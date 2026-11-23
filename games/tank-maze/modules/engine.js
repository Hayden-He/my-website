// Deterministic rules for Tank Maze. Coordinates are measured in map units.
export const STEP = 1 / 120;
export const TANK_RADIUS = 0.30;
export const SHELL_RADIUS = 0.095;
export const WINS = 3;

const TANK_SPEED = 3.25;
const TURN_SPEED = 3.65;
const SHELL_SPEED = 9.5;
const SHELL_LIFE = 5.5;
const SHOT_COOLDOWN = 0.52;
const EPSILON = 1e-7;

// Walls are interior rectangles. The map boundary is an implicit wall so that
// every stage has a complete enclosure without repeating four extra rectangles.
export const MAPS = Object.freeze([
  Object.freeze({
    id: 'lanes', width: 15, height: 11,
    walls: Object.freeze([
      { x: 4, y: 1, w: 1, h: 3 }, { x: 4, y: 7, w: 1, h: 3 },
      { x: 10, y: 1, w: 1, h: 3 }, { x: 10, y: 7, w: 1, h: 3 },
      { x: 7, y: 3, w: 1, h: 5 },
    ]),
    spawns: Object.freeze([{ x: 2, y: 5.5, angle: 0 }, { x: 13, y: 5.5, angle: Math.PI }]),
  }),
  Object.freeze({
    id: 'corners', width: 15, height: 11,
    walls: Object.freeze([
      { x: 3, y: 2, w: 5, h: 1 }, { x: 7, y: 2, w: 1, h: 3 },
      { x: 7, y: 7, w: 1, h: 2 }, { x: 4, y: 8, w: 5, h: 1 },
      { x: 10, y: 2, w: 2, h: 1 }, { x: 11, y: 3, w: 1, h: 4 },
      { x: 9, y: 8, w: 3, h: 1 }, { x: 3, y: 5, w: 2, h: 1 },
    ]),
    spawns: Object.freeze([{ x: 1.8, y: 1.3, angle: 0.15 }, { x: 13.2, y: 9.7, angle: Math.PI + 0.15 }]),
  }),
  Object.freeze({
    id: 'loop', width: 15, height: 11,
    walls: Object.freeze([
      { x: 3, y: 2, w: 9, h: 1 }, { x: 3, y: 8, w: 9, h: 1 },
      // Two openings on each side let tanks enter and leave the outer loop.
      { x: 3, y: 3, w: 1, h: 2 }, { x: 3, y: 6, w: 1, h: 2 },
      { x: 11, y: 3, w: 1, h: 2 }, { x: 11, y: 6, w: 1, h: 2 },
      { x: 6, y: 4, w: 3, h: 1 }, { x: 6, y: 6, w: 3, h: 1 },
      { x: 7, y: 5, w: 1, h: 1 },
    ]),
    spawns: Object.freeze([{ x: 1.8, y: 5.5, angle: 0 }, { x: 13.2, y: 5.5, angle: Math.PI }]),
  }),
]);

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
  return {
    drive: clamp(Number.isFinite(input?.drive) ? input.drive : 0, -1, 1),
    turn: clamp(Number.isFinite(input?.turn) ? input.turn : 0, -1, 1),
    fire: Boolean(input?.fire),
  };
}

function createTank(spawn, id) {
  return {
    id, x: spawn.x, y: spawn.y, angle: spawn.angle, cooldown: 0,
    vx: 0, vy: 0, active: true,
  };
}

