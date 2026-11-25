import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../games/tank-maze/modules/maps.js';
import {
  MAX_AMMO, MAX_HEALTH, SHELL_RADIUS, STAT_KEYS, STEP, TANK_RADIUS, WINS,
  canFire, collidesCircle, createMatch, nextRound, readMatchStats, recordMatchStats,
  rules, stepMatch, traceAimRay, wouldReturnToShooter,
} from '../games/tank-maze/modules/engine.js';
import { AI_DIFFICULTIES, createAI } from '../games/tank-maze/modules/ai.js';
import { createRenderer, drawMapPreview, drawTankPreview } from '../games/tank-maze/modules/renderer.js';

function advanceMatch(match, seconds, inputs = [{}, {}]) {
  const step = 0.05;
  const count = Math.round(seconds / step);
  const events = [];
  for (let i = 0; i < count; i++) {
    stepMatch(match, inputs, step);
    events.push(...match.events);
  }
  const remainder = seconds - count * step;
  if (remainder > 1e-6) {
    stepMatch(match, inputs, remainder);
    events.push(...match.events);
  }
  return events;
}

function reachableCells(map, startPoint) {
  const gridStep = 0.5;
  const maxCol = Math.ceil(map.width / gridStep) - 1;
  const maxRow = Math.ceil(map.height / gridStep) - 1;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const toCell = (p) => ({
    col: clamp(Math.floor(p.x / gridStep), 0, maxCol),
    row: clamp(Math.floor(p.y / gridStep), 0, maxRow),
  });
  const toPoint = (c) => ({ x: (c.col + 0.5) * gridStep, y: (c.row + 0.5) * gridStep });
  const walkable = (c) => {
    const p = toPoint(c);
    return p.x > TANK_RADIUS && p.x < map.width - TANK_RADIUS
      && p.y > TANK_RADIUS && p.y < map.height - TANK_RADIUS
      && !collidesCircle(map, p.x, p.y, TANK_RADIUS + 0.02);
  };
  const key = (c) => `${c.col},${c.row}`;

  let start = toCell(startPoint);
  if (!walkable(start)) {
    const candidates = [];
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const c = { col: start.col + dc, row: start.row + dr };
        if (walkable(c)) candidates.push(c);
      }
    }
    assert.ok(candidates.length > 0, `${map.id} spawn must be near a walkable cell`);
    start = candidates[0];
  }

  const visited = new Set([key(start)]);
  const queue = [start];
  const dirs = [{ col: 1, row: 0 }, { col: -1, row: 0 }, { col: 0, row: 1 }, { col: 0, row: -1 }];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const d of dirs) {
      const next = { col: cur.col + d.col, row: cur.row + d.row };
      const k = key(next);
      if (!visited.has(k) && walkable(next)) {
        visited.add(k);
        queue.push(next);
      }
    }
  }
  return { visited, toCell, walkable };
}

test('all Tank Maze maps have clear spawns, repair spots, patrol points, and full connectivity', () => {
  assert.equal(MAPS.length, 5);
  assert.deepEqual(MAPS.map((m) => m.id), ['lanes', 'corners', 'loop', 'garden', 'outpost']);

  for (const map of MAPS) {
    assert.ok(map.width > 0 && map.height > 0);
    assert.equal(map.spawns.length, 2);
    for (const spawn of map.spawns) {
      assert.equal(collidesCircle(map, spawn.x, spawn.y, TANK_RADIUS), false, `${map.id} spawn collides`);
    }
    assert.equal(collidesCircle(map, map.repair.x, map.repair.y, 0.2), false, `${map.id} repair collides`);
    assert.ok(map.patrol.length > 0, `${map.id} patrol list non-empty`);
    for (const pt of map.patrol) {
      assert.ok(pt.x > 0 && pt.x < map.width && pt.y > 0 && pt.y < map.height, `${map.id} patrol in bounds`);
      assert.equal(collidesCircle(map, pt.x, pt.y, TANK_RADIUS), false, `${map.id} patrol collides`);
    }

    const { visited, toCell, walkable } = reachableCells(map, map.spawns[0]);
    const goalKey = (pt) => {
      const c = toCell(pt);
      if (walkable(c)) return `${c.col},${c.row}`;
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const adj = { col: c.col + dc, row: c.row + dr };
          if (walkable(adj)) return `${adj.col},${adj.row}`;
        }
      }
      return null;
    };

    const spawn1Key = goalKey(map.spawns[1]);
    const repairKey = goalKey(map.repair);
    assert.ok(spawn1Key && visited.has(spawn1Key), `${map.id}: spawn[0] must reach spawn[1]`);
    assert.ok(repairKey && visited.has(repairKey), `${map.id}: spawn[0] must reach repair`);
  }
});

