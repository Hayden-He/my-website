import {
  W, H, GRAVITY, ARCADE_SECONDS, MAX_PARTICLES, MAX_SPLATTERS,
  SKINS, FRUITS, SPECIAL_FRUIT_MAP,
  segCircleHit, calcComboBonus, calcComboFeverEnergy,
} from './rules.js';
import { createFruitAudio } from './audio.js';
import { createFruitRenderer } from './renderer.js';

const t = (key, params) => window.I18N.t(key, params);
const MODE_KEY = 'game_mode_fruit';
const SKIN_KEY = 'game_skin_fruit';
const AURORA_KEY = 'game_skin_fruit_aurora';
const BEST_KEYS = {
  classic: 'game_best_fruit_classic',
  arcade: 'game_best_fruit_arcade',
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-el');
const thirdLabel = document.getElementById('third-label');
const thirdEl = document.getElementById('third-el');
const bestEl = document.getElementById('best-el');
const timerBarWrap = document.getElementById('timer-bar-wrap');
const timerBar = document.getElementById('timer-bar');
const feverBarBox = document.getElementById('fever-bar-box');
const feverLabel = document.getElementById('fever-label');
const feverFill = document.getElementById('fever-fill');
const feverPct = document.getElementById('fever-pct');
const buffBar = document.getElementById('buff-bar');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const overlayStats = document.getElementById('overlay-stats');
const overlayBtn = document.getElementById('overlay-btn');
const pauseBtn = document.getElementById('pause-btn');
const soundBtn = document.getElementById('sound-btn');
const helpBtn = document.getElementById('help-btn');
const restartBtn = document.getElementById('restart-btn');
const modeClassicBtn = document.getElementById('mode-classic');
const modeArcadeBtn = document.getElementById('mode-arcade');
const skinBtns = Array.from(document.querySelectorAll('.skin-pill'));
const controls = document.querySelector('.mobile-game-controls');

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
if (mode !== 'classic' && mode !== 'arcade') mode = 'classic';
let skin = readStored(SKIN_KEY, 'silver');
if (!SKINS[skin]) skin = 'silver';

let soundEnabled = window.SiteData ? window.SiteData.getSound() : true;
window.GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
});

const {
  playSwoosh, playSlice, playBombFuse, playMiss, playCombo,
  playBomb, playShieldBlock, playCountdownTick, playSpecial,
} = createFruitAudio({ isEnabled: () => soundEnabled });

// 游戏状态
let state = 'ready'; // 'ready' | 'playing' | 'paused' | 'over'
let score = 0;
let lives = 3;
let timeLeft = ARCADE_SECONDS;
let elapsed = 0;
let nextHealScore = 100;
let bestClassic = window.GameKit.readBest(BEST_KEYS.classic);
let bestArcade = window.GameKit.readBest(BEST_KEYS.arcade);
let auroraUnlocked = readStored(AURORA_KEY, '') === '1' || bestClassic >= 500 || bestArcade >= 500;
if (auroraUnlocked) writeStored(AURORA_KEY, '1');
if (skin === 'aurora' && !auroraUnlocked) skin = 'silver';
let newBest = false;
let lastEndReason = '';
let slicedCount = 0;
let maxCombo = 0;
let feverCount = 0;
let lastTickSec = 6;

// 特殊状态计时
let freezeTimer = 0;
let frenzyTimer = 0;
let frenzySpawnCd = 0;
let doubleTimer = 0;
let magnetTimer = 0;
let hasShield = false;
let clockSpawnCount = 0;
let feverMeter = 0;
let feverActiveTimer = 0;
let feverSpawnCd = 0;
let pomegranateTarget = null;
let waveTimer = 0.6;

// 实体与特效
let items = [];
let pendingBombs = [];
let halves = [];
let particles = [];
let splatters = [];
let floatTexts = [];
let bolts = [];
let shockwaves = [];
let slashes = [];
let trail = [];
let bombBlast = null;
let showcaseTimer = 0.2;

// 镜头反馈
let shakeTimer = 0;
let shakeMag = 0;
let flashAlpha = 0;
let flashColor = '#ffffff';

// 连击判定
let comboCount = 0;
let comboEnergyCount = 0;
let comboTimer = 0;
let comboX = W * 0.5;
let comboY = H * 0.5;

// 指针状态
let activePointerId = null;
let prevPt = null;

// DPR 高清适配
function syncCanvasDpr() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
syncCanvasDpr();
window.addEventListener('resize', syncCanvasDpr);

const renderer = createFruitRenderer({
  ctx,
  getState: () => ({
    skin, freezeTimer, feverActiveTimer, items, pendingBombs, halves, particles,
    splatters, floatTexts, bolts, shockwaves, slashes, trail, bombBlast,
    shakeTimer, shakeMag, flashAlpha, flashColor,
  }),
});

function currentBest() {
  return mode === 'classic' ? bestClassic : bestArcade;
}

function updateBest(val) {
  if (mode === 'classic') {
    if (val > bestClassic) {
      bestClassic = val;
      window.GameKit.saveBestIfHigher(BEST_KEYS.classic, val);
      return true;
    }
  } else if (val > bestArcade) {
    bestArcade = val;
    window.GameKit.saveBestIfHigher(BEST_KEYS.arcade, val);
    return true;
  }
  return false;
}

function addBuffPill(cls, label) {
  const span = document.createElement('span');
  span.className = 'buff-pill ' + cls;
  span.textContent = label;
  buffBar.appendChild(span);
}

