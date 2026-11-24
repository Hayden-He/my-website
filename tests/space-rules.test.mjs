import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W, H, BOSS_BEAM_LENGTH, MOTHERSHIP_DEPLOY_SECONDS, SKINS, PICKUP_THEMES, SPACE_SCENES,
  getBossKind, getBossName, buildWaveQueue, computeBossLasers,
  mothershipShieldLinks, crimsonDashEnd, openingEnemyShots, prismBeam,
  bulletCrossesCircle, ellipseImpactTime, fastRockOverlaps,
  beamHitsPlayer, bossHullImpactTime,
} from '../games/space/modules/rules.js';
import { createSpaceAudio } from '../games/space/modules/audio.js';
import { createSpaceRenderer } from '../games/space/modules/renderer.js';

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

function withGlobals(overrides, fn) {
  const saved = new Map();
  for (const [k, v] of Object.entries(overrides)) {
    saved.set(k, Object.hasOwn(globalThis, k) ? [true, globalThis[k]] : [false, undefined]);
    globalThis[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, [existed, val]] of saved) {
      if (existed) globalThis[k] = val;
      else delete globalThis[k];
    }
  }
}

function makeCanvasCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
      if (prop === 'measureText') return () => ({ width: 40 });
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, val) {
      target[prop] = val;
      return true;
    },
  });
}

function makeAudioCtx() {
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} };
  return {
    currentTime: 1,
    sampleRate: 44100,
    destination: {},
    createBuffer: (ch, len) => ({ sampleRate: 44100, getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }),
    createOscillator: () => ({ type: '', frequency: param, connect() {}, start() {}, stop() {} }),
    createGain: () => ({ gain: param, connect() {} }),
    createBiquadFilter: () => ({ type: '', frequency: param, Q: param, connect() {} }),
  };
}

