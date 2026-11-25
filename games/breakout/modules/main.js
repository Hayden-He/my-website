import {
  W, H, WALL_SIDE, PADDLE_Y, PADDLE_BASE_WIDTH, PADDLE_WIDE_WIDTH, PADDLE_SPEED,
  BALL_RADIUS, BASE_BALL_SPEED, MAX_BALLS, START_LIVES, MAX_LIVES,
  ENDLESS_PUSH_INTERVAL, MAX_PARTICLES, EFFECT_DURATIONS, SKINS, POWERUP_META,
  clamp, buildClassicLevel, buildEndlessInitialBricks, pushEndlessRow,
  countClearableBricks, createBall, stepBallSubstepped, stepLasers, stepCapsules, rollPowerupDrop,
} from './rules.js';
import { createBreakoutAudio } from './audio.js';
import { createBreakoutRenderer } from './renderer.js';

const t = (key, params) => (window.I18N ? window.I18N.t(key, params) : key);
const MODE_KEY = 'game_mode_breakout';
const SKIN_KEY = 'game_skin_breakout';
const BEST_KEYS = {
  classic: 'game_best_breakout_classic',
  level: 'game_best_breakout_level',
  endless: 'game_best_breakout_endless',
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stageLabelEl = document.getElementById('stage-label');
const stageValueEl = document.getElementById('stage-value');
const scoreEl = document.getElementById('score-el');
const bestEl = document.getElementById('best-el');
const livesLabelEl = document.getElementById('lives-label');
const livesPipsEl = document.getElementById('lives-pips');
const comboBadge = document.getElementById('combo-badge');
const effectExpandBadge = document.getElementById('effect-expand');
const effectFireBadge = document.getElementById('effect-fire');
const effectLaserBadge = document.getElementById('effect-laser');
const effectMagnetBadge = document.getElementById('effect-magnet');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const overlayBtn = document.getElementById('overlay-btn');
const modeClassicBtn = document.getElementById('mode-classic');
const modeEndlessBtn = document.getElementById('mode-endless');
const pauseBtn = document.getElementById('pause-btn');
const soundBtn = document.getElementById('sound-btn');
const helpBtn = document.getElementById('help-btn');
const restartBtn = document.getElementById('restart-btn');
const launchBtn = document.getElementById('launch-btn');
const skinBtns = Array.from(document.querySelectorAll('.skin-pill'));
const immersiveBtn = document.getElementById('immersive-btn');

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

let mode = readStored(MODE_KEY, 'classic');
if (mode !== 'classic' && mode !== 'endless') mode = 'classic';

let skin = readStored(SKIN_KEY, 'neon');
if (!SKINS[skin]) skin = 'neon';

let soundEnabled = window.SiteData ? SiteData.getSound() : true;
GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
});

const audio = createBreakoutAudio({ isEnabled: () => soundEnabled });

let phase = 'ready'; // 'ready' | 'playing' | 'paused' | 'over'
let dialogOpen = false;
let autoPausedByDialog = false;
let score = 0;
let level = 1;
let wave = 1;
let lives = START_LIVES;
let combo = 0;
let maxCombo = 0;
let ballSpeed = BASE_BALL_SPEED;
let pushTimer = ENDLESS_PUSH_INTERVAL;
let levelBannerTimer = 0;
let levelBannerText = '';
let shakeTimer = 0;
let shakeMag = 0;
let laserCooldown = 0;
let lastFrameAt = 0;
let nowMs = 0;

let bricks = [];
let balls = [];
let capsules = [];
let lasers = [];
let particles = [];
let floatTexts = [];
const effects = { expand: 0, fire: 0, laser: 0, magnet: 0 };
const paddle = { x: W / 2, w: PADDLE_BASE_WIDTH };
const keys = { left: false, right: false };

const renderer = createBreakoutRenderer({
  ctx,
  getState: () => ({
    mode,
    skin,
    now: nowMs,
    bricks,
    balls,
    capsules,
    lasers,
    particles,
    floatTexts,
    effects,
    paddle,
    shakeTimer,
    shakeMag,
    levelBannerTimer,
    levelBannerText,
  }),
});

function paddleHalfWidth() {
  return paddle.w / 2;
}

