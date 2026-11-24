import test from 'node:test';
import assert from 'node:assert/strict';

function createMemoryStorage() {
  class MemoryStorage {
    getItem(key) {
      const k = String(key);
      return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null;
    }
    setItem(key, value) {
      this[String(key)] = String(value);
    }
    removeItem(key) {
      delete this[String(key)];
    }
    clear() {
      for (const k of Object.keys(this)) delete this[k];
    }
  }
  return new MemoryStorage();
}

globalThis.localStorage = createMemoryStorage();
globalThis.sessionStorage = createMemoryStorage();

const world = await import('../games/block-workshop/modules/world.js');
const projects = await import('../games/block-workshop/modules/projects.js');

test('world bounds, material validation, placement, and removal', () => {
  const blocks = world.createWorld();
  assert.equal(world.canPlace(blocks, { x: 0, y: 0, z: 0 }), true);
  assert.equal(world.canPlace(blocks, { x: world.SIZE - 1, y: world.MAX_HEIGHT - 1, z: world.SIZE - 1 }), true);
  assert.equal(world.canPlace(blocks, { x: -1, y: 0, z: 0 }), false);
  assert.equal(world.canPlace(blocks, { x: world.SIZE, y: 0, z: 0 }), false);
  assert.equal(world.canPlace(blocks, { x: 0, y: world.MAX_HEIGHT, z: 0 }), false);
  assert.equal(world.canPlace(blocks, { x: 1.5, y: 0, z: 0 }), false);

  assert.equal(world.placeBlock(blocks, { x: 2, y: 0, z: 3 }, 'bedrock'), false);
  assert.equal(world.placeBlock(blocks, { x: 2, y: 0, z: 3 }, 'grass'), true);
  assert.equal(world.hasBlock(blocks, { x: 2, y: 0, z: 3 }), true);
  assert.equal(world.canPlace(blocks, { x: 2, y: 0, z: 3 }), false);
  assert.equal(world.placeBlock(blocks, { x: 2, y: 0, z: 3 }, 'stone'), false);

  assert.equal(world.removeBlock(blocks, { x: 2, y: 0, z: 3 }), true);
  assert.equal(world.removeBlock(blocks, { x: 2, y: 0, z: 3 }), false);
  assert.equal(world.hasBlock(blocks, { x: 2, y: 0, z: 3 }), false);
});

test('bridge tutorial practice world and step progression', () => {
  const blocks = world.createPracticeWorld();
  assert.equal(blocks.size, 4);

  const initial = world.bridgeProgress(blocks);
  assert.equal(initial.placed, 0);
  assert.equal(initial.clear, true);
  assert.equal(initial.step, world.BRIDGE_STEPS[0]);

  for (const cell of world.BRIDGE_STEPS[0].cells) {
    assert.equal(world.placeBlock(blocks, cell, 'stone'), true);
  }
  const afterStep1 = world.bridgeProgress(blocks);
  assert.equal(afterStep1.placed, world.BRIDGE_STEPS[0].cells.length);
  assert.equal(afterStep1.step, world.BRIDGE_STEPS[1]);

  // Placing under the bridge deck should mark gap unclear
  const blocker = { x: 10, y: 0, z: 13 };
  assert.equal(world.placeBlock(blocks, blocker, 'wood'), true);
  assert.equal(world.bridgeProgress(blocks).clear, false);
  assert.equal(world.removeBlock(blocks, blocker), true);

  for (const step of world.BRIDGE_STEPS.slice(1)) {
    for (const cell of step.cells) assert.equal(world.placeBlock(blocks, cell, 'wood'), true);
  }
  const finished = world.bridgeProgress(blocks);
  assert.equal(finished.placed, world.BRIDGE_PLAN.length);
  assert.equal(finished.step, undefined);
  assert.equal(finished.clear, true);
});

test('projects CRUD, optimistic concurrency, rename, v1 migration, and session drafts', () => {
  localStorage.clear();
  sessionStorage.clear();

  const blocks = world.createWorld();
  world.placeBlock(blocks, { x: 1, y: 0, z: 2 }, 'iron');

  const raw1 = projects.saveProject('p1', 'Bridge', blocks, null);
  assert.equal(projects.readProject('p1').blocks.size, 1);
  const listed1 = projects.listProjects();
  assert.equal(listed1.length, 1);
  assert.equal(listed1[0].id, 'p1');
  assert.equal(listed1[0].name, 'Bridge');
  assert.equal(listed1[0].count, 1);
  assert.equal(typeof listed1[0].updatedAt, 'number');

  assert.throws(() => projects.saveProject('p1', 'Bridge', blocks, null), /Project changed/);

  world.placeBlock(blocks, { x: 2, y: 0, z: 2 }, 'gold');
  const raw2 = projects.saveProject('p1', 'Bridge', blocks, raw1);
  assert.equal(projects.readProject('p1').blocks.size, 2);

  // Rename preserves blocks and rejects stale raw
  assert.throws(() => projects.renameProject('p1', 'Golden Bridge', raw1), /Project changed/);
  const raw3 = projects.renameProject('p1', 'Golden Bridge', raw2);
  assert.equal(projects.readProject('p1').name, 'Golden Bridge');
  assert.equal(projects.readProject('p1').blocks.size, 2);

  // Sorting orders newest updatedAt first
  const blocks2 = world.createWorld();
  world.placeBlock(blocks2, { x: 0, y: 0, z: 0 }, 'brick');
  localStorage.setItem('game_save_block-workshop_older', JSON.stringify({
    version: 2,
    name: 'Older',
    updatedAt: 1000,
    cells: [{ x: 0, y: 0, z: 0, material: 'brick' }],
  }));
  const sorted = projects.listProjects();
  assert.equal(sorted[0].id, 'p1');
  assert.equal(sorted[1].id, 'older');
  assert.equal(sorted[1].count, 1);
  localStorage.removeItem('game_save_block-workshop_older');

  // Remember and read saved project session
  projects.rememberSession('p1', blocks);
  const loadedSavedSession = projects.readSession();
  assert.equal(loadedSavedSession.id, 'p1');
  assert.equal(loadedSavedSession.blocks.size, 2);

  // Unnamed draft session
  const draftBlocks = world.createWorld();
  world.placeBlock(draftBlocks, { x: 5, y: 1, z: 5 }, 'diamond');
  projects.rememberSession(null, draftBlocks);
  const loadedDraft = projects.readSession();
  assert.equal(loadedDraft.id, null);
  assert.equal(loadedDraft.blocks.get('5:1:5')?.material, 'diamond');

  // v1 -> v2 coordinate migration (+2 offset on x and z from oldSize=20 to SIZE=24)
  localStorage.setItem('game_save_block-workshop_v1ok', JSON.stringify({
    version: 1,
    name: 'Legacy',
    cells: [{ x: 0, y: 0, z: 19, material: 'stone' }],
  }));
  const migrated = projects.readProject('v1ok');
  assert.ok(migrated);
  assert.equal(migrated.blocks.get('2:0:21')?.material, 'stone');

  // Out-of-bounds v1 cell is rejected
  localStorage.setItem('game_save_block-workshop_v1bad', JSON.stringify({
    version: 1,
    name: 'InvalidLegacy',
    cells: [{ x: 20, y: 0, z: 0, material: 'stone' }],
  }));
  assert.equal(projects.readProject('v1bad'), null);

  assert.throws(() => projects.deleteProject('p1', raw2), /Project changed/);
  projects.deleteProject('p1', raw3);
  assert.equal(projects.readProject('p1'), null);
});

