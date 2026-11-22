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

test('projects CRUD, optimistic concurrency, v1 migration, and session drafts', () => {
  localStorage.clear();
  sessionStorage.clear();

  const blocks = world.createWorld();
  world.placeBlock(blocks, { x: 1, y: 0, z: 2 }, 'iron');

  const raw1 = projects.saveProject('p1', 'Bridge', blocks, null);
  assert.equal(projects.readProject('p1').blocks.size, 1);
  assert.deepEqual(projects.listProjects(), [{ id: 'p1', name: 'Bridge' }]);

  assert.throws(() => projects.saveProject('p1', 'Bridge', blocks, null), /Project changed/);

  world.placeBlock(blocks, { x: 2, y: 0, z: 2 }, 'gold');
  const raw2 = projects.saveProject('p1', 'Bridge', blocks, raw1);
  assert.equal(projects.readProject('p1').blocks.size, 2);

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

  assert.throws(() => projects.deleteProject('p1', raw1), /Project changed/);
  projects.deleteProject('p1', raw2);
  assert.equal(projects.readProject('p1'), null);
});