function movePaddleTo(targetX) {
  const half = paddleHalfWidth();
  paddle.x = clamp(targetX, WALL_SIDE + half, W - WALL_SIDE - half);
  for (const ball of balls) {
    if (ball.stuck) {
      ball.x = clamp(paddle.x + ball.dockOffset, WALL_SIDE + ball.r, W - WALL_SIDE - ball.r);
      ball.y = PADDLE_Y - ball.r - 0.5;
    }
  }
}

function dockFreshBall() {
  const b = createBall(paddle.x, PADDLE_Y - BALL_RADIUS - 0.5, ballSpeed, -0.32);
  b.stuck = true;
  b.dockOffset = 0;
  balls = [b];
}

function addFloatText(x, y, text, color = '#f8fafc') {
  floatTexts.push({ x, y, text, color, life: 0.72 });
}

function addBurstParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i += 1) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const spd = 55 + Math.random() * 145;
    particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      size: 2.5 + Math.random() * 2.5,
      color,
      life: 0.28 + Math.random() * 0.2,
      maxLife: 0.48,
    });
  }
}

function loadClassicStage(nextLevel) {
  level = nextLevel;
  const data = buildClassicLevel(level);
  bricks = data.bricks;
  ballSpeed = data.ballSpeed;
  capsules = [];
  lasers = [];
  effects.expand = 0;
  effects.fire = 0;
  effects.laser = 0;
  effects.magnet = 0;
  paddle.w = PADDLE_BASE_WIDTH;
  movePaddleTo(W / 2);
  dockFreshBall();
  levelBannerText = t('第 {level} 关 · {name}', { level, name: t(data.name) });
  levelBannerTimer = 2.0;
}

function setupRound(startImmediately = false) {
  score = 0;
  lives = START_LIVES;
  combo = 0;
  maxCombo = 0;
  wave = 1;
  pushTimer = ENDLESS_PUSH_INTERVAL;
  particles = [];
  floatTexts = [];
  effects.expand = 0;
  effects.fire = 0;
  effects.laser = 0;
  effects.magnet = 0;
  paddle.w = PADDLE_BASE_WIDTH;
  paddle.x = W / 2;

  if (mode === 'classic') {
    loadClassicStage(1);
  } else {
    bricks = buildEndlessInitialBricks();
    ballSpeed = BASE_BALL_SPEED + 15;
    capsules = [];
    lasers = [];
    dockFreshBall();
    levelBannerText = t('无尽下压 · 阻挡砖块触底');
    levelBannerTimer = 2.0;
  }

  phase = startImmediately ? 'playing' : 'ready';
  updateHud();
  renderOverlay();
}

function saveRecords() {
  if (mode === 'classic') {
    GameKit.saveBestIfHigher(BEST_KEYS.classic, score);
    GameKit.saveBestIfHigher(BEST_KEYS.level, level);
  } else {
    GameKit.saveBestIfHigher(BEST_KEYS.endless, score);
  }
}

function updateLivesUi() {
  livesLabelEl.textContent = t('生命 {n}', { n: lives });
  livesPipsEl.setAttribute('aria-label', t('剩余生命 {n}', { n: lives }));
  livesPipsEl.setAttribute('aria-valuenow', String(lives));
  livesPipsEl.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i += 1) {
    const pip = document.createElement('span');
    pip.className = 'life-pip' + (i >= lives ? ' lost' : '');
    livesPipsEl.appendChild(pip);
  }
}

function syncEffectBadge(el, key, val) {
  if (val > 0) {
    el.hidden = false;
    const pct = clamp((val / EFFECT_DURATIONS[key]) * 100, 0, 100);
    el.style.setProperty('--remaining', pct.toFixed(1) + '%');
    el.textContent = `${t(POWERUP_META[key].label)} ${Math.ceil(val)}s`;
  } else {
    el.hidden = true;
  }
}