function renderHud() {
  scoreEl.textContent = score;
  bestEl.textContent = currentBest();

  if (mode === 'classic') {
    thirdLabel.textContent = t('剩余生命');
    thirdEl.className = 'hud-value lives';
    thirdEl.textContent = '';
    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'life-dot' + (i >= lives ? ' lost' : '');
      thirdEl.appendChild(dot);
    }
    thirdEl.setAttribute('aria-label', t('{n} 条命', { n: lives }));
    timerBarWrap.className = 'timer-bar-wrap classic';
  } else {
    thirdLabel.textContent = t('剩余时间');
    const sec = Math.max(0, Math.ceil(timeLeft));
    const isClockFrozen = freezeTimer > 0 || !!pomegranateTarget;
    thirdEl.className = 'hud-value' + (sec <= 10 && !isClockFrozen ? ' danger' : '');
    thirdEl.textContent = sec + 's';
    thirdEl.removeAttribute('aria-label');
    timerBarWrap.className = 'timer-bar-wrap';
    const pct = Math.max(0, Math.min(100, (timeLeft / ARCADE_SECONDS) * 100));
    timerBar.style.width = pct + '%';
    timerBar.className = 'timer-bar' + (isClockFrozen ? ' frozen' : (sec <= 10 ? ' low' : ''));
  }

  pauseBtn.disabled = state !== 'playing' && state !== 'paused';
  pauseBtn.textContent = t(state === 'paused' ? '继续' : '暂停');

  // 暴走能量条（位于画布正上方）
  if (feverActiveTimer > 0) {
    feverBarBox.classList.add('active');
    feverLabel.textContent = t('🔥 超级暴走 ×2');
    feverFill.style.width = Math.max(0, Math.min(100, (feverActiveTimer / 4.5) * 100)) + '%';
    feverPct.textContent = feverActiveTimer.toFixed(1) + 's';
  } else {
    feverBarBox.classList.remove('active');
    feverLabel.textContent = t('🔥 暴走能量');
    const pct = Math.max(0, Math.min(100, Math.round(feverMeter)));
    feverFill.style.width = pct + '%';
    feverPct.textContent = pct + '%';
  }

  // Buff 状态胶囊
  buffBar.textContent = '';
  if (hasShield) addBuffPill('shield', t('防爆护盾'));
  if (feverActiveTimer > 0) addBuffPill('fever', t('超级暴走 {s}s', { s: feverActiveTimer.toFixed(1) }));
  if (freezeTimer > 0) addBuffPill('freeze', t('冰冻减速 {s}s', { s: freezeTimer.toFixed(1) }));
  if (frenzyTimer > 0) addBuffPill('frenzy', t('水果狂热 {s}s', { s: frenzyTimer.toFixed(1) }));
  if (doubleTimer > 0) addBuffPill('double', t('双倍得分 {s}s', { s: doubleTimer.toFixed(1) }));
  if (magnetTimer > 0) addBuffPill('magnet', t('磁力聚拢 {s}s', { s: magnetTimer.toFixed(1) }));
  if (pomegranateTarget) addBuffPill('pomegranate', t('狂切石榴！'));
}

function renderOverlay() {
  controls.toggleAttribute('data-live', state === 'playing' || state === 'paused' || state === 'dying');
  overlay.toggleAttribute('data-ready', state === 'ready');
  if (state === 'playing') {
    overlay.classList.remove('show');
    return;
  }
  overlay.classList.add('show');
  if (state === 'ready') {
    overlayTitle.textContent = t('极速切水果');
    overlayDesc.textContent = t(mode === 'classic'
      ? '经典 3 命：漏掉常规水果扣 1 命，善用回血/护盾/分裂/磁力/冰冻/闪电果，切到炸弹立即结束！'
      : '60 秒狂热：冰冻与石榴期间暂停倒计时，连击攒满触发无炸弹暴走，还有+3s时钟/护盾/分裂果！');
    overlayStats.textContent = '';
    overlayStats.hidden = true;
    overlayBtn.textContent = t('开始游戏');
  } else if (state === 'paused') {
    overlayTitle.textContent = t('已暂停');
    overlayDesc.textContent = t('当前得分：{score}', { score });
    overlayStats.textContent = '';
    overlayStats.hidden = true;
    overlayBtn.textContent = t('继续游戏');
  } else if (state === 'over') {
    overlayTitle.textContent = lastEndReason === 'bomb'
      ? t('切到炸弹！')
      : (mode === 'arcade' ? t('时间到！') : t('生命耗尽！'));
    const suffix = newBest ? t('（新纪录！）') : '';
    overlayDesc.textContent = t('本局得分：{score}（本模式最高：{best}）', {
      score,
      best: currentBest(),
    }) + suffix;
    overlayStats.textContent = t('切中 {fruits} 颗 · 最高 {combo} 连击 · 暴走 {fever} 次', {
      fruits: slicedCount,
      combo: maxCombo,
      fever: feverCount,
    });
    overlayStats.hidden = false;
    overlayBtn.textContent = t('再来一局');
  }
}

function syncModeButtons() {
  modeClassicBtn.classList.toggle('active', mode === 'classic');
  modeArcadeBtn.classList.toggle('active', mode === 'arcade');
  skinBtns.forEach((btn) => {
    const id = btn.dataset.skin;
    const locked = id === 'aurora' && !auroraUnlocked;
    btn.classList.toggle('active', id === skin);
    btn.classList.toggle('locked', locked);
    const lockIcon = btn.querySelector('.skin-lock');
    if (lockIcon) lockIcon.hidden = !locked;
  });
}

function unlockAurora() {
  if (auroraUnlocked) return;
  auroraUnlocked = true;
  writeStored(AURORA_KEY, '1');
  syncModeButtons();
  playSpecial('fever');
  addFloatText(W * 0.5, H * 0.24, t('解锁极光星刃！'), '#5eead4', 1.35);
  if (window.SiteData) window.SiteData.toast(t('解锁限定刀锋：极光星刃！'), { duration: 3000 });
}

