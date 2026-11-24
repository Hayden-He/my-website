import {
  W, H, FLOOR_Y, GRAVITY, JUMP_VY, BASE_VX, BALL_R,
  BOARD_X, RIM_LEFT_X, RIM_RIGHT_X, RIM_CENTER_X,
  BALL_SKINS, getShotTimeLimit, getSceneInfo, getBlockers, collidePoint,
} from './rules.js';
import { createBasketballAudio } from './audio.js';
import { createBasketballRenderer } from './renderer.js';

const t = (key, params) => (window.I18N ? window.I18N.t(key, params) : key);
const STORAGE_KEY = 'game_best_basketball';
const SKIN_STORAGE_KEY = 'game_skin_basketball';
const canvas = document.getElementById('court');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score-el');
const timeEl = document.getElementById('time-el');
const swishEl = document.getElementById('swish-el');
const bankEl = document.getElementById('bank-el');
const bestEl = document.getElementById('best-el');
const timerBar = document.getElementById('timer-bar');
const shotClock = document.getElementById('shot-clock');
const skinBtn = document.getElementById('skin-btn');
const pauseBtn = document.getElementById('pause-btn');
const challengeBtn = document.getElementById('challenge-btn');
const practiceBtn = document.getElementById('practice-btn');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const soundBtn = document.getElementById('sound-btn');
const overlay = document.getElementById('game-overlay');
const finalSummary = document.getElementById('final-summary');
const finalStats = document.getElementById('final-stats');
const sceneNameEl = document.getElementById('scene-name');
const sceneNextEl = document.getElementById('scene-next');

// 适配高清屏：内部分辨率按设备像素比放大，逻辑坐标仍为 640x420
const DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * DPR;
canvas.height = H * DPR;

let skinIndex = 0;
try {
  const savedSkin = parseInt(localStorage.getItem(SKIN_STORAGE_KEY) || '0', 10);
  if (savedSkin >= 0 && savedSkin < BALL_SKINS.length) skinIndex = savedSkin;
} catch {}

function renderSkinButton() {
  skinBtn.textContent = t('用球: {name}', { name: t(BALL_SKINS[skinIndex].name) });
}
renderSkinButton();

let soundEnabled = window.SiteData ? window.SiteData.getSound() : true;
const { clearSoundTimers, playSound } = createBasketballAudio({ isEnabled: () => soundEnabled });

window.GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
  if (!on) clearSoundTimers();
});

let bestScore = window.GameKit.readBest(STORAGE_KEY);

function setText(el, v) {
  v = String(v);
  if (el._v !== v) { el._v = v; el.textContent = v; }
}
function setClass(el, v) {
  if (el._c !== v) { el._c = v; el.className = v; }
}

let state = {};
let practice = false;
let lastTime = 0;
let lastTickSec = -1;

const renderer = createBasketballRenderer({
  ctx,
  dpr: DPR,
  getState: () => state,
  getPractice: () => practice,
  getSkinIndex: () => skinIndex,
  isReducedMotion: () => reducedMotion.matches,
  t,
});

function spawnBall() {
  // 金球：每累计 5 个进球后出现一次（若未投进，则不补发）
  const isGold = state.goldPending;
  state.goldPending = false;
  state.ball = {
    x: 565,
    y: FLOOR_Y - BALL_R,
    prevY: FLOOR_Y - BALL_R,
    vx: BASE_VX,
    vy: 0,
    rot: 0,
    hitBoard: false,
    hitRim: false,
    scored: false,
    isGold,
    resetCooldown: 0,
    bottomEntry: false,
    jumpLock: 0,
    squash: 0,
  };
}

