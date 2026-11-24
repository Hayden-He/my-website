import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SKINS, FRUITS, SPECIAL_FRUIT_MAP,
  segCircleHit, calcComboBonus, calcComboFeverEnergy,
} from '../games/fruit/modules/rules.js';
import { createFruitAudio } from '../games/fruit/modules/audio.js';
import { createFruitRenderer } from '../games/fruit/modules/renderer.js';

test('fruit configs define valid skins, fruits, and special fruit mappings', () => {
  assert.ok(SKINS.silver && SKINS.aurora);
  assert.ok(FRUITS.length >= 14);
  for (const fruit of FRUITS) {
    assert.ok(fruit.id && fruit.r > 0 && fruit.pts >= 1);
  }
  for (const [kind, fruit] of Object.entries(SPECIAL_FRUIT_MAP)) {
    assert.ok(kind && fruit && fruit.id);
  }
});

test('segCircleHit detects intersections, tangent hits, contained points, zero-length segments, and misses', () => {
  // Segment passing straight through circle center
  assert.equal(segCircleHit(0, 50, 100, 50, 50, 50, 20), true);
  // Tangent touch at exact radius
  assert.equal(segCircleHit(0, 30, 100, 30, 50, 50, 20), true);
  // Zero-length segment inside circle
  assert.equal(segCircleHit(55, 55, 55, 55, 50, 50, 20), true);
  // Zero-length segment outside circle
  assert.equal(segCircleHit(80, 80, 80, 80, 50, 50, 20), false);
  // Segment stops before reaching circle
  assert.equal(segCircleHit(0, 50, 25, 50, 50, 50, 20), false);
  // Segment passes far above circle
  assert.equal(segCircleHit(0, 10, 100, 10, 50, 50, 20), false);
});

test('combo bonus and fever energy scale as expected at 3+ hits', () => {
  assert.equal(calcComboBonus(0), 0);
  assert.equal(calcComboBonus(2), 0);
  assert.equal(calcComboBonus(3), 3);
  assert.equal(calcComboBonus(6), 6);

  assert.equal(calcComboFeverEnergy(2), 0);
  assert.equal(calcComboFeverEnergy(3), 12);
  assert.equal(calcComboFeverEnergy(4), 18);
  assert.equal(calcComboFeverEnergy(5), 25);
  assert.equal(calcComboFeverEnergy(7), 25);
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

test('fruit renderer and audio modules run cleanly across all skins, shields, fruits, and specials', () => {
  const ac = makeAudioCtx();
  let state = null;
  withGlobals({
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCanvasCtx() }) },
    window: { SiteData: { withAudio: (fn) => fn(ac) } },
  }, () => {
    const renderer = createFruitRenderer({
      ctx: makeCanvasCtx(),
      getState: () => state,
    });
    const specials = ['bomb', 'pomegranate', 'freeze', 'frenzy', 'double', 'lightning', 'splitter', 'magnet', 'shield', 'clock', 'heal'];
    for (const skin of Object.keys(SKINS)) {
      for (const hasShield of [false, true]) {
        state = {
          skin,
          hasShield,
          freezeTimer: 1.5,
          feverActiveTimer: 2,
          items: FRUITS.map((fruit, idx) => ({
            fruit,
            special: idx < specials.length ? specials[idx] : null,
            isMini: idx === 11,
            x: 40 + idx * 38,
            y: 430,
            r: fruit.r,
            rot: 0.4,
            vy: -20,
            hits: 3,
            hitBounce: 0.1,
          })),
          pendingBombs: [{ launchX: 150, delay: 0.2, maxDelay: 0.45 }],
          halves: FRUITS.map((fruit) => ({ fruit, x: 100, y: 100, r: fruit.r, rot: 0, sliceAngle: 0.5, side: 1 })),
          particles: [
            { kind: 'drop', x: 10, y: 10, r: 3, color: '#fff', life: 0.5, maxLife: 1 },
            { kind: 'petal', x: 20, y: 20, r: 3, color: '#fff', life: 0.5, maxLife: 1 },
            { kind: 'crystal', x: 30, y: 30, r: 3, color: '#fff', life: 0.5, maxLife: 1 },
          ],
          splatters: [{ x: 10, y: 10, r: 20, color: '#f00', alpha: 0.3, drops: [{ dx: 2, dy: 2, r: 2 }] }],
          floatTexts: [{ x: 50, y: 50, text: '+1', color: '#fff', scale: 1, life: 0.5, maxLife: 1 }],
          bolts: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], life: 0.2, maxLife: 0.3 }],
          shockwaves: [{ x: 10, y: 10, r: 10, maxR: 50, color: '#fff', life: 0.1, maxLife: 0.2 }],
          slashes: [{ x: 10, y: 10, angle: 0, len: 40, color: '#fff', life: 0.1, maxLife: 0.2 }],
          trail: [{ x: 0, y: 0, t: 0 }, { x: 10, y: 10, t: 10 }, { x: 20, y: 20, t: 20 }],
          bombBlast: { x: 100, y: 100, timer: 0.2, duration: 0.8 },
          shakeTimer: 0.1,
          shakeMag: 4,
          flashAlpha: 0.3,
          flashColor: '#fff',
        };
        renderer.draw();
      }
    }

    const audio = createFruitAudio({ isEnabled: () => true });
    audio.playSwoosh();
    audio.playSlice(3);
    audio.playBombFuse();
    audio.playMiss();
    audio.playCombo(4);
    audio.playBomb();
    audio.playShieldBlock();
    audio.playCountdownTick(3);
    for (const kind of ['freeze', 'frenzy', 'double', 'lightning', 'splitter', 'magnet', 'shield', 'clock', 'fever']) {
      audio.playSpecial(kind);
    }
  });
});
