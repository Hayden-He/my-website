import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W, H, PADDLE_Y, PADDLE_HEIGHT, PADDLE_BASE_WIDTH, BALL_RADIUS, MAX_BALLS,
  SKINS, POWERUP_META, LEVELS,
  buildClassicLevel, buildEndlessInitialBricks, pushEndlessRow,
  countClearableBricks, createBall, reflectFromPaddle,
  enforceVerticalComponent, collideBallWithBrick, detonateBombBrick,
  rollPowerupDrop, stepBallSubstepped, stepLasers, stepCapsules, createBrick,
} from '../games/breakout/modules/rules.js';
import { createBreakoutAudio } from '../games/breakout/modules/audio.js';
import { createBreakoutRenderer } from '../games/breakout/modules/renderer.js';

function makeMockCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    fillText: noop,
    setLineDash: noop,
    createLinearGradient: () => grad,
  };
}

test('all 8 classic levels build bounded bricks with positive clearable counts', () => {
  assert.equal(LEVELS.length, 8);
  for (let lv = 1; lv <= 9; lv += 1) {
    const built = buildClassicLevel(lv);
    assert.ok(built.bricks.length > 0);
    assert.ok(countClearableBricks(built.bricks) > 0);
    for (const b of built.bricks) {
      assert.ok(b.x >= 0 && b.x + b.w <= W);
      assert.ok(b.y >= 40 && b.y + b.h < PADDLE_Y);
    }
  }
  const lv1 = buildClassicLevel(1);
  const lv9 = buildClassicLevel(9);
  assert.ok(lv9.ballSpeed > lv1.ballSpeed);
});

test('paddle reflection respects max angle and enforceVerticalComponent prevents horizontal lock', () => {
  const paddle = { x: 200, w: PADDLE_BASE_WIDTH };
  const rightEdgeBall = createBall(200 + paddle.w / 2, PADDLE_Y - BALL_RADIUS, 340, 0);
  reflectFromPaddle(rightEdgeBall, paddle);
  assert.ok(rightEdgeBall.vx > 0 && rightEdgeBall.vy < 0);
  const angleDeg = (Math.atan2(rightEdgeBall.vx, -rightEdgeBall.vy) * 180) / Math.PI;
  assert.ok(angleDeg <= 62.1);

  const flatBall = { x: 100, y: 100, vx: 300, vy: 2, r: BALL_RADIUS };
  enforceVerticalComponent(flatBall, 0.24);
  assert.ok(Math.abs(flatBall.vy) >= 70);
  assert.ok(Math.abs(Math.hypot(flatBall.vx, flatBall.vy) - Math.hypot(300, 2)) < 0.01);
});

test('substepped physics avoids tunneling, handles steel/gold bricks, fireball pierce, and bomb chain', () => {
  const paddle = { x: 230, w: PADDLE_BASE_WIDTH };
  const steel = createBrick(2, 2, 'S');
  const gold = createBrick(3, 2, 'G');
  const bomb = createBrick(4, 2, 'B');
  const neighborGold = createBrick(5, 2, 'G');
  const neighborNormal = createBrick(4, 3, '1');
  const bricks = [steel, gold, bomb, neighborGold, neighborNormal];

  // Fast upward ball hits steel brick (no tunneling) and reduces HP 2 -> 1
  const ball = createBall(steel.x + steel.w / 2, steel.y + steel.h + BALL_RADIUS + 8, 900, 0);
  const step1 = stepBallSubstepped(ball, paddle, bricks, { fire: 0, magnet: 0 }, 0.03);
  assert.equal(step1.brickEvents.length, 1);
  assert.equal(steel.hp, 1);
  assert.ok(ball.vy > 0);

  // Gold brick resists normal ball
  const goldBall = createBall(gold.x + gold.w / 2, gold.y + gold.h + BALL_RADIUS + 4, 340, 0);
  const stepGold = stepBallSubstepped(goldBall, paddle, bricks, { fire: 0, magnet: 0 }, 0.03);
  assert.equal(stepGold.brickEvents[0].indestructible, true);
  assert.equal(gold.hp, 99);

  // Detonating bomb chains 3x3 including adjacent gold walls without reflecting fireball
  const fireBall = createBall(bomb.x + bomb.w / 2, bomb.y + bomb.h + BALL_RADIUS + 3, 340, 0);
  const stepFire = stepBallSubstepped(fireBall, paddle, bricks, { fire: 5, magnet: 0 }, 0.03);
  assert.equal(bomb.hp, 0);
  assert.equal(neighborGold.hp, 0);
  assert.equal(neighborNormal.hp, 0);
  assert.ok(fireBall.vy < 0, 'fireball pierces without bouncing back');
  assert.ok(stepFire.brickEvents[0].chained.length >= 2);
});