test('all 12 materials, mirror symmetry, undo/redo history, batch clear, and starter templates', () => {
  const expectedMaterials = [
    'grass', 'sand', 'wood', 'stone', 'iron', 'copper',
    'gold', 'diamond', 'brick', 'leaves', 'glass', 'snow',
  ];
  assert.deepEqual(Object.keys(world.MATERIALS), expectedMaterials);

  const matBlocks = world.createWorld();
  expectedMaterials.forEach((mat, index) => {
    assert.equal(world.placeBlock(matBlocks, { x: index, y: 0, z: 0 }, mat), true);
  });
  assert.equal(matBlocks.size, 12);

  // Symmetry mirroring & deduplication
  assert.deepEqual(world.mirrorPositions({ x: 2, y: 1, z: 3 }, 'off'), [{ x: 2, y: 1, z: 3 }]);
  assert.deepEqual(world.mirrorPositions({ x: 2, y: 1, z: 3 }, 'x'), [
    { x: 2, y: 1, z: 3 },
    { x: 21, y: 1, z: 3 },
  ]);
  assert.deepEqual(world.mirrorPositions({ x: 2, y: 1, z: 3 }, 'z'), [
    { x: 2, y: 1, z: 3 },
    { x: 2, y: 1, z: 20 },
  ]);
  assert.deepEqual(world.mirrorPositions({ x: 2, y: 1, z: 3 }, 'xz'), [
    { x: 2, y: 1, z: 3 },
    { x: 21, y: 1, z: 3 },
    { x: 2, y: 1, z: 20 },
    { x: 21, y: 1, z: 20 },
  ]);

  // History undo/redo + batch clear + redo clear on new edit + capacity cap
  const blocks = world.createWorld();
  const history = world.createHistory(3);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);

  const placeChanges = world.applyBatchPlace(blocks, world.mirrorPositions({ x: 1, y: 0, z: 1 }, 'xz'), 'brick');
  assert.equal(placeChanges.length, 4);
  assert.equal(blocks.size, 4);
  history.push(placeChanges);
  assert.equal(history.canUndo(), true);

  const undo1 = history.undo(blocks);
  assert.ok(undo1 && undo1.materials.has('brick'));
  assert.equal(blocks.size, 0);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), true);

  const redo1 = history.redo(blocks);
  assert.ok(redo1 && redo1.materials.has('brick'));
  assert.equal(blocks.size, 4);

  const removeChanges = world.applyBatchRemove(blocks, world.mirrorPositions({ x: 1, y: 0, z: 1 }, 'x'));
  assert.equal(removeChanges.length, 2);
  assert.equal(blocks.size, 2);
  history.push(removeChanges);
  assert.equal(history.canRedo(), false);

  const clearChanges = world.applyClear(blocks);
  assert.equal(clearChanges.length, 2);
  assert.equal(blocks.size, 0);
  history.push(clearChanges);
  history.undo(blocks);
  assert.equal(blocks.size, 2);

  // Limit enforcement (max 3)
  history.push(world.applyBatchPlace(blocks, [{ x: 0, y: 1, z: 0 }], 'snow'));
  history.push(world.applyBatchPlace(blocks, [{ x: 0, y: 2, z: 0 }], 'glass'));
  assert.equal(history.size(), 3);

  // Starter templates
  assert.equal(world.TEMPLATES.length, 3);
  assert.equal(world.createTemplateWorld('missing'), null);
  for (const tpl of world.TEMPLATES) {
    const built = world.createTemplateWorld(tpl.id);
    assert.ok(built && built.size >= 40, `template ${tpl.id} should be populated`);
    for (const cell of built.values()) {
      assert.equal(world.inBounds(cell), true, `template ${tpl.id} cell in bounds`);
      assert.equal(Object.hasOwn(world.MATERIALS, cell.material), true, `template ${tpl.id} valid material`);
    }
  }
});
