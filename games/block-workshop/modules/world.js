export const SIZE = 24;
export const MAX_HEIGHT = 16;
export const MATERIALS = Object.freeze({
  grass: '#6f9876',
  sand: '#e7be7c',
  wood: '#bf8e58',
  stone: '#626661',
  iron: '#b9cbdc',
  copper: '#bf6846',
  gold: '#eeb327',
  diamond: '#39c7da',
  brick: '#b25241',
  leaves: '#4a854d',
  glass: '#9adbf0',
  snow: '#edf4fb',
});
export const SYMMETRY_MODES = Object.freeze(['off', 'x', 'z', 'xz']);
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

export function inBounds(position) {
  if (!position) return false;
  const { x, y, z } = position;
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
    x >= 0 && x < SIZE && y >= 0 && y < MAX_HEIGHT && z >= 0 && z < SIZE;
}

export function hasBlock(blocks, position) {
  return blocks.has(key(position));
}

export function getBlock(blocks, position) {
  return position ? blocks.get(key(position)) || null : null;
}

export function bridgeProgress(blocks) {
  return {
    placed: BRIDGE_PLAN.filter((position) => hasBlock(blocks, position)).length,
    step: BRIDGE_STEPS.find(({ cells }) => cells.some((position) => !hasBlock(blocks, position))),
    clear: BRIDGE_GAP.every((position) => !hasBlock(blocks, position)),
  };
}

export function canPlace(blocks, position) {
  return inBounds(position) && !blocks.has(key(position));
}

export function placeBlock(blocks, position, material) {
  if (!Object.hasOwn(MATERIALS, material) || !canPlace(blocks, position)) return false;
  blocks.set(key(position), { x: position.x, y: position.y, z: position.z, material });
  return true;
}

export function removeBlock(blocks, position) {
  return blocks.delete(key(position));
}

export function setBlock(blocks, position, material) {
  if (!position) return false;
  if (material === null) return removeBlock(blocks, position);
  if (!Object.hasOwn(MATERIALS, material) || !inBounds(position)) return false;
  blocks.set(key(position), { x: position.x, y: position.y, z: position.z, material });
  return true;
}

export function mirrorPositions(position, mode = 'off') {
  if (!position) return [];
  const candidates = [{ x: position.x, y: position.y, z: position.z }];
  const mirrorX = mode === 'x' || mode === 'xz';
  const mirrorZ = mode === 'z' || mode === 'xz';
  const mx = SIZE - 1 - position.x;
  const mz = SIZE - 1 - position.z;
  if (mirrorX) candidates.push({ x: mx, y: position.y, z: position.z });
  if (mirrorZ) candidates.push({ x: position.x, y: position.y, z: mz });
  if (mirrorX && mirrorZ) candidates.push({ x: mx, y: position.y, z: mz });
  const seen = new Set();
  return candidates.filter((cell) => {
    const id = key(cell);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function applyBatchPlace(blocks, positions, material) {
  if (!Object.hasOwn(MATERIALS, material) || !Array.isArray(positions)) return [];
  const changes = [];
  for (const pos of positions) {
    if (!placeBlock(blocks, pos, material)) continue;
    changes.push({ x: pos.x, y: pos.y, z: pos.z, before: null, after: material });
  }
  return changes;
}

export function applyBatchRemove(blocks, positions) {
  if (!Array.isArray(positions)) return [];
  const changes = [];
  for (const pos of positions) {
    const existing = getBlock(blocks, pos);
    if (!existing) continue;
    if (removeBlock(blocks, pos)) {
      changes.push({ x: existing.x, y: existing.y, z: existing.z, before: existing.material, after: null });
    }
  }
  return changes;
}

export function applyClear(blocks) {
  if (!blocks || !blocks.size) return [];
  const changes = [];
  for (const cell of blocks.values()) {
    changes.push({ x: cell.x, y: cell.y, z: cell.z, before: cell.material, after: null });
  }
  blocks.clear();
  return changes;
}

export function createHistory(limit = 100) {
  const undoStack = [];
  const redoStack = [];
  const maxEntries = Math.max(1, Number.isInteger(limit) ? limit : 100);

  function applyEntry(source, target, blocks, field, reverse) {
    if (!source.length) return null;
    const entry = source.pop();
    const materials = new Set();
    const ordered = reverse ? [...entry].reverse() : entry;
    for (const change of ordered) {
      const existing = blocks.get(key(change));
      if (existing) materials.add(existing.material);
      const nextMaterial = change[field];
      if (nextMaterial) materials.add(nextMaterial);
      setBlock(blocks, change, nextMaterial);
    }
    target.push(entry);
    return { changes: entry, materials };
  }

  return {
    push(changes) {
      if (!Array.isArray(changes) || !changes.length) return;
      redoStack.length = 0;
      undoStack.push(changes.map((c) => ({ x: c.x, y: c.y, z: c.z, before: c.before ?? null, after: c.after ?? null })));
      if (undoStack.length > maxEntries) undoStack.shift();
    },
    undo(blocks) {
      return applyEntry(undoStack, redoStack, blocks, 'before', true);
    },
    redo(blocks) {
      return applyEntry(redoStack, undoStack, blocks, 'after', false);
    },
    canUndo() { return undoStack.length > 0; },
    canRedo() { return redoStack.length > 0; },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
    size() { return undoStack.length; },
  };
}

export function createWorld() {
  return new Map();
}

function fillBox(blocks, x1, x2, y1, y2, z1, z2, material, hollow = false) {
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) {
        if (hollow && x > x1 && x < x2 && z > z1 && z < z2) continue;
        setBlock(blocks, { x, y, z }, material);
      }
    }
  }
}