test('endless mode shifts bricks downward, flags danger line, and drops only positive powerups', () => {
  const rng = () => 0.12;
  let bricks = buildEndlessInitialBricks(rng);
  assert.ok(bricks.length >= 30);

  let danger = false;
  for (let w = 2; w <= 22; w += 1) {
    const res = pushEndlessRow(bricks, w, rng);
    bricks = res.bricks;
    if (res.dangerReached) {
      danger = true;
      break;
    }
  }
  assert.equal(danger, true);

  const normalBrick = createBrick(0, 0, '1');
  const goldBrick = createBrick(1, 0, 'G');
  assert.equal(rollPowerupDrop(goldBrick, () => 0.01), null);
  const drop = rollPowerupDrop(normalBrick, () => 0.05);
  assert.ok(drop && Object.prototype.hasOwnProperty.call(POWERUP_META, drop));
});

test('stepLasers damages bricks and stops on gold walls', () => {
  const b1 = createBrick(0, 0, '1');
  const g1 = createBrick(1, 0, 'G');
  const res = stepLasers(
    [{ x: b1.x + 10, y: b1.y + b1.h + 4 }, { x: g1.x + 10, y: g1.y + g1.h + 4 }],
    [b1, g1],
    0.02
  );
  assert.equal(res.lasers.length, 0);
  assert.equal(b1.hp, 0);
  assert.equal(g1.hp, 99);
});

test('stepCapsules advances capsules, catches all 6 powerups on paddle overlap, and drops off-screen capsules', () => {
  const paddle = { x: W / 2, w: PADDLE_BASE_WIDTH };
  const kinds = Object.keys(POWERUP_META);
  assert.equal(kinds.length, 6);

  // Mid-air capsules remain in flight
  const flying = stepCapsules([{ x: paddle.x, y: 200, vy: 135, kind: kinds[0] }], paddle, 0.1);
  assert.equal(flying.caught.length, 0);
  assert.equal(flying.capsules.length, 1);
  assert.ok(flying.capsules[0].y > 200);

  // Every capsule kind is caught cleanly across center & edge overlap without throwing
  const toCatch = kinds.map((kind, idx) => ({
    x: idx === 0 ? paddle.x - paddle.w / 2 - 14 : idx === kinds.length - 1 ? paddle.x + paddle.w / 2 + 14 : paddle.x,
    y: PADDLE_Y + PADDLE_HEIGHT / 2 - 2,
    vy: 135,
    kind,
  }));
  // Include an off-screen capsule that should be pruned
  const withOffscreen = [...toCatch, { x: paddle.x, y: H + 20, vy: 135, kind: 'wide' }];
  const res = stepCapsules(withOffscreen, paddle, 0.016);
  assert.deepEqual(res.caught.map((c) => c.kind), kinds);
  assert.equal(res.capsules.length, 0);
});

test('breakout renderer and audio run cleanly across all 3 skins and states', () => {
  const ctx = makeMockCtx();
  let curSkin = 'neon';
  const renderer = createBreakoutRenderer({
    ctx,
    getState: () => ({
      mode: 'endless',
      skin: curSkin,
      now: 1200,
      bricks: [createBrick(0, 0, '1'), createBrick(1, 0, 'S'), createBrick(2, 0, 'B'), createBrick(3, 0, 'G')],
      balls: [{ ...createBall(200, 400, 320, -0.2), stuck: true, trail: [{ x: 198, y: 405 }] }],
      capsules: [{ x: 180, y: 300, kind: 'multi' }],
      lasers: [{ x: 150, y: 250 }],
      particles: [{ x: 100, y: 120, size: 3, color: '#fff', life: 0.2, maxLife: 0.4 }],
      floatTexts: [{ x: 200, y: 200, text: '+60', color: '#fde047', life: 0.4 }],
      effects: { expand: 5, fire: 4, laser: 3, magnet: 2 },
      paddle: { x: 220, w: 120 },
      shakeTimer: 0.1,
      shakeMag: 5,
      levelBannerTimer: 1.0,
      levelBannerText: '第 1 关 · 彩虹阶梯',
    }),
  });
  for (const skinKey of Object.keys(SKINS)) {
    curSkin = skinKey;
    renderer.renderFrame();
  }

  const noop = () => {};
  const fakeAc = {
    sampleRate: 44100,
    currentTime: 0,
    destination: {},
    createBuffer: () => ({ sampleRate: 44100, getChannelData: () => new Float32Array(1024) }),
    createBufferSource: () => ({ buffer: null, connect: noop, start: noop, stop: noop }),
    createBiquadFilter: () => ({ type: '', frequency: { setValueAtTime: noop, exponentialRampToValueAtTime: noop }, connect: noop }),
    createOscillator: () => ({ type: '', frequency: { setValueAtTime: noop, exponentialRampToValueAtTime: noop }, connect: noop, start: noop, stop: noop }),
    createGain: () => ({ gain: { setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop }, connect: noop }),
  };
  globalThis.window = { SiteData: { withAudio: (fn) => fn(fakeAc) } };
  const audio = createBreakoutAudio({ isEnabled: () => true });
  audio.playPaddleHit(false);
  audio.playPaddleHit(true);
  audio.playWallHit();
  audio.playBrickHit({ destroyed: true, combo: 4 });
  audio.playBombExplode();
  audio.playLaser();
  audio.playPowerup('life');
  audio.playLifeLost();
  audio.playLevelClear();
  audio.playGameOver();
  assert.ok(MAX_BALLS >= 6);
});