test('ammo consumption, shot cooldown blocking, and full reload recharge', () => {
  const match = createMatch('lanes');
  const tank = match.tanks[0];
  tank.x = 2.0;
  tank.y = 1.5;
  tank.angle = 0;

  assert.equal(tank.ammo, MAX_AMMO);
  assert.equal(canFire(tank), true);

  // First shot consumes 1 ammo and triggers cooldown + recharge timer
  stepMatch(match, [{ fire: true }, {}], STEP);
  assert.equal(tank.ammo, MAX_AMMO - 1);
  assert.ok(tank.cooldown > 0);
  assert.ok(tank.reload > 0);
  assert.equal(canFire(tank), false);
  assert.ok(match.events.some((e) => e.type === 'shot' && e.owner === 0));

  // Rapid fire while on cooldown does not fire another shell
  const shellCountBefore = match.shells.length;
  stepMatch(match, [{ fire: true }, {}], STEP);
  assert.equal(match.shells.length, shellCountBefore);
  assert.equal(tank.ammo, MAX_AMMO - 1);

  // Waiting past AMMO_RECHARGE restores full ammo and clears reload timer
  advanceMatch(match, rules.AMMO_RECHARGE + 0.05);
  assert.equal(tank.ammo, MAX_AMMO);
  assert.equal(tank.reload, 0);
  assert.equal(canFire(tank), true);
});

test('shell ricochets off walls, skips unbounced owner, and hits owner after bounce', () => {
  const match = createMatch('lanes');
  const shooter = match.tanks[0];
  const other = match.tanks[1];
  // Move other tank out of the way
  other.x = 20.0;
  other.y = 13.0;

  // Facing open space along top lane: unbounced shot never hits shooter, wouldReturnToShooter is false
  shooter.x = 2.0;
  shooter.y = 1.5;
  shooter.angle = 0;
  assert.equal(wouldReturnToShooter(match.map, shooter, 0), false);
  stepMatch(match, [{ drive: 1, fire: true }, {}], STEP);
  advanceMatch(match, 0.3, [{ drive: 1 }, {}]);
  assert.equal(shooter.health, MAX_HEALTH);

  // Facing left boundary wall at close range: bounces and hits shooter
  const bounceMatch = createMatch('lanes');
  const t0 = bounceMatch.tanks[0];
  bounceMatch.tanks[1].x = 20.0;
  bounceMatch.tanks[1].y = 13.0;
  t0.x = 1.0;
  t0.y = 1.5;
  t0.angle = Math.PI;
  assert.equal(wouldReturnToShooter(bounceMatch.map, t0, Math.PI), true);

  let bounced = false;
  let selfKnockoutEvents = [];
  for (let roundShot = 0; roundShot < MAX_HEALTH; roundShot++) {
    stepMatch(bounceMatch, [{ fire: true }, {}], STEP);
    const ev = advanceMatch(bounceMatch, 0.9);
    if (ev.some((e) => e.type === 'bounce' && e.owner === 0)) bounced = true;
    selfKnockoutEvents.push(...ev);
    if (bounceMatch.result) break;
  }

  assert.equal(bounced, true);
  assert.ok(selfKnockoutEvents.some((e) => e.type === 'hit' && e.owner === 0 && e.target === 0));
  assert.deepEqual(bounceMatch.result, { winner: 1, hits: [0], selfHit: true });
  assert.deepEqual(bounceMatch.scores, [0, 1]);
});

