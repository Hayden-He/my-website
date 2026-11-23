import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUFFER_ROWS, CLEAR_DELAY_MS, COLS, GARBAGE_INTERVAL_MS, ICE_DURATION_MS, LOCK_DELAY_MS, MAX_LOCK_RESETS,
  PIECE_TYPES, POWERUP_EVERY, POWERUP_TYPES, ROWS, SPRINT_TARGET, TOTAL_ROWS,
  canPlace, createBag, createGame, deserializeMarathonSave, dropIntervalMs, finishPendingClear, getDangerRatio,
  getGhostY, hardDrop, holdPiece, lockActivePiece, movePiece, rotatePiece,
  serializeMarathonSave, stepGame,
} from '../games/tetris/modules/engine.js';

function makeSeededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function fillRow(board, rowIndex, skipCols = [], type = 'I') {
  const skip = new Set(skipCols);
  for (let c = 0; c < COLS; c++) {
    board[rowIndex][c] = skip.has(c) ? null : type;
  }
}

test('7-bag generator produces all 7 unique tetrominoes in every bag and sequence', () => {
  const rng = makeSeededRng(12345);
  for (let i = 0; i < 10; i++) {
    const bag = createBag(rng);
    assert.equal(bag.length, 7);
    assert.deepEqual([...bag].sort(), [...PIECE_TYPES].sort());
  }

  const game = createGame({ rng: makeSeededRng(999) });
  game.status = 'playing';
  const drawn = [];
  for (let i = 0; i < 21; i++) {
    drawn.push(game.active.type);
    // Clear board so pieces never top out while drawing 3 full bags
    game.board.forEach((row) => row.fill(null));
    hardDrop(game, makeSeededRng(999 + i));
  }
  for (let b = 0; b < 3; b++) {
    const chunk = drawn.slice(b * 7, (b + 1) * 7);
    assert.deepEqual([...chunk].sort(), [...PIECE_TYPES].sort());
  }
});

test('SRS wall kicks work against walls and floor for T and I pieces', () => {
  const game = createGame({ rng: makeSeededRng(42) });
  game.status = 'playing';

  // T piece in rot 1 flush against left wall (stem at col 0 -> x = -1) rotating CCW (1->0) kicks right to x = 0
  game.active = { type: 'T', rot: 1, x: -1, y: 10 };
  assert.equal(rotatePiece(game, -1).rotated, true);
  assert.equal(game.active.rot, 0);
  assert.equal(game.active.x, 0);

  // T piece in rot 3 flush against right wall (x = 8, cells at cols 8 & 9) rotating CW (3->0) kicks left to x = 7
  game.active = { type: 'T', rot: 3, x: 8, y: 10 };
  assert.equal(rotatePiece(game, 1).rotated, true);
  assert.equal(game.active.rot, 0);
  assert.equal(game.active.x, 7);

  // I piece vertical rot 3 at left wall (x = -1, col 0) rotating CW (3->0) kicks right to x = 0
  game.active = { type: 'I', rot: 3, x: -1, y: 10 };
  assert.equal(rotatePiece(game, 1).rotated, true);
  assert.equal(game.active.rot, 0);
  assert.equal(game.active.x, 0);

  // I piece horizontal rot 0 on bottom row (y = TOTAL_ROWS - 2, cells at row 21) rotating CW (0->1) floor-kicks up
  game.active = { type: 'I', rot: 0, x: 3, y: TOTAL_ROWS - 2 };
  assert.equal(rotatePiece(game, 1).rotated, true);
  assert.equal(game.active.rot, 1);
  assert.ok(canPlace(game.board, game.active.type, game.active.rot, game.active.x, game.active.y));
  assert.ok(game.active.y < TOTAL_ROWS - 2);
});

test('getGhostY finds lowest valid y above stack or floor', () => {
  const game = createGame({ rng: makeSeededRng(7) });
  game.active = { type: 'O', rot: 0, x: 4, y: 2 };
  // O piece has cells at dy 0 and 1, so lowest valid y on empty board is TOTAL_ROWS - 2
  assert.equal(getGhostY(game), TOTAL_ROWS - 2);

  game.board[15][5] = 'J';
  // Block at row 15 col 5 stops O (bottom at y + 1) at y = 13 (cells on rows 13, 14)
  assert.equal(getGhostY(game), 13);
});

