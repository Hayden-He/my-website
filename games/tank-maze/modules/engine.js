import { MAPS } from './maps.js';

export { MAPS };

// Deterministic rules for Tank Maze. Coordinates are measured in map units.
export const STEP = 1 / 120;
export const TANK_RADIUS = 0.30;
export const SHELL_RADIUS = 0.095;
export const WINS = 2;
export const MAX_HEALTH = 3;
export const MAX_AMMO = 3;

const TANK_SPEED = 3.25;
const TURN_SPEED = 3.65;
const SHELL_SPEED = 7.5;
const SHELL_LIFE = 5.5;
const SHOT_COOLDOWN = 0.52;
const AMMO_RECHARGE = 1.8;
const HIT_PROTECTION = 0.8;
const REPAIR_RADIUS = 0.36;
const EPSILON = 1e-7;

function resolveMap(map) {
  if (!map) return MAPS[0];
  if (typeof map === 'string') return MAPS.find((item) => item.id === map) || MAPS[0];
  return MAPS.includes(map) ? map : MAPS.find((item) => item.id === map.id) || MAPS[0];
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function circleRectDistanceSquared(x, y, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  return (x - cx) ** 2 + (y - cy) ** 2;
}

export function collidesCircle(mapInput, x, y, radius = 0) {
  const map = resolveMap(mapInput);
  if (x - radius < 0 || x + radius > map.width || y - radius < 0 || y + radius > map.height) return true;
  return map.walls.some((wall) => circleRectDistanceSquared(x, y, wall) <= (radius + EPSILON) ** 2);
}

function collidesTank(map, x, y, radius, other) {
  if (collidesCircle(map, x, y, radius)) return true;
  if (!other) return false;
  return (x - other.x) ** 2 + (y - other.y) ** 2 < (radius + TANK_RADIUS) ** 2;
}

function segmentClear(mapInput, x1, y1, x2, y2, radius = 0.03) {
  const map = resolveMap(mapInput);
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(distance / 0.08));
  for (let i = 1; i <= steps; i++) {
    const ratio = i / steps;
    if (collidesCircle(map, x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio, radius)) return false;
  }
  return true;
}

export function hasLineOfSight(mapInput, from, to) {
  return segmentClear(mapInput, from.x, from.y, to.x, to.y, 0.05);
}

function sanitizeInput(input) {
  const move = input?.move;
  return {
    move: Number.isFinite(move?.x) && Number.isFinite(move?.y) ? move : null,
    drive: clamp(Number.isFinite(input?.drive) ? input.drive : 0, -1, 1),
    turn: clamp(Number.isFinite(input?.turn) ? input.turn : 0, -1, 1),
    fire: Boolean(input?.fire),
  };
}

function createTank(spawn, id) {
  return {
    id, x: spawn.x, y: spawn.y, angle: spawn.angle, cooldown: 0,
    vx: 0, vy: 0, health: MAX_HEALTH, protection: 0, ammo: MAX_AMMO, reload: 0, active: true,
  };
}

function resetRound(match) {
  const spawns = match.spawnFlip ? [match.map.spawns[1], match.map.spawns[0]] : match.map.spawns;
  match.tanks = [createTank(spawns[0], 0), createTank(spawns[1], 1)];
  match.shells = [];
  match.repair = null;
  match.result = null;
  match.events = [];
}

export function createMatch(map = MAPS[0]) {
  const match = {
    map: resolveMap(map), tanks: [], shells: [], scores: [0, 0], round: 1,
    spawnFlip: false, result: null, winner: null, events: [],
  };
  resetRound(match);
  return match;
}

export function nextRound(match) {
  if (!match?.result || match.winner !== null) return match;
  match.round += 1;
  match.spawnFlip = !match.spawnFlip;
  resetRound(match);
  return match;
}

