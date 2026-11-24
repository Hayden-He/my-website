import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W, H, BOSS_BEAM_LENGTH, MOTHERSHIP_DEPLOY_SECONDS, SKINS, PICKUP_THEMES, SPACE_SCENES,
  getBossKind, getBossName, buildWaveQueue, computeBossLasers,
  mothershipShieldLinks, crimsonDashEnd, openingEnemyShots, prismBeam,
  bulletCrossesCircle, ellipseImpactTime, fastRockOverlaps,
  beamHitsPlayer, bossHullImpactTime,
} from '../games/space/modules/rules.js';

test('space configs expose valid skins, pickup themes, and backdrops', () => {
  assert.deepEqual(Object.keys(SKINS), ['cobalt', 'crimson', 'phantom']);
  assert.deepEqual(Object.keys(PICKUP_THEMES), ['weapon', 'shield', 'overdrive', 'heal', 'emp', 'blast']);
  assert.equal(SPACE_SCENES.length, 3);
});

test('getBossKind cycles across crimson, prism, and mothership tiers', () => {
  assert.equal(getBossKind(1), 'crimson');
  assert.equal(getBossKind(2), 'prism');
  assert.equal(getBossKind(3), 'mothership');
  assert.equal(getBossKind(4), 'crimson');
  assert.equal(getBossName('crimson', true), '绯红裁决者 BOSS');
  assert.equal(getBossName('prism', false), '苍蓝棱镜');
  assert.equal(getBossName('mothership', false), '紫曜母舰');
});

test('buildWaveQueue returns scripted waves for 1-4, standard 7 and 9, ace extras, and procedural waves', () => {
  const wave1 = buildWaveQueue(1, 'standard');
  assert.equal(wave1.length, 2);
  assert.equal(wave1[0].items.length, 3);
  assert.equal(wave1[0].items[0].kind, 'scout');

  const wave2Ace = buildWaveQueue(2, 'ace');
  assert.equal(wave2Ace.length, 4);
  assert.equal(wave2Ace[2].delay, 0.82);
  assert.equal(wave2Ace[3].delay, 0);

  const wave3 = buildWaveQueue(3, 'standard');
  assert.equal(wave3[0].items[0].lesson, 'flank');

  const wave4 = buildWaveQueue(4, 'standard');
  assert.equal(wave4[0].items[0].kind, 'gunship');

  const wave7Std = buildWaveQueue(7, 'standard');
  assert.equal(wave7Std.length, 6);

  const wave9Std = buildWaveQueue(9, 'standard');
  assert.equal(wave9Std.length, 6);
  assert.equal(wave9Std[1].items[0].kind, 'gunship');

  const wave7Ace = buildWaveQueue(7, 'ace', () => 0.9);
  assert.equal(wave7Ace.length, 17); // 7 + floor(7 * 1.5) = 17 single spawns when rng=0.9
  assert.ok(wave7Ace.every((entry) => entry.items.length >= 1));

  const wave6Proc = buildWaveQueue(6, 'standard', () => 0.1);
  assert.equal(wave6Proc.length, 4);
  const total6 = wave6Proc.reduce((sum, entry) => sum + entry.items.length, 0);
  assert.equal(total6, 14);
});

test('boss helpers compute lasers, mothership shield links, crimson dash end, opening shots, and prism beam', () => {
  const lasers = computeBossLasers({ x: 230, y: 100 });
  assert.equal(lasers.length, 2);
  assert.equal(lasers[0].x, 184);
  assert.equal(lasers[1].x, 276);
  assert.equal(lasers[0].y, 120);

  assert.equal(mothershipShieldLinks(null), 0);
  assert.equal(mothershipShieldLinks({
    supports: [{ age: MOTHERSHIP_DEPLOY_SECONDS }, { age: 0.1 }],
    supportJam: 0,
  }), 1);
  assert.equal(mothershipShieldLinks({
    supports: [{ age: MOTHERSHIP_DEPLOY_SECONDS }, { age: MOTHERSHIP_DEPLOY_SECONDS + 0.5 }],
    supportJam: 1.2,
  }), 0);

  assert.equal(crimsonDashEnd({ phase: 1 }), H - 108);
  assert.equal(crimsonDashEnd({ phase: 2 }), H - 82);

  const aimShots = openingEnemyShots({ lesson: 'aim', lockAngle: 1.2 }, 'standard');
  assert.deepEqual(aimShots, [{ x: 0, y: 12, angle: 1.2 }]);
  assert.equal(openingEnemyShots({ lesson: 'spread' }, 'standard').length, 3);
  assert.equal(openingEnemyShots({ lesson: 'spread' }, 'ace').length, 5);

  const beamStart = prismBeam({ step: 'sweep-warn', remaining: 0.4, sweep: { from: 1.0, to: 2.0, duration: 1.0 } }, { x: 200, y: 90 });
  assert.equal(beamStart.angle, 1.0);
  const beamMid = prismBeam({ step: 'sweep-fire', remaining: 0.25, sweep: { from: 1.0, to: 2.0, duration: 1.0 } }, { x: 200, y: 90 });
  assert.equal(beamMid.angle, 1.75);
});

test('collision helpers detect swept circle hits, ellipse impacts, asteroids, beams, and boss hulls', () => {
  assert.equal(bulletCrossesCircle({ x: 200, y: 100 }, 200, 180, 200, 140, 12), true);
  assert.equal(bulletCrossesCircle({ x: 260, y: 100 }, 260, 180, 200, 140, 12), false);

  assert.equal(ellipseImpactTime(200, 100, 200, 100, 200, 100, 30, 20), 0);
  const tHit = ellipseImpactTime(200, 100, 200, 200, 200, 100, 20, 20);
  assert.ok(tHit !== null && Math.abs(tHit - 0.8) < 1e-6);
  assert.equal(ellipseImpactTime(260, 200, 260, 220, 200, 100, 20, 20), null);

  const rock = { x: W * 0.5, y: 200, vx: 0, vy: 0, r: 22, rot: 0, vRot: 0 };
  assert.equal(fastRockOverlaps(rock, W * 0.5, 250, W * 0.5, 150, 4, 0), true);
  assert.equal(fastRockOverlaps(rock, 40, 250, 40, 150, 4, 0), false);

  const beam = { x: 230, y: 100, angle: Math.PI * 0.5 };
  assert.equal(beamHitsPlayer(beam, 16, { x: 240, y: 400 }), true);
  assert.equal(beamHitsPlayer(beam, 16, { x: 260, y: 400 }), false);
  assert.equal(beamHitsPlayer(beam, 16, { x: 230, y: 100 + BOSS_BEAM_LENGTH + 10 }), false);

  const carrier = { kind: 'mothership', phase: 2, x: 230, y: 100, r: 50 };
  assert.equal(bossHullImpactTime(carrier, 230, 100, 8), 0);
  assert.equal(bossHullImpactTime(carrier, 295, 100, 5), 0); // phase 2 width is 69 (+5 = 74) -> dx=65 inside
  assert.equal(bossHullImpactTime({ ...carrier, phase: 1 }, 305, 100, 5), null);
});