test('holdPiece swaps once per lock and resets after lock', () => {
  const rng = makeSeededRng(77);
  const game = createGame({ rng });
  game.status = 'playing';
  const first = game.active.type;
  const second = game.queue[0];

  assert.equal(holdPiece(game, rng).held, true);
  assert.equal(game.hold, first);
  assert.equal(game.active.type, second);
  assert.equal(game.holdUsed, true);

  // Cannot hold twice before locking
  assert.equal(holdPiece(game, rng).held, false);
  assert.equal(game.active.type, second);

  // Lock current piece, then hold is re-enabled and swaps back the stored piece
  hardDrop(game, rng);
  assert.equal(game.holdUsed, false);
  const third = game.active.type;
  assert.equal(holdPiece(game, rng).held, true);
  assert.equal(game.active.type, first);
  assert.equal(game.hold, third);
});

test('line clear scoring, back-to-back Tetris 1.5x, combo, and level progression', () => {
  const rng = makeSeededRng(101);
  const game = createGame({ mode: 'marathon', rng });
  game.status = 'playing';

  // Leave one anchor block above so line clears don't trigger All Clear
  game.board[TOTAL_ROWS - 8][9] = 'Z';

  // Set up 4 bottom rows missing only column 0 for an I-piece vertical Tetris
  for (let r = TOTAL_ROWS - 4; r < TOTAL_ROWS; r++) {
    fillRow(game.board, r, [0], 'J');
  }
  game.active = { type: 'I', rot: 3, x: -1, y: TOTAL_ROWS - 4 };
  const ev1 = lockActivePiece(game, rng);
  assert.equal(ev1.linesCleared, 4);
  assert.equal(ev1.isTetris, true);
  assert.equal(ev1.isBackToBack, false);
  assert.equal(game.score, 800);
  assert.equal(game.combo, 0);
  assert.equal(game.tetrises, 1);
  assert.ok(game.pendingClear);
  const done1 = stepGame(game, CLEAR_DELAY_MS, rng);
  assert.equal(done1?.type, 'clearComplete');
  assert.equal(game.pendingClear, null);

  // Place a non-clearing piece in the middle of nowhere — B2B stays true, combo resets to -1
  game.active = { type: 'O', rot: 0, x: 4, y: TOTAL_ROWS - 2 };
  const evIdle = lockActivePiece(game, rng);
  assert.equal(evIdle.linesCleared, 0);
  assert.equal(game.backToBack, true);
  assert.equal(game.combo, -1);

  // Second Tetris triggers Back-to-Back (800 * 1.5 = 1200)
  game.board.forEach((row) => row.fill(null));
  game.board[TOTAL_ROWS - 8][9] = 'Z';
  for (let r = TOTAL_ROWS - 4; r < TOTAL_ROWS; r++) {
    fillRow(game.board, r, [0], 'L');
  }
  game.active = { type: 'I', rot: 3, x: -1, y: TOTAL_ROWS - 4 };
  const ev2 = lockActivePiece(game, rng);
  assert.equal(ev2.isTetris, true);
  assert.equal(ev2.isBackToBack, true);
  assert.equal(ev2.gained, 1200);
  assert.equal(game.score, 2000);
  assert.equal(game.lines, 8);
  assert.equal(game.level, 1);
  stepGame(game, CLEAR_DELAY_MS, rng);

  // Next lock clears 2 lines (combo becomes 1 -> +50, level jumps from 1 to 2 at 10 lines, B2B resets)
  fillRow(game.board, TOTAL_ROWS - 2, [4, 5], 'S');
  fillRow(game.board, TOTAL_ROWS - 1, [4, 5], 'S');
  game.active = { type: 'O', rot: 0, x: 3, y: TOTAL_ROWS - 2 };
  const ev3 = lockActivePiece(game, rng);
  assert.equal(ev3.linesCleared, 2);
  assert.equal(ev3.combo, 1);
  assert.equal(ev3.gained, 300 + 50); // base 300*1 + combo 1*50*1
  assert.equal(ev3.levelUp, true);
  assert.equal(game.lines, 10);
  assert.equal(game.level, 2);
  assert.equal(game.backToBack, false);
  assert.equal(game.maxCombo, 1);
});

