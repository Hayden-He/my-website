import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  BALL_R, BALL_SKINS, SKYLINE,
  getShotTimeLimit, getSceneInfo, getBlockers, collidePoint,
} from '../games/basketball/modules/rules.js';
import { createBasketballAudio } from '../games/basketball/modules/audio.js';
import { createBasketballRenderer } from '../games/basketball/modules/renderer.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const gameRulesSource = fs.readFileSync(path.join(root, 'assets/game-rules.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(gameRulesSource, sandbox, { filename: 'assets/game-rules.js' });
const { hoopBounce } = sandbox.window.GameRules;

test('basketball configs expose valid skins and skyline buildings', () => {
  assert.equal(BALL_SKINS.length, 5);
  assert.equal(new Set(BALL_SKINS.map((s) => s.id)).size, 5);
  assert.ok(SKYLINE.length >= 10);
});

test('getShotTimeLimit decreases every 6 points and clamps at 7.0s', () => {
  assert.equal(getShotTimeLimit(0), 10.0);
  assert.equal(getShotTimeLimit(5), 10.0);
  assert.ok(Math.abs(getShotTimeLimit(6) - 9.4) < 1e-9);
  assert.ok(Math.abs(getShotTimeLimit(12) - 8.8) < 1e-9);
  assert.equal(getShotTimeLimit(30), 7.0);
  assert.equal(getShotTimeLimit(100), 7.0);
});

test('getSceneInfo transitions across all five court tiers', () => {
  assert.deepEqual(getSceneInfo(0), { name: '黄昏街头', next: '下一场景 15 分' });
  assert.deepEqual(getSceneInfo(15), { name: '暮色球场', next: '下一场景 30 分' });
  assert.deepEqual(getSceneInfo(30), { name: '夜场灯光', next: '下一场景 60 分' });
  assert.deepEqual(getSceneInfo(60), { name: '极光球场', next: '下一场景 100 分' });
  assert.deepEqual(getSceneInfo(100), { name: '星河球场', next: '已解锁全部场景' });
});

test('getBlockers evolves across 25, 50, and 80 points and disables in practice mode', () => {
  const baseState = { score: 20, blockerX: 285, blockerY: 160, blockerFlash: 0.2, blockerFlash2: 0.4 };
  assert.deepEqual(getBlockers(baseState, false), []);
  assert.deepEqual(getBlockers({ ...baseState, score: 90 }, true), []);

  const stage1 = getBlockers({ ...baseState, score: 25 }, false);
  assert.equal(stage1.length, 1);
  assert.equal(stage1[0].x, 250);
  assert.equal(stage1[0].h, 56);

  const stage2 = getBlockers({ ...baseState, score: 50 }, false);
  assert.equal(stage2.length, 1);
  assert.equal(stage2[0].x, 285);

  const stage3 = getBlockers({ ...baseState, score: 80 }, false);
  assert.equal(stage3.length, 2);
  assert.equal(stage3[0].x, 225);
  assert.equal(stage3[1].x, 305);
  assert.equal(stage3[1].y, 334 - 160);
});

test('collidePoint bounces approaching ball and ignores non-colliding ball', () => {
  const far = { x: 400, y: 200, vx: -100, vy: 50 };
  assert.equal(collidePoint(far, 100, 186, 4.5, hoopBounce), false);

  const hit = { x: 100 + BALL_R, y: 186, vx: -100, vy: 0 };
  assert.equal(collidePoint(hit, 100, 186, 4.5, hoopBounce), true);
  assert.ok(hit.vx > 0);
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

test('basketball renderer and audio modules run cleanly across court tiers, skins, and sounds', () => {
  const ac = makeAudioCtx();
  let score = 0;
  let skinIndex = 0;
  let paused = false;
  let started = false;
  withGlobals({
    window: {
      SiteData: { withAudio: (fn) => fn(ac) },
      GameArt: { drawStar() {}, drawFire() {} },
    },
  }, () => {
    globalThis.window.window = globalThis.window;
    const renderer = createBasketballRenderer({
      ctx: makeCanvasCtx(),
      dpr: 2,
      t: (k) => k,
      getPractice: () => false,
      getSkinIndex: () => skinIndex,
      isReducedMotion: () => false,
      getState: () => ({
        score,
        combo: 3,
        started,
        ended: false,
        paused,
        rimY: 186,
        rimSpring: 0.2,
        netSwing: 0.5,
        netExpand: 0.5,
        shake: 2,
        blockerX: 280,
        blockerY: 160,
        blockerFlash: 0.2,
        blockerFlash2: 0.2,
        ball: { x: 300, y: 200, vx: -100, vy: -50, rot: 1, squash: 0.1, isGold: score === 60 },
        trail: [{ x: 310, y: 205, life: 0.5 }],
        particles: [{ x: 100, y: 100, r: 3, color: '#fff', life: 0.5 }],
        rings: [{ x: 100, y: 100, r: 20, color: '#fff', life: 0.5 }],
        popups: [{ x: 100, y: 100, text: '+2', color: '#fff', life: 0.5 }],
      }),
    });

    const tiers = [0, 15, 30, 60, 100];
    for (let i = 0; i < tiers.length; i += 1) {
      score = tiers[i];
      skinIndex = i % BALL_SKINS.length;
      started = i > 0;
      paused = i === tiers.length - 1;
      renderer.render();
    }

    const audio = createBasketballAudio({ isEnabled: () => true });
    for (const kind of ['jump', 'bounce', 'board', 'rim', 'net', 'shield', 'swish', 'gold', 'score', 'tick', 'buzzer']) {
      audio.playSound(kind, 3);
    }
    audio.clearSoundTimers();
  });
});