function resetState(nextState) {
  state = nextState;
  score = 0;
  lives = 3;
  timeLeft = ARCADE_SECONDS;
  elapsed = 0;
  nextHealScore = 100;
  newBest = false;
  lastEndReason = '';
  slicedCount = 0;
  maxCombo = 0;
  feverCount = 0;
  lastTickSec = 6;
  freezeTimer = 0;
  frenzyTimer = 0;
  frenzySpawnCd = 0;
  doubleTimer = 0;
  magnetTimer = 0;
  hasShield = false;
  clockSpawnCount = 0;
  feverMeter = 0;
  feverActiveTimer = 0;
  feverSpawnCd = 0;
  pomegranateTarget = null;
  waveTimer = 0.35;
  items = [];
  pendingBombs = [];
  halves = [];
  particles = [];
  splatters = [];
  floatTexts = [];
  bolts = [];
  shockwaves = [];
  slashes = [];
  trail = [];
  bombBlast = null;
  showcaseTimer = 0.15;
  shakeTimer = 0;
  flashAlpha = 0;
  comboCount = 0;
  comboEnergyCount = 0;
  comboTimer = 0;
  activePointerId = null;
  prevPt = null;
  renderHud();
  renderOverlay();
  controls.scrollTop = 0;
}

function startGame() {
  resetState('playing');
}

function endGame(reason) {
  if (state === 'over') return;
  state = 'over';
  lastEndReason = reason;
  newBest = updateBest(score);
  pomegranateTarget = null;
  pendingBombs = [];
  renderHud();
  renderOverlay();
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  activePointerId = null;
  prevPt = null;
  renderHud();
  renderOverlay();
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  renderHud();
  renderOverlay();
}

async function confirmAbandonIfActive() {
  if ((state === 'playing' || state === 'paused') && score > 0) {
    if (state === 'playing') pauseGame();
    const ok = await window.SiteData.confirmDialog({
      title: t('重开本局'),
      message: t('当前进度将被清除，确定重开吗？'),
      confirmText: t('重开'),
      cancelText: t('继续本局'),
      danger: true,
    });
    return ok;
  }
  return true;
}

// ---------- 投掷生成逻辑 ----------
function spawnFruitObject(kind, specialKind, fromSide, custom) {
  const fruit = kind || FRUITS[Math.floor(Math.random() * FRUITS.length)];
  const isBomb = specialKind === 'bomb';
  const isMini = !!(custom && custom.isMini);
  const isBonus = !!(custom && custom.isBonus);
  const isFeverFruit = !!(custom && custom.isFeverFruit);
  const r = (custom && custom.r) || (isBomb ? 28 : (specialKind === 'pomegranate' ? 35 : fruit.r));

  let x, y, vx, vy;
  if (custom && typeof custom.x === 'number' && typeof custom.y === 'number') {
    x = custom.x;
    y = custom.y;
    vx = custom.vx;
    vy = custom.vy;
  } else if (fromSide) {
    const left = fromSide === 'left';
    x = left ? -r : W + r;
    y = H * (0.42 + Math.random() * 0.34);
    vx = (left ? 1 : -1) * (270 + Math.random() * 140);
    vy = -(340 + Math.random() * 170);
  } else {
    x = (custom && typeof custom.launchX === 'number') ? custom.launchX : (80 + Math.random() * (W - 160));
    y = H + r + 8;
    const targetX = (custom && typeof custom.targetX === 'number') ? custom.targetX : (120 + Math.random() * (W - 240));
    const peakH = (custom && typeof custom.peakH === 'number') ? custom.peakH : (55 + Math.random() * 125);
    const rise = (H + r) - peakH;
    vy = -Math.sqrt(2 * GRAVITY * rise);
    const flightTime = (-vy * 1.45) / GRAVITY;
    vx = (targetX - x) / Math.max(0.65, flightTime);
  }

  items.push({
    id: Math.random(),
    fruit,
    special: specialKind || null,
    isMini,
    isBonus,
    isFeverFruit,
    r,
    x,
    y,
    vx,
    vy,
    rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 4.8,
    sliced: false,
    hits: 0,
    hitCd: 0,
    life: 0,
    multiTimer: 0,
  });
}

function scheduleBomb() {
  pendingBombs.push({
    launchX: 80 + Math.random() * (W - 160),
    targetX: 120 + Math.random() * (W - 240),
    peakH: 65 + Math.random() * 120,
    r: 28,
    delay: 0.45,
    maxDelay: 0.45,
  });
}

function spawnWave() {
  const difficulty = Math.min(1, elapsed / 55);
  const count = 1 + Math.floor(Math.random() * (2.2 + difficulty * 2.5));
  const bombChance = feverActiveTimer > 0
    ? 0
    : (mode === 'classic' ? 0.1 + difficulty * 0.14 : 0.12 + difficulty * 0.08);

  let specialSpawned = false;
  let bombSpawned = false;
  for (let i = 0; i < count; i += 1) {
    const roll = Math.random();
    if (roll < bombChance && items.length + pendingBombs.length < 10) {
      scheduleBomb();
      if (!bombSpawned) {
        bombSpawned = true;
        playBombFuse();
      }
    } else if (!specialSpawned && !pomegranateTarget && Math.random() < (mode === 'arcade' ? 0.18 : 0.12)) {
      specialSpawned = true;
      if (mode === 'arcade') {
        const pool = ['freeze', 'frenzy', 'double', 'pomegranate', 'lightning', 'splitter', 'magnet', 'shield'];
        const clockOnBoard = items.some((it) => !it.sliced && it.special === 'clock');
        if (clockSpawnCount < 2 && timeLeft <= 48 && !clockOnBoard) pool.push('clock', 'clock');
        const sp = pool[Math.floor(Math.random() * pool.length)];
        spawnFruitObject(SPECIAL_FRUIT_MAP[sp], sp);
      } else {
        const pool = ['freeze', 'pomegranate', 'lightning', 'splitter', 'magnet', 'shield', 'heal'];
        if (lives < 3) pool.push('heal', 'shield');
        const sp = pool[Math.floor(Math.random() * pool.length)];
        spawnFruitObject(SPECIAL_FRUIT_MAP[sp], sp);
      }
    } else {
      spawnFruitObject();
    }
  }
}