test('40-line sprint transitions to cleared when lines reach target', () => {
  const rng = makeSeededRng(55);
  const game = createGame({ mode: 'sprint', rng });
  game.status = 'playing';
  game.lines = SPRINT_TARGET - 2;

  fillRow(game.board, TOTAL_ROWS - 2, [4, 5], 'Z');
  fillRow(game.board, TOTAL_ROWS - 1, [4, 5], 'Z');
  game.active = { type: 'O', rot: 0, x: 3, y: TOTAL_ROWS - 2 };

  const ev = lockActivePiece(game, rng);
  assert.equal(ev.type, 'cleared');
  assert.equal(game.status, 'cleared');
  assert.equal(game.lines, SPRINT_TARGET);
  assert.equal(game.active, null);
});

test('lock delay locks after LOCK_DELAY_MS and allows up to MAX_LOCK_RESETS resets', () => {
  const rng = makeSeededRng(88);
  const game = createGame({ rng });
  game.status = 'playing';
  game.active = { type: 'O', rot: 0, x: 4, y: TOTAL_ROWS - 3 };

  // Gravity drops O onto the floor and enters grounded state
  stepGame(game, 800, rng);
  assert.equal(game.active.y, TOTAL_ROWS - 2);
  assert.equal(game.grounded, true);

  // Move left/right up to MAX_LOCK_RESETS times; each should reset lockTimerMs
  for (let i = 0; i < MAX_LOCK_RESETS; i++) {
    stepGame(game, LOCK_DELAY_MS - 50, rng);
    assert.equal(game.piecesPlaced, 0);
    const dx = i % 2 === 0 ? -1 : 1;
    assert.equal(movePiece(game, dx, 0).moved, true);
    assert.equal(game.lockTimerMs, 0);
  }

  // Next move after MAX_LOCK_RESETS no longer resets lockTimerMs
  stepGame(game, LOCK_DELAY_MS - 50, rng);
  assert.equal(movePiece(game, -1, 0).moved, true);
  assert.equal(game.lockTimerMs, LOCK_DELAY_MS - 50);

  // Final 50ms locks the piece
  const lockEv = stepGame(game, 50, rng);
  assert.equal(lockEv?.type, 'lock');
  assert.equal(game.piecesPlaced, 1);
  assert.ok(dropIntervalMs(15) < dropIntervalMs(1));
  assert.equal(ROWS + BUFFER_ROWS, TOTAL_ROWS);
});

test('marathon save serialization round-trips valid state and rejects invalid payloads', () => {
  const rng = makeSeededRng(333);
  const game = createGame({ mode: 'marathon', rng });
  assert.equal(serializeMarathonSave(game), null); // still in 'ready'

  game.status = 'playing';
  assert.equal(serializeMarathonSave(game), null); // untouched (0 placed, 0 score, 0 lines)

  hardDrop(game, rng);
  game.hold = 'T';
  game.holdUsed = true;
  game.combo = 2;
  game.maxCombo = 2;
  game.backToBack = true;
  game.tetrises = 1;
  game.lines = 12;
  game.level = 2;

  const raw = serializeMarathonSave(game);
  assert.ok(raw);

  const restored = deserializeMarathonSave(raw, rng);
  assert.ok(restored);
  assert.equal(restored.status, 'paused');
  assert.equal(restored.score, game.score);
  assert.equal(restored.lines, 12);
  assert.equal(restored.level, 2);
  assert.equal(restored.hold, 'T');
  assert.equal(restored.holdUsed, true);
  assert.equal(restored.combo, 2);
  assert.equal(restored.backToBack, true);
  assert.deepEqual(restored.board, game.board);

  // Reject malformed / wrong-mode / tampered saves
  assert.equal(deserializeMarathonSave('not json'), null);
  const parsed = JSON.parse(raw);
  assert.equal(deserializeMarathonSave(JSON.stringify({ ...parsed, version: 99 })), null);
  assert.equal(deserializeMarathonSave(JSON.stringify({ ...parsed, mode: 'sprint' })), null);
  assert.equal(deserializeMarathonSave(JSON.stringify({ ...parsed, piecesPlaced: 0, score: 0, lines: 0 })), null);

  const badBoard = parsed.board.map((row) => [...row]);
  badBoard[0][0] = 'X';
  assert.equal(deserializeMarathonSave(JSON.stringify({ ...parsed, board: badBoard })), null);

  // Active piece colliding with board is rejected
  const blockedBoard = parsed.board.map((row) => [...row]);
  blockedBoard[parsed.active.y + 1][parsed.active.x + 1] = 'I';
  assert.equal(deserializeMarathonSave(JSON.stringify({ ...parsed, board: blockedBoard })), null);
});

