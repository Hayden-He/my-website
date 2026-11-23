import {
  STEP, TANK_RADIUS, SHELL_RADIUS, angleDifference, collidesCircle, hasLineOfSight, rules,
} from './engine.js';

const GRID_STEP = 0.5;
const SEARCH_POINTS = [
  { x: 2, y: 2 }, { x: 7.5, y: 1.5 }, { x: 13, y: 2 },
  { x: 12.5, y: 8.5 }, { x: 7.5, y: 9.5 }, { x: 2.5, y: 8.5 },
];

const PRESETS = Object.freeze({
  easy: Object.freeze({ reaction: 0.32, aimError: 0.18, dodge: 0.42, lead: 0, hiddenFire: false, avoidOwn: false }),
  normal: Object.freeze({ reaction: 0.19, aimError: 0.12, dodge: 0.67, lead: 0.18, hiddenFire: true, avoidOwn: false }),
  hard: Object.freeze({ reaction: 0.08, aimError: 0.07, dodge: 0.95, lead: 0.34, hiddenFire: true, avoidOwn: true }),
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function cellFor(point, map) {
  const maxCol = Math.ceil(map.width / GRID_STEP) - 1;
  const maxRow = Math.ceil(map.height / GRID_STEP) - 1;
  return {
    col: clamp(Math.floor(point.x / GRID_STEP), 0, maxCol),
    row: clamp(Math.floor(point.y / GRID_STEP), 0, maxRow),
  };
}

function cellPoint(cell) {
  return { x: (cell.col + 0.5) * GRID_STEP, y: (cell.row + 0.5) * GRID_STEP };
}

function cellKey(cell) { return cell.col + ',' + cell.row; }

function walkable(map, cell) {
  const point = cellPoint(cell);
  return point.x > TANK_RADIUS && point.x < map.width - TANK_RADIUS
    && point.y > TANK_RADIUS && point.y < map.height - TANK_RADIUS
    && !collidesCircle(map, point.x, point.y, TANK_RADIUS + 0.02);
}

function findPath(map, from, to) {
  let start = cellFor(from, map);
  const goal = cellFor(to, map);
  if (!walkable(map, start)) {
    const nearby = [];
    for (let col = start.col - 1; col <= start.col + 1; col++) {
      for (let row = start.row - 1; row <= start.row + 1; row++) {
        const candidate = { col, row };
        if (walkable(map, candidate)) nearby.push(candidate);
      }
    }
    nearby.sort((a, b) => distance(from, cellPoint(a)) - distance(from, cellPoint(b)));
    if (!nearby.length) return [];
    start = nearby[0];
  }
  const open = [start];
  const cameFrom = new Map();
  const visited = new Set([cellKey(start)]);
  const directions = [{ col: 1, row: 0 }, { col: -1, row: 0 }, { col: 0, row: 1 }, { col: 0, row: -1 }];
  let target = null;
  for (let head = 0; head < open.length; head++) {
    const current = open[head];
    if (current.col === goal.col && current.row === goal.row) { target = current; break; }
    for (const direction of directions) {
      const next = { col: current.col + direction.col, row: current.row + direction.row };
      const key = cellKey(next);
      if (visited.has(key) || !walkable(map, next)) continue;
      visited.add(key);
      cameFrom.set(key, current);
      open.push(next);
    }
  }
  if (!target) {
    // A target can be in a narrow wall-adjacent cell. Go to the visited cell
    // closest to it instead of making the bot stop searching.
    let best = null;
    let bestDistance = Infinity;
    for (const key of visited) {
      const [col, row] = key.split(',').map(Number);
      const candidate = { col, row };
      const value = (candidate.col - goal.col) ** 2 + (candidate.row - goal.row) ** 2;
      if (value < bestDistance) { bestDistance = value; best = candidate; }
    }
    target = best;
  }
  if (!target) return [];
  const result = [];
  let current = target;
  while (current) {
    result.push(cellPoint(current));
    current = cameFrom.get(cellKey(current));
  }
  return result.reverse();
}

function chooseSearchPoint(state, map) {
  const point = SEARCH_POINTS[state.searchIndex % SEARCH_POINTS.length];
  state.searchIndex += 1;
  return {
    x: clamp(point.x, TANK_RADIUS + 0.2, map.width - TANK_RADIUS - 0.2),
    y: clamp(point.y, TANK_RADIUS + 0.2, map.height - TANK_RADIUS - 0.2),
  };
}

function aimAt(tank, target) {
  return Math.atan2(target.y - tank.y, target.x - tank.x);
}

function clearToBank(map, from, point) {
  const steps = Math.max(1, Math.ceil(distance(from, point) / 0.06));
  for (let index = 0; index < steps; index++) {
    const ratio = index / steps;
    if (collidesCircle(map, from.x + (point.x - from.x) * ratio, from.y + (point.y - from.y) * ratio, SHELL_RADIUS)) return false;
  }
  return true;
}

const wallEdges = new WeakMap();
function edgesFor(map) {
  if (!wallEdges.has(map)) {
    const edges = [
      { axis: 'x', value: SHELL_RADIUS, min: 0, max: map.height, side: 1 },
      { axis: 'x', value: map.width - SHELL_RADIUS, min: 0, max: map.height, side: -1 },
      { axis: 'y', value: SHELL_RADIUS, min: 0, max: map.width, side: 1 },
      { axis: 'y', value: map.height - SHELL_RADIUS, min: 0, max: map.width, side: -1 },
    ];
    for (const wall of map.walls) {
      edges.push(
        { axis: 'x', value: wall.x - SHELL_RADIUS, min: wall.y, max: wall.y + wall.h, side: -1 },
        { axis: 'x', value: wall.x + wall.w + SHELL_RADIUS, min: wall.y, max: wall.y + wall.h, side: 1 },
        { axis: 'y', value: wall.y - SHELL_RADIUS, min: wall.x, max: wall.x + wall.w, side: -1 },
        { axis: 'y', value: wall.y + wall.h + SHELL_RADIUS, min: wall.x, max: wall.x + wall.w, side: 1 },
      );
    }
    wallEdges.set(map, edges);
  }
  return wallEdges.get(map);
}

// Return a real one-wall bank angle. This mirrors the target across each wall
// edge, then verifies that the two line segments reach that edge and leave it
// without crossing another wall. It prevents blind firing at a hidden target.
function bankAim(map, from, target) {
  let best = null;
  let bestLength = rules.SHELL_LIFE * rules.SHELL_SPEED;
  for (const edge of edgesFor(map)) {
    const start = (from[edge.axis] - edge.value) * edge.side;
    const finish = (target[edge.axis] - edge.value) * edge.side;
    if (start <= 0.5 || finish <= 0) continue;
    const reflected = edge.axis === 'x'
      ? { x: edge.value * 2 - target.x, y: target.y }
      : { x: target.x, y: edge.value * 2 - target.y };
    const length = distance(from, reflected);
    if (length >= bestLength) continue;
    const ratio = start / (start + finish);
    const point = {
      x: from.x + (reflected.x - from.x) * ratio,
      y: from.y + (reflected.y - from.y) * ratio,
    };
    const along = edge.axis === 'x' ? point.y : point.x;
    if (along < edge.min + SHELL_RADIUS || along > edge.max - SHELL_RADIUS) continue;
    if (!clearToBank(map, from, point) || !clearToBank(map, target, point)) continue;
    best = aimAt(from, reflected);
    bestLength = length;
  }
  return best;
}

function dangerFromShell(match, tank, preset) {
  let danger = null;
  let dangerDistance = preset.dodge;
  for (const shell of match.shells) {
    if (shell.owner === tank.id && !(preset.avoidOwn && shell.bounces > 0)) continue;
    const rx = tank.x - shell.x;
    const ry = tank.y - shell.y;
    const speedSquared = shell.vx * shell.vx + shell.vy * shell.vy;
    if (!speedSquared) continue;
    const time = (rx * shell.vx + ry * shell.vy) / speedSquared;
    if (time <= 0 || time > Math.min(0.65, shell.life)) continue;
    const dx = shell.x + shell.vx * time - tank.x;
    const dy = shell.y + shell.vy * time - tank.y;
    const value = Math.hypot(dx, dy);
    if (value < dangerDistance && hasLineOfSight(match.map, shell, tank)) {
      dangerDistance = value;
      danger = shell;
    }
  }
  return danger;
}

function dodgeInput(tank, shell) {
  // Turn across the predicted path, then drive away. The cross product keeps
  // the choice deterministic and avoids oscillating when a shell is head-on.
  const cross = shell.vx * (tank.y - shell.y) - shell.vy * (tank.x - shell.x);
  return { drive: -1, turn: cross >= 0 ? -1 : 1, fire: false };
}

function createState() {
  return {
    round: 0, path: [], pathIndex: 0, pathAge: 0,
    lastSeen: null, searchTarget: null, searchIndex: 0, reactionTimer: 0,
    visibleFor: 0, bankAngle: null, bankTime: 0, moveBack: 0,
  };
}

export function createAI(difficulty = 'normal') {
  const preset = PRESETS[difficulty] || PRESETS.normal;
  const state = createState();

  return function aiInput(match, dt = STEP) {
    const tank = match?.tanks?.[1];
    const enemy = match?.tanks?.[0];
    if (!tank || !enemy || !tank.active || !enemy.active || match.result || match.winner !== null) {
      return { drive: 0, turn: 0, fire: false };
    }
    if (state.round !== match.round) {
      Object.assign(state, createState(), { round: match.round });
    }
    const elapsed = Number.isFinite(dt) ? dt : STEP;
    state.pathAge += elapsed;
    state.reactionTimer -= elapsed;
    state.moveBack -= elapsed;

    const visible = hasLineOfSight(match.map, tank, enemy);
    const justLost = !visible && state.visibleFor >= preset.reaction;
    if (visible) {
      state.lastSeen = { x: enemy.x, y: enemy.y };
      state.visibleFor += elapsed;
      state.bankAngle = null;
      state.path = [];
      state.pathIndex = 0;
    } else {
      state.visibleFor = 0;
    }

    const danger = dangerFromShell(match, tank, preset);
    if (danger && (state.reactionTimer <= 0 || preset.dodge > 0.8)) {
      state.reactionTimer = preset.reaction;
      return dodgeInput(tank, danger);
    }

    if (justLost && preset.hiddenFire && tank.cooldown <= STEP) {
      state.bankAngle = bankAim(match.map, tank, state.lastSeen);
      state.bankTime = 0.8;
    }
    if (!visible && state.bankAngle !== null && state.bankTime > 0) {
      state.bankTime -= elapsed;
      const bankError = angleDifference(tank.angle, state.bankAngle);
      const fire = Math.abs(bankError) <= 0.033;
      if (fire) {
        state.bankAngle = null;
        state.moveBack = 0.18;
      }
      return { drive: 0, turn: fire ? 0 : Math.sign(bankError), fire };
    }
    if (state.moveBack > 0) return { drive: -1, turn: 0, fire: false };

    let target;
    if (visible) {
      target = {
        x: enemy.x + enemy.vx * preset.lead,
        y: enemy.y + enemy.vy * preset.lead,
      };
    } else {
      const pathPoint = state.path[state.pathIndex];
      const reached = pathPoint && distance(tank, pathPoint) < 0.34;
      // Once the last-known position is reached, continue into a patrol route
      // so the bot actively searches instead of camping at one coordinate.
      const pathFinished = reached && state.pathIndex === state.path.length - 1;
      if (pathFinished || state.pathAge > 12) {
        state.lastSeen = null;
        state.path = [];
        state.pathIndex = 0;
      }
      if (!state.path.length) {
        const goal = state.lastSeen || chooseSearchPoint(state, match.map);
        state.searchTarget = goal;
        state.path = findPath(match.map, tank, goal);
        state.pathIndex = 0;
        state.pathAge = 0;
      }
      target = state.path[state.pathIndex] || state.searchTarget || chooseSearchPoint(state, match.map);
      if (distance(tank, target) < 0.34 && state.pathIndex < state.path.length - 1) state.pathIndex += 1;
      target = state.path[state.pathIndex] || target;
    }

    const targetAngle = aimAt(tank, target);
    const angleError = angleDifference(tank.angle, targetAngle);
    const targetDistance = distance(tank, target);
    const turn = Math.abs(angleError) < 0.06 ? 0 : angleError > 0 ? 1 : -1;
    // Navigation waypoints are approached monotonically. Reversing inside the
    // arrival radius causes a short path to oscillate forever near the corner.
    let drive = targetDistance > 0.30 ? 1 : 0;
    if (!visible && Math.abs(angleError) > 0.45) drive = 0;
    if (visible && targetDistance < 1.4) drive = -1;
    if (visible && Math.abs(angleError) > 0.75) drive = targetDistance > 3 ? 0.55 : 0;

    const fire = visible && state.visibleFor >= preset.reaction && Math.abs(angleError) <= preset.aimError
      && tank.cooldown <= STEP;
    if (fire && preset.hiddenFire) state.moveBack = 0.18;
    return { drive, turn, fire };
  };
}

export const AI_DIFFICULTIES = Object.freeze(['easy', 'normal', 'hard']);
