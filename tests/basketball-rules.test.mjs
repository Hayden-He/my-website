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