test('T-Spin Double and All Clear award expected bonuses and counters', () => {
  const rng = makeSeededRng(404);
  const game = createGame({ mode: 'marathon', rng });
  game.status = 'playing';

  // Build a T-Spin Double pocket at rows 20..21 with 3 corners occupied around (4, 20)
  fillRow(game.board, TOTAL_ROWS - 2, [3, 4, 5], 'J');
  fillRow(game.board, TOTAL_ROWS - 1, [4], 'J');
  game.board[TOTAL_ROWS - 3][3] = 'J';
  game.active = { type: 'T', rot: 1, x: 3, y: TOTAL_ROWS - 3, powerup: null };

  assert.equal(rotatePiece(game, 1).rotated, true);
  const tSpinEv = lockActivePiece(game, rng);
  assert.equal(tSpinEv.isTSpin, true);
  assert.equal(tSpinEv.linesCleared, 2);
  assert.equal(tSpinEv.gained, 1200);
  assert.equal(game.tSpins, 1);
  assert.equal(game.backToBack, true);
  stepGame(game, CLEAR_DELAY_MS, rng);

  // All Clear: single remaining I-piece completes bottom row leaving board empty (combo = 1 -> +50)
  game.board.forEach((row) => row.fill(null));
  fillRow(game.board, TOTAL_ROWS - 1, [3, 4, 5, 6], 'S');
  game.active = { type: 'I', rot: 0, x: 3, y: TOTAL_ROWS - 2, powerup: null };
  const acEv = lockActivePiece(game, rng);
  assert.equal(acEv.linesCleared, 1);
  assert.equal(acEv.isAllClear, true);
  assert.equal(acEv.gained, 100 + 50 + 1800);
  assert.equal(game.allClears, 1);
  stepGame(game, CLEAR_DELAY_MS, rng);
  assert.equal(game.board.every((row) => row.every((cell) => cell === null)), true);
});