function initGame() {
  clearSoundTimers();
  lastTime = 0;
  const limit = getShotTimeLimit(0);
  lastTickSec = -1;
  state = {
    score: 0,
    swishCount: 0,
    bankCount: 0,
    normalCount: 0,
    combo: 0,
    goalCount: 0,
    goldPending: false,
    paused: false,
    endedAt: 0,
    prevRimY: 186,
    started: false,
    ended: false,
    timeLimit: limit,
    timeLeft: limit,
    rimY: 186,
    baseRimY: 186,
    targetRimY: 186,
    rimFloatOffset: 0,
    rimFloatTarget: 18,
    rimFloatSpeed: 34,
    rimFloatPause: 0,
    rimSpring: 0,
    skyTime: 0,
    netSwing: 0,
    netExpand: 0,
    boardFlash: 0,
    blockerX: 250,
    blockerY: 180,
    blockerDir: 1,
    blockerSpeedScale: 1,
    blockerPhase: 0,
    blockerPause: 0,
    blockerFlash: 0,
    blockerFlash2: 0,
    shake: 0,
    rings: [],
    particles: [],
    trail: [],
    popups: [],
    ball: null,
  };
  spawnBall();
  overlay.classList.remove('show');
  pauseBtn.textContent = t('暂停');
  challengeBtn.classList.toggle('active', !practice);
  practiceBtn.classList.toggle('active', practice);
  challengeBtn.setAttribute('aria-pressed', String(!practice));
  practiceBtn.setAttribute('aria-pressed', String(practice));
  shotClock.classList.toggle('practice', practice);
  updateHud();
}

async function resetRound(nextPractice = practice) {
  if (!practice && state.started && !state.ended) {
    const changingMode = nextPractice !== practice;
    const confirmed = await window.SiteData.confirmDialog({
      title: changingMode ? t('切换到练习') : t('重开本局'),
      message: t('当前挑战进度将清除。'),
      confirmText: changingMode ? t('切换') : t('重开'),
      cancelText: t('继续本局'),
      danger: true,
    });
    if (!confirmed) return;
  }
  practice = nextPractice;
  initGame();
}

function saveBest() {
  if (practice) return;
  if (state.score > bestScore) {
    bestScore = state.score;
    window.GameKit.saveBestIfHigher(STORAGE_KEY, bestScore);
  }
}

function renderFinal() {
  finalSummary.textContent = t('本局总分：{score} 分（最高纪录：{best} 分）', {
    score: state.score,
    best: bestScore,
  });
  finalStats.textContent = t('空心入网 {swish} 次 · 打板进球 {bank} 次 · 普通命中 {normal} 次', {
    swish: state.swishCount,
    bank: state.bankCount,
    normal: state.normalCount,
  });
}

function updateHud() {
  setText(scoreEl, state.score);
  setText(timeEl, practice ? '—' : state.timeLeft.toFixed(1) + 's');
  setClass(timeEl, 'hud-value' + (!practice && state.timeLeft <= 2.5 ? ' danger' : ''));
  setText(swishEl, state.swishCount);
  setText(bankEl, state.bankCount);
  setText(bestEl, bestScore);

  const scene = getSceneInfo(practice ? 0 : state.score, t);
  setText(sceneNameEl, practice ? t('练习') : scene.name);
  const gold = state.ball.isGold || state.goldPending
    ? t('金球 ×2')
    : t('再进 {n} 球出金球', { n: 5 - state.goalCount % 5 });
  setText(sceneNextEl, practice ? t('固定篮筐 · 不计纪录') : scene.next + ' · ' + gold);

  const pct = Math.max(0, Math.min(100, (state.timeLeft / state.timeLimit) * 100));
  const pctStr = pct.toFixed(1) + '%';
  if (timerBar._w !== pctStr) { timerBar._w = pctStr; timerBar.style.width = pctStr; }
  setClass(timerBar, 'timer-bar' + (state.timeLeft <= 2.5 ? ' low' : ''));
}

function addPopup(text, x, y, color) {
  state.popups.push({ text, x, y, color, life: 1.0 });
}

function spawnBurst(x, y, color, count) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 140;
    state.particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 40,
      r: 2.5 + Math.random() * 2.5,
      color,
      life: 1.0,
    });
  }
}

function addRing(x, y, color, maxR) {
  if (reducedMotion.matches) return;
  state.rings.push({ x, y, r: 8, maxR: maxR || 42, color, life: 1.0 });
}

