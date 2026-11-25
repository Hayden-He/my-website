const t = (key, params) => (window.I18N ? I18N.t(key, params) : key);
const BEST_PREFIX = 'game_best_memory_';
const BEST_COMBO_KEY = 'game_best_memory_combo';
const MODE_KEY = 'game_mode_memory';
const ICONS = [
  { id: 'apple', name: '苹果' },
  { id: 'orange', name: '橙子' },
  { id: 'lemon', name: '柠檬' },
  { id: 'grape', name: '葡萄' },
  { id: 'watermelon', name: '西瓜' },
  { id: 'strawberry', name: '草莓' },
  { id: 'cherry', name: '樱桃' },
  { id: 'kiwi', name: '猕猴桃' },
  { id: 'peach', name: '桃子' },
  { id: 'coconut', name: '椰子' },
  { id: 'pineapple', name: '菠萝' },
  { id: 'pear', name: '梨子' },
];
const MODES = {
  4: { cols: 4, pairs: 8, label: '4×4 轻松' },
  5: { cols: 5, pairs: 10, label: '5×4 标准' },
  6: { cols: 6, pairs: 12, label: '6×4 挑战' },
};

const wrapEl = document.querySelector('.game-wrap');
const boardEl = document.getElementById('memory-board');
const movesEl = document.getElementById('moves-el');
const timeEl = document.getElementById('time-el');
const bestEl = document.getElementById('best-el');
const soundBtn = document.getElementById('sound-btn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const previewBtn = document.getElementById('preview-btn');
const statusEl = document.getElementById('memory-status');
const modeBtns = document.querySelectorAll('[data-memory-mode]');

let mode = 4;
try {
  const saved = Number(localStorage.getItem(MODE_KEY));
  if (MODES[saved]) mode = saved;
} catch {}

let soundEnabled = window.SiteData ? SiteData.getSound() : true;
GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
});

let deck = [];
let first = null;
let second = null;
let moves = 0;
let matches = 0;
let combo = 0;
let maxCombo = 0;
let started = false;
let ended = false;
let lock = false;
let mismatchTimer = null;
let mismatchPair = null;
let previewUsed = false;
let previewing = false;
let previewTimer = null;
let previewRemain = 0;
let elapsed = 0;
let timerId = null;
let dialogOpen = false;
let newRecord = false;
let gameId = 0;

function bestKey(size) {
  return BEST_PREFIX + size + (previewUsed ? '_preview' : '');
}

function readBest(size) {
  return GameKit.readBest(bestKey(size));
}

function playTone(freq, duration, slideTo) {
  if (!soundEnabled || !window.SiteData) return;
  SiteData.withAudio((ac) => {
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + duration);
      gain.gain.setValueAtTime(0.06, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch {}
  });
}

function playComboChime(streak) {
  if (!soundEnabled || !window.SiteData) return;
  const base = 580 + Math.min(streak, 6) * 55;
  SiteData.withAudio((ac) => {
    try {
      [base, base + 180].forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const start = ac.currentTime + i * 0.055;
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.065, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(start);
        osc.stop(start + 0.12);
      });
    } catch {}
  });
}

function playVictoryFanfare() {
  if (!soundEnabled || !window.SiteData) return;
  SiteData.withAudio((ac) => {
    try {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const start = ac.currentTime + i * 0.07;
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(start);
        osc.stop(start + 0.23);
      });
    } catch {}
  });
}

function updateHud() {
  movesEl.textContent = moves;
  timeEl.textContent = elapsed + 's';
  const best = readBest(mode);
  bestEl.textContent = best > 0 ? best + t(' 次') : '--';
  previewBtn.disabled = started || previewUsed;
  const pairs = MODES[mode].pairs;
  statusEl.classList.toggle('combo-hot', !previewing && !lock && combo >= 2);
  if (previewing) {
    statusEl.textContent = t('记住牌面（{sec}s）...', { sec: previewRemain });
  } else if (lock) {
    statusEl.textContent = t('这两张牌不同，点下一张可立即继续。');
  } else if (started && combo >= 2) {
    statusEl.textContent = t('已配对 {matches}/{pairs} · 连击 ×{combo}', { matches, pairs, combo });
  } else if (started) {
    statusEl.textContent = t('已配对 {matches}/{pairs}', { matches, pairs });
  } else if (previewUsed) {
    statusEl.textContent = t('本局使用了预览，纪录单独计算。');
  } else {
    statusEl.textContent = '';
  }
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

function buildDeck(size) {
  return GameRules.buildMemoryDeck(ICONS, MODES[size].pairs);
}

function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.dataset.mode = String(mode);
  if (wrapEl) wrapEl.classList.toggle('wide', mode === 6);
  deck.forEach((card, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'memory-card';
    btn.dataset.index = String(index);
    btn.dataset.icon = card.icon;
    btn.dataset.name = card.name;
    btn.setAttribute('aria-label', t('未翻开的牌'));

    const inner = document.createElement('span');
    inner.className = 'memory-card-inner';

    const back = document.createElement('span');
    back.className = 'memory-face memory-back';
    back.setAttribute('aria-hidden', 'true');
    back.textContent = '?';

    const front = document.createElement('span');
    front.className = 'memory-face memory-front';
    front.setAttribute('aria-hidden', 'true');
    const frontIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    frontIcon.setAttribute('class', 'memory-icon');
    frontIcon.setAttribute('viewBox', '0 0 32 32');
    frontIcon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#mem-' + card.icon);
    frontIcon.appendChild(use);
    front.appendChild(frontIcon);

    inner.appendChild(back);
    inner.appendChild(front);
    btn.appendChild(inner);
    boardEl.appendChild(btn);
  });
}

