const t = (key, params) => (window.I18N ? I18N.t(key, params) : key);
const LEGACY_BEST_KEY = 'game_best_snake';
const BEST_PREFIX = LEGACY_BEST_KEY + '_';
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const stageBox = document.getElementById('stage-box');
const scoreEl = document.getElementById('score-el');
const slowStatus = document.getElementById('slow-status');
const slowProgress = document.getElementById('slow-progress');
const bestEl = document.getElementById('best-el');
const pauseBtn = document.getElementById('pause-btn');
const soundBtn = document.getElementById('sound-btn');
const modeClassicBtn = document.getElementById('mode-classic');
const modeWrapBtn = document.getElementById('mode-wrap');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');

const SIZE = 560;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = SIZE * DPR;
canvas.height = SIZE * DPR;

const GRID = 24;
const CELL = SIZE / GRID;
const BONUS_TTL = 45;
const MAX_SLOW = 48;

let soundEnabled = window.SiteData ? SiteData.getSound() : true;
GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
});

function playTone(freq, duration, slideTo) {
  if (!soundEnabled || !window.SiteData) return;
  SiteData.withAudio((audioCtx) => {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {}
  });
}

function bestKeyFor(isWrap) {
  return BEST_PREFIX + (isWrap ? 'wrap' : 'classic');
}

function readBest(isWrap) {
  return GameKit.readBest(bestKeyFor(isWrap));
}

// 旧版两种模式共用一个最高分，首次升级时迁移到经典模式
function migrateLegacyBest() {
  try {
    const legacy = localStorage.getItem(LEGACY_BEST_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(bestKeyFor(false))) {
      localStorage.setItem(bestKeyFor(false), legacy);
    }
    localStorage.removeItem(LEGACY_BEST_KEY);
  } catch {}
}

let bestScore = 0;

let snake, dir, nextDirs, food, bonusItem, score, eatenCount, speedOffset, started, paused, gameOver, timer;
let endTitleKey = '游戏结束';
let particles = [];
let popups = [];
let wrapMode = false;
try {
  wrapMode = localStorage.getItem('game_mode_snake') === 'wrap';
} catch {}
let animTime = 0;
let lastFrameTs = 0;

migrateLegacyBest();
bestScore = readBest(wrapMode);
bestEl.textContent = bestScore;

// 枚举所有空格后随机选取，避免蛇接近占满棋盘时随机撞格造成死循环；无空格时返回 null
function randomEmptyCell({ preferInterior = false } = {}) {
  return GameRules.snakeRandomEmptyCell(GRID, snake, food, bonusItem, { preferInterior });
}

function randomAppleCell() {
  return randomEmptyCell({ preferInterior: !wrapMode });
}

function spawnParticles(gx, gy, color, count) {
  const cx = gx * CELL + CELL / 2;
  const cy = gy * CELL + CELL / 2;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 45 + Math.random() * 110;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 2 + Math.random() * 2.5,
      color,
      life: 1,
    });
  }
}

function addPopup(gx, gy, text, color) {
  popups.push({
    x: Math.max(40, Math.min(SIZE - 40, gx * CELL + CELL / 2)),
    y: Math.max(28, gy * CELL),
    text,
    color,
    life: 1,
  });
}

function updateBest() {
  scoreEl.textContent = score;
  if (score > bestScore) {
    bestScore = score;
    bestEl.textContent = bestScore;
    GameKit.saveBestIfHigher(bestKeyFor(wrapMode), bestScore);
  }
}