function jumpBall() {
  if (state.ended || state.paused) return;
  if (!state.started) state.started = true;
  const b = state.ball;
  if (b.scored || b.jumpLock > 0) return;
  // 高空升力平滑衰减，防止贴顶滑行逃课，同时保持手感连贯
  const minY = BALL_R + 6;
  const ceilingZone = 75;
  const liftFactor = b.y < ceilingZone
    ? Math.max(0.18, (b.y - minY) / (ceilingZone - minY))
    : 1;
  b.vy = JUMP_VY * liftFactor;
  b.squash = -0.1;
  if (b.vx > -120) b.vx = BASE_VX;
  // 普通球起跳时产生轻巧的主题气流微粒，增强起跳反馈但不抢火焰球与金球风头
  if (!reducedMotion.matches && state.combo < 2 && !b.isGold) {
    const skinId = BALL_SKINS[skinIndex].id;
    const puffColor = skinId === 'planet'
      ? '#bae6fd'
      : skinId === 'ice'
        ? '#e0f2fe'
        : skinId === 'water'
          ? '#a5f3fc'
          : skinId === 'darkgold'
            ? '#fde68a'
            : '#f8fafc';
    for (let i = 0; i < 5; i++) {
      state.particles.push({
        x: b.x + (Math.random() - 0.5) * 18,
        y: b.y + BALL_R - 2,
        vx: (Math.random() - 0.5) * 75,
        vy: 28 + Math.random() * 52,
        r: 2.0 + Math.random() * 1.2,
        color: puffColor,
        life: 0.65,
      });
    }
  }
  playSound('jump');
}

canvas.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary || e.button !== 0) return;
  e.preventDefault();
  if (state.paused) { setPaused(false); return; }
  jumpBall();
});

function setPaused(flag) {
  if (!state.started || state.ended) return;
  if (state.paused === flag) return;
  state.paused = flag;
  pauseBtn.textContent = flag ? t('继续') : t('暂停');
  lastTime = 0;
}

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (window.GameKit.shouldIgnoreGameKey(e, { ignoreOnControl: true })) return;
  if (window.SiteData?.isDialogOpen?.()) return;
  if (window.GameKit?.isTutorialOpen?.()) return;
  if (e.code === 'KeyP') {
    setPaused(!state.paused);
    return;
  }
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
    if (e.code === 'Enter' && !state.ended) return;
    e.preventDefault();
    if (state.ended) {
      // 结算后短暂锁定，避免连续按键误触直接重开
      if ((e.code === 'Space' || e.code === 'Enter') && performance.now() - state.endedAt > 600) initGame();
      return;
    }
    if (e.code === 'Enter') return;
    if (state.paused) { setPaused(false); return; }
    jumpBall();
  }
});

window.GameKit.onHidden(() => setPaused(true));
document.addEventListener('site:dialogopen', () => {
  if (state.started && !state.ended) setPaused(true);
});

document.addEventListener('i18n:change', () => {
  renderSkinButton();
  pauseBtn.textContent = state.paused ? t('继续') : t('暂停');
  if (state.ended) renderFinal();
  updateHud();
});
pauseBtn.addEventListener('click', () => setPaused(!state.paused));
challengeBtn.addEventListener('click', () => { if (practice) resetRound(false); });
practiceBtn.addEventListener('click', () => { if (!practice) resetRound(true); });

function updateClock(elapsed) {
  if (!practice && !state.paused && state.started && !state.ended && !state.ball.scored) {
    state.timeLeft -= elapsed;
    if (state.timeLeft <= 3.0 && state.timeLeft > 0) {
      const sec = Math.ceil(state.timeLeft);
      if (sec !== lastTickSec) {
        lastTickSec = sec;
        playSound('tick');
      }
    }
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.ended = true;
      state.endedAt = performance.now();
      playSound('buzzer');
      saveBest();
      updateHud();
      renderFinal();
      overlay.classList.add('show');
    }
  }
}