// ---------- 粒子与反馈 ----------
function pushParticle(p) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
}

function spawnJuiceSplash(x, y, color, count) {
  if (splatters.length >= MAX_SPLATTERS) splatters.shift();
  const drops = [];
  for (let i = 0; i < 6; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const d = 10 + Math.random() * 24;
    drops.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: 3 + Math.random() * 6 });
  }
  splatters.push({ x, y, r: 22 + Math.random() * 14, color, alpha: 0.42, drops });

  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const spd = 90 + Math.random() * 260;
    pushParticle({
      kind: 'drop',
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 60,
      r: 2.5 + Math.random() * 4.5,
      color,
      life: 0.55 + Math.random() * 0.3,
      maxLife: 0.85,
      gravity: 560,
    });
  }
}

function spawnBladeParticle(x, y) {
  if (skin === 'silver') {
    if (Math.random() > 0.35) return;
    pushParticle({
      kind: 'spark',
      x,
      y,
      vx: (Math.random() - 0.5) * 90,
      vy: (Math.random() - 0.5) * 90,
      r: 1.5 + Math.random() * 2,
      color: '#f8fafc',
      life: 0.25,
      maxLife: 0.25,
      gravity: 0,
    });
  } else if (skin === 'flame') {
    pushParticle({
      kind: 'drop',
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 60,
      vy: -70 - Math.random() * 90,
      r: 2.5 + Math.random() * 3.5,
      color: Math.random() < 0.5 ? '#fb923c' : '#fde047',
      life: 0.35,
      maxLife: 0.35,
      gravity: -90,
    });
  } else if (skin === 'ice') {
    if (Math.random() > 0.5) return;
    pushParticle({
      kind: 'crystal',
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 45,
      vy: 30 + Math.random() * 55,
      r: 3 + Math.random() * 2.5,
      color: '#bae6fd',
      rot: Math.random() * Math.PI,
      life: 0.45,
      maxLife: 0.45,
      gravity: 40,
    });
  } else if (skin === 'neon') {
    if (Math.random() > 0.45) return;
    pushParticle({
      kind: 'spark',
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 140,
      vy: (Math.random() - 0.5) * 140,
      r: 2 + Math.random() * 2,
      color: Math.random() < 0.5 ? '#f0abfc' : '#38bdf8',
      life: 0.22,
      maxLife: 0.22,
      gravity: 0,
    });
  } else if (skin === 'sakura') {
    if (Math.random() > 0.45) return;
    pushParticle({
      kind: 'petal',
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 55,
      vy: 35 + Math.random() * 45,
      r: 3.5 + Math.random() * 2.5,
      color: Math.random() < 0.5 ? '#fda4af' : '#fecdd3',
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 6,
      life: 0.65,
      maxLife: 0.65,
      gravity: 30,
    });
  } else if (skin === 'aurora') {
    if (Math.random() > 0.55) return;
    pushParticle({
      kind: 'crystal',
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 85,
      vy: (Math.random() - 0.5) * 85,
      r: 2.8 + Math.random() * 2.4,
      color: Math.random() < 0.5 ? '#5eead4' : '#c084fc',
      rot: Math.random() * Math.PI,
      life: 0.38,
      maxLife: 0.38,
      gravity: 0,
    });
  }
}

function addFloatText(x, y, text, color, scale) {
  floatTexts.push({
    x: Math.max(58, Math.min(W - 58, x)),
    y: Math.max(36, Math.min(H - 36, y)),
    text,
    color: color || '#fef08a',
    scale: scale || 1,
    life: 0.9,
    maxLife: 0.9,
  });
}

function triggerShake(mag, time) {
  shakeMag = Math.max(shakeMag, mag);
  shakeTimer = Math.max(shakeTimer, time);
}

function addPoints(pts) {
  const mult = (doubleTimer > 0 ? 2 : 1) * (feverActiveTimer > 0 ? 2 : 1);
  const gained = pts * mult;
  score += gained;
  if (score >= 500) unlockAurora();
  if (mode === 'classic' && score >= nextHealScore) {
    nextHealScore += 100;
    if (lives < 3) {
      lives += 1;
      addFloatText(W * 0.5, 90, '+1 ♥', '#4ade80', 1.35);
    }
  }
  return gained;
}

