import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = fs.readFileSync(path.join(root, 'assets/game-rules.js'), 'utf8');
const win = {};
new Function('window', source)(win);
const GameRules = win.GameRules;

const toLine = (values) => values.map((val, idx) => ({ val, idx }));

test('merge2048Line merges pairs once per move and tracks origins & scores', () => {
  const fourTwos = GameRules.merge2048Line(toLine([2, 2, 2, 2]));
  assert.deepEqual(fourTwos.result, [4, 4, 0, 0]);
  assert.deepEqual(fourTwos.origins, [[0, 1], [2, 3], [], []]);
  assert.deepEqual(fourTwos.mergedIdx, [0, 1]);
  assert.equal(fourTwos.gained, 8);
  assert.equal(fourTwos.highestMerged, 4);

  const noChain = GameRules.merge2048Line(toLine([2, 2, 4, 0]));
  assert.deepEqual(noChain.result, [4, 4, 0, 0]);
  assert.deepEqual(noChain.origins, [[0, 1], [2], [], []]);
  assert.deepEqual(noChain.mergedIdx, [0]);
  assert.equal(noChain.gained, 4);
  assert.equal(noChain.highestMerged, 4);

  const sparse = GameRules.merge2048Line(toLine([0, 8, 0, 8]));
  assert.deepEqual(sparse.result, [16, 0, 0, 0]);
  assert.deepEqual(sparse.origins, [[1, 3], [], [], []]);
  assert.equal(sparse.gained, 16);
  assert.equal(sparse.highestMerged, 16);
});

test('canMove2048 detects empty spaces, adjacent matches, and deadlocks', () => {
  assert.equal(GameRules.canMove2048([
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 32, 0],
  ]), true);

  assert.equal(GameRules.canMove2048([
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 32, 32],
  ]), true);

  assert.equal(GameRules.canMove2048([
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 32, 4],
  ]), true);

  assert.equal(GameRules.canMove2048([
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [2, 4, 8, 16],
    [32, 64, 128, 256],
  ]), false);
});

function countInversions(board) {
  let inv = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) continue;
    for (let j = i + 1; j < board.length; j++) {
      if (board[j] !== 0 && board[i] > board[j]) inv += 1;
    }
  }
  return inv;
}

function isSlideSolvable(size, board) {
  const inversions = countInversions(board);
  if (size % 2 === 1) return inversions % 2 === 0;
  const blankRowFromBottom = size - Math.floor(board.indexOf(0) / size);
  return (inversions + blankRowFromBottom) % 2 === 1;
}

function manhattanDistance(size, board) {
  return board.reduce((sum, val, idx) => {
    if (val === 0) return sum;
    const target = val - 1;
    return sum + Math.abs(Math.floor(idx / size) - Math.floor(target / size))
      + Math.abs((idx % size) - (target % size));
  }, 0);
}

function makeSeededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('slide helpers and shuffleSlideBoard produce valid solvable boards', () => {
  assert.deepEqual(GameRules.solvedSlideBoard(3), [1, 2, 3, 4, 5, 6, 7, 8, 0]);
  assert.deepEqual(GameRules.slideNeighbors(3, 0), [3, 1]);
  assert.deepEqual(GameRules.slideNeighbors(3, 4), [1, 7, 3, 5]);

  const rng = makeSeededRng(20261122);
  for (const [size, beginner] of [[3, false], [3, true], [4, false], [4, true]]) {
    const board = GameRules.shuffleSlideBoard(size, beginner, rng);
    assert.equal(board.length, size * size);
    assert.deepEqual([...board].sort((a, b) => a - b), Array.from({ length: size * size }, (_, i) => i));
    assert.equal(isSlideSolvable(size, board), true);
    assert.notDeepEqual(board, GameRules.solvedSlideBoard(size));
    assert.ok(manhattanDistance(size, board) >= (beginner ? 6 : 1));
  }
});

test('scoreHoop computes swish combo, bank shot, normal shot, and gold multiplier', () => {
  assert.deepEqual(GameRules.scoreHoop({ hitBoard: false, hitRim: false, isGold: false }, 0), {
    kind: 'swish',
    combo: 1,
    gained: 4,
  });
  assert.deepEqual(GameRules.scoreHoop({ hitBoard: false, hitRim: false, isGold: false }, 1), {
    kind: 'swish',
    combo: 2,
    gained: 5,
  });
  assert.deepEqual(GameRules.scoreHoop({ hitBoard: false, hitRim: false, isGold: true }, 2), {
    kind: 'swish',
    combo: 3,
    gained: 10,
  });
  assert.deepEqual(GameRules.scoreHoop({ hitBoard: true, hitRim: false, isGold: false }, 3), {
    kind: 'bank',
    combo: 0,
    gained: 3,
  });
  assert.deepEqual(GameRules.scoreHoop({ hitBoard: false, hitRim: true, isGold: true }, 2), {
    kind: 'normal',
    combo: 0,
    gained: 4,
  });
});

test('hoopBounce handles misses, separating motion, reflection, and vx clamping', () => {
  assert.equal(GameRules.hoopBounce({ x: 20, y: 0, vx: 10, vy: 0 }, 0, 0, 10), null);
  assert.equal(GameRules.hoopBounce({ x: 0, y: 0, vx: 10, vy: 0 }, 0, 0, 10), null);

  const separating = GameRules.hoopBounce({ x: 5, y: 0, vx: 12, vy: -3 }, 0, 0, 10);
  assert.deepEqual(separating, { x: 10, y: 0, vx: 12, vy: -3 });

  const reflected = GameRules.hoopBounce({ x: -5, y: 0, vx: 20, vy: 0 }, 0, 0, 10);
  assert.equal(reflected.x, -10);
  assert.equal(reflected.y, 0);
  assert.ok(reflected.vx < 0);
  assert.equal(reflected.vy, 0);

  const clamped = GameRules.hoopBounce({ x: 5, y: 0, vx: -100, vy: 0 }, 0, 0, 10);
  assert.equal(clamped.vx, 65);
});