function updateHud() {
  stageLabelEl.textContent = t(mode === 'classic' ? '当前关卡' : '推进波次');
  stageValueEl.textContent = String(mode === 'classic' ? level : wave);
  scoreEl.textContent = String(score);
  bestEl.textContent = String(GameKit.readBest(mode === 'classic' ? BEST_KEYS.classic : BEST_KEYS.endless));

  modeClassicBtn.classList.toggle('active', mode === 'classic');
  modeEndlessBtn.classList.toggle('active', mode === 'endless');
  modeClassicBtn.setAttribute('aria-pressed', String(mode === 'classic'));
  modeEndlessBtn.setAttribute('aria-pressed', String(mode === 'endless'));

  skinBtns.forEach((btn) => {
    const active = btn.dataset.skin === skin;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  updateLivesUi();

  if (combo >= 3) {
    comboBadge.hidden = false;
    comboBadge.textContent = t('{n} 连击', { n: combo });
  } else {
    comboBadge.hidden = true;
  }

  syncEffectBadge(effectExpandBadge, 'expand', effects.expand);
  syncEffectBadge(effectFireBadge, 'fire', effects.fire);
  syncEffectBadge(effectLaserBadge, 'laser', effects.laser);
  syncEffectBadge(effectMagnetBadge, 'magnet', effects.magnet);

  const hasStuck = balls.some((b) => b.stuck);
  const canLaser = phase === 'playing' && effects.laser > 0;
  launchBtn.disabled = phase !== 'playing' || (!hasStuck && !canLaser);
  launchBtn.textContent = !hasStuck && canLaser ? t('发射激光 (空格)') : t('发射 / 激光 (空格)');
  pauseBtn.disabled = phase !== 'playing' && phase !== 'paused';
  pauseBtn.textContent = t(phase === 'paused' ? '继续' : '暂停');
}

function renderOverlay() {
  if (phase === 'playing') {
    overlay.classList.remove('show');
    return;
  }
  overlay.classList.add('show');
  if (phase === 'ready') {
    overlayTitle.textContent = t('经典打砖块');
    overlayDesc.textContent = t(
      mode === 'classic'
        ? '共 8 关原创阵型，接住增益胶囊并用角度控球击碎全部砖块。'
        : '砖块会持续向下压进，守住红色警戒线并冲击无尽高分！'
    );
    overlayBtn.textContent = t('开始游戏');
  } else if (phase === 'paused') {
    overlayTitle.textContent = t('已暂停');
    overlayDesc.textContent = t('当前得分 {score} · 准备好随时继续。', { score });
    overlayBtn.textContent = t('继续游戏');
  } else {
    overlayTitle.textContent = t('游戏结束');
    const best = GameKit.readBest(mode === 'classic' ? BEST_KEYS.classic : BEST_KEYS.endless);
    overlayDesc.textContent = mode === 'classic'
      ? t('得分 {score} · 最高第 {level} 关 · 最高连击 ×{combo} · 纪录 {best}', { score, level, combo: maxCombo, best })
      : t('得分 {score} · 坚持 {wave} 波 · 最高连击 ×{combo} · 纪录 {best}', { score, wave, combo: maxCombo, best });
    overlayBtn.textContent = t('再来一局');
  }
}

function launchStuckBalls() {
  let launched = false;
  for (const ball of balls) {
    if (!ball.stuck) continue;
    ball.stuck = false;
    launched = true;
  }
  if (launched) {
    audio.playPaddleHit(false);
    updateHud();
  }
  return launched;
}

function fireLasers(cooldownSeconds = 0.24) {
  if (phase !== 'playing' || effects.laser <= 0 || laserCooldown > 0) return false;
  const left = paddle.x - paddle.w / 2;
  lasers.push({ x: left + 10, y: PADDLE_Y - 8 });
  lasers.push({ x: left + paddle.w - 10, y: PADDLE_Y - 8 });
  laserCooldown = cooldownSeconds;
  audio.playLaser();
  return true;
}

function triggerPrimaryAction() {
  if (phase === 'ready') {
    phase = 'playing';
    launchStuckBalls();
    renderOverlay();
    updateHud();
    return;
  }
  if (phase === 'paused') {
    phase = 'playing';
    renderOverlay();
    updateHud();
    return;
  }
  if (phase === 'over') {
    setupRound(true);
    return;
  }
  if (!launchStuckBalls()) fireLasers();
}

function applyPowerup(kind) {
  audio.playPowerup(kind);
  addFloatText(paddle.x, PADDLE_Y - 18, '+' + t(POWERUP_META[kind].label), '#fde047');
  if (kind === 'expand') {
    effects.expand = EFFECT_DURATIONS.expand;
    paddle.w = PADDLE_WIDE_WIDTH;
    movePaddleTo(paddle.x);
  } else if (kind === 'fire') {
    effects.fire = EFFECT_DURATIONS.fire;
  } else if (kind === 'laser') {
    effects.laser = EFFECT_DURATIONS.laser;
  } else if (kind === 'magnet') {
    effects.magnet = EFFECT_DURATIONS.magnet;
  } else if (kind === 'life') {
    if (lives < MAX_LIVES) lives += 1;
    else score += 150;
  } else if (kind === 'multi') {
    const source = balls[0];
    if (source) {
      if (source.stuck) source.stuck = false;
      const spd = Math.hypot(source.vx, source.vy) || ballSpeed;
      const baseAngle = Math.atan2(source.vx, -source.vy);
      for (const offset of [-0.36, 0.36]) {
        if (balls.length >= MAX_BALLS) break;
        balls.push(createBall(source.x, source.y, spd, baseAngle + offset));
      }
    }
  }
  updateHud();
}

function handleBrickEvents(events) {
  for (const ev of events) {
    const b = ev.brick;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (ev.indestructible) {
      audio.playBrickHit({ indestructible: true });
      addBurstParticles(cx, cy, '#fde68a', 4);
      continue;
    }
    if (!ev.destroyed) {
      audio.playBrickHit({ destroyed: false, combo });
      addBurstParticles(cx, cy, '#cbd5e1', 4);
      continue;
    }

    const hitList = [b, ...(ev.chained || [])];
    if (ev.chained && ev.chained.length > 0 || b.type === 'bomb') {
      audio.playBombExplode();
      shakeTimer = 0.24;
      shakeMag = 6;
    }
    for (const dead of hitList) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const pts = dead.points + Math.min(50, Math.max(0, combo - 1) * 5);
      score += pts;
      const color = dead.type === 'bomb'
        ? '#f97316'
        : dead.type === 'gold'
          ? '#fbbf24'
          : SKINS[skin].normalPalette[dead.colorIdx % 5];
      addBurstParticles(dead.x + dead.w / 2, dead.y + dead.h / 2, color, dead.type === 'bomb' ? 14 : 8);
      if (combo >= 5 && combo % 5 === 0) {
        addFloatText(dead.x + dead.w / 2, dead.y, `${t('{n} 连击', { n: combo })} +${pts}`, '#fcd34d');
      }
      const dropKind = rollPowerupDrop(dead);
      if (dropKind && capsules.length < 6) {
        capsules.push({ x: dead.x + dead.w / 2, y: dead.y + dead.h / 2, vy: 125, kind: dropKind });
      }
    }
    audio.playBrickHit({ destroyed: true, combo });
  }
}

function endGame(overReason) {
  phase = 'over';
  saveRecords();
  audio.playGameOver();
  if (overReason === 'pushed') {
    levelBannerText = t('砖块突破警戒线！');
    levelBannerTimer = 1.6;
  }
  updateHud();
  renderOverlay();
}

function step(dt) {
  nowMs = performance.now();
  if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);
  if (levelBannerTimer > 0) levelBannerTimer = Math.max(0, levelBannerTimer - dt);
  if (laserCooldown > 0) laserCooldown = Math.max(0, laserCooldown - dt);

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floatTexts.length - 1; i >= 0; i -= 1) {
    const ft = floatTexts[i];
    ft.y -= 32 * dt;
    ft.life -= dt;
    if (ft.life <= 0) floatTexts.splice(i, 1);
  }

  if (phase !== 'playing') return;

  if (keys.left && !keys.right) movePaddleTo(paddle.x - PADDLE_SPEED * dt);
  else if (keys.right && !keys.left) movePaddleTo(paddle.x + PADDLE_SPEED * dt);

  let hudDirty = false;
  for (const key of ['expand', 'fire', 'laser', 'magnet']) {
    if (effects[key] > 0) {
      effects[key] = Math.max(0, effects[key] - dt);
      hudDirty = true;
      if (key === 'expand' && effects[key] === 0) {
        paddle.w = PADDLE_BASE_WIDTH;
        movePaddleTo(paddle.x);
      }
    }
  }

  if (effects.laser > 0 && laserCooldown <= 0) {
    fireLasers(0.42);
  }
  if (lasers.length > 0) {
    const laserRes = stepLasers(lasers, bricks, dt);
    lasers = laserRes.lasers;
    if (laserRes.brickEvents.length > 0) {
      handleBrickEvents(laserRes.brickEvents);
      hudDirty = true;
    }
  }

  const capsuleRes = stepCapsules(capsules, paddle, dt);
  capsules = capsuleRes.capsules;
  if (capsuleRes.caught.length > 0) {
    for (const cap of capsuleRes.caught) {
      applyPowerup(cap.kind);
    }
    hudDirty = true;
  }

  const nextBalls = [];
  for (const ball of balls) {
    if (!ball.stuck) {
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 6) ball.trail.shift();
    }
    const res = stepBallSubstepped(ball, paddle, bricks, effects, dt);
    if (res.wallHit) audio.playWallHit();
    if (res.magnetCatch) {
      combo = 0;
      audio.playPaddleHit(true);
      hudDirty = true;
    } else if (res.paddleHit) {
      combo = 0;
      audio.playPaddleHit(false);
      hudDirty = true;
    }
    if (res.brickEvents.length > 0) {
      handleBrickEvents(res.brickEvents);
      hudDirty = true;
    }
    if (!res.missed) nextBalls.push(ball);
  }
  balls = nextBalls;

  if (balls.length === 0) {
    lives -= 1;
    combo = 0;
    audio.playLifeLost();
    capsules = [];
    lasers = [];
    effects.expand = 0;
    effects.fire = 0;
    effects.laser = 0;
    effects.magnet = 0;
    paddle.w = PADDLE_BASE_WIDTH;
    movePaddleTo(paddle.x);
    if (lives <= 0) {
      endGame('lost');
      return;
    }
    dockFreshBall();
    hudDirty = true;
  }

  if (mode === 'classic' && countClearableBricks(bricks) === 0) {
    score += 200 + level * 50;
    saveRecords();
    audio.playLevelClear();
    loadClassicStage(level + 1);
    hudDirty = true;
  } else if (mode === 'endless') {
    pushTimer -= dt;
    if (pushTimer <= 0 || countClearableBricks(bricks) === 0) {
      wave += 1;
      pushTimer = Math.max(5.5, ENDLESS_PUSH_INTERVAL - wave * 0.25);
      const pushed = pushEndlessRow(bricks, wave);
      bricks = pushed.bricks;
      if (pushed.dangerReached) {
        endGame('pushed');
        return;
      }
      hudDirty = true;
    }
  }

  if (hudDirty) updateHud();
}