function moveTank(match, tank, input, dt) {
  let dx;
  let dy;
  if (input.move) {
    const { x, y } = input.move;
    const length = Math.hypot(x, y);
    if (length > 0) tank.angle = Math.atan2(y, x);
    else if (input.turn) tank.angle = wrapAngle(tank.angle + input.turn * TURN_SPEED * dt);
    const scale = TANK_SPEED * dt / Math.max(1, length);
    dx = x * scale;
    dy = y * scale;
  } else {
    tank.angle = wrapAngle(tank.angle + input.turn * TURN_SPEED * dt);
    const travel = input.drive * TANK_SPEED * dt;
    dx = Math.cos(tank.angle) * travel;
    dy = Math.sin(tank.angle) * travel;
  }
  const other = match.tanks[1 - tank.id];
  let nx = tank.x;
  let ny = tank.y;
  if (!collidesTank(match.map, nx + dx, ny, TANK_RADIUS, other)) nx += dx;
  if (!collidesTank(match.map, nx, ny + dy, TANK_RADIUS, other)) ny += dy;
  tank.vx = (nx - tank.x) / Math.max(dt, STEP);
  tank.vy = (ny - tank.y) / Math.max(dt, STEP);
  tank.x = nx;
  tank.y = ny;
}

export function canFire(tank, elapsed = 0) {
  return tank.cooldown <= elapsed + EPSILON &&
    (tank.ammo > 0 || (elapsed > 0 && tank.reload <= elapsed + EPSILON));
}

function findMuzzleDistance(map, tank, angle) {
  const nose = TANK_RADIUS + SHELL_RADIUS + 0.04;
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  let muzzleDistance = nose;
  // A tank can be pressed against a corner. Find the last clear point along
  // the barrel so a shot starts outside the wall and can immediately bounce.
  while (muzzleDistance > 0 && collidesCircle(
    map, tank.x + directionX * muzzleDistance, tank.y + directionY * muzzleDistance, SHELL_RADIUS
  )) muzzleDistance -= 0.02;
  return muzzleDistance;
}

function createShell(map, tank, angle) {
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const muzzleDistance = findMuzzleDistance(map, tank, angle);
  const x = tank.x + directionX * muzzleDistance;
  const y = tank.y + directionY * muzzleDistance;
  return {
    x, y, vx: directionX * SHELL_SPEED, vy: directionY * SHELL_SPEED,
    owner: tank.id, bounces: 0, life: SHELL_LIFE,
  };
}

export function traceAimRay(mapInput, tank, maxLength = 4.6, bounceLength = 1.15) {
  if (!tank) return null;
  const map = resolveMap(mapInput);
  const dx = Math.cos(tank.angle);
  const dy = Math.sin(tank.angle);
  const muzzleDistance = findMuzzleDistance(map, tank, tank.angle);
  const start = {
    x: tank.x + dx * muzzleDistance,
    y: tank.y + dy * muzzleDistance,
  };
  let x = start.x;
  let y = start.y;
  let hitWall = false;
  let bounceDx = dx;
  let bounceDy = dy;
  const totalSteps = Math.max(1, Math.ceil(maxLength / 0.05));
  const ds = maxLength / totalSteps;
  for (let i = 0; i < totalSteps; i++) {
    const nx = x + dx * ds;
    const ny = y + dy * ds;
    let hitX = collidesCircle(map, nx, y, SHELL_RADIUS);
    let hitY = collidesCircle(map, x, ny, SHELL_RADIUS);
    if (!hitX && !hitY && collidesCircle(map, nx, ny, SHELL_RADIUS)) {
      hitX = true;
      hitY = true;
    }
    if (hitX || hitY) {
      hitWall = true;
      if (hitX) bounceDx *= -1;
      if (hitY) bounceDy *= -1;
      break;
    }
    x = nx;
    y = ny;
  }
  const end = { x, y };
  let bounceEnd = null;
  if (hitWall && bounceLength > 0) {
    let bx = x;
    let by = y;
    const bSteps = Math.max(1, Math.ceil(bounceLength / 0.05));
    const bds = bounceLength / bSteps;
    for (let i = 0; i < bSteps; i++) {
      const nx = bx + bounceDx * bds;
      const ny = by + bounceDy * bds;
      if (collidesCircle(map, nx, ny, SHELL_RADIUS)) break;
      bx = nx;
      by = ny;
    }
    if (Math.hypot(bx - x, by - y) > 0.05) bounceEnd = { x: bx, y: by };
  }
  return { start, end, hitWall, bounceEnd };
}

function fire(match, tank) {
  if (!canFire(tank)) return;
  const shell = createShell(match.map, tank, tank.angle);
  match.shells.push(shell);
  if (tank.ammo === MAX_AMMO) tank.reload = AMMO_RECHARGE;
  tank.ammo -= 1;
  tank.cooldown = SHOT_COOLDOWN;
  match.events.push({ type: 'shot', x: shell.x, y: shell.y, owner: tank.id });
}