function initGame() {
  const mid = Math.floor(GRID / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  dir = { x: 1, y: 0 };
  nextDirs = [];
  score = 0;
  eatenCount = 0;
  speedOffset = 0;
  bonusItem = null;
  particles = [];
  popups = [];
  started = false;
  paused = false;
  gameOver = false;
  food = randomAppleCell();
  overlay.classList.remove('show');
  pauseBtn.textContent = t('暂停');
  scoreEl.textContent = '0';
  updateSlowStatus();
  if (timer) clearTimeout(timer);
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  pauseBtn.textContent = paused ? t('继续') : t('暂停');
  if (paused) {
    if (timer) clearTimeout(timer);
  } else {
    tick();
  }
}

function setDirection(name) {
  if (gameOver || paused) return;
  const map = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const candidate = map[name];
  if (!candidate) return;

  if (!started) {
    if (candidate.x === -1) return;
    dir = candidate;
    started = true;
    tick();
    return;
  }

  const lastDir = nextDirs.length > 0 ? nextDirs[nextDirs.length - 1] : dir;
  if (candidate.x + lastDir.x === 0 && candidate.y + lastDir.y === 0) return;
  if (candidate.x === lastDir.x && candidate.y === lastDir.y) return;
  if (nextDirs.length < 2) nextDirs.push(candidate);
}

function tick() {
  if (!started || paused || gameOver) return;
  if (nextDirs.length > 0) dir = nextDirs.shift();

  const step = GameRules.snakeNextStep(GRID, snake, dir, wrapMode, food, bonusItem);
  if (step.collision) {
    endGame();
    return;
  }

  const head = step.head;
  snake.unshift(head);

  let grew = false;
  if (step.ateFood) {
    grew = true;
    eatenCount += 1;
    score += 10;
    playTone(520, 0.08, 760);
    spawnParticles(head.x, head.y, '#ef4444', 10);
    addPopup(head.x, head.y, '+10', '#15803d');
    food = randomAppleCell();
    if (!food && !bonusItem) {
      updateBest();
      endGame('通关！🎉');
      return;
    }

    // 每吃 4 个普通果子，刷新一个限时奖励果（金星或冰果）
    if (eatenCount % 4 === 0 && !bonusItem) {
      const pos = randomEmptyCell();
      if (pos) {
        bonusItem = {
          x: pos.x,
          y: pos.y,
          type: Math.random() < 0.7 ? 'star' : 'ice',
          ttl: BONUS_TTL,
          maxTtl: BONUS_TTL,
        };
      }
    }
  } else if (step.ateBonus) {
    grew = true;
    if (bonusItem.type === 'star') {
      score += 30;
      playTone(660, 0.14, 1040);
      spawnParticles(head.x, head.y, '#f59e0b', 16);
      addPopup(head.x, head.y, '+30', '#d97706');
    } else {
      score += 15;
      speedOffset = Math.min(MAX_SLOW, speedOffset + 28);
      slowProgress.max = speedOffset;
      playTone(440, 0.14, 300);
      spawnParticles(head.x, head.y, '#38bdf8', 14);
      addPopup(head.x, head.y, t('+15 减速'), '#0284c7');
    }
    bonusItem = null;
    if (!food) {
      updateBest();
      endGame('通关！🎉');
      return;
    }
  }

  if (bonusItem) {
    bonusItem.ttl -= 1;
    if (bonusItem.ttl <= 0) {
      addPopup(
        bonusItem.x,
        bonusItem.y,
        t(bonusItem.type === 'star' ? '星星消失了' : '冰果消失了'),
        '#94a3b8'
      );
      bonusItem = null;
      if (!food) food = randomAppleCell();
    }
  }

  if (grew) {
    updateBest();
  } else {
    snake.pop();
  }

  updateSlowStatus();
  const delay = GameRules.snakeTickDelay(score, speedOffset);
  if (speedOffset > 0) speedOffset = Math.max(0, speedOffset - 0.6);
  timer = setTimeout(tick, delay);
}

function updateSlowStatus() {
  slowStatus.classList.toggle('active', speedOffset > 0 && !gameOver);
  slowProgress.value = speedOffset;
}

function renderEnd() {
  overlayTitle.textContent = t(endTitleKey);
  overlayDesc.textContent = t('本局得分：{score}（本模式最高：{best}）', {
    score,
    best: bestScore,
  });
}

function endGame(titleKey) {
  gameOver = true;
  updateSlowStatus();
  endTitleKey = titleKey || '游戏结束';
  playTone(220, 0.22, 95);
  renderEnd();
  overlay.classList.add('show');
}

function draw(dt) {
  animTime += dt;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // 清爽草地棋盘格（深色主题下仅调整底色网格，保持实体颜色与规则不变）
  const isDarkTheme = document.documentElement.dataset.theme === 'dark';
  const evenCellColor = isDarkTheme ? '#0f1f1c' : '#ecfdf5';
  const oddCellColor = isDarkTheme ? '#132622' : '#e2fbe9';
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? evenCellColor : oddCellColor;
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  // 普通红苹果
  if (food && food.x >= 0) {
    const fx = food.x * CELL + CELL / 2;
    const fy = food.y * CELL + CELL / 2;
    const pulse = 1 + Math.sin(animTime * 4.2) * 0.05;
    const r = CELL * 0.37 * pulse;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
    ctx.beginPath();
    ctx.arc(fx, fy + 1, r * 1.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(fx, fy + 1, r, 0, Math.PI * 2);
    ctx.fill();

    // 高光与绿叶
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(fx - r * 0.3, fy - r * 0.2, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(fx + 2, fy - r * 0.95, 4, 2.2, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 限时特殊果子（带倒计时外环）
  if (bonusItem) {
    const bx = bonusItem.x * CELL + CELL / 2;
    const by = bonusItem.y * CELL + CELL / 2;
    const isStar = bonusItem.type === 'star';
    const ratio = Math.max(0, bonusItem.ttl / bonusItem.maxTtl);
    const blink = bonusItem.ttl <= 12 && Math.floor(animTime * 10) % 2 === 0 ? 0.55 : 1;

    ctx.save();
    ctx.globalAlpha = blink;

    // 倒计时外环
    ctx.strokeStyle = isStar ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(bx, by, CELL * 0.46, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = isStar ? '#d97706' : '#0284c7';
    ctx.beginPath();
    ctx.arc(bx, by, CELL * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.stroke();

    ctx.fillStyle = isStar ? '#f59e0b' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(bx, by, CELL * 0.36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (window.GameArt) {
      if (isStar) GameArt.drawStar(ctx, bx, by, 8, '#fff');
      else GameArt.drawSnowflake(ctx, bx, by, 9, '#fff');
    }
    ctx.restore();
  }

  // 蛇身渐变绘制
  const len = snake.length;
  for (let idx = len - 1; idx >= 0; idx--) {
    const seg = snake[idx];
    const t = len > 1 ? idx / (len - 1) : 0;
    const pad = idx === 0 ? 1.2 : 1.8 + t * 1.4;
    const rad = idx === 0 ? 8 : Math.max(4, 7 - t * 2);

    if (idx === 0) {
      ctx.fillStyle = '#15803d';
    } else {
      const g = Math.round(197 - t * 32);
      const b = Math.round(94 - t * 18);
      ctx.fillStyle = `rgb(34, ${g}, ${b})`;
    }

    ctx.beginPath();
    ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, rad);
    ctx.fill();

    if (idx === 0) {
      const cx = seg.x * CELL + CELL / 2;
      const cy = seg.y * CELL + CELL / 2;
      const ex = dir.x * 3.5;
      const ey = dir.y * 3.5;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + ex - dir.y * 4, cy + ey + dir.x * 4, 2.8, 0, Math.PI * 2);
      ctx.arc(cx + ex + dir.y * 4, cy + ey - dir.x * 4, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(cx + ex * 1.25 - dir.y * 4, cy + ey * 1.25 + dir.x * 4, 1.3, 0, Math.PI * 2);
      ctx.arc(cx + ex * 1.25 + dir.y * 4, cy + ey * 1.25 - dir.x * 4, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 粒子特效
  particles = particles.filter((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 2.4;
    if (p.life <= 0) return false;
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return true;
  });

  // 得分飘字
  popups = popups.filter((p) => {
    p.y -= 28 * dt;
    p.life -= dt * 1.4;
    if (p.life <= 0) return false;
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
    return true;
  });

  if (!started && !gameOver) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.74)';
    ctx.beginPath();
    ctx.roundRect(SIZE / 2 - 165, SIZE / 2 - 78, 330, 44, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('按方向键 / WASD 或点击画面开始 🐍'), SIZE / 2, SIZE / 2 - 51);
  } else if (paused && !gameOver) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.56)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('已暂停（点击或按空格继续）'), SIZE / 2, SIZE / 2);
  }
}

function frameLoop(ts) {
  if (!lastFrameTs) lastFrameTs = ts;
  const dt = Math.min((ts - lastFrameTs) / 1000, 0.05);
  lastFrameTs = ts;
  draw(dt);
  requestAnimationFrame(frameLoop);
}

document.addEventListener('keydown', (e) => {
  if (GameKit.shouldIgnoreGameKey(e, { ignoreOnControl: true })) return;
  if (window.SiteData && SiteData.isDialogOpen && SiteData.isDialogOpen()) return;
  if (window.GameKit && GameKit.isTutorialOpen && GameKit.isTutorialOpen()) return;
  if (e.code === 'Space' || e.code === 'KeyP') {
    e.preventDefault();
    togglePause();
    return;
  }
  const keyMap = {
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
  };
  if (keyMap[e.code]) {
    e.preventDefault();
    setDirection(keyMap[e.code]);
  }
});

document.querySelectorAll('.dpad-btn').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDirection(btn.dataset.dir);
  });
  btn.addEventListener('click', (e) => {
    if (e.detail === 0) setDirection(btn.dataset.dir);
  });
});

GameKit.bindSwipe(canvas, {
  onDirection: setDirection,
  getThreshold: (width) => Math.max(8, Math.min(12, width * 0.028)),
  axisRatio: 1.1,
  cancelOnMultiTouch: false,
  onTap() {
    if (gameOver) return;
    if (paused) togglePause();
    else if (!started) setDirection('right');
  },
});

function applyModeChrome(flag) {
  modeClassicBtn.classList.toggle('active', !flag);
  modeWrapBtn.classList.toggle('active', flag);
  modeClassicBtn.setAttribute('aria-pressed', String(!flag));
  modeWrapBtn.setAttribute('aria-pressed', String(flag));
  stageBox.classList.toggle('wrap-mode', flag);
}

function setWrapMode(flag) {
  if (wrapMode === flag) return;
  wrapMode = flag;
  try {
    localStorage.setItem('game_mode_snake', flag ? 'wrap' : 'classic');
  } catch {}
  applyModeChrome(flag);
  bestScore = readBest(wrapMode);
  bestEl.textContent = bestScore;
  initGame();
}

modeClassicBtn.addEventListener('click', () => setWrapMode(false));
modeWrapBtn.addEventListener('click', () => setWrapMode(true));

pauseBtn.addEventListener('click', togglePause);

document.addEventListener('i18n:change', () => {
  pauseBtn.textContent = paused ? t('继续') : t('暂停');
  if (gameOver) renderEnd();
});

document.addEventListener('theme:change', () => {
  draw(0);
});

function pauseIfRunning() {
  if (started && !paused && !gameOver) togglePause();
}

// 打开清数据等原生确认框时先暂停，避免蛇在弹窗后面继续走
document.addEventListener('site:dialogopen', pauseIfRunning);

// 切到后台时自动暂停，避免蛇在后台继续移动
GameKit.onHidden(pauseIfRunning);
document.getElementById('restart-btn').addEventListener('click', initGame);
document.getElementById('overlay-btn').addEventListener('click', initGame);

function showTutorial(force) {
  GameKit.showTutorial({
    id: 'snake',
    force,
    steps: [
      { icon: 'game-snake', title: t('灵活转向躲避'), text: t('电脑用方向键 / WASD，手机可划屏或点按方向键；支持经典撞墙与自由穿墙双模式。') },
      { icon: 'art-star', title: t('吃果子与特殊道具'), text: t('红苹果 +10 分，限时金星 +30 分，冰果可短暂减速。') },
    ],
  });
}

document.getElementById('help-btn').addEventListener('click', () => showTutorial(true));
applyModeChrome(wrapMode);
initGame();
GameKit.bindMobileLayout('snake', document.getElementById('immersive-btn'), pauseIfRunning);
showTutorial(false);
requestAnimationFrame(frameLoop);