function setCardBack(card) {
  card.classList.remove('flipped', 'matched', 'mismatch');
  card.setAttribute('aria-label', t('未翻开的牌'));
}

function clearMismatchPending() {
  if (mismatchTimer) {
    clearTimeout(mismatchTimer);
    mismatchTimer = null;
  }
  if (mismatchPair) {
    setCardBack(mismatchPair[0]);
    setCardBack(mismatchPair[1]);
    mismatchPair = null;
  }
  lock = false;
}

function initGame() {
  gameId += 1;
  stopTimer();
  clearMismatchPending();
  if (previewTimer) {
    clearInterval(previewTimer);
    previewTimer = null;
  }
  previewRemain = 0;
  modeBtns.forEach((btn) => {
    const active = Number(btn.dataset.memoryMode) === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  deck = buildDeck(mode);
  first = null;
  second = null;
  moves = 0;
  matches = 0;
  combo = 0;
  maxCombo = 0;
  started = false;
  ended = false;
  previewUsed = false;
  previewing = false;
  elapsed = 0;
  newRecord = false;
  overlay.classList.remove('show');
  renderBoard();
  updateHud();
}

function refreshCardAria() {
  boardEl.querySelectorAll('.memory-card').forEach((card) => {
    if (card.classList.contains('matched')) {
      card.setAttribute('aria-label', t('已配对，{icon}', { icon: t(card.dataset.name) }));
    } else if (card.classList.contains('flipped') || card.classList.contains('peeking')) {
      card.setAttribute('aria-label', t('已翻开，{icon}', { icon: t(card.dataset.name) }));
    } else {
      card.setAttribute('aria-label', t('未翻开的牌'));
    }
  });
}

function previewCards() {
  if (started || previewUsed || previewing || ended) return;
  previewUsed = true;
  previewing = true;
  previewRemain = 2;
  const currentGame = gameId;
  const cards = boardEl.querySelectorAll('.memory-card');
  cards.forEach((card) => card.classList.add('peeking'));
  refreshCardAria();
  updateHud();
  previewTimer = setInterval(() => {
    if (currentGame !== gameId) {
      clearInterval(previewTimer);
      previewTimer = null;
      return;
    }
    previewRemain -= 1;
    if (previewRemain <= 0) {
      clearInterval(previewTimer);
      previewTimer = null;
      previewing = false;
      cards.forEach((card) => card.classList.remove('peeking'));
      refreshCardAria();
    }
    updateHud();
  }, 1000);
}

function formatFinishDesc() {
  const pairs = MODES[mode].pairs;
  const accuracy = moves > 0 ? Math.round((pairs / moves) * 100) : 100;
  const best = readBest(mode);
  return (newRecord ? t('新纪录！') : '') +
    t('尝试 {moves} 次（准确率 {accuracy}% · 最高连击 ×{combo}）· 用时 {elapsed}s · 最少 {best} 次', {
      moves,
      accuracy,
      combo: maxCombo,
      elapsed,
      best,
    });
}

function finishGame() {
  ended = true;
  stopTimer();
  const currentGame = gameId;
  const isNew = readBest(mode) === 0 || moves < readBest(mode);
  if (isNew) {
    GameKit.writeBest(bestKey(mode), moves);
    newRecord = true;
  }
  if (!previewUsed) {
    GameKit.saveBestIfHigher(BEST_COMBO_KEY, maxCombo);
  }

  setTimeout(() => {
    if (currentGame !== gameId) return;
    overlayTitle.textContent = t('全部配对！🎉');
    overlayDesc.textContent = formatFinishDesc();
    overlay.classList.add('show');
    updateHud();
    playVictoryFanfare();
  }, 380);
}

boardEl.addEventListener('click', (event) => {
  const card = event.target.closest('.memory-card');
  if (!card || previewing || ended) return;
  if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
  if (lock) clearMismatchPending();

  if (!started) {
    started = true;
    startTimer();
    updateHud();
  }

  card.classList.add('flipped');
  card.setAttribute('aria-label', t('已翻开，{icon}', { icon: t(card.dataset.name) }));
  playTone(520, 0.05);

  if (!first) {
    first = card;
    return;
  }

  second = card;
  moves += 1;

  if (GameRules.isMemoryPairMatch(first.dataset.icon, second.dataset.icon)) {
    const a = first;
    const b = second;
    first = null;
    second = null;
    a.classList.add('matched');
    b.classList.add('matched');
    a.setAttribute('aria-label', t('已配对，{icon}', { icon: t(a.dataset.name) }));
    b.setAttribute('aria-label', t('已配对，{icon}', { icon: t(b.dataset.name) }));
    matches += 1;
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    updateHud();
    playComboChime(combo);
    if (matches === MODES[mode].pairs) finishGame();
    return;
  }

  combo = 0;
  lock = true;
  const currentGame = gameId;
  mismatchPair = [first, second];
  first = null;
  second = null;
  mismatchPair[0].classList.add('mismatch');
  mismatchPair[1].classList.add('mismatch');
  updateHud();
  playTone(300, 0.06, 210);
  mismatchTimer = setTimeout(() => {
    if (currentGame !== gameId) return;
    clearMismatchPending();
    updateHud();
  }, 720);
});

function switchMode(next) {
  if (next === mode) return;
  mode = next;
  try {
    localStorage.setItem(MODE_KEY, String(mode));
  } catch {}
  initGame();
}

async function confirmAbandonAndRun(action, { switching = false } = {}) {
  if (!started || ended) {
    action();
    return;
  }
  const ok = await window.SiteData.confirmDialog({
    title: switching ? t('切换牌桌') : t('重开本局'),
    message: switching
      ? t('切换牌桌会清除当前翻牌进度。')
      : t('当前翻牌进度将被清除，确定重开吗？'),
    confirmText: switching ? t('切换') : t('重开'),
    cancelText: t('继续本局'),
    danger: true,
  });
  if (ok) action();
}

modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = Number(btn.dataset.memoryMode);
    if (next !== mode) confirmAbandonAndRun(() => switchMode(next), { switching: true });
  });
});
previewBtn.addEventListener('click', previewCards);
document.getElementById('restart-btn').addEventListener('click', () => confirmAbandonAndRun(initGame));
document.getElementById('overlay-btn').addEventListener('click', initGame);