test('hit protection blocks rapid follow-up damage and repair pickup heals damaged tank only', () => {
  const match = createMatch('lanes');
  const p0 = match.tanks[0];
  const p1 = match.tanks[1];
  p0.x = 2.0;
  p0.y = 1.5;
  p0.angle = 0;
  p1.x = 4.5;
  p1.y = 1.5;
  p1.angle = Math.PI;

  assert.equal(match.repair, null);

  // First hit reduces p1 health to 2, grants HIT_PROTECTION, and spawns repair kit
  stepMatch(match, [{ fire: true }, {}], STEP);
  const firstEvents = advanceMatch(match, 0.3);
  assert.equal(p1.health, MAX_HEALTH - 1);
  assert.ok(p1.protection > 0);
  assert.ok(match.repair && match.repair.takenBy === null);
  assert.ok(firstEvents.some((e) => e.type === 'repair-spawn'));

  // Wait past shot cooldown (0.52s) while still inside HIT_PROTECTION (0.8s)
  // Place a shell directly right in front of p1 before protection expires
  advanceMatch(match, 0.25); // elapsed ~0.55s since shot -> protection still > 0, cooldown ready
  p0.x = 3.7;
  p0.y = 1.5;
  stepMatch(match, [{ fire: true }, {}], STEP);
  advanceMatch(match, 0.08);
  // Shell consumed by protection without reducing health
  assert.equal(p1.health, MAX_HEALTH - 1);
  assert.equal(match.shells.length, 0);

  // Wait for protection to expire and verify another hit deals damage
  advanceMatch(match, rules.HIT_PROTECTION);
  assert.equal(p1.protection, 0);
  p0.x = 3.7;
  stepMatch(match, [{ fire: true }, {}], STEP);
  advanceMatch(match, 0.15);
  assert.equal(p1.health, MAX_HEALTH - 2);

  // Full-health p0 standing on repair does NOT consume it
  p0.x = match.repair.x;
  p0.y = match.repair.y;
  stepMatch(match, [{}, {}], STEP);
  assert.equal(match.repair.takenBy, null);
  assert.equal(p0.health, MAX_HEALTH);

  // Damaged p1 moving onto repair heals +1 and claims it
  p1.x = match.repair.x + 0.1;
  p1.y = match.repair.y;
  stepMatch(match, [{}, {}], STEP);
  assert.equal(p1.health, MAX_HEALTH - 1);
  assert.equal(match.repair.takenBy, 1);
  assert.ok(match.events.some((e) => e.type === 'repair' && e.target === 1));
});

test('best-of-3 match progression swaps spawns per round and stops after WINS', () => {
  const match = createMatch('lanes');
  const initialSpawn0 = { ...match.tanks[0] };
  const initialSpawn1 = { ...match.tanks[1] };

  function knockOutTank1() {
    const p0 = match.tanks[0];
    const p1 = match.tanks[1];
    p0.x = 3.0;
    p0.y = 1.5;
    p0.angle = 0;
    p1.x = 4.2;
    p1.y = 1.5;
    for (let i = 0; i < MAX_HEALTH; i++) {
      p0.cooldown = 0;
      p1.protection = 0;
      stepMatch(match, [{ fire: true }, {}], STEP);
      advanceMatch(match, 0.25);
      if (match.result) break;
    }
  }

  // Round 1
  knockOutTank1();
  assert.equal(match.result.winner, 0);
  assert.deepEqual(match.scores, [1, 0]);
  assert.equal(match.winner, null);
  assert.equal(match.shells.length, 0);

  // stepMatch while round is decided is a no-op
  const frozenRound = match.round;
  stepMatch(match, [{ drive: 1 }, {}], 0.1);
  assert.equal(match.round, frozenRound);
  assert.equal(match.events.length, 0);

  // Advance to Round 2 -> spawns flip
  nextRound(match);
  assert.equal(match.round, 2);
  assert.equal(match.spawnFlip, true);
  assert.equal(match.result, null);
  assert.equal(match.repair, null);
  assert.equal(match.tanks[0].x, initialSpawn1.x);
  assert.equal(match.tanks[1].x, initialSpawn0.x);
  assert.equal(match.tanks[0].health, MAX_HEALTH);
  assert.equal(match.tanks[1].health, MAX_HEALTH);

  // Round 2 win reaches WINS (2) and ends the match
  knockOutTank1();
  assert.equal(match.scores[0], WINS);
  assert.equal(match.winner, 0);

  // nextRound and stepMatch after match winner are no-ops
  nextRound(match);
  assert.equal(match.round, 2);
  assert.equal(match.winner, 0);
  stepMatch(match, [{ drive: 1, fire: true }, {}], 0.1);
  assert.equal(match.shells.length, 0);
});