function loop(timestamp) {
  requestAnimationFrame(loop);
  if (!lastFrameAt) lastFrameAt = timestamp;
  const dt = Math.min(0.05, Math.max(0, (timestamp - lastFrameAt) / 1000));
  lastFrameAt = timestamp;
  step(dt);
  renderer.renderFrame();
}

function togglePause() {
  if (phase === 'playing') {
    phase = 'paused';
    renderOverlay();
    updateHud();
  } else if (phase === 'paused') {
    phase = 'playing';
    renderOverlay();
    updateHud();
  }
}

async function confirmAbandonAndRun(action, { switching = false } = {}) {
  if (phase !== 'playing' && phase !== 'paused') {
    action();
    return;
  }
  const wasPlaying = phase === 'playing';
  if (wasPlaying) phase = 'paused';
  renderOverlay();
  updateHud();
  const ok = await window.SiteData.confirmDialog({
    title: t(switching ? '切换模式' : '重开本局'),
    message: t(switching ? '切换模式会结束当前对局进度。' : '当前进度将被清除，确定重开吗？'),
    confirmText: t(switching ? '切换' : '重开'),
    cancelText: t('继续本局'),
    danger: true,
  });
  if (ok) {
    action();
  } else if (wasPlaying && phase === 'paused') {
    phase = 'playing';
    renderOverlay();
    updateHud();
  }
}