document.addEventListener('keydown', (event) => {
  if (GameKit.shouldIgnoreGameKey(event, { ignoreOnControl: true })) return;
  if (window.SiteData && SiteData.isDialogOpen && SiteData.isDialogOpen()) return;
  if (window.GameKit && GameKit.isTutorialOpen && GameKit.isTutorialOpen()) return;
  const target = event.target;
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.code === 'KeyP') {
    event.preventDefault();
    previewCards();
    return;
  }
  if (event.code === 'KeyR') {
    event.preventDefault();
    confirmAbandonAndRun(initGame);
    return;
  }
  if (!boardEl.contains(document.activeElement)) return;
  const cards = Array.from(boardEl.querySelectorAll('.memory-card'));
  const idx = cards.indexOf(document.activeElement);
  if (idx < 0) return;
  const cols = getComputedStyle(boardEl).gridTemplateColumns.split(' ').length || MODES[mode].cols;
  let nextIdx = -1;
  if (event.code === 'ArrowLeft') nextIdx = idx > 0 ? idx - 1 : -1;
  else if (event.code === 'ArrowRight') nextIdx = idx + 1 < cards.length ? idx + 1 : -1;
  else if (event.code === 'ArrowUp') nextIdx = idx - cols >= 0 ? idx - cols : -1;
  else if (event.code === 'ArrowDown') nextIdx = idx + cols < cards.length ? idx + cols : -1;
  if (nextIdx >= 0) {
    event.preventDefault();
    cards[nextIdx].focus();
  }
});

document.addEventListener('i18n:change', () => {
  updateHud();
  refreshCardAria();
  if (overlay.classList.contains('show')) {
    overlayDesc.textContent = formatFinishDesc();
  }
});

document.addEventListener('site:dialogopen', () => {
  dialogOpen = true;
});
document.addEventListener('site:dialogclose', () => {
  dialogOpen = false;
});

function showTutorial(force) {
  GameKit.showTutorial({
    id: 'memory',
    force,
    steps: [
      { icon: 'game-memory', title: t('翻牌与连击'), text: t('每次翻开两张牌配对消除；连续配对会累计连击并提升清脆音效，不配对时直接点下一张即可继续。') },
      { icon: 'mem-pineapple', title: t('三种牌桌与预览'), text: t('支持 4×4 轻松、5×4 标准与 6×4 挑战；开局前可按 P 或点「预览牌面」偷看 2 秒（纪录单独计算）。') },
    ],
  });
}

document.getElementById('help-btn').addEventListener('click', () => showTutorial(true));
initGame();
showTutorial(false);