// ---------- 切割判定 ----------
function sliceNormalItem(item, angle) {
  if (item.sliced) return;
  item.sliced = true;

  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  for (const side of [-1, 1]) {
    halves.push({
      fruit: item.fruit,
      special: item.special,
      r: item.r,
      x: item.x + nx * side * 5,
      y: item.y + ny * side * 5,
      vx: item.vx + nx * side * 95,
      vy: Math.min(item.vy, -40) + ny * side * 65 - 40,
      rot: item.rot,
      sliceAngle: angle,
      vRot: side * (2.6 + Math.random() * 2.2),
      side,
    });
  }

  const splashColor = item.special === 'freeze' ? '#38bdf8'
    : item.special === 'lightning' ? '#fde047'
    : item.special === 'magnet' ? '#c084fc'
    : item.special === 'shield' ? '#2dd4bf'
    : item.special === 'clock' ? '#fb923c'
    : item.fruit.juice;
  spawnJuiceSplash(item.x, item.y, splashColor, 14);

  if (item.special === 'freeze') {
    freezeTimer = 4.2;
    playSpecial('freeze');
    addFloatText(item.x, item.y - 10, t('冰冻减速!'), '#67e8f9', 1.2);
  } else if (item.special === 'frenzy') {
    frenzyTimer = 5.0;
    frenzySpawnCd = 0.05;
    playSpecial('frenzy');
    addFloatText(item.x, item.y - 10, t('水果狂热!'), '#f472b6', 1.25);
  } else if (item.special === 'double') {
    doubleTimer = 6.0;
    playSpecial('double');
    addFloatText(item.x, item.y - 10, t('双倍得分 ×2!'), '#fde047', 1.25);
  } else if (item.special === 'magnet') {
    magnetTimer = 4.5;
    playSpecial('magnet');
    addFloatText(item.x, item.y - 10, t('磁力聚拢!'), '#d8b4fe', 1.25);
  } else if (item.special === 'shield') {
    playSpecial('shield');
    if (!hasShield) {
      hasShield = true;
      addFloatText(item.x, item.y - 10, t('防爆护盾!'), '#5eead4', 1.25);
    } else {
      const g = addPoints(15);
      addFloatText(item.x, item.y - 10, '+' + g, '#5eead4', 1.25);
    }
  } else if (item.special === 'clock') {
    clockSpawnCount += 1;
    timeLeft = Math.min(ARCADE_SECONDS + 6, timeLeft + 3);
    playSpecial('clock');
    addFloatText(item.x, item.y - 10, '+3s!', '#fdba74', 1.35);
  } else if (item.special === 'splitter') {
    playSpecial('splitter');
    addFloatText(item.x, item.y - 10, t('分裂连爆!'), '#fde047', 1.25);
    const miniPool = [FRUITS[3], FRUITS[6], FRUITS[9], FRUITS[11]];
    for (let m = 0; m < miniPool.length; m += 1) {
      spawnFruitObject(miniPool[m], null, null, {
        isMini: true,
        r: 18,
        x: item.x,
        y: item.y,
        vx: (m - 1.5) * 115 + (Math.random() - 0.5) * 36,
        vy: -300 - Math.random() * 140,
      });
    }
  } else if (item.special === 'heal') {
    playSpecial('double');
    if (lives < 3) {
      lives += 1;
      addFloatText(item.x, item.y - 10, '+1 ♥', '#4ade80', 1.35);
    } else {
      const g = addPoints(15);
      addFloatText(item.x, item.y - 10, '+' + g, '#4ade80', 1.25);
    }
  } else if (item.special === 'lightning') {
    playSpecial('lightning');
    flashColor = '#fef08a';
    flashAlpha = 0.35;
    triggerShake(6, 0.2);
    const targets = items.filter((other) => !other.sliced && other !== item && other.special !== 'bomb');
    const ptsList = [{ x: item.x, y: item.y }];
    let chainCount = 0;
    for (const tgt of targets) {
      ptsList.push({ x: tgt.x, y: tgt.y });
      sliceNormalItem(tgt, Math.atan2(tgt.y - item.y, tgt.x - item.x));
      chainCount += 1;
    }
    if (ptsList.length > 1) {
      bolts.push({ points: ptsList, life: 0.28, maxLife: 0.28 });
    }
    if (chainCount > 0) {
      const bonus = addPoints(chainCount * 2);
      addFloatText(item.x, item.y - 24, t('闪电连劈 +{n}', { n: bonus }), '#fef08a', 1.3);
    }
  }

  const isCrit = !item.special && Math.random() < 0.07;
  const basePts = isCrit ? 10 : (item.isMini ? 3 : item.fruit.pts);
  const gained = addPoints(basePts);
  shockwaves.push({
    x: item.x,
    y: item.y,
    r: item.r * 0.65,
    maxR: item.r * (isCrit || item.special ? 2.4 : 1.75),
    color: isCrit ? '#fde047' : splashColor,
    life: 0.18,
    maxLife: 0.18,
  });
  slashes.push({
    x: item.x,
    y: item.y,
    angle,
    len: item.r * (isCrit ? 3.2 : 2.65),
    color: isCrit ? '#fef08a' : '#ffffff',
    life: 0.15,
    maxLife: 0.15,
  });
  if (isCrit) {
    addFloatText(item.x, item.y - 16, t('暴击 +{n}!', { n: gained }), '#fde047', 1.35);
    triggerShake(4, 0.14);
  } else if (!item.special) {
    addFloatText(item.x, item.y - 8, '+' + gained, '#ffffff', 0.95);
  }

  comboCount += 1;
  slicedCount += 1;
  comboTimer = 0.2;
  comboX = item.x;
  comboY = item.y;
  if (!item.isFeverFruit) {
    comboEnergyCount += 1;
    addFeverEnergy(item.special ? 5 : 3);
  }
  playSlice(comboCount);
}

function addFeverEnergy(amount) {
  if (feverActiveTimer > 0) return;
  feverMeter += amount;
  if (feverMeter >= 100) {
    feverMeter = 0;
    comboEnergyCount = 0;
    feverCount += 1;
    feverActiveTimer = 4.5;
    feverSpawnCd = 0.05;
    playSpecial('fever');
    addFloatText(W * 0.5, H * 0.34, t('超级暴走 ×2！'), '#fde047', 1.45);
    triggerShake(6, 0.22);
  }
}