function moveShell(map, shell, dt) {
  const oldX = shell.x;
  const oldY = shell.y;
  const nextX = shell.x + shell.vx * dt;
  const nextY = shell.y + shell.vy * dt;
  let hitX = collidesCircle(map, nextX, oldY, SHELL_RADIUS);
  let hitY = collidesCircle(map, oldX, nextY, SHELL_RADIUS);
  if (!hitX && !hitY && collidesCircle(map, nextX, nextY, SHELL_RADIUS)) {
    hitX = true;
    hitY = true;
  }
  if (hitX) shell.vx *= -1;
  if (hitY) shell.vy *= -1;
  shell.x = hitX ? oldX : nextX;
  shell.y = hitY ? oldY : nextY;
  if (hitX || hitY) shell.bounces += 1;
  shell.life -= dt;
  return hitX || hitY;
}

// Use the real muzzle and ricochet rules to predict a quick return to this pose.
export function wouldReturnToShooter(map, tank, angle, horizon = 1.2) {
  const shell = createShell(map, tank, angle);
  const reachSquared = (TANK_RADIUS + SHELL_RADIUS) ** 2;
  const steps = Math.ceil(Math.min(horizon, SHELL_LIFE) / STEP);
  for (let step = 0; step < steps; step++) {
    moveShell(map, shell, STEP);
    if (shell.bounces > 0 && (shell.x - tank.x) ** 2 + (shell.y - tank.y) ** 2 <= reachSquared) return true;
  }
  return false;
}

function settleHits(match) {
  const knockouts = [];
  let selfHit = false;
  match.shells = match.shells.filter((shell) => {
    let target = null;
    let nearest = (SHELL_RADIUS + TANK_RADIUS) ** 2;
    for (const tank of match.tanks) {
      if (!tank.active) continue;
      // The muzzle is intentionally close to the firing tank. A shell only
      // becomes dangerous to its owner after its first wall bounce.
      if (tank.id === shell.owner && shell.bounces === 0) continue;
      const distance = (shell.x - tank.x) ** 2 + (shell.y - tank.y) ** 2;
      if (distance > nearest) continue;
      nearest = distance;
      target = tank;
    }
    if (!target) return shell.life > 0;
    if (target.protection > 0) {
      match.events.push({ type: 'shield-block', x: shell.x, y: shell.y, owner: shell.owner, target: target.id });
      return false;
    }
    target.health -= 1;
    match.events.push({ type: 'hit', x: shell.x, y: shell.y, owner: shell.owner, target: target.id });
    if (target.health === 0) {
      target.active = false;
      knockouts.push(target.id);
      selfHit ||= target.id === shell.owner;
      match.events.push({ type: 'knockout', x: target.x, y: target.y, owner: shell.owner, target: target.id });
    } else {
      target.protection = HIT_PROTECTION;
    }
    return false;
  });
  if (!knockouts.length) return;
  const winner = knockouts.length === 2 ? null : 1 - knockouts[0];
  match.result = { winner, hits: knockouts, selfHit };
  if (winner === null) {
    match.events.push({ type: 'draw', x: (match.tanks[0].x + match.tanks[1].x) / 2, y: (match.tanks[0].y + match.tanks[1].y) / 2 });
  } else {
    match.scores[winner] += 1;
    match.events.push({ type: 'roundEnd', winner, score: [...match.scores] });
    if (match.scores[winner] >= WINS) match.winner = winner;
  }
  match.shells = [];
}

function updateRepair(match) {
  if (match.result) return;
  if (!match.repair) {
    if (match.tanks.some(({ health }) => health < MAX_HEALTH)) {
      match.repair = { ...match.map.repair, takenBy: null };
      match.events.push({ type: 'repair-spawn', x: match.repair.x, y: match.repair.y });
    }
    return;
  }
  const { repair } = match;
  if (repair.takenBy !== null) return;
  const reach = TANK_RADIUS + REPAIR_RADIUS;
  let nearest = Infinity;
  let recipient = null;
  for (const tank of match.tanks) {
    if (!tank.active || tank.health >= MAX_HEALTH) continue;
    const distance = Math.hypot(tank.x - repair.x, tank.y - repair.y);
    if (distance > reach) continue;
    if (Math.abs(distance - nearest) <= EPSILON) {
      recipient = null;
    } else if (distance < nearest) {
      recipient = tank;
      nearest = distance;
    }
  }
  if (!recipient) return;
  recipient.health += 1;
  repair.takenBy = recipient.id;
  match.events.push({ type: 'repair', target: recipient.id, x: repair.x, y: repair.y });
}