function update(dt) {
  if (state.paused) return;
  if (!reducedMotion.matches) state.skyTime += dt;

  // 平滑过渡篮筐高度变化（15 分后改为随机方向与速率的平滑漂移）
  state.prevRimY = state.rimY;
  state.baseRimY += (state.targetRimY - state.baseRimY) * Math.min(1, dt * 6);
  if (!practice && state.score >= 15 && state.started && !state.ended) {
    if (state.rimFloatPause > 0) {
      state.rimFloatPause = Math.max(0, state.rimFloatPause - dt);
    } else {
      const diff = state.rimFloatTarget - state.rimFloatOffset;
      const stepSpd = state.rimFloatSpeed * Math.min(1, Math.max(0.35, Math.abs(diff) / 14));
      if (Math.abs(diff) <= stepSpd * dt) {
        state.rimFloatOffset = state.rimFloatTarget;
        state.rimFloatPause = 0.15 + Math.random() * 0.25;
        let nextTarget = (Math.random() * 2 - 1) * 28;
        if (Math.abs(nextTarget - state.rimFloatOffset) < 12) {
          nextTarget = state.rimFloatOffset >= 0 ? -18 - Math.random() * 10 : 18 + Math.random() * 10;
        }
        state.rimFloatTarget = nextTarget;
        state.rimFloatSpeed = 24 + Math.random() * 34;
      } else {
        state.rimFloatOffset += Math.sign(diff) * stepSpd * dt;
      }
    }
  } else {
    state.rimFloatOffset = 0;
  }
  state.rimY = Math.max(128, Math.min(236, state.baseRimY + state.rimFloatOffset));

  // 护盾随分数三阶段演进：25+ 垂直守卫 -> 50+ 斜向巡逻提速 -> 80+ 双子联动护盾
  if (!practice && state.score >= 25 && state.started && !state.ended) {
    const baseSpd = state.score >= 80 ? 105 : state.score >= 50 ? 95 : 78;
    if (state.blockerPause > 0) {
      state.blockerPause = Math.max(0, state.blockerPause - dt);
    } else {
      const norm = Math.max(0, Math.min(1, (state.blockerY - 64) / (270 - 64)));
      const easeFactor = 0.45 + 0.9 * Math.sin(norm * Math.PI);
      state.blockerY += state.blockerDir * baseSpd * state.blockerSpeedScale * easeFactor * dt;
      if (state.blockerY >= 270) {
        state.blockerY = 270;
        state.blockerDir = -1;
        state.blockerSpeedScale = 0.85 + Math.random() * 0.33;
        state.blockerPause = 0.08;
      } else if (state.blockerY <= 64) {
        state.blockerY = 64;
        state.blockerDir = 1;
        state.blockerSpeedScale = 0.85 + Math.random() * 0.33;
        state.blockerPause = 0.08;
      }
    }
    if (state.score >= 50 && state.score < 80) {
      state.blockerPhase += dt * 1.35;
      state.blockerX = 270 + Math.sin(state.blockerPhase) * 45;
    } else {
      state.blockerX = 250;
    }
  }

  if (state.netSwing > 0) state.netSwing = Math.max(0, state.netSwing - dt * 2.2);
  if (state.netExpand > 0) state.netExpand = Math.max(0, state.netExpand - dt * 3.0);
  if (state.rimSpring > 0) state.rimSpring = Math.max(0, state.rimSpring - dt * 5.0);
  if (state.boardFlash > 0) state.boardFlash = Math.max(0, state.boardFlash - dt * 3.5);
  if (state.blockerFlash > 0) state.blockerFlash = Math.max(0, state.blockerFlash - dt * 4.5);
  if (state.blockerFlash2 > 0) state.blockerFlash2 = Math.max(0, state.blockerFlash2 - dt * 4.5);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 28);

  state.rings = state.rings.filter((rg) => {
    rg.r += (rg.maxR - rg.r) * Math.min(1, dt * 9);
    rg.life -= dt * 2.2;
    return rg.life > 0;
  });

  state.popups = state.popups.filter((p) => {
    p.y -= 36 * dt;
    p.life -= dt * 1.1;
    return p.life > 0;
  });

  state.particles = state.particles.filter((p) => {
    p.vy += 320 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 1.6;
    return p.life > 0;
  });

  const b = state.ball;
  const onFire = state.combo >= 2;

  if (state.started && !state.ended) {
    if (!reducedMotion.matches && (onFire || b.isGold)) {
      state.trail.push({
        x: b.x,
        y: b.y,
        r: BALL_R * 0.75,
        color: b.isGold ? '#fde047' : '#fb923c',
        life: 0.35,
        maxLife: 0.35,
        alpha: 1.4,
      });
    } else if (Math.hypot(b.vx, b.vy) > 120) {
      state.trail.push({
        x: b.x,
        y: b.y,
        r: BALL_R * 0.36,
        color: '#e2e8f0',
        life: 0.14,
        maxLife: 0.14,
        alpha: 1.1,
      });
    }
    state.trail = state.trail.filter((tr) => {
      tr.life -= dt;
      return tr.life > 0;
    });

    if (b.jumpLock > 0) b.jumpLock = Math.max(0, b.jumpLock - dt);
    b.prevY = b.y;
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += (b.vx / BALL_R) * dt;
    b.squash += (0 - b.squash) * Math.min(1, dt * 14);

    if (b.y < BALL_R + 6) {
      b.y = BALL_R + 6;
      b.vy = Math.max(Math.abs(b.vy) * 0.75, 240);
      b.jumpLock = 0.2;
      b.squash = 0.1;
    }

    if (b.y >= FLOOR_Y - BALL_R) {
      b.y = FLOOR_Y - BALL_R;
      b.bottomEntry = false;
      if (Math.abs(b.vy) > 95) {
        b.squash = 0.14;
        b.vy = -b.vy * 0.48;
        playSound('bounce');
        spawnBurst(b.x, FLOOR_Y - 2, 'rgba(254, 243, 199, 0.7)', 3);
      } else {
        b.vy = 0;
      }
      if (!b.scored) b.vx = BASE_VX;
    }

    if (b.x > RIM_RIGHT_X + BALL_R + 12 || b.y < state.rimY - BALL_R) {
      b.bottomEntry = false;
    }

    const boardTop = state.rimY - 82;
    const boardBottom = state.rimY + 26;
    if (
      b.x - BALL_R < BOARD_X + 6 &&
      b.x + BALL_R > BOARD_X - 6 &&
      b.y + BALL_R > boardTop &&
      b.y - BALL_R < boardBottom
    ) {
      if (b.x > BOARD_X && b.vx < 0) {
        b.x = BOARD_X + 6 + BALL_R;
        b.vx = Math.abs(b.vx) * 0.56;
        b.vy *= 0.85;
        b.hitBoard = true;
        b.squash = 0.1;
        state.boardFlash = 1.0;
        addRing(BOARD_X + 6, b.y, 'rgba(224, 242, 254, 0.85)', 28);
        playSound('board');
      } else if (b.x <= BOARD_X && b.vx > 0) {
        b.x = BOARD_X - 6 - BALL_R;
        b.vx = -Math.abs(b.vx) * 0.56;
        b.vy *= 0.85;
        b.squash = 0.1;
        state.boardFlash = 1.0;
        playSound('board');
      }
    }

    // 防守护盾碰撞（25/50/80 分三阶段演进）
    if (state.score >= 25 && !b.scored) {
      const blockers = getBlockers(state, practice);
      for (let bi = 0; bi < blockers.length; bi++) {
        const blk = blockers[bi];
        const halfH = blk.h / 2;
        const bTop = blk.y - halfH;
        const bBot = blk.y + halfH;
        if (b.x + BALL_R > blk.x - 6 && b.x - BALL_R < blk.x + 6 && b.y + BALL_R > bTop && b.y - BALL_R < bBot) {
          const fromRight = b.x >= blk.x;
          if ((fromRight && b.vx < 0) || (!fromRight && b.vx > 0)) {
            const relHit = (b.y - blk.y) / halfH;
            b.x = fromRight ? blk.x + 6 + BALL_R : blk.x - 6 - BALL_R;
            b.vx = (fromRight ? 1 : -1) * Math.abs(b.vx) * 0.54;
            b.vy = relHit < 0 ? -210 + relHit * 60 : -110 + relHit * 70;
            b.squash = 0.12;
            if (bi === 0) state.blockerFlash = 1.0;
            else state.blockerFlash2 = 1.0;
            state.shake = Math.max(state.shake, 3);
            addRing(blk.x + (fromRight ? 4 : -4), b.y, 'rgba(248, 113, 113, 0.9)', 26);
            spawnBurst(blk.x + (fromRight ? 4 : -4), b.y, '#fca5a5', 6);
            playSound('shield');
            break;
          }
        }
      }
    }

    if (!b.scored) {
      if (collidePoint(b, RIM_LEFT_X, state.rimY, 4.5)) {
        b.hitRim = true;
        state.rimSpring = 1.0;
        playSound('rim');
      }
      if (collidePoint(b, RIM_RIGHT_X, state.rimY, 4.5)) {
        b.hitRim = true;
        state.rimSpring = 1.0;
        playSound('rim');
      }
    }

    // 软篮网底部阻挡：防止从篮筐底部穿入再掉下造成乌龙球
    if (!b.scored && b.vy < 0 && b.prevY - state.prevRimY >= 8 && b.y - state.rimY < 8) {
      if (b.x > RIM_LEFT_X - 4 && b.x < RIM_RIGHT_X + 4) {
        b.y = state.rimY + 8;
        b.vy = Math.max(Math.abs(b.vy) * 0.35, 70);
        b.vx += b.x < RIM_CENTER_X ? -45 : 45;
        b.bottomEntry = true;
        state.netSwing = Math.max(state.netSwing, 0.55);
        playSound('net');
      }
    }

    // 使用“相对篮筐”的位置判断穿越，避免篮筐移动时同一帧漏判
    if (!b.scored && !b.bottomEntry && b.vy > 0 && b.prevY - state.prevRimY <= 0 && b.y - state.rimY >= 0) {
      if (b.x > RIM_LEFT_X + 1 && b.x < RIM_RIGHT_X - 1) {
        b.scored = true;
        b.vx *= 0.2;
        b.vy = Math.max(b.vy * 0.5, 140);
        state.netSwing = 1.0;
        state.netExpand = 1.0;
        state.rimSpring = 0.7;

        const { kind, combo, gained } = window.GameRules.scoreHoop(b, state.combo);
        state.combo = combo;
        let label = t('命中');
        let color = '#4ade80';

        if (kind === 'swish') {
          state.swishCount += 1;
          label = state.combo >= 2
            ? t('火焰空心×{combo}', { combo: state.combo })
            : t('空心入网');
          color = '#fbbf24';
          state.shake = Math.max(state.shake, 5.5);
          addRing(RIM_CENTER_X, state.rimY + 8, '#fbbf24', 52);
          playSound('swish', state.combo);
          spawnBurst(RIM_CENTER_X, state.rimY + 12, '#fbbf24', 16);
        } else if (kind === 'bank') {
          state.bankCount += 1;
          label = t('打板进球');
          color = '#38bdf8';
          addRing(RIM_CENTER_X, state.rimY + 8, '#38bdf8', 38);
          playSound('score');
          spawnBurst(RIM_CENTER_X, state.rimY + 12, '#38bdf8', 11);
        } else {
          state.normalCount += 1;
          playSound('score');
          spawnBurst(RIM_CENTER_X, state.rimY + 12, '#4ade80', 8);
        }

        if (b.isGold) {
          state.shake = Math.max(state.shake, 6);
          addRing(RIM_CENTER_X, state.rimY + 8, '#fef08a', 60);
          playSound('gold');
        }

        state.score += gained;
        state.goalCount += 1;
        if (!practice && state.goalCount % 5 === 0) state.goldPending = true;
        saveBest();

        state.timeLimit = getShotTimeLimit(state.score);
        state.timeLeft = state.timeLimit;
        lastTickSec = -1;

        if (!practice && state.score >= 4) {
          state.targetRimY = 140 + Math.random() * 88;
        }

        addPopup((b.isGold ? t('金球×2 ') : '') + label + ' +' + gained, RIM_CENTER_X + 24, state.rimY - 26, color);
        b.resetCooldown = 0.52;
      }
    }

    if (b.scored) {
      b.resetCooldown -= dt;
      if (b.resetCooldown <= 0) spawnBall();
    } else if (b.x < -BALL_R - 10 || b.x > W + BALL_R + 20) {
      state.combo = 0;
      spawnBall();
    }
  }

  updateHud();
}