function switchMode(next) {
  if (next === mode) return;
  confirmAbandonAndRun(() => {
    mode = next;
    writeStored(MODE_KEY, mode);
    setupRound(false);
  }, { switching: true });
}

function setSkin(next) {
  if (!SKINS[next]) return;
  skin = next;
  writeStored(SKIN_KEY, skin);
  updateHud();
}

function canvasPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return ((event.clientX - rect.left) / rect.width) * W;
}

let activePointer = null;
canvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  activePointer = { id: event.pointerId, startX: event.clientX, moved: false };
  canvas.setPointerCapture(event.pointerId);
  if (phase === 'playing') movePaddleTo(canvasPointFromEvent(event));
});

canvas.addEventListener('pointermove', (event) => {
  if (activePointer && activePointer.id === event.pointerId) {
    if (Math.abs(event.clientX - activePointer.startX) > 14) activePointer.moved = true;
    if (phase === 'playing') movePaddleTo(canvasPointFromEvent(event));
  } else if (event.pointerType === 'mouse' && phase === 'playing') {
    movePaddleTo(canvasPointFromEvent(event));
  }
});

canvas.addEventListener('pointerup', (event) => {
  if (!activePointer || activePointer.id !== event.pointerId) return;
  const wasTap = !activePointer.moved;
  activePointer = null;
  if (wasTap && phase === 'playing') {
    if (!launchStuckBalls()) fireLasers();
  }
});