test('party mode spawns powerups every POWERUP_EVERY pieces, preserves on hold, and activates effects', () => {
  const rng = makeSeededRng(707);
  const game = createGame({ mode: 'party', rng });
  game.status = 'playing';

  const seenPowerups = [];
  for (let i = 0; i < POWERUP_EVERY * 2; i++) {
    seenPowerups.push(game.active.powerup);
    game.board.forEach((row) => row.fill(null));
    hardDrop(game, rng);
  }
  assert.equal(seenPowerups[POWERUP_EVERY - 1] !== null, true);
  assert.ok(POWERUP_TYPES.includes(seenPowerups[POWERUP_EVERY - 1]));
  assert.equal(seenPowerups[POWERUP_EVERY * 2 - 1] !== null, true);

  // Hold preserves powerup
  game.active = { type: 'O', rot: 0, x: 4, y: 5, powerup: 'bomb' };
  game.hold = null;
  game.holdPowerup = null;
  game.holdUsed = false;
  assert.equal(holdPiece(game, rng).held, true);
  assert.equal(game.hold, 'O');
  assert.equal(game.holdPowerup, 'bomb');

  // Bomb clears 3x3 neighborhood around center (x=6, y=21) and awards 25 * bombedCount * level
  game.board.forEach((row) => row.fill(null));
  game.score = 0;
  game.level = 1;
  game.board[TOTAL_ROWS - 1][7] = 'J';
  game.board[TOTAL_ROWS - 1][3] = 'J';
  game.active = { type: 'O', rot: 0, x: 4, y: TOTAL_ROWS - 2, powerup: 'bomb' };
  const bombEv = lockActivePiece(game, rng);
  assert.equal(bombEv.powerupTriggered?.type, 'bomb');
  assert.equal(bombEv.powerupTriggered.count, 5); // 4 cells of O + (7, TOTAL_ROWS-1)
  assert.equal(game.board[TOTAL_ROWS - 1][7], null);
  assert.equal(game.board[TOTAL_ROWS - 1][3], 'J'); // outside 3x3 around x=6
  assert.equal(game.score, 5 * 25);

  // Laser clears incomplete bottom row occupied by piece
  game.board.forEach((row) => row.fill(null));
  game.board[TOTAL_ROWS - 1][0] = 'L';
  game.board[TOTAL_ROWS - 1][9] = 'L';
  game.active = { type: 'O', rot: 0, x: 4, y: TOTAL_ROWS - 2, powerup: 'laser' };
  const laserEv = lockActivePiece(game, rng);
  assert.equal(laserEv.powerupTriggered?.type, 'laser');
  assert.equal(laserEv.linesCleared, 1);
  assert.ok(game.pendingClear);
  stepGame(game, CLEAR_DELAY_MS, rng);
  assert.equal(game.board[TOTAL_ROWS - 1][0], null);
  assert.equal(game.board[TOTAL_ROWS - 1][9], null);

  // Ice slows gravity & pauses garbage rising; garbage rises after GARBAGE_INTERVAL_MS when thawed
  game.board.forEach((row) => row.fill(null));
  game.active = { type: 'O', rot: 0, x: 4, y: TOTAL_ROWS - 2, powerup: 'ice' };
  const iceEv = lockActivePiece(game, rng);
  assert.equal(iceEv.powerupTriggered?.type, 'ice');
  assert.equal(game.iceTimerMs, ICE_DURATION_MS);

  const prevGarbageTimer = game.garbageTimerMs;
  stepGame(game, 500, rng);
  assert.equal(game.iceTimerMs, ICE_DURATION_MS - 500);
  assert.equal(game.garbageTimerMs, prevGarbageTimer); // paused during freeze

  game.iceTimerMs = 0;
  game.garbageTimerMs = GARBAGE_INTERVAL_MS - 100;
  const garbageEv = stepGame(game, 100, rng);
  assert.equal(garbageEv?.type, 'garbage');
  const bottomRow = game.board[TOTAL_ROWS - 1];
  assert.equal(bottomRow.filter((c) => c === 'G').length, COLS - 1);
  assert.equal(bottomRow.filter((c) => c === null).length, 1);

  // Danger ratio reflects top 4 visible rows
  game.board.forEach((row) => row.fill(null));
  assert.equal(getDangerRatio(game), 0);
  game.board[BUFFER_ROWS + 3][0] = 'J';
  assert.equal(getDangerRatio(game), 0.25);
  game.board[BUFFER_ROWS][0] = 'J';
  assert.equal(getDangerRatio(game), 1);
});