function flushCombo() {
  if (comboCount > maxCombo) maxCombo = comboCount;
  if (comboCount >= 6) unlockAurora();
  const baseBonus = calcComboBonus(comboCount);
  if (baseBonus > 0) {
    const bonus = addPoints(baseBonus);
    addFloatText(comboX, comboY - 28, t('{c} 连击 +{n}', { c: comboCount, n: bonus }), '#fde047', 1.4);
    triggerShake(Math.min(7, 2 + comboCount), 0.16);
    const comboEnergy = calcComboFeverEnergy(comboEnergyCount);
    if (comboEnergy > 0) addFeverEnergy(comboEnergy);
    playCombo(comboCount);
  }
  comboCount = 0;
  comboEnergyCount = 0;
  comboTimer = 0;
}

function handleSliceSegment(ax, ay, bx, by) {
  if (state !== 'playing') return;
  const dist = Math.hypot(bx - ax, by - ay);
  if (dist < 3) return;
  const angle = Math.atan2(by - ay, bx - ax);
  if (dist > 26) playSwoosh();

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.sliced) continue;
    const isBomb = item.special === 'bomb';
    if (isBomb && item.vy < 0 && item.y > H - item.r * 0.45) continue;
    const hitRadius = isBomb ? item.r * 0.9 : item.r * 1.1;
    if (!segCircleHit(ax, ay, bx, by, item.x, item.y, hitRadius)) continue;

    if (isBomb) {
      item.sliced = true;
      if (hasShield) {
        hasShield = false;
        playShieldBlock();
        triggerShake(8, 0.28);
        spawnJuiceSplash(item.x, item.y, '#2dd4bf', 18);
        shockwaves.push({
          x: item.x,
          y: item.y,
          r: 16,
          maxR: 135,
          color: '#5eead4',
          life: 0.28,
          maxLife: 0.28,
        });
        addFloatText(item.x, item.y - 12, t('护盾抵消!'), '#5eead4', 1.35);
        continue;
      }
      playBomb();
      triggerShake(14, 0.55);
      spawnJuiceSplash(item.x, item.y, '#f97316', 28);
      shockwaves.push({
        x: item.x,
        y: item.y,
        r: 18,
        maxR: 150,
        color: '#fef08a',
        life: 0.32,
        maxLife: 0.32,
      });
      if (mode === 'classic') {
        state = 'dying';
        activePointerId = null;
        prevPt = null;
        pomegranateTarget = null;
        pendingBombs = [];
        bombBlast = { x: item.x, y: item.y, timer: 0, duration: 0.85 };
        flashColor = '#ffffff';
        flashAlpha = 0.05;
        renderHud();
        return;
      }
      flashColor = '#ffffff';
      flashAlpha = 0.55;
      feverMeter = 0;
      comboCount = 0;
      comboEnergyCount = 0;
      comboTimer = 0;
      score = Math.max(0, score - 10);
      addFloatText(item.x, item.y - 12, '-10', '#ef4444', 1.45);
      continue;
    }

    if (item.special === 'pomegranate') {
      if (item.hitCd <= 0) {
        item.hitCd = 0.075;
        item.hits += 1;
        item.hitBounce = 0.22;
        if (!pomegranateTarget) {
          pomegranateTarget = item;
          item.multiTimer = 1.75;
          item.vx *= 0.15;
          item.vy *= 0.15;
        }
        const gained = addPoints(2);
        slashes.push({
          x: item.x + (Math.random() - 0.5) * 14,
          y: item.y + (Math.random() - 0.5) * 14,
          angle,
          len: item.r * 2.9,
          color: '#fecdd3',
          life: 0.14,
          maxLife: 0.14,
        });
        spawnJuiceSplash(item.x, item.y, '#e11d48', 8);
        playSlice(item.hits);
        triggerShake(3.5, 0.08);
        addFloatText(
          item.x + (Math.random() - 0.5) * 32,
          item.y - 16 + (Math.random() - 0.5) * 20,
          t('连切 ×{h} +{n}', { h: item.hits, n: gained }),
          '#fda4af',
          1.05
        );
        if (item.hits >= 14) {
          finishPomegranate(item);
        }
      }
      continue;
    }

    sliceNormalItem(item, angle);
  }
}

function finishPomegranate(item) {
  if (item.sliced) return;
  pomegranateTarget = null;
  flashColor = '#fecdd3';
  flashAlpha = 0.45;
  triggerShake(10, 0.28);
  playCombo(4);
  sliceNormalItem(item, Math.random() * Math.PI);
  for (const other of items) {
    if (!other.sliced && other !== item && other.special !== 'bomb') {
      sliceNormalItem(other, Math.atan2(other.y - item.y, other.x - item.x));
    }
  }
}

// ---------- 主循环更新 ----------
function decayVisualEffects(dt) {
  if (shakeTimer > 0) {
    shakeTimer = Math.max(0, shakeTimer - dt);
    if (shakeTimer === 0) shakeMag = 0;
  }
  if (state !== 'dying' && flashAlpha > 0) {
    flashAlpha = Math.max(0, flashAlpha - dt * 2.1);
  }
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.gravity || 0) * dt;
    if (p.vRot) p.rot += p.vRot * dt;
  }
  for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
    shockwaves[i].life -= dt;
    if (shockwaves[i].life <= 0) shockwaves.splice(i, 1);
  }
  for (let i = slashes.length - 1; i >= 0; i -= 1) {
    slashes[i].life -= dt;
    if (slashes[i].life <= 0) slashes.splice(i, 1);
  }
  for (let i = floatTexts.length - 1; i >= 0; i -= 1) {
    const ft = floatTexts[i];
    ft.life -= dt;
    ft.y -= 36 * dt;
    if (ft.life <= 0) floatTexts.splice(i, 1);
  }
  for (let i = bolts.length - 1; i >= 0; i -= 1) {
    bolts[i].life -= dt;
    if (bolts[i].life <= 0) bolts.splice(i, 1);
  }
  const now = performance.now();
  while (trail.length && now - trail[0].t > 135) trail.shift();
}