function loop(ts) {
  if (!lastTime) lastTime = ts;
  const elapsed = (ts - lastTime) / 1000;
  const dt = Math.min(elapsed, 0.2);
  lastTime = ts;
  updateClock(elapsed);
  // 物理子步进：单步不超过 1/90 秒，降低低帧率下穿模风险
  const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
  for (let i = 0; i < steps; i++) update(dt / steps);
  renderer.render();
  requestAnimationFrame(loop);
}

skinBtn.addEventListener('click', () => {
  skinIndex = (skinIndex + 1) % BALL_SKINS.length;
  renderSkinButton();
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, String(skinIndex));
  } catch {}
});
document.getElementById('restart-btn').addEventListener('click', () => resetRound());
document.getElementById('overlay-restart').addEventListener('click', initGame);

function showTutorial(force) {
  window.GameKit.showTutorial({
    id: 'basketball',
    force,
    steps: [
      { icon: 'art-tap', title: t('连点升空'), text: t('连续点击球场，或连按空格键，让球持续升高。') },
      { icon: 'game-basketball', title: t('停手落网'), text: t('在篮筐上方停止点击，让球自然下落；空心入网得分最高。') },
    ],
  });
}

document.getElementById('help-btn').addEventListener('click', () => showTutorial(true));
initGame();
window.GameKit.bindMobileLayout('basketball', document.getElementById('immersive-btn'), () => setPaused(true));
showTutorial(false);
requestAnimationFrame(loop);