test('space renderer and audio modules run cleanly across skins, scenes, bosses, enemies, and audio cues', () => {
  const ac = makeAudioCtx();
  let viewState = null;
  withGlobals({
    window: { SiteData: { withAudio: (fn) => fn(ac) } },
  }, () => {
    const renderer = createSpaceRenderer({
      ctx: makeCanvasCtx(),
      t: (k) => k,
      getState: () => viewState,
    });
    const poly = [{ x: 12, y: 0 }, { x: 6, y: 10 }, { x: -6, y: 10 }, { x: -12, y: 0 }, { x: -6, y: -10 }, { x: 6, y: -10 }];
    const bosses = [
      { kind: 'crimson', phase: 1, x: 230, y: 100, targetY: 98, r: 46, hp: 50, maxHp: 100, hitFlash: 0.1, maneuver: 'dash-warn', maneuverTimer: 0.2, dashX: 200, guard: { x: 230, y: 166, hp: 10, maxHp: 10 }, campCounter: { active: true, warn: 0.4, x: 230, y: 400 } },
      { kind: 'crimson', phase: 2, x: 230, y: 100, targetY: 98, r: 46, hp: 20, maxHp: 100, hitFlash: 0, maneuver: 'scatter-warn', maneuverTimer: 0.3, dashX: 200 },
      { kind: 'prism', phase: 2, x: 230, y: 100, targetY: 98, r: 46, hp: 50, maxHp: 100, hitFlash: 0, maneuver: 'reflect', maneuverTimer: 0.2, prismAttack: { step: 'sweep-fire', remaining: 0.5, sweep: { from: 1, to: 2, duration: 1, width: 13 } }, prismMirror: { x: 140, y: 120, r: 22, hp: 10, maxHp: 10, age: 1 }, prismReflect: { panels: [0.1, 0, 0, 0, 0, 0] } },
      { kind: 'mothership', phase: 2, x: 230, y: 100, targetY: 98, r: 50, hp: 50, maxHp: 100, hitFlash: 0, maneuver: 'patrol', laserState: 'fire', laserTimer: 0.5, laserWidth: 16, lasers: [{ x: 184, y: 120, angle: Math.PI / 2 }], supports: [{ x: 140, y: 140, side: -1, hp: 10, maxHp: 15, age: 1 }], supportJam: 0 },
    ];
    const skinNames = Object.keys(SKINS);
    for (let bi = 0; bi < bosses.length; bi += 1) {
      viewState = {
        mode: 'ace',
        skin: skinNames[bi % skinNames.length],
        stars: [{ x: 10, y: 10, r: 1, alpha: 0.5, tint: '#fff' }],
        meteors: [{ x: 20, y: 20, vx: 10, vy: 20, len: 30, life: 0.5 }],
        sceneIndex: bi % SPACE_SCENES.length,
        previousScene: 0,
        sceneBlend: 0.5,
        backgroundTime: 10,
        state: 'playing',
        player: { x: 230, y: 460, bank: 0.1, hitFlash: 0, invuln: 0, shield: true, overdriveTimer: 2, weaponLv: 5, blastAmmo: 2 },
        boss: bosses[bi],
        bullets: [
          { x: 230, y: 300, vx: 0, vy: -500, r: 4, heavy: true, style: 'phantom' },
          { x: 200, y: 300, vx: 0, vy: -600, r: 6, explosive: true },
        ],
        enemyBullets: [
          { x: 200, y: 200, vx: 0, vy: 200, r: 5, color: '#f00' },
          { x: 210, y: 200, vx: 0, vy: 200, r: 5, color: '#0ff', reflected: true, crystal: true },
        ],
        enemies: [
          { kind: 'scout', x: 100, y: 100, r: 16, hp: 1, maxHp: 1 },
          { kind: 'interceptor', lesson: 'aim', lockTimer: 0.2, lockAngle: 1.5, x: 150, y: 120, r: 18, hp: 2, maxHp: 2 },
          { kind: 'gunship', lesson: 'spread', lockTimer: 0.2, x: 200, y: 120, r: 24, hp: 4, maxHp: 4 },
          { kind: 'drone', x: 260, y: 120, r: 16, hp: 2, maxHp: 2 },
          { kind: 'asteroid', rockStyle: 'boulder', x: 320, y: 120, vx: 0, vy: 80, r: 22, hp: 2, maxHp: 3, rot: 0, poly },
          { kind: 'asteroid', rockStyle: 'shard', x: 360, y: 140, vx: 20, vy: 180, r: 20, hp: 1, maxHp: 2, rot: 0.5, poly },
        ],
        pickups: Object.keys(PICKUP_THEMES).map((type, idx) => ({ type, x: 60 + idx * 50, y: 220, r: 14, pulse: 0 })),
        pickupCue: { type: 'weapon', timer: 0.2 },
        particles: [{ x: 10, y: 10, r: 2, color: '#fff', life: 0.3, maxLife: 0.5 }],
        debris: [{ x: 10, y: 10, w: 4, h: 4, rot: 0, color: '#fff', life: 0.3, maxLife: 0.5 }],
        muzzleFlashes: [{ x: 230, y: 440, r: 8, color: '#fff', life: 0.05, maxLife: 0.1 }],
        afterimages: [{ x: 230, y: 460, bank: 0, style: 'phantom', life: 0.1, maxLife: 0.2 }],
        shockwaves: [{ x: 100, y: 100, r: 10, maxR: 60, color: '#fff', life: 0.2, maxLife: 0.4, blast: true }],
        floatTexts: [{ x: 100, y: 100, text: '+100', color: '#fff', scale: 1, life: 0.4, maxLife: 0.8 }],
        empWave: { x: 230, y: 460, r: 50, life: 0.2, maxLife: 0.4 },
        bossAlertAlpha: 0.5,
        waveBanner: 'Wave 5',
        waveBannerTimer: 1,
        combo: 8,
        comboTimer: 2,
        shakeTimer: 0.1,
        shakeMag: 3,
        flashAlpha: 0.1,
        flashColor: '#fff',
      };
      renderer.draw();
    }

    const audio = createSpaceAudio({ isEnabled: () => true, getSkin: () => 'cobalt' });
    for (const accent of ['armorHit', 'blastImpact', 'overdriveStart', 'overdriveEnding', 'heavyShot', 'heavyHit']) {
      audio.playWeaponAccent(accent);
    }
    audio.playShoot(SKINS.cobalt.shot, true, 1);
    audio.playHit(false);
    audio.playHit(true, true);
    audio.playExplode(true);
    audio.playExplode(false);
    for (const kind of Object.keys(PICKUP_THEMES)) audio.playPowerup(kind);
    audio.playEmp();
    audio.playBossAlert();
    audio.playPlayerHit();
    audio.playBossLaserCharge();
    audio.playBossLaserFire();
    audio.playWaveClear();
    audio.playPrismReflectCue(false);
    audio.playPrismReflectCue(true);
    audio.playComboMilestone();
  });
});
