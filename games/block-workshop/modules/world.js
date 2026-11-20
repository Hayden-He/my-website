export const SIZE = 24;
export const MAX_HEIGHT = 16;
export const MATERIALS = Object.freeze({ grass: '#6f9876', sand: '#e7be7c', wood: '#bf8e58', stone: '#626661', iron: '#b9cbdc', copper: '#bf6846', gold: '#eeb327', diamond: '#39c7da' });
const middle = SIZE / 2;
const pierXs = [middle - 3, middle + 2];
const bridgeRows = [middle + 1, middle + 2];

export const BRIDGE_STEPS = [
  {
    prompt: '先补齐两端的桥墩。',
    cells: pierXs.flatMap((x) => bridgeRows.map((z) => ({ x, y: 1, z }))),
  },
  {
    prompt: '点方块侧面，把悬空桥面向中间接起来。',
    cells: Array.from({ length: 6 }, (_, index) => middle - 3 + index)
      .flatMap((x) => bridgeRows.map((z) => ({ x, y: 2, z }))),
  },
  {
    prompt: '沿蓝图加上护栏。',
    cells: Array.from({ length: 4 }, (_, index) => ({ x: middle - 2 + index, y: 3, z: bridgeRows[0] })),
  },
];

export const BRIDGE_PLAN = BRIDGE_STEPS.flatMap(({ cells }) => cells);
const BRIDGE_GAP = Array.from({ length: 4 }, (_, index) => middle - 2 + index)
  .flatMap((x) => bridgeRows.flatMap((z) => [0, 1].map((y) => ({ x, y, z }))));

function key({ x, y, z }) {
  return x + ':' + y + ':' + z;
}

export function hasBlock(blocks, position) {
  return blocks.has(key(position));
}

export function bridgeProgress(blocks) {
  return {
    placed: BRIDGE_PLAN.filter((position) => hasBlock(blocks, position)).length,
    step: BRIDGE_STEPS.find(({ cells }) => cells.some((position) => !hasBlock(blocks, position))),
    clear: BRIDGE_GAP.every((position) => !hasBlock(blocks, position)),
  };
}

export function canPlace(blocks, { x, y, z }) {
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
    x >= 0 && x < SIZE && y >= 0 && y < MAX_HEIGHT && z >= 0 && z < SIZE && !blocks.has(key({ x, y, z }));
}

export function placeBlock(blocks, position, material) {
  if (!Object.hasOwn(MATERIALS, material) || !canPlace(blocks, position)) return false;
  blocks.set(key(position), { ...position, material });
  return true;
}

export function removeBlock(blocks, position) {
  return blocks.delete(key(position));
}

export function createWorld() {
  return new Map();
}


export function createPracticeWorld() {
  const blocks = createWorld();
  for (const x of pierXs) {
    for (const z of bridgeRows) placeBlock(blocks, { x, y: 0, z }, 'stone');
  }
  return blocks;
}