function addTree(blocks, x, baseY, z) {
  fillBox(blocks, x, x, baseY, baseY + 2, z, z, 'wood');
  fillBox(blocks, x - 1, x + 1, baseY + 3, baseY + 3, z - 1, z + 1, 'leaves');
  setBlock(blocks, { x, y: baseY + 4, z }, 'leaves');
}

function buildCabin() {
  const blocks = createWorld();
  fillBox(blocks, 6, 17, 0, 0, 6, 17, 'grass');
  fillBox(blocks, 13, 17, 0, 0, 12, 17, 'sand');
  fillBox(blocks, 14, 17, 0, 0, 13, 16, 'glass');

  // Stone foundation, interior plank floor & front threshold
  fillBox(blocks, 7, 12, 1, 1, 7, 11, 'stone', true);
  fillBox(blocks, 8, 11, 1, 1, 8, 10, 'wood');
  removeBlock(blocks, { x: 9, y: 1, z: 11 });
  setBlock(blocks, { x: 9, y: 0, z: 12 }, 'stone');
  setBlock(blocks, { x: 9, y: 0, z: 13 }, 'stone');

  // Timber walls with doorway & glass windows
  fillBox(blocks, 7, 12, 2, 3, 7, 11, 'wood', true);
  removeBlock(blocks, { x: 9, y: 2, z: 11 });
  for (const win of [
    { x: 11, y: 2, z: 11 },
    { x: 7, y: 2, z: 9 },
    { x: 12, y: 2, z: 9 },
    { x: 9, y: 2, z: 7 },
    { x: 10, y: 2, z: 7 },
  ]) {
    setBlock(blocks, win, 'glass');
  }

  // Pitched brick roof & stone-brick chimney
  fillBox(blocks, 7, 12, 4, 4, 7, 11, 'brick', true);
  fillBox(blocks, 7, 12, 5, 5, 8, 10, 'brick');
  fillBox(blocks, 7, 12, 6, 6, 9, 9, 'brick');
  fillBox(blocks, 7, 7, 4, 7, 8, 8, 'stone');

  // Lantern by door & lakeside tree
  setBlock(blocks, { x: 8, y: 1, z: 12 }, 'wood');
  setBlock(blocks, { x: 8, y: 2, z: 12 }, 'gold');
  addTree(blocks, 15, 1, 8);
  return blocks;
}