function stepOnce(match, inputs, dt) {
  for (const tank of match.tanks) {
    tank.cooldown = Math.max(0, tank.cooldown - dt);
    tank.protection = tank.protection - dt > EPSILON ? tank.protection - dt : 0;
    if (tank.ammo < MAX_AMMO) {
      tank.reload -= dt;
      if (tank.reload <= EPSILON) {
        tank.ammo += 1;
        tank.reload = tank.ammo === MAX_AMMO ? 0 : AMMO_RECHARGE + tank.reload;
      }
    }
  }
  for (let index = 0; index < match.tanks.length; index++) {
    const input = sanitizeInput(inputs[index]);
    const tank = match.tanks[index];
    moveTank(match, tank, input, dt);
    if (input.fire) fire(match, tank);
  }
  for (const shell of match.shells) {
    if (moveShell(match.map, shell, dt)) {
      match.events.push({ type: 'bounce', x: shell.x, y: shell.y, owner: shell.owner, bounces: shell.bounces });
    }
  }
  settleHits(match);
  updateRepair(match);
}

export function stepMatch(match, inputs = [], dt = STEP) {
  if (!match || match.winner !== null || match.result) {
    if (match) match.events = [];
    return match;
  }
  match.events = [];
  const total = Math.max(0, Math.min(Number.isFinite(dt) ? dt : STEP, 0.2));
  if (total === 0) return match;
  const steps = Math.ceil(total / STEP);
  const slice = total / steps;
  for (let index = 0; index < steps; index++) {
    if (match.result || match.winner !== null) break;
    stepOnce(match, inputs, slice);
  }
  return match;
}

export function angleDifference(from, to) { return wrapAngle(to - from); }

export const rules = Object.freeze({
  TANK_SPEED, TURN_SPEED, SHELL_SPEED, SHELL_LIFE, SHOT_COOLDOWN, AMMO_RECHARGE,
  HIT_PROTECTION, REPAIR_RADIUS,
});

export const STAT_KEYS = Object.freeze({
  wins: 'game_best_tank-maze_wins',
  winsByDifficulty: (difficulty) => `game_best_tank-maze_wins_${difficulty}`,
  bestStreak: 'game_best_tank-maze_streak',
  currentStreak: 'game_save_tank-maze_streak',
});

const VALID_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);

function readNonNegInt(storage, key) {
  if (!storage) return 0;
  try {
    const value = parseInt(storage.getItem(key) || '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function readMatchStats(storage, difficulty = 'normal') {
  const diff = VALID_DIFFICULTIES.has(difficulty) ? difficulty : 'normal';
  return {
    totalWins: readNonNegInt(storage, STAT_KEYS.wins),
    difficultyWins: readNonNegInt(storage, STAT_KEYS.winsByDifficulty(diff)),
    currentStreak: readNonNegInt(storage, STAT_KEYS.currentStreak),
    bestStreak: readNonNegInt(storage, STAT_KEYS.bestStreak),
  };
}

export function recordMatchStats(storage, difficulty = 'normal', playerWon = false) {
  const diff = VALID_DIFFICULTIES.has(difficulty) ? difficulty : 'normal';
  const current = readMatchStats(storage, diff);
  const next = playerWon
    ? {
        totalWins: current.totalWins + 1,
        difficultyWins: current.difficultyWins + 1,
        currentStreak: current.currentStreak + 1,
        bestStreak: Math.max(current.bestStreak, current.currentStreak + 1),
      }
    : {
        totalWins: current.totalWins,
        difficultyWins: current.difficultyWins,
        currentStreak: 0,
        bestStreak: current.bestStreak,
      };
  if (storage) {
    try {
      storage.setItem(STAT_KEYS.currentStreak, String(next.currentStreak));
      if (playerWon) {
        storage.setItem(STAT_KEYS.wins, String(next.totalWins));
        storage.setItem(STAT_KEYS.winsByDifficulty(diff), String(next.difficultyWins));
        storage.setItem(STAT_KEYS.bestStreak, String(next.bestStreak));
      }
    } catch {}
  }
  return next;
}
