export const COLS = 10;
export const ROWS = 20;
export const BUFFER_ROWS = 2;
export const TOTAL_ROWS = ROWS + BUFFER_ROWS;
export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;
export const SPRINT_TARGET = 40;
export const SAVE_VERSION = 1;

export const POWERUP_TYPES = Object.freeze(['bomb', 'laser', 'ice']);
export const POWERUP_EVERY = 7;
export const ICE_DURATION_MS = 8000;
export const GARBAGE_INTERVAL_MS = 24000;
export const GARBAGE_WARN_MS = 4000;

export const GARBAGE_STYLE = Object.freeze({
  color: '#64748b',
  light: '#94a3b8',
  dark: '#334155',
});

export const PIECE_TYPES = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

export const PIECES = Object.freeze({
  I: {
    color: '#06b6d4',
    light: '#67e8f9',
    dark: '#0e7490',
    shapes: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
  },
  O: {
    color: '#eab308',
    light: '#fde047',
    dark: '#a16207',
    shapes: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
  },
  T: {
    color: '#a855f7',
    light: '#d8b4fe',
    dark: '#7e22ce',
    shapes: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  S: {
    color: '#22c55e',
    light: '#86efac',
    dark: '#15803d',
    shapes: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  Z: {
    color: '#ef4444',
    light: '#fca5a5',
    dark: '#b91c1c',
    shapes: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
  },
  J: {
    color: '#3b82f6',
    light: '#93c5fd',
    dark: '#1d4ed8',
    shapes: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
  },
  L: {
    color: '#f97316',
    light: '#fdba74',
    dark: '#c2410c',
    shapes: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  },
});

// SRS 踢墙表（棋盘 y 轴向下为正）
const JLSTZ_KICKS = Object.freeze({
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
});

const I_KICKS = Object.freeze({
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
});

const CLEAR_POINTS = [0, 100, 300, 500, 800];
const TSPIN_POINTS = [0, 800, 1200, 1600];

export function createBoard() {
  return Array.from({ length: TOTAL_ROWS }, () => Array(COLS).fill(null));
}

export function createBag(rng = Math.random) {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function dropIntervalMs(level) {
  return Math.max(60, Math.round(800 * Math.pow(0.84, Math.max(1, level) - 1)));
}

export function getPieceCells(type, rot, x, y) {
  return PIECES[type].shapes[rot].map(([dx, dy]) => [x + dx, y + dy]);
}

export function canPlace(board, type, rot, x, y) {
  if (!PIECES[type] || rot < 0 || rot > 3) return false;
  for (const [cx, cy] of getPieceCells(type, rot, x, y)) {
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= TOTAL_ROWS) return false;
    if (board[cy][cx] !== null) return false;
  }
  return true;
}

function refillQueue(state, rng) {
  while (state.queue.length < 7) {
    if (!state.bag.length) state.bag = createBag(rng);
    const type = state.bag.shift();
    state.spawnCount += 1;
    let powerup = null;
    if (state.mode === 'party' && state.spawnCount % POWERUP_EVERY === 0) {
      powerup = POWERUP_TYPES[Math.floor(rng() * POWERUP_TYPES.length)];
    }
    state.queue.push(type);
    state.queuePowerups.push(powerup);
  }
}

function spawnPosition(type, powerup = null) {
  return { type, rot: 0, x: 3, y: 1, powerup };
}

function syncGrounded(state) {
  if (!state.active) {
    state.grounded = false;
    return;
  }
  const { type, rot, x, y } = state.active;
  state.grounded = !canPlace(state.board, type, rot, x, y + 1);
}

function spawnNextPiece(state, rng) {
  refillQueue(state, rng);
  const type = state.queue.shift();
  const powerup = state.queuePowerups.shift() || null;
  refillQueue(state, rng);
  const next = spawnPosition(type, powerup);
  state.lockTimerMs = 0;
  state.lockResets = 0;
  state.gravityAccMs = 0;
  state.holdUsed = false;
  state.lastAction = null;
  if (!canPlace(state.board, next.type, next.rot, next.x, next.y)) {
    state.active = null;
    state.grounded = false;
    state.status = 'gameover';
    state.lastEvent = { type: 'gameover' };
    return false;
  }
  state.active = next;
  syncGrounded(state);
  return true;
}

export function createGame({ mode = 'marathon', rng = Math.random } = {}) {
  const normalizedMode = mode === 'sprint' ? 'sprint' : mode === 'party' ? 'party' : 'marathon';
  const state = {
    mode: normalizedMode,
    board: createBoard(),
    bag: createBag(rng),
    queue: [],
    queuePowerups: [],
    spawnCount: 0,
    active: null,
    hold: null,
    holdPowerup: null,
    holdUsed: false,
    lastAction: null,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    maxCombo: 0,
    backToBack: false,
    tetrises: 0,
    tSpins: 0,
    allClears: 0,
    powerupsUsed: 0,
    piecesPlaced: 0,
    elapsedMs: 0,
    iceTimerMs: 0,
    garbageTimerMs: 0,
    lockTimerMs: 0,
    lockResets: 0,
    grounded: false,
    gravityAccMs: 0,
    status: 'ready',
    lastEvent: null,
  };
  refillQueue(state, rng);
  const firstType = state.queue.shift();
  const firstPowerup = state.queuePowerups.shift() || null;
  refillQueue(state, rng);
  state.active = spawnPosition(firstType, firstPowerup);
  syncGrounded(state);
  return state;
}

export function getGhostY(state) {
  if (!state.active) return 0;
  const { type, rot, x } = state.active;
  let y = state.active.y;
  while (canPlace(state.board, type, rot, x, y + 1)) y += 1;
  return y;
}

export function getDangerRatio(state) {
  if (!state || !Array.isArray(state.board)) return 0;
  for (let r = BUFFER_ROWS; r < BUFFER_ROWS + 4; r++) {
    if (state.board[r].some((cell) => cell !== null)) {
      const visibleRow = r - BUFFER_ROWS;
      return Math.min(1, Math.max(0, (4 - visibleRow) / 4));
    }
  }
  return 0;
}

function bumpLockReset(state) {
  const wasGrounded = state.grounded;
  syncGrounded(state);
  if ((wasGrounded || state.grounded) && state.lockResets < MAX_LOCK_RESETS) {
    state.lockTimerMs = 0;
    state.lockResets += 1;
  }
}

export function movePiece(state, dx, dy) {
  if (state.status !== 'playing' || !state.active) return { moved: false };
  const { type, rot, x, y } = state.active;
  const nx = x + dx;
  const ny = y + dy;
  if (!canPlace(state.board, type, rot, nx, ny)) return { moved: false };
  state.active.x = nx;
  state.active.y = ny;
  state.lastAction = 'move';
  if (dy > 0) {
    state.gravityAccMs = 0;
    if (state.mode !== 'sprint') state.score += dy;
    syncGrounded(state);
    if (!state.grounded) state.lockTimerMs = 0;
  } else {
    bumpLockReset(state);
  }
  state.lastEvent = { type: dy > 0 ? 'soft-drop' : 'move' };
  return { moved: true };
}

export function rotatePiece(state, dir) {
  if (state.status !== 'playing' || !state.active) return { rotated: false };
  const { type, rot, x, y } = state.active;
  const step = dir < 0 ? -1 : 1;
  const nextRot = (rot + step + 4) % 4;
  if (type === 'O') return { rotated: false };
  const table = type === 'I' ? I_KICKS : JLSTZ_KICKS;
  const kicks = table[rot + '>' + nextRot] || [[0, 0]];
  for (const [kx, ky] of kicks) {
    if (canPlace(state.board, type, nextRot, x + kx, y + ky)) {
      state.active.rot = nextRot;
      state.active.x = x + kx;
      state.active.y = y + ky;
      state.lastAction = 'rotate';
      bumpLockReset(state);
      state.lastEvent = { type: 'rotate', kicked: kx !== 0 || ky !== 0 };
      return { rotated: true };
    }
  }
  return { rotated: false };
}

export function holdPiece(state, rng = Math.random) {
  if (state.status !== 'playing' || !state.active || state.holdUsed) return { held: false };
  const currentType = state.active.type;
  const currentPowerup = state.active.powerup || null;
  const previousHold = state.hold;
  const previousHoldPowerup = state.holdPowerup || null;

  state.hold = currentType;
  state.holdPowerup = currentPowerup;
  state.holdUsed = true;
  state.lockTimerMs = 0;
  state.lockResets = 0;
  state.gravityAccMs = 0;
  state.lastAction = 'hold';

  let nextType = previousHold;
  let nextPowerup = previousHoldPowerup;
  if (!nextType) {
    refillQueue(state, rng);
    nextType = state.queue.shift();
    nextPowerup = state.queuePowerups.shift() || null;
    refillQueue(state, rng);
  }
  const next = spawnPosition(nextType, nextPowerup);
  if (!canPlace(state.board, next.type, next.rot, next.x, next.y)) {
    state.active = null;
    state.grounded = false;
    state.status = 'gameover';
    state.lastEvent = { type: 'gameover' };
    return { held: false };
  }
  state.active = next;
  syncGrounded(state);
  state.lastEvent = { type: 'hold' };
  return { held: true };
}

function detectTSpin(board, active, lastAction) {
  if (!active || active.type !== 'T' || lastAction !== 'rotate') return false;
  const cx = active.x + 1;
  const cy = active.y + 1;
  const corners = [
    [cx - 1, cy - 1],
    [cx + 1, cy - 1],
    [cx - 1, cy + 1],
    [cx + 1, cy + 1],
  ];
  let occupied = 0;
  for (const [kx, ky] of corners) {
    if (kx < 0 || kx >= COLS || ky < 0 || ky >= TOTAL_ROWS || board[ky][kx] !== null) {
      occupied += 1;
    }
  }
  return occupied >= 3;
}

export function lockActivePiece(state, rng = Math.random) {
  if (!state.active) return null;
  const active = state.active;
  const tSpinDetected = detectTSpin(state.board, active, state.lastAction);
  const cells = getPieceCells(active.type, active.rot, active.x, active.y);

  let allAboveVisible = true;
  for (const [cx, cy] of cells) {
    if (cy >= BUFFER_ROWS) allAboveVisible = false;
    state.board[cy][cx] = active.type;
  }
  state.piecesPlaced += 1;

  let powerupTriggered = null;
  let powerupBonus = 0;
  const forcedClearRows = new Set();

  if (state.mode === 'party' && active.powerup) {
    if (active.powerup === 'bomb') {
      const avgX = cells.reduce((sum, [x]) => sum + x, 0) / cells.length;
      const avgY = cells.reduce((sum, [, y]) => sum + y, 0) / cells.length;
      const bx = Math.round(avgX);
      const by = Math.round(avgY);
      let bombedCount = 0;
      for (let ry = by - 1; ry <= by + 1; ry++) {
        if (ry < 0 || ry >= TOTAL_ROWS) continue;
        for (let rx = bx - 1; rx <= bx + 1; rx++) {
          if (rx < 0 || rx >= COLS) continue;
          if (state.board[ry][rx] !== null) {
            state.board[ry][rx] = null;
            bombedCount += 1;
          }
        }
      }
      powerupBonus = bombedCount * 25 * state.level;
      state.powerupsUsed += 1;
      powerupTriggered = { type: 'bomb', cx: bx, cy: by, count: bombedCount };
    } else if (active.powerup === 'laser') {
      const targetRow = Math.max(...cells.map(([, y]) => y));
      forcedClearRows.add(targetRow);
      state.powerupsUsed += 1;
      powerupTriggered = { type: 'laser', row: targetRow };
    } else if (active.powerup === 'ice') {
      state.iceTimerMs = ICE_DURATION_MS;
      state.powerupsUsed += 1;
      powerupTriggered = { type: 'ice', durationMs: ICE_DURATION_MS };
    }
  }

  const clearedRows = [];
  for (let r = 0; r < TOTAL_ROWS; r++) {
    if (forcedClearRows.has(r) || state.board[r].every((cell) => cell !== null)) {
      clearedRows.push(r);
    }
  }

  const linesCleared = clearedRows.length;
  if (linesCleared > 0) {
    for (let i = clearedRows.length - 1; i >= 0; i--) {
      state.board.splice(clearedRows[i], 1);
    }
    while (state.board.length < TOTAL_ROWS) {
      state.board.unshift(Array(COLS).fill(null));
    }
  }

  const prevLevel = state.level;
  const isTSpin = tSpinDetected && linesCleared > 0;
  const isTetris = linesCleared === 4;
  let isBackToBack = false;
  let isAllClear = false;
  let gained = powerupBonus;

  if (linesCleared > 0) {
    state.lines += linesCleared;
    state.combo += 1;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    if (isTetris) state.tetrises += 1;
    if (isTSpin) state.tSpins += 1;

    const difficultClear = isTetris || isTSpin;
    isBackToBack = difficultClear && state.backToBack;
    state.backToBack = difficultClear;

    let base = (isTSpin ? (TSPIN_POINTS[linesCleared] || 1600) : CLEAR_POINTS[linesCleared]) * state.level;
    if (isBackToBack) base = Math.round(base * 1.5);
    const comboBonus = state.combo >= 1 ? state.combo * 50 * state.level : 0;

    isAllClear = state.board.every((row) => row.every((cell) => cell === null));
    let allClearBonus = 0;
    if (isAllClear) {
      state.allClears += 1;
      allClearBonus = 1800 * state.level;
    }

    gained += base + comboBonus + allClearBonus;
  } else {
    state.combo = -1;
  }

  if (state.mode !== 'sprint') {
    state.score += gained;
    state.level = Math.floor(state.lines / 10) + 1;
  }

  const levelUp = state.mode !== 'sprint' && state.level > prevLevel;

  if (state.mode === 'sprint' && state.lines >= SPRINT_TARGET) {
    state.active = null;
    state.grounded = false;
    state.status = 'cleared';
    const event = {
      type: 'cleared', clearedRows, linesCleared, isTetris, isTSpin, isBackToBack, isAllClear,
      combo: state.combo, levelUp: false, gained, powerupTriggered,
    };
    state.lastEvent = event;
    return event;
  }

  if (allAboveVisible && !powerupTriggered) {
    state.active = null;
    state.grounded = false;
    state.status = 'gameover';
    const event = {
      type: 'gameover', clearedRows, linesCleared, isTetris, isTSpin, isBackToBack, isAllClear,
      combo: state.combo, levelUp, gained, powerupTriggered,
    };
    state.lastEvent = event;
    return event;
  }

  const spawned = spawnNextPiece(state, rng);
  if (!spawned) return state.lastEvent;

  const event = {
    type: 'lock', clearedRows, linesCleared, isTetris, isTSpin, isBackToBack, isAllClear,
    combo: state.combo, levelUp, gained, powerupTriggered,
  };
  state.lastEvent = event;
  return event;
}

export function hardDrop(state, rng = Math.random) {
  if (state.status !== 'playing' || !state.active) return null;
  const targetY = getGhostY(state);
  const distance = Math.max(0, targetY - state.active.y);
  state.active.y = targetY;
  if (state.mode !== 'sprint') state.score += distance * 2;
  const event = lockActivePiece(state, rng);
  if (event && event.type === 'lock') event.hardDropDistance = distance;
  return event;
}

export function addGarbageRow(state, rng = Math.random) {
  if (!state || state.status !== 'playing') return null;
  if (state.board[0].some((cell) => cell !== null)) {
    state.active = null;
    state.grounded = false;
    state.status = 'gameover';
    state.lastEvent = { type: 'gameover' };
    return state.lastEvent;
  }
  const holeCol = Math.floor(rng() * COLS);
  const garbageRow = Array.from({ length: COLS }, (_, c) => (c === holeCol ? null : 'G'));
  state.board.shift();
  state.board.push(garbageRow);

  if (state.active) {
    if (!canPlace(state.board, state.active.type, state.active.rot, state.active.x, state.active.y)) {
      if (canPlace(state.board, state.active.type, state.active.rot, state.active.x, state.active.y - 1)) {
        state.active.y -= 1;
      } else {
        state.active = null;
        state.grounded = false;
        state.status = 'gameover';
        state.lastEvent = { type: 'gameover' };
        return state.lastEvent;
      }
    }
    syncGrounded(state);
  }
  const event = { type: 'garbage', holeCol };
  state.lastEvent = event;
  return event;
}

export function stepGame(state, dtMs, rng = Math.random) {
  if (state.status !== 'playing' || !state.active || dtMs <= 0) return null;
  state.elapsedMs += dtMs;

  let garbageEvent = null;
  if (state.mode === 'party') {
    if (state.iceTimerMs > 0) {
      state.iceTimerMs = Math.max(0, state.iceTimerMs - dtMs);
    } else {
      state.garbageTimerMs += dtMs;
      if (state.garbageTimerMs >= GARBAGE_INTERVAL_MS) {
        state.garbageTimerMs -= GARBAGE_INTERVAL_MS;
        garbageEvent = addGarbageRow(state, rng);
        if (state.status === 'gameover') return garbageEvent;
      }
    }
  }

  let interval = dropIntervalMs(state.mode === 'sprint' ? 1 : state.level);
  if (state.mode === 'party' && state.iceTimerMs > 0) {
    interval = Math.round(interval * 2.2);
  }

  if (state.grounded) {
    state.lockTimerMs += dtMs;
    if (state.lockTimerMs >= LOCK_DELAY_MS) {
      const lockEv = lockActivePiece(state, rng);
      if (lockEv && garbageEvent) lockEv.garbageRisen = true;
      return lockEv;
    }
    return garbageEvent;
  }

  state.gravityAccMs += dtMs;
  while (state.gravityAccMs >= interval && state.status === 'playing' && state.active) {
    state.gravityAccMs -= interval;
    const { type, rot, x, y } = state.active;
    if (canPlace(state.board, type, rot, x, y + 1)) {
      state.active.y += 1;
      syncGrounded(state);
      if (state.grounded) {
        state.lockTimerMs = 0;
        break;
      }
    } else {
      syncGrounded(state);
      break;
    }
  }
  return garbageEvent;
}

function isValidPieceType(value) {
  return typeof value === 'string' && Object.hasOwn(PIECES, value);
}

export function serializeMarathonSave(state) {
  if (!state || state.mode !== 'marathon') return null;
  if (state.status !== 'playing' && state.status !== 'paused') return null;
  if (!state.active || (state.piecesPlaced <= 0 && state.score <= 0 && state.lines <= 0)) return null;
  return JSON.stringify({
    version: SAVE_VERSION,
    mode: 'marathon',
    board: state.board,
    bag: state.bag,
    queue: state.queue,
    active: { type: state.active.type, rot: state.active.rot, x: state.active.x, y: state.active.y },
    hold: state.hold,
    holdUsed: state.holdUsed,
    score: state.score,
    lines: state.lines,
    level: state.level,
    combo: state.combo,
    maxCombo: state.maxCombo,
    backToBack: state.backToBack,
    tetrises: state.tetrises,
    tSpins: state.tSpins,
    allClears: state.allClears,
    piecesPlaced: state.piecesPlaced,
    elapsedMs: Math.round(state.elapsedMs),
  });
}

export function deserializeMarathonSave(raw, rng = Math.random) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION || data.mode !== 'marathon') return null;
    if (!Array.isArray(data.board) || data.board.length !== TOTAL_ROWS) return null;
    const board = data.board.map((row) => {
      if (!Array.isArray(row) || row.length !== COLS) throw new Error('bad row');
      return row.map((cell) => {
        if (cell === null) return null;
        if (!isValidPieceType(cell)) throw new Error('bad cell');
        return cell;
      });
    });

    if (!data.active || !isValidPieceType(data.active.type)) return null;
    if (!Number.isInteger(data.active.rot) || data.active.rot < 0 || data.active.rot > 3) return null;
    if (!Number.isInteger(data.active.x) || !Number.isInteger(data.active.y)) return null;
    if (!canPlace(board, data.active.type, data.active.rot, data.active.x, data.active.y)) return null;

    if (data.hold !== null && !isValidPieceType(data.hold)) return null;
    if (!Array.isArray(data.queue) || data.queue.length < 3 || !data.queue.every(isValidPieceType)) return null;
    if (!Array.isArray(data.bag) || !data.bag.every(isValidPieceType)) return null;

    const ints = ['score', 'lines', 'maxCombo', 'tetrises', 'piecesPlaced', 'elapsedMs'];
    for (const key of ints) {
      if (!Number.isSafeInteger(data[key]) || data[key] < 0) return null;
    }
    if (!Number.isSafeInteger(data.level) || data.level < 1) return null;
    if (!Number.isSafeInteger(data.combo) || data.combo < -1) return null;
    if (data.piecesPlaced === 0 && data.score === 0 && data.lines === 0) return null;

    const tSpins = Number.isSafeInteger(data.tSpins) && data.tSpins >= 0 ? data.tSpins : 0;
    const allClears = Number.isSafeInteger(data.allClears) && data.allClears >= 0 ? data.allClears : 0;

    const state = {
      mode: 'marathon',
      board,
      bag: [...data.bag],
      queue: [...data.queue],
      queuePowerups: Array(data.queue.length).fill(null),
      spawnCount: data.piecesPlaced + 1 + data.queue.length,
      active: { type: data.active.type, rot: data.active.rot, x: data.active.x, y: data.active.y, powerup: null },
      hold: data.hold,
      holdPowerup: null,
      holdUsed: !!data.holdUsed,
      lastAction: null,
      score: data.score,
      lines: data.lines,
      level: data.level,
      combo: data.combo,
      maxCombo: data.maxCombo,
      backToBack: !!data.backToBack,
      tetrises: data.tetrises,
      tSpins,
      allClears,
      powerupsUsed: 0,
      piecesPlaced: data.piecesPlaced,
      elapsedMs: data.elapsedMs,
      iceTimerMs: 0,
      garbageTimerMs: 0,
      lockTimerMs: 0,
      lockResets: 0,
      grounded: false,
      gravityAccMs: 0,
      status: 'paused',
      lastEvent: null,
    };
    refillQueue(state, rng);
    syncGrounded(state);
    return state;
  } catch {
    return null;
  }
}