function update(dt) {
  if (state === 'ready') {
    showcaseTimer -= dt;
    if (showcaseTimer <= 0 && items.length < 3) {
      showcaseTimer = 1.15 + Math.random() * 0.5;
      spawnFruitObject();
    }
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i];
      it.x += it.vx * dt * 0.72;
      it.y += it.vy * dt * 0.72;
      it.vy += GRAVITY * dt * 0.72;
      it.rot += it.vRot * dt * 0.72;
      if (it.y > H + it.r + 40 && it.vy > 0) items.splice(i, 1);
    }
    return;
  }

  if (state === 'dying' && bombBlast) {
    bombBlast.timer += dt;
    const p = bombBlast.timer / bombBlast.duration;
    flashColor = '#ffffff';
    if (p < 0.52) {
      flashAlpha = Math.min(0.96, (p / 0.52) * 0.96);
    } else {
      flashAlpha = Math.max(0, 0.96 * (1 - (p - 0.52) / 0.48));
    }
    decayVisualEffects(dt);
    if (bombBlast.timer >= bombBlast.duration) {
      bombBlast = null;
      flashAlpha = 0;
      endGame('bomb');
    }
    return;
  }

  if (state === 'over') {
    decayVisualEffects(dt);
    return;
  }

  if (state !== 'playing') return;

  elapsed += dt;
  if (mode === 'arcade' && freezeTimer <= 0 && !pomegranateTarget) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame('time');
      return;
    }
    const curSec = Math.ceil(timeLeft);
    if (curSec > lastTickSec) lastTickSec = Math.min(6, curSec);
    else if (curSec >= 1 && curSec <= 5 && curSec < lastTickSec) {
      lastTickSec = curSec;
      playCountdownTick(curSec);
    }
  }

  if (freezeTimer > 0) freezeTimer = Math.max(0, freezeTimer - dt);
  if (doubleTimer > 0) doubleTimer = Math.max(0, doubleTimer - dt);
  if (magnetTimer > 0) magnetTimer = Math.max(0, magnetTimer - dt);
  if (frenzyTimer > 0 && !pomegranateTarget) {
    frenzyTimer = Math.max(0, frenzyTimer - dt);
    frenzySpawnCd -= dt;
    if (frenzySpawnCd <= 0) {
      frenzySpawnCd = 0.22;
      spawnFruitObject(null, null, Math.random() < 0.5 ? 'left' : 'right', { isBonus: true });
    }
  }
  if (feverActiveTimer > 0 && !pomegranateTarget) {
    feverActiveTimer = Math.max(0, feverActiveTimer - dt);
    feverSpawnCd -= dt;
    if (feverSpawnCd <= 0) {
      feverSpawnCd = 0.16;
      const sideRoll = Math.random();
      spawnFruitObject(null, null, sideRoll < 0.35 ? 'left' : (sideRoll < 0.7 ? 'right' : null), { isBonus: true, isFeverFruit: true });
    }
  }

  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) flushCombo();
  }

  if (!pomegranateTarget) {
    for (let i = pendingBombs.length - 1; i >= 0; i -= 1) {
      const pb = pendingBombs[i];
      pb.delay -= dt * (freezeTimer > 0 ? 0.55 : 1);
      if (pb.delay <= 0) {
        pendingBombs.splice(i, 1);
        spawnFruitObject(null, 'bomb', null, {
          launchX: pb.launchX,
          targetX: pb.targetX,
          peakH: pb.peakH,
          r: pb.r,
        });
      }
    }
  }

  waveTimer -= dt;
  if (waveTimer <= 0 && !pomegranateTarget) {
    spawnWave();
    const pace = Math.max(0.95, 1.85 - Math.min(0.75, elapsed * 0.012));
    const sprintScale = (mode === 'arcade' && timeLeft <= 10) ? 0.85 : 1;
    waveTimer = ((frenzyTimer > 0 || feverActiveTimer > 0) ? pace * 0.85 : pace) * sprintScale;
  }

  const timeScale = pomegranateTarget ? 0.22 : (freezeTimer > 0 ? 0.45 : 1);
  const sdt = dt * timeScale;
  const magX = prevPt ? prevPt.x : W * 0.5;
  const magY = prevPt ? prevPt.y : H * 0.42;

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    item.life += dt;
    if (item.hitCd > 0) item.hitCd = Math.max(0, item.hitCd - dt);
    if (item.hitBounce > 0) item.hitBounce = Math.max(0, item.hitBounce - dt * 2.2);

    if (item === pomegranateTarget) {
      item.multiTimer -= dt;
      item.x += item.vx * dt * 0.25;
      item.y += item.vy * dt * 0.25;
      item.rot += item.vRot * dt * 0.4;
      if (item.multiTimer <= 0) {
        finishPomegranate(item);
      }
      continue;
    }

    if (magnetTimer > 0) {
      if (item.special === 'bomb') {
        const pushDir = item.x >= magX ? 1 : -1;
        item.vx += pushDir * 140 * sdt;
      } else {
        const dx = magX - item.x;
        const dy = magY - item.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 260) {
          item.vx += (dx / dist) * 260 * sdt;
          item.vy += (dy / dist) * 190 * sdt;
        }
      }
    }

    item.x += item.vx * sdt;
    item.y += item.vy * sdt;
    item.vy += GRAVITY * sdt;
    item.rot += item.vRot * sdt;

    if (item.sliced) {
      items.splice(i, 1);
      continue;
    }

    if (item.y > H + item.r + 40 && item.vy > 0) {
      const missedFruit = !item.special && !item.isMini && !item.isBonus && item.life > 0.45;
      items.splice(i, 1);
      if (missedFruit && feverActiveTimer <= 0) {
        feverMeter = Math.max(0, feverMeter - 10);
      }
      if (missedFruit && mode === 'classic') {
        lives -= 1;
        playMiss();
        addFloatText(Math.max(40, Math.min(W - 40, item.x)), H - 46, '✕', '#ef4444', 1.6);
        triggerShake(5, 0.16);
        if (lives <= 0) {
          lives = 0;
          endGame('lives');
          return;
        }
      }
    }
  }

  for (let i = halves.length - 1; i >= 0; i -= 1) {
    const h = halves[i];
    h.x += h.vx * sdt;
    h.y += h.vy * sdt;
    h.vy += GRAVITY * sdt;
    h.rot += h.vRot * sdt;
    if (h.y > H + h.r + 50) halves.splice(i, 1);
  }

  for (let i = splatters.length - 1; i >= 0; i -= 1) {
    splatters[i].alpha -= dt * 0.085;
    if (splatters[i].alpha <= 0) splatters.splice(i, 1);
  }

  decayVisualEffects(dt);

  renderHud();
}