canvas.addEventListener('pointercancel', () => {
  activePointer = null;
});

document.addEventListener('keydown', (event) => {
  if (GameKit.shouldIgnoreGameKey(event, { ignoreOnControl: true })) return;
  if (window.SiteData && SiteData.isDialogOpen && SiteData.isDialogOpen()) return;
  if (window.GameKit && GameKit.isTutorialOpen && GameKit.isTutorialOpen()) return;
  const target = event.target;
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;

  if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
    event.preventDefault();
    keys.left = true;
  } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
    event.preventDefault();
    keys.right = true;
  } else if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
    event.preventDefault();
    triggerPrimaryAction();
  } else if (event.code === 'KeyP') {
    event.preventDefault();
    togglePause();
  } else if (event.code === 'KeyR') {
    event.preventDefault();
    confirmAbandonAndRun(() => setupRound(false));
  }
});

document.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = false;
});

modeClassicBtn.addEventListener('click', () => switchMode('classic'));
modeEndlessBtn.addEventListener('click', () => switchMode('endless'));
pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', () => confirmAbandonAndRun(() => setupRound(false)));
overlayBtn.addEventListener('click', triggerPrimaryAction);
launchBtn.addEventListener('click', () => {
  if (!launchStuckBalls()) fireLasers();
});
skinBtns.forEach((btn) => {
  btn.addEventListener('click', () => setSkin(btn.dataset.skin));
});

GameKit.onHidden(() => {
  keys.left = false;
  keys.right = false;
  if (phase === 'playing') togglePause();
});

document.addEventListener('site:dialogopen', () => {
  dialogOpen = true;
  keys.left = false;
  keys.right = false;
  if (phase === 'playing') {
    autoPausedByDialog = true;
    togglePause();
  }
});

document.addEventListener('site:dialogclose', () => {
  dialogOpen = false;
  if (autoPausedByDialog && phase === 'paused') {
    autoPausedByDialog = false;
    togglePause();
  }
});

document.addEventListener('i18n:change', () => {
  updateHud();
  renderOverlay();
  if (mode === 'classic') {
    const data = buildClassicLevel(level);
    if (levelBannerTimer > 0) levelBannerText = t('第 {level} 关 · {name}', { level, name: t(data.name) });
  } else if (levelBannerTimer > 0) {
    levelBannerText = t('无尽下压 · 阻挡砖块触底');
  }
});

function showTutorial(force) {
  GameKit.showTutorial({
    id: 'breakout',
    force,
    steps: [
      { icon: 'game-breakout', title: t('控板接球碎砖'), text: t('鼠标滑动、触屏拖动或用 A/D/方向键控制挡板，按空格或轻点画布发射弹珠击碎全部砖块。') },
      { icon: 'art-zap', title: t('接住增益胶囊'), text: t('碎砖随机掉落宽板、三球分裂、烈焰穿透、双联激光、磁性吸板与额外生命。') },
      { icon: 'art-star', title: t('闯关与无尽双模式'), text: t('经典闯关含 8 套原创阵型；无尽下压中砖块会不断下压，守住红色警戒线！') },
    ],
  });
}

helpBtn.addEventListener('click', () => showTutorial(true));
GameKit.bindMobileLayout('breakout', immersiveBtn, () => {});
setupRound(false);
showTutorial(false);
requestAnimationFrame(loop);