test('AI difficulties, idle on finished match, shell dodging, self-hit guard, and simulation stability', () => {
  assert.deepEqual(AI_DIFFICULTIES, ['easy', 'normal', 'hard']);

  // Idle when round/match finished
  const finished = createMatch('lanes');
  finished.result = { winner: 0, hits: [1], selfHit: false };
  const idleAi = createAI('normal');
  assert.deepEqual(idleAi(finished, STEP), { drive: 0, turn: 0, fire: false });

  // Dodges incoming shell with clear LOS
  const dodgeMatch = createMatch('lanes');
  dodgeMatch.tanks[0].x = 2.0;
  dodgeMatch.tanks[0].y = 1.5;
  dodgeMatch.tanks[1].x = 8.0;
  dodgeMatch.tanks[1].y = 1.5;
  dodgeMatch.tanks[1].angle = Math.PI;
  dodgeMatch.shells.push({
    x: 6.0, y: 1.5, vx: rules.SHELL_SPEED, vy: 0, owner: 0, bounces: 0, life: 5.0,
  });
  const dodgeAi = createAI('normal');
  const dodgeCmd = dodgeAi(dodgeMatch, 0.05);
  assert.equal(dodgeCmd.drive, -1);
  assert.equal(dodgeCmd.fire, false);
  assert.ok(dodgeCmd.turn === 1 || dodgeCmd.turn === -1);

  // Suppresses unsafe shot that would ricochet straight back to shooter
  const guardMatch = createMatch('lanes');
  const bot = guardMatch.tanks[1];
  const enemy = guardMatch.tanks[0];
  bot.x = 20.5;
  bot.y = 1.5;
  bot.angle = 0;
  enemy.x = 22.1;
  enemy.y = 1.5;
  assert.equal(wouldReturnToShooter(guardMatch.map, bot, 0), true);

  const guardAi = createAI('normal');
  // Warm up reaction time (> 0.19s) while maintaining alignment
  let lastCmd = null;
  for (let i = 0; i < 6; i++) {
    lastCmd = guardAi(guardMatch, 0.05);
  }
  assert.equal(lastCmd.fire, false);
  assert.equal(lastCmd.drive, -1);

  // Short simulation loop produces valid finite commands
  const simMatch = createMatch('corners');
  const simAi = createAI('hard');
  for (let i = 0; i < 60; i++) {
    const cmd = simAi(simMatch, STEP);
    assert.ok(Number.isFinite(cmd.drive) && cmd.drive >= -1 && cmd.drive <= 1);
    assert.ok(Number.isFinite(cmd.turn) && cmd.turn >= -1 && cmd.turn <= 1);
    assert.equal(typeof cmd.fire, 'boolean');
    stepMatch(simMatch, [{ drive: 0.5, turn: 0.2, fire: false }, cmd], STEP);
  }
});

test('stationary Q/E fine-turn, shield-block/knockout events, aim raycast, and difficulty streak stats', () => {
  // Stationary turn via move:{x:0,y:0} + turn
  const match = createMatch('lanes');
  const p0 = match.tanks[0];
  const p1 = match.tanks[1];
  const initialAngle = p0.angle;
  stepMatch(match, [{ move: { x: 0, y: 0 }, turn: 0.72, fire: false }, {}], 0.1);
  assert.ok(p0.angle > initialAngle, 'stationary positive turn rotates clockwise');
  stepMatch(match, [{ move: { x: 0, y: 0 }, turn: -0.72, fire: false }, {}], 0.2);
  assert.ok(p0.angle < initialAngle, 'stationary negative turn rotates counter-clockwise');

  // Trace aim ray: straight corridor vs wall bounce
  p0.x = 2.0;
  p0.y = 1.5;
  p0.angle = 0;
  const openRay = traceAimRay(match.map, p0, 4.0, 1.0);
  assert.equal(openRay.hitWall, false);
  assert.equal(openRay.bounceEnd, null);
  assert.ok(openRay.end.x > openRay.start.x + 3.5);

  p0.x = 1.5;
  p0.y = 1.0;
  p0.angle = -Math.PI / 4;
  const bankRay = traceAimRay(match.map, p0, 4.6, 1.15);
  assert.equal(bankRay.hitWall, true);
  assert.ok(bankRay.bounceEnd && bankRay.bounceEnd.y > bankRay.end.y);

  // shield-block and knockout events
  p0.x = 2.0;
  p0.y = 1.5;
  p0.angle = 0;
  p1.x = 3.2;
  p1.y = 1.5;
  p1.protection = 0.5;
  stepMatch(match, [{ fire: true }, {}], STEP);
  const blockEvents = advanceMatch(match, 0.25);
  assert.ok(blockEvents.some((e) => e.type === 'shield-block' && e.target === 1));
  assert.equal(p1.health, MAX_HEALTH);

  p1.health = 1;
  p1.protection = 0;
  p0.cooldown = 0;
  stepMatch(match, [{ fire: true }, {}], STEP);
  const koEvents = advanceMatch(match, 0.25);
  assert.ok(koEvents.some((e) => e.type === 'knockout' && e.target === 1));

  // Stats helpers
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  assert.deepEqual(readMatchStats(storage, 'hard'), {
    totalWins: 0, difficultyWins: 0, currentStreak: 0, bestStreak: 0,
  });
  const s1 = recordMatchStats(storage, 'hard', true);
  assert.deepEqual(s1, { totalWins: 1, difficultyWins: 1, currentStreak: 1, bestStreak: 1 });
  const s2 = recordMatchStats(storage, 'hard', true);
  assert.deepEqual(s2, { totalWins: 2, difficultyWins: 2, currentStreak: 2, bestStreak: 2 });
  const s3 = recordMatchStats(storage, 'normal', false);
  assert.deepEqual(s3, { totalWins: 2, difficultyWins: 0, currentStreak: 0, bestStreak: 2 });
  assert.equal(storage.getItem(STAT_KEYS.wins), '2');
  assert.equal(storage.getItem(STAT_KEYS.winsByDifficulty('hard')), '2');
  assert.equal(storage.getItem(STAT_KEYS.bestStreak), '2');
});

