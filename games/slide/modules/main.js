const t = (key, params) => (window.I18N ? I18N.t(key, params) : key);
const MODES = { beginner: 3, 3: 3, 4: 4, 5: 5 };
const BEST_PREFIX = 'game_best_slide_';
const MODE_KEY = 'game_mode_slide';

const boardEl = document.getElementById('slide-board');
const goalGrid = document.getElementById('slide-goal-grid');
const progressEl = document.getElementById('slide-progress');
const movesEl = document.getElementById('moves-el');
const timeEl = document.getElementById('time-el');
const bestEl = document.getElementById('best-el');
const soundBtn = document.getElementById('sound-btn');
const restartBtn = document.getElementById('restart-btn');
const retryBtn = document.getElementById('retry-btn');
const modeButtons = document.querySelectorAll('[data-slide-mode]');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const overlayBtn = document.getElementById('overlay-btn');
const overlayRetryBtn = document.getElementById('overlay-retry-btn');

let mode = '3';
try {
  const savedMode = localStorage.getItem(MODE_KEY);
  if (typeof MODES[savedMode] === 'number') mode = savedMode;
} catch {}

let size = MODES[mode];
let board = [];
let initialBoard = [];
let moves = 0;
let elapsed = 0;
let timerId = null;
let started = false;
let ended = false;
let newRecord = false;
let dialogOpen = false;
let suppressClickUntil = 0;

let soundEnabled = window.SiteData ? SiteData.getSound() : true;
GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
});

function playTone(freq, duration) {
  if (!soundEnabled || !window.SiteData) return;
  SiteData.withAudio((audio) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  });
}

function playVictoryFanfare() {
  if (!soundEnabled || !window.SiteData) return;
  SiteData.withAudio((audio) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + i * 0.07;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.23);
    });
  });
}

function bestKey() {
  return BEST_PREFIX + mode;
}

function readBest() {
  return GameKit.readBest(bestKey());
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    if (!started || ended || document.hidden || dialogOpen) return;
    elapsed += 1;
    timeEl.textContent = elapsed + 's';
  }, 1000);
}

function updateHud() {
  movesEl.textContent = String(moves);
  timeEl.textContent = elapsed + 's';
  const best = readBest();
  bestEl.textContent = best > 0 ? best + t(' 步') : '--';
  if (progressEl) {
    const placed = GameRules.countSlideInPlace(board);
    progressEl.textContent = t('已归位 {placed}/{total}', { placed, total: size * size - 1 });
  }
}

function renderGoal() {
  goalGrid.style.setProperty('--size', String(size));
  goalGrid.dataset.size = String(size);
  goalGrid.replaceChildren(...GameRules.solvedSlideBoard(size).map((value) => {
    const tile = document.createElement('span');
    if (value) tile.textContent = String(value);
    return tile;
  }));
}

function render() {
  const activeTile = document.activeElement;
  const focusedValue = boardEl.contains(activeTile) ? Number(activeTile.textContent) : null;
  boardEl.style.setProperty('--size', String(size));
  boardEl.dataset.size = String(size);
  boardEl.innerHTML = '';
  const blank = board.indexOf(0);
  const blankRow = Math.floor(blank / size);
  const blankCol = blank % size;
  const movable = GameRules.slideNeighbors(size, blank);
  board.forEach((value, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slide-tile' + (value === 0 ? ' blank' : '');
    btn.dataset.index = String(index);
    if (value === 0) {
      btn.disabled = true;
      btn.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-label', t('空格'));
    } else {
      const row = Math.floor(index / size);
      const col = index % size;
      const inPlace = value === index + 1;
      btn.classList.toggle('in-place', inPlace);
      btn.classList.toggle('movable', !ended && movable.includes(index));
      btn.classList.toggle('inline-movable', !ended && (row === blankRow || col === blankCol));
      btn.textContent = String(value);
      btn.setAttribute('aria-label', t('第 {row} 行第 {col} 列，数字 {n}', { row: row + 1, col: col + 1, n: value }));
      btn.addEventListener('click', () => {
        if (performance.now() < suppressClickUntil) return;
        moveTile(index);
      });
    }
    boardEl.appendChild(btn);
    if (value !== 0 && value === focusedValue) btn.focus({ preventScroll: true });
  });
}

function startIfNeeded() {
  if (!started) {
    started = true;
    startTimer();
  }
}

