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

test('minesweeper board generation keeps 3x3 start zone safe, computes adj, and flood-fills safely', () => {
  assert.deepEqual(GameRules.mineNeighbors(9, 0, 0), [[0, 1], [1, 0], [1, 1]]);
  assert.equal(GameRules.mineNeighbors(9, 4, 4).length, 8);

  const board = GameRules.createMineBoard(9);
  assert.equal(board.length, 9);
  assert.equal(board[0].length, 9);

  const rng = makeSeededRng(20261124);
  GameRules.placeMinesOnBoard(board, 10, 4, 4, rng);

  let mines = 0;
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (Math.abs(r - 4) <= 1 && Math.abs(c - 4) <= 1) {
        assert.equal(board[r][c].mine, false, 'start 3x3 neighborhood must stay mine-free');
      }
      if (board[r][c].mine) mines += 1;
    }
  }
  assert.equal(mines, 10);

  // Spot check adj accuracy
  const checkCell = board.flat().find((cell) => !cell.mine && cell.adj > 0);
  assert.ok(checkCell);

  // Flood fill stops at flagged/mine/numbered cells
  const floodBoard = GameRules.createMineBoard(4);
  floodBoard[3][3].mine = true;
  floodBoard[2][2].adj = 1;
  floodBoard[2][3].adj = 1;
  floodBoard[3][2].adj = 1;
  floodBoard[0][1].flag = true;
  const opened = GameRules.revealMineSafeArea(floodBoard, 0, 0);
  assert.equal(floodBoard[0][0].open, true);
  assert.equal(floodBoard[0][1].open, false); // skipped flagged cell
  assert.equal(floodBoard[3][3].open, false); // skipped mine cell
  assert.equal(floodBoard[2][2].open, true);  // numbered border cell opens and stops cascade
  assert.equal(opened, 14);
});

test('snake helpers pick valid empty cells, detect wall/self/tail movement, and scale tick delay', () => {
  const rng = makeSeededRng(12345);
  const snake = [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }];
  const pos = GameRules.snakeRandomEmptyCell(5, snake, { x: 3, y: 3 }, null, { preferInterior: true }, rng);
  assert.ok(pos && pos.x > 0 && pos.x < 4 && pos.y > 0 && pos.y < 4);

  // Full board returns null
  const fullSnake = [];
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 2; x += 1) fullSnake.push({ x, y });
  }
  assert.equal(GameRules.snakeRandomEmptyCell(2, fullSnake, null, null, {}, rng), null);

  // Wall collision in classic mode vs wrap in wrap mode
  const edgeSnake = [{ x: 0, y: 2 }, { x: 1, y: 2 }];
  assert.equal(GameRules.snakeNextStep(5, edgeSnake, { x: -1, y: 0 }, false, null, null).collision, 'wall');
  const wrapped = GameRules.snakeNextStep(5, edgeSnake, { x: -1, y: 0 }, true, null, null);
  assert.equal(wrapped.collision, null);
  assert.deepEqual(wrapped.head, { x: 4, y: 2 });

  // Moving into departing tail cell is legal when not growing, illegal when growing or hitting mid-body
  const loopSnake = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }];
  assert.equal(GameRules.snakeNextStep(5, loopSnake, { x: 0, y: 1 }, false, null, null).collision, null);
  assert.equal(GameRules.snakeNextStep(5, loopSnake, { x: 0, y: 1 }, false, { x: 1, y: 2 }, null).collision, 'self');
  assert.equal(GameRules.snakeNextStep(5, loopSnake, { x: 1, y: 0 }, false, null, null).collision, 'self');

  // Growth detection and speed delay floor
  const growStep = GameRules.snakeNextStep(5, edgeSnake, { x: 0, y: -1 }, false, { x: 0, y: 1 }, null);
  assert.equal(growStep.ateFood, true);
  assert.equal(growStep.willGrow, true);

  assert.equal(GameRules.snakeTickDelay(0, 0), 185);
  assert.equal(GameRules.snakeTickDelay(100, 0), 161);
  assert.equal(GameRules.snakeTickDelay(1000, 28), 110);
});

test('memory deck builder creates balanced shuffled pairs and match helper checks pairs', () => {
  const icons = [
    { id: 'apple', name: '苹果' },
    { id: 'orange', name: '橙子' },
    { id: 'lemon', name: '柠檬' },
    { id: 'grape', name: '葡萄' },
  ];
  const deck = GameRules.buildMemoryDeck(icons, 3, makeSeededRng(77));
  assert.equal(deck.length, 6);
  const counts = {};
  for (const card of deck) counts[card.icon] = (counts[card.icon] || 0) + 1;
  assert.deepEqual(counts, { apple: 2, orange: 2, lemon: 2 });

  assert.equal(GameRules.isMemoryPairMatch('apple', 'apple'), true);
  assert.equal(GameRules.isMemoryPairMatch('apple', 'orange'), false);
  assert.equal(GameRules.isMemoryPairMatch('', ''), false);
});