// ---------- 指针与事件绑定 ----------
function toCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (state !== 'playing') return;
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  activePointerId = event.pointerId;
  if (event.pointerType !== 'mouse') {
    try { canvas.setPointerCapture(event.pointerId); } catch {}
  }
  const pt = toCanvasPoint(event);
  prevPt = pt;
  trail.push({ x: pt.x, y: pt.y, t: performance.now() });
});

canvas.addEventListener('pointermove', (event) => {
  if (state !== 'playing') return;
  if (event.pointerType !== 'mouse' && activePointerId !== event.pointerId) return;
  const pt = toCanvasPoint(event);
  trail.push({ x: pt.x, y: pt.y, t: performance.now() });
  if (trail.length > 16) trail.shift();
  spawnBladeParticle(pt.x, pt.y);
  if (prevPt) {
    handleSliceSegment(prevPt.x, prevPt.y, pt.x, pt.y);
  }
  prevPt = pt;
});

function endPointer(event) {
  if (event.pointerType === 'mouse' && event.type !== 'pointerleave') return;
  if (event.pointerType !== 'mouse' && activePointerId !== event.pointerId) return;
  activePointerId = null;
  prevPt = null;
  flushCombo();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', endPointer);
canvas.addEventListener('pointerleave', endPointer);

function pauseForLayoutChange() {
  if (activePointerId !== null && canvas.hasPointerCapture(activePointerId)) {
    const pointerId = activePointerId;
    activePointerId = null;
    canvas.releasePointerCapture(pointerId);
  }
  trail = [];
  pauseGame();
}

overlayBtn.addEventListener('click', () => {
  if (state === 'paused') resumeGame();
  else startGame();
});

pauseBtn.addEventListener('click', () => {
  if (state === 'playing') pauseGame();
  else if (state === 'paused') resumeGame();
});

restartBtn.addEventListener('click', async () => {
  if (await confirmAbandonIfActive()) startGame();
});

async function switchMode(nextMode) {
  if (nextMode === mode) return;
  if (!(await confirmAbandonIfActive())) return;
  mode = nextMode;
  writeStored(MODE_KEY, mode);
  syncModeButtons();
  resetState('ready');
}

modeClassicBtn.addEventListener('click', () => switchMode('classic'));
modeArcadeBtn.addEventListener('click', () => switchMode('arcade'));

skinBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.skin;
    if (!SKINS[next]) return;
    if (next === 'aurora' && !auroraUnlocked) {
      if (window.SiteData) {
        window.SiteData.toast(t('单局达 500 分或打出 6 连击解锁极光星刃'), { duration: 2800 });
      }
      return;
    }
    skin = next;
    writeStored(SKIN_KEY, skin);
    syncModeButtons();
  });
});

function openTutorial(force) {
  if (state === 'playing') pauseGame();
  window.GameKit.showTutorial({
    id: 'fruit',
    force: !!force,
    steps: [
      {
        icon: 'game-fruit',
        title: t('划屏挥砍水果'),
        text: t('手指划屏或移动鼠标挥砍飞起的水果，一次切中 3 个以上触发连击加分！'),
      },
      {
        icon: 'art-explosion',
        title: t('小心炸弹'),
        text: t('炸弹发射前会在底部亮起红色 ! 预警并响起警示音。经典模式切到炸弹立即结束，60 秒狂热扣 10 分（有护盾可抵消一次）。'),
      },
      {
        icon: 'art-zap',
        title: t('善用特殊水果与暴走'),
        text: t('新增分裂果、磁力聚拢、防爆护盾、回血果与 +3s 时钟果；冰冻/石榴期间会暂停 60 秒倒计时，连击攒满能量槽还会触发无炸弹双倍暴走！'),
      },
    ],
  });
}

helpBtn.addEventListener('click', () => openTutorial(true));

document.addEventListener('keydown', (event) => {
  if (window.GameKit.shouldIgnoreGameKey(event, { ignoreOnControl: true })) return;
  if (window.GameKit.isTutorialOpen()) return;
  if (event.code === 'Space' || event.code === 'Enter') {
    event.preventDefault();
    if (state === 'ready' || state === 'over') startGame();
    else if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});

window.GameKit.onHidden(pauseGame);
document.addEventListener('site:dialogopen', pauseGame);
document.addEventListener('i18n:change', () => {
  renderHud();
  renderOverlay();
});

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(dt);
  renderer.draw();
  requestAnimationFrame(frame);
}

syncModeButtons();
resetState('ready');
window.GameKit.bindMobileLayout('fruit', document.getElementById('immersive-btn'), pauseForLayoutChange);
openTutorial(false);
requestAnimationFrame(frame);