test('tank-maze renderer handles all event types, skins, previews, and themes safely', () => {
  const noop = () => {};
  function makeCtx() {
    return {
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      lineCap: 'butt',
      globalAlpha: 1,
      setTransform: noop,
      drawImage: noop,
      fillRect: noop,
      strokeRect: noop,
      rect: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      arc: noop,
      arcTo: noop,
      closePath: noop,
      fill: noop,
      stroke: noop,
      save: noop,
      restore: noop,
      translate: noop,
      rotate: noop,
      scale: noop,
      setLineDash: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
    };
  }
  function makeCanvas() {
    return {
      width: 690,
      height: 450,
      getBoundingClientRect: () => ({ width: 690, height: 450 }),
      getContext: () => makeCtx(),
    };
  }

  const prevWindow = globalThis.window;
  const prevDoc = globalThis.document;
  const prevMatchMedia = globalThis.matchMedia;
  const docEl = { dataset: { theme: 'light' } };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.document = {
    documentElement: docEl,
    createElement: () => makeCanvas(),
  };
  globalThis.matchMedia = () => ({ matches: false });

  try {
    const renderer = createRenderer(makeCanvas());
    assert.ok(renderer);
    const match = createMatch('outpost');
    match.repair = { ...match.map.repair, takenBy: null };
    match.tanks[1].protection = 0.4;
    match.shells.push({ x: 3, y: 8.5, vx: 7.5, vy: 0, owner: 0, bounces: 0, life: 4 });

    renderer.announceSpawn();
    renderer.addEvents([
      { type: 'shot', x: 2.2, y: 8.5, owner: 0 },
      { type: 'bounce', x: 5, y: 8.5, owner: 0, bounces: 1 },
      { type: 'shield-block', x: 10, y: 8.5, owner: 0, target: 1 },
      { type: 'hit', x: 10, y: 8.5, owner: 0, target: 1 },
      { type: 'knockout', x: 10, y: 8.5, owner: 0, target: 1 },
      { type: 'repair-spawn', x: match.repair.x, y: match.repair.y },
      { type: 'repair', x: match.repair.x, y: match.repair.y, target: 0 },
    ]);
    assert.equal(renderer.hasEffects(), true);

    for (const theme of ['light', 'dark']) {
      docEl.dataset.theme = theme;
      renderer.draw(match, 0.05, { playerSkin: 'wedge', aiSkin: 'cabin', showAim: true });
    }
    for (const map of MAPS) drawMapPreview(makeCanvas(), map);
    for (const skin of ['standard', 'wedge', 'cabin']) drawTankPreview(makeCanvas(), skin);
    renderer.clear();
    assert.equal(renderer.hasEffects(), false);
  } finally {
    globalThis.window = prevWindow;
    globalThis.document = prevDoc;
    globalThis.matchMedia = prevMatchMedia;
  }
});