test('marathon and party modes pause for CLEAR_DELAY_MS during pendingClear and ignore inputs', () => {
  for (const mode of ['marathon', 'party']) {
    const rng = makeSeededRng(808);
    const game = createGame({ mode, rng });
    game.status = 'playing';
    assert.equal(game.clearDelayMs, CLEAR_DELAY_MS);

    game.board[TOTAL_ROWS - 3][9] = 'Z';
    fillRow(game.board, TOTAL_ROWS - 1, [3, 4, 5, 6], 'J');
    game.active = { type: 'I', rot: 0, x: 3, y: TOTAL_ROWS - 2, powerup: null };

    const ev = hardDrop(game, rng);
    assert.equal(ev?.linesCleared, 1);
    assert.equal(ev?.lockedType, 'I');
    assert.equal(ev?.lockedCells?.length, 4);
    assert.ok(game.pendingClear);
    assert.equal(game.pendingClear.rows.length, 1);
    assert.equal(game.active, null);
    // Full row remains visible on board during dissolve delay
    assert.equal(game.board[TOTAL_ROWS - 1].every((cell) => cell !== null), true);

    // Player inputs are ignored during pendingClear
    assert.equal(movePiece(game, -1, 0).moved, false);
    assert.equal(rotatePiece(game, 1).rotated, false);
    assert.equal(holdPiece(game, rng).held, false);
    assert.equal(hardDrop(game, rng), null);

    // Partial step advances timer without collapsing
    const prevGarbageTimer = game.garbageTimerMs;
    assert.equal(stepGame(game, 100, rng), null);
    assert.ok(game.pendingClear);
    assert.equal(game.pendingClear.elapsedMs, 100);
    assert.equal(game.garbageTimerMs, prevGarbageTimer);

    // Completing CLEAR_DELAY_MS collapses row and spawns next piece
    const nextQueued = game.queue[0];
    const done = stepGame(game, CLEAR_DELAY_MS - 100, rng);
    assert.equal(done?.type, 'clearComplete');
    assert.equal(game.pendingClear, null);
    assert.equal(game.active?.type, nextQueued);
    assert.equal(game.board[TOTAL_ROWS - 1][9], null);
    assert.equal(game.board[TOTAL_ROWS - 2][9], 'Z');
  }
});

test('sprint mode uses zero clear delay and collapses lines immediately', () => {
  const rng = makeSeededRng(909);
  const game = createGame({ mode: 'sprint', rng });
  game.status = 'playing';
  assert.equal(game.clearDelayMs, 0);

  game.board[TOTAL_ROWS - 3][9] = 'Z';
  fillRow(game.board, TOTAL_ROWS - 1, [3, 4, 5, 6], 'J');
  game.active = { type: 'I', rot: 0, x: 3, y: TOTAL_ROWS - 2, powerup: null };
  const nextQueued = game.queue[0];

  const ev = hardDrop(game, rng);
  assert.equal(ev?.linesCleared, 1);
  assert.equal(game.pendingClear, null);
  assert.equal(game.active?.type, nextQueued);
  assert.equal(game.board[TOTAL_ROWS - 1][9], null);
  assert.equal(game.board[TOTAL_ROWS - 2][9], 'Z');
});

test('serializeMarathonSave during pendingClear collapses a copy cleanly and restores next piece', () => {
  const rng = makeSeededRng(1010);
  const game = createGame({ mode: 'marathon', rng });
  game.status = 'playing';

  game.board[TOTAL_ROWS - 3][8] = 'L';
  fillRow(game.board, TOTAL_ROWS - 1, [3, 4, 5, 6], 'S');
  game.active = { type: 'I', rot: 0, x: 3, y: TOTAL_ROWS - 2, powerup: null };
  const expectedNext = game.queue[0];

  hardDrop(game, rng);
  assert.ok(game.pendingClear);

  const raw = serializeMarathonSave(game);
  assert.ok(raw);
  // Original state remains in pendingClear
  assert.ok(game.pendingClear);
  assert.equal(game.board[TOTAL_ROWS - 1].every((c) => c !== null), true);

  const restored = deserializeMarathonSave(raw, rng);
  assert.ok(restored);
  assert.equal(restored.pendingClear, null);
  assert.equal(restored.clearDelayMs, CLEAR_DELAY_MS);
  assert.equal(restored.active?.type, expectedNext);
  assert.equal(restored.board[TOTAL_ROWS - 1][8], null);
  assert.equal(restored.board[TOTAL_ROWS - 2][8], 'L');
  assert.equal(finishPendingClear(game, rng)?.type, 'clearComplete');
});