function resetRound(match) {
  const spawns = match.spawnFlip ? [match.map.spawns[1], match.map.spawns[0]] : match.map.spawns;
  match.tanks = [createTank(spawns[0], 0), createTank(spawns[1], 1)];
  match.shells = [];
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
  tank.angle = wrapAngle(tank.angle + input.turn * TURN_SPEED * dt);
  const speed = input.drive * TANK_SPEED;
  const dx = Math.cos(tank.angle) * speed * dt;
  const dy = Math.sin(tank.angle) * speed * dt;
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

function fire(match, tank) {
  if (tank.cooldown > 0) return;
  const nose = TANK_RADIUS + SHELL_RADIUS + 0.04;
  const directionX = Math.cos(tank.angle);
  const directionY = Math.sin(tank.angle);
  let muzzleDistance = nose;
  // A tank can be pressed against a corner. Find the last clear point along
  // the barrel so a shot starts outside the wall and can immediately bounce.
  while (muzzleDistance > 0 && collidesCircle(
    match.map, tank.x + directionX * muzzleDistance, tank.y + directionY * muzzleDistance, SHELL_RADIUS
  )) muzzleDistance -= 0.02;
  const x = tank.x + directionX * muzzleDistance;
  const y = tank.y + directionY * muzzleDistance;
  match.shells.push({
    x, y, vx: Math.cos(tank.angle) * SHELL_SPEED, vy: Math.sin(tank.angle) * SHELL_SPEED,
    owner: tank.id, bounces: 0, life: SHELL_LIFE,
  });
  tank.cooldown = SHOT_COOLDOWN;
  match.events.push({ type: 'shot', x, y, owner: tank.id });
}

function moveShell(match, shell, dt) {
  const oldX = shell.x;
  const oldY = shell.y;
  const nextX = shell.x + shell.vx * dt;
  const nextY = shell.y + shell.vy * dt;
  let hitX = collidesCircle(match.map, nextX, oldY, SHELL_RADIUS);
  let hitY = collidesCircle(match.map, oldX, nextY, SHELL_RADIUS);
  if (!hitX && !hitY && collidesCircle(match.map, nextX, nextY, SHELL_RADIUS)) {
    hitX = true;
    hitY = true;
  }
  if (hitX) shell.vx *= -1;
  if (hitY) shell.vy *= -1;
  shell.x = hitX ? oldX : nextX;
  shell.y = hitY ? oldY : nextY;
  if (hitX || hitY) {
    shell.bounces += 1;
    match.events.push({ type: 'bounce', x: shell.x, y: shell.y, owner: shell.owner, bounces: shell.bounces });
  }
  shell.life -= dt;
}

function settleHits(match) {
  const hits = new Set();
  const hitBy = new Map();
  for (const shell of match.shells) {
    for (const tank of match.tanks) {
      if (!tank.active) continue;
      // The muzzle is intentionally close to the firing tank. A shell only
      // becomes dangerous to its owner after its first wall bounce.
      if (tank.id === shell.owner && shell.bounces === 0) continue;
      if ((shell.x - tank.x) ** 2 + (shell.y - tank.y) ** 2 > (SHELL_RADIUS + TANK_RADIUS) ** 2) continue;
      hits.add(tank.id);
      if (!hitBy.has(tank.id)) hitBy.set(tank.id, shell.owner);
      match.events.push({ type: 'hit', x: shell.x, y: shell.y, owner: shell.owner, target: tank.id });
    }
  }
  if (!hits.size) return;
  const hitList = [...hits].sort((a, b) => a - b);
  const both = hits.size === match.tanks.length;
  const winner = both ? null : 1 - hitList[0];
  match.result = { winner, hits: hitList, selfHit: hitList.some((id) => hitBy.get(id) === id) };
  if (winner === null) {
    match.events.push({ type: 'draw', x: (match.tanks[0].x + match.tanks[1].x) / 2, y: (match.tanks[0].y + match.tanks[1].y) / 2 });
  } else {
    match.scores[winner] += 1;
    match.events.push({ type: 'roundEnd', winner, score: [...match.scores] });
    if (match.scores[winner] >= WINS) match.winner = winner;
  }
  for (const tank of match.tanks) tank.active = false;
  match.shells = [];
}

function stepOnce(match, inputs, dt) {
  for (const tank of match.tanks) {
    tank.cooldown = Math.max(0, tank.cooldown - dt);
  }
  for (let index = 0; index < match.tanks.length; index++) {
    const input = sanitizeInput(inputs[index]);
    const tank = match.tanks[index];
    moveTank(match, tank, input, dt);
    if (input.fire) fire(match, tank);
  }
  for (const shell of match.shells) moveShell(match, shell, dt);
  settleHits(match);
  match.shells = match.shells.filter((shell) => shell.life > 0);
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
  TANK_SPEED, TURN_SPEED, SHELL_SPEED, SHELL_LIFE, SHOT_COOLDOWN,
});