function moveTile(index) {
  if (ended) return;
  const blank = board.indexOf(0);
  const chain = GameRules.getSlideChain(size, blank, index);
  if (!chain.length) return;
  const fromRects = chain.map((idx) => boardEl.children[idx].getBoundingClientRect());
  const movedTargets = [];
  let dest = blank;
  let landedInPlace = false;
  chain.forEach((src) => {
    [board[dest], board[src]] = [board[src], board[dest]];
    movedTargets.push(dest);
    if (board[dest] === dest + 1) landedInPlace = true;
    dest = src;
  });
  moves += chain.length;
  startIfNeeded();
  playTone(landedInPlace ? 640 : 480, 0.045);
  render();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    movedTargets.forEach((targetIdx, i) => {
      const tile = boardEl.children[targetIdx];
      const from = fromRects[i];
      const to = tile.getBoundingClientRect();
      tile.animate?.([
        { transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)` },
        { transform: 'translate(0, 0)' },
      ], { duration: 115, easing: 'ease-out' });
    });
  }
  updateHud();
  if (board.every((value, i) => value === (i + 1) % board.length)) finish();
}

function slideByDirection(dir) {
  if (ended) return false;
  const blank = board.indexOf(0);
  const row = Math.floor(blank / size);
  const col = blank % size;
  let target = -1;
  if (dir === 'up' && row < size - 1) target = blank + size;
  else if (dir === 'down' && row > 0) target = blank - size;
  else if (dir === 'left' && col < size - 1) target = blank + 1;
  else if (dir === 'right' && col > 0) target = blank - 1;
  if (target < 0) return false;
  moveTile(target);
  return true;
}

function finish() {
  ended = true;
  stopTimer();
  const previousBest = readBest();
  newRecord = previousBest === 0 || moves < previousBest;
  if (newRecord) GameKit.writeBest(bestKey(), moves);
  const best = readBest();
  overlayTitle.textContent = t('完成！');
  overlayDesc.textContent = (newRecord ? t('新纪录！') : '') +
    t('步数：{moves} · 用时：{elapsed}s · 最少 {best} 步', { moves, elapsed, best });
  overlay.classList.add('show');
  if (boardEl.contains(document.activeElement)) overlayBtn.focus({ preventScroll: true });
  updateHud();
  playVictoryFanfare();
}

function initGame(nextMode = mode, retry = false) {
  mode = nextMode;
  size = MODES[mode];
  stopTimer();
  moves = 0;
  elapsed = 0;
  started = false;
  ended = false;
  newRecord = false;
  if (retry) board = initialBoard.slice();
  else {
    board = GameRules.shuffleSlideBoard(size, mode === 'beginner');
    initialBoard = board.slice();
  }
  overlay.classList.remove('show');
  modeButtons.forEach((button) => {
    const active = button.dataset.slideMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderGoal();
  render();
  updateHud();
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
}

async function restartWithConfirm(nextMode = mode, retry = false) {
  const switching = nextMode !== mode;
  if (moves === 0 || ended) {
    initGame(nextMode, retry);
    return;
  }
  const ok = await window.SiteData.confirmDialog({
    title: switching ? t('切换模式') : retry ? t('同盘重试') : t('重开本局'),
    message: switching
      ? t('切换模式会清除当前棋局进度。')
      : t('当前进度将被清除，确定重开吗？'),
    confirmText: switching ? t('切换') : retry ? t('重试') : t('重开'),
    cancelText: t('继续本局'),
    danger: true,
  });
  if (ok) initGame(nextMode, retry);
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.slideMode !== mode) restartWithConfirm(button.dataset.slideMode);
  });
});
restartBtn.addEventListener('click', () => restartWithConfirm());
retryBtn.addEventListener('click', () => restartWithConfirm(mode, true));
overlayBtn.addEventListener('click', () => initGame());
overlayRetryBtn.addEventListener('click', () => initGame(mode, true));

let swipeGesture = null;
boardEl.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0 || ended) return;
  swipeGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, committed: false };
});
boardEl.addEventListener('pointermove', (event) => {
  if (!swipeGesture || swipeGesture.id !== event.pointerId || swipeGesture.committed) return;
  const dx = event.clientX - swipeGesture.x;
  const dy = event.clientY - swipeGesture.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < 24 || Math.max(ax, ay) < 1.25 * Math.min(ax, ay)) return;
  swipeGesture.committed = true;
  suppressClickUntil = performance.now() + 350;
  slideByDirection(ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
function clearSwipe(event) {
  if (swipeGesture?.id === event.pointerId) swipeGesture = null;
}
boardEl.addEventListener('pointerup', clearSwipe);
boardEl.addEventListener('pointercancel', clearSwipe);

document.addEventListener('keydown', (event) => {
  if (GameKit.shouldIgnoreGameKey(event, { ignoreOnControl: true })) return;
  if (window.SiteData && SiteData.isDialogOpen && SiteData.isDialogOpen()) return;
  if (window.GameKit && GameKit.isTutorialOpen && GameKit.isTutorialOpen()) return;
  const target = event.target;
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.code === 'KeyR') {
    event.preventDefault();
    restartWithConfirm();
    return;
  }
  if (ended) return;
  const dirMap = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };
  const dir = dirMap[event.code];
  if (!dir) return;
  event.preventDefault();
  slideByDirection(dir);
});

document.addEventListener('site:dialogopen', () => {
  dialogOpen = true;
});
document.addEventListener('site:dialogclose', () => {
  dialogOpen = false;
});

document.addEventListener('i18n:change', () => {
  render();
  updateHud();
  if (ended) {
    overlayTitle.textContent = t('完成！');
    const best = readBest();
    overlayDesc.textContent = (newRecord ? t('新纪录！') : '') +
      t('步数：{moves} · 用时：{elapsed}s · 最少 {best} 步', { moves, elapsed, best });
  }
});

function showTutorial(force) {
  GameKit.showTutorial({
    id: 'slide',
    force,
    steps: [
      { icon: 'game-slide', title: t('按序还原数字'), text: t('点击同行/同列方块可一次推动整排，或用划屏、方向键 / WASD 把数字按顺序排好。') },
      { icon: 'art-grid', title: t('多种难度与重试'), text: t('提供 3×3 入门、3×3 经典、4×4 标准与 5×5 挑战；不满意步数可点「同盘重试」或按 R 重开。') },
    ],
  });
}

document.getElementById('help-btn').addEventListener('click', () => showTutorial(true));
initGame();
showTutorial(false);