function buildLighthouse() {
  const blocks = createWorld();
  fillBox(blocks, 6, 17, 0, 0, 6, 17, 'glass');
  fillBox(blocks, 9, 16, 0, 0, 6, 12, 'sand');
  fillBox(blocks, 10, 15, 0, 1, 7, 11, 'stone');
  fillBox(blocks, 12, 12, 0, 0, 12, 15, 'wood');

  // Striped brick & snow tower shaft
  fillBox(blocks, 11, 13, 2, 3, 8, 10, 'snow', true);
  fillBox(blocks, 11, 13, 4, 5, 8, 10, 'brick', true);
  fillBox(blocks, 11, 13, 6, 7, 8, 10, 'snow', true);
  fillBox(blocks, 11, 13, 8, 8, 8, 10, 'brick', true);
  setBlock(blocks, { x: 12, y: 2, z: 10 }, 'wood');

  // Iron observation deck, glass lantern room & copper dome
  fillBox(blocks, 10, 14, 9, 9, 7, 11, 'iron');
  fillBox(blocks, 11, 13, 10, 11, 8, 10, 'glass', true);
  fillBox(blocks, 12, 12, 10, 11, 9, 9, 'gold');
  fillBox(blocks, 11, 13, 12, 12, 8, 10, 'copper');
  setBlock(blocks, { x: 12, y: 13, z: 9 }, 'copper');

  // Keeper's hut
  fillBox(blocks, 14, 15, 2, 2, 8, 9, 'wood');
  fillBox(blocks, 14, 15, 3, 3, 8, 9, 'brick');
  return blocks;
}

function buildArchBridge() {
  const blocks = createWorld();
  fillBox(blocks, 6, 17, 0, 0, 6, 17, 'grass');
  fillBox(blocks, 9, 14, 0, 0, 6, 17, 'sand');
  fillBox(blocks, 10, 13, 0, 0, 6, 17, 'glass');

  // Bridge stone abutments & approaches
  fillBox(blocks, 8, 8, 1, 1, 10, 13, 'stone');
  fillBox(blocks, 15, 15, 1, 1, 10, 13, 'stone');
  fillBox(blocks, 9, 9, 1, 1, 10, 13, 'stone');
  fillBox(blocks, 14, 14, 1, 1, 10, 13, 'stone');
  fillBox(blocks, 9, 9, 2, 2, 10, 13, 'wood');
  fillBox(blocks, 14, 14, 2, 2, 10, 13, 'wood');

  // Arched deck over stream
  for (const z of [10, 13]) {
    setBlock(blocks, { x: 10, y: 2, z }, 'stone');
    setBlock(blocks, { x: 13, y: 2, z }, 'stone');
  }
  fillBox(blocks, 10, 13, 3, 3, 10, 13, 'wood');

  // Railings & gold bridge lamps
  for (const x of [9, 14]) {
    for (const z of [10, 13]) setBlock(blocks, { x, y: 3, z }, 'stone');
  }
  for (const x of [10, 11, 12, 13]) {
    for (const z of [10, 13]) setBlock(blocks, { x, y: 4, z }, x === 11 || x === 12 ? 'stone' : 'iron');
  }
  setBlock(blocks, { x: 11, y: 5, z: 10 }, 'gold');
  setBlock(blocks, { x: 12, y: 5, z: 13 }, 'gold');

  // Flanking trees
  addTree(blocks, 7, 1, 7);
  addTree(blocks, 16, 1, 16);
  return blocks;
}

export const TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'cabin',
    name: '湖畔小屋',
    description: '石基木屋配红砖坡顶、烟囱与小水塘。',
    build: buildCabin,
  }),
  Object.freeze({
    id: 'lighthouse',
    name: '海角灯塔',
    description: '礁石上的红白条纹灯塔，带玻璃灯室与铜顶。',
    build: buildLighthouse,
  }),
  Object.freeze({
    id: 'arch-bridge',
    name: '花园拱桥',
    description: '跨溪石木拱桥，两岸有树影和暖金路灯。',
    build: buildArchBridge,
  }),
]);

export function createTemplateWorld(id) {
  const template = TEMPLATES.find((entry) => entry.id === id);
  return template ? template.build() : null;
}

export function createPracticeWorld() {
  const blocks = createWorld();
  for (const x of pierXs) {
    for (const z of bridgeRows) placeBlock(blocks, { x, y: 0, z }, 'stone');
  }
  return blocks;
}
