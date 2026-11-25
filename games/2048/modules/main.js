const t = (key, params) => (window.I18N ? I18N.t(key, params) : key);
const LEGACY_BEST_KEY = 'game_best_2048';
const BEST_PREFIX = LEGACY_BEST_KEY + '_';
const SAVE_PREFIX = 'game_save_2048_';
const MODE_KEY = SAVE_PREFIX + 'mode';
const MAX_UNDO = 3;
const MODES = {
  4: { size: 4, obstacle: false, label: '4×4 经典' },
  obstacle: { size: 4, obstacle: true, label: '4×4 障碍' },
  5: { size: 5, obstacle: false, label: '5×5 轻松' },
};
const temporarySaves = new Map();

const gridBgEl = document.getElementById('grid-bg');
const tileLayerEl = document.getElementById('tile-layer');
const scoreBoxEl = document.getElementById('score-box');
const scoreEl = document.getElementById('score-el');
const maxEl = document.getElementById('max-el');
const bestEl = document.getElementById('best-el');
const undoBtn = document.getElementById('undo-btn');
const soundBtn = document.getElementById('sound-btn');
const modeBtns = document.querySelectorAll('.mode-pill[data-mode]');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const keepBtn = document.getElementById('keep-btn');
const boardWrap = document.getElementById('board-wrap');

let soundEnabled = window.SiteData ? SiteData.getSound() : true;
GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
});

function playOsc(audioCtx, { freq, to, duration, volume, type = 'sine', delay = 0 }) {
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
}

function playSlideTone() {
  if (!soundEnabled || !window.SiteData) return;
  SiteData.withAudio((audioCtx) => {
    try {
      playOsc(audioCtx, { freq: 190, to: 130, duration: 0.045, volume: 0.032, type: 'sine' });
    } catch {}
  });
}

function playMergeTone(maxVal, reached2048 = false) {
  if (!soundEnabled || !window.SiteData) return;
  SiteData.withAudio((audioCtx) => {
    try {
      if (reached2048) {
        [[523, 0], [659, 0.08], [784, 0.16], [1046, 0.25]].forEach(([f, d]) => {
          playOsc(audioCtx, { freq: f, duration: 0.16, volume: 0.085, type: 'triangle', delay: d });
        });
        return;
      }
      const base = maxVal > 0 ? Math.min(880, 260 + Math.log2(maxVal) * 48) : 220;
      playOsc(audioCtx, { freq: base, to: base * 1.12, duration: 0.085, volume: 0.07, type: 'sine' });
      if (maxVal >= 128) {
        playOsc(audioCtx, { freq: base * 1.5, duration: 0.1, volume: 0.045, type: 'triangle', delay: 0.03 });
      }
    } catch {}
  });
}

function bestKeyFor(modeValue) {
  return BEST_PREFIX + modeValue;
}

function readBestScore(modeValue) {
  return GameKit.readBest(bestKeyFor(modeValue));
}

// 旧版把 4×4 / 5×5 的最高分存在同一个键里，首次升级时迁移到当前尺寸
function migrateLegacyBest(modeValue) {
  try {
    const legacy = localStorage.getItem(LEGACY_BEST_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(bestKeyFor(modeValue))) {
      localStorage.setItem(bestKeyFor(modeValue), legacy);
    }
    localStorage.removeItem(LEGACY_BEST_KEY);
  } catch {}
}

let bestScore = 0;
let newBestThisGame = false;

let mode = '4';
let size = 4;
let board = [];
let score = 0;
let played = false;
let history = [];
let victory = null;
let lastSpawn = null;
let lastMerged = new Set();
let renderSeq = 0;

function cloneBoard(b) {
  return b.map((row) => row.slice());
}

function readProgress(key) {
  if (temporarySaves.has(key)) return temporarySaves.get(key);
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeProgress(key, value) {
  try {
    localStorage.setItem(key, value);
    temporarySaves.delete(key);
  } catch {
    temporarySaves.set(key, value);
  }
}

function saveGame() {
  const prevState = history.length ? history[history.length - 1] : null;
  writeProgress(SAVE_PREFIX + mode, JSON.stringify({ board, score, played, history, prevState, victory }));
}

function isValidPosition(position, targetMode = mode) {
  const cfg = MODES[targetMode];
  if (!cfg || !position || !Number.isSafeInteger(position.score) || position.score < 0) return false;
  const s = cfg.size;
  return Array.isArray(position.board) && position.board.length === s &&
    position.board.every((row) => Array.isArray(row) && row.length === s && row.every((tile) => (
      tile === 0 || (cfg.obstacle && tile === -1) ||
      (Number.isSafeInteger(tile) && tile >= 2 && tile === 2 ** Math.floor(Math.log2(tile)))
    ))) && position.board.some((row) => row.some((tile) => tile > 0));
}

function rebuildGridBg() {
  boardWrap.style.setProperty('--size', String(size));
  gridBgEl.innerHTML = '';
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell-bg';
    gridBgEl.appendChild(cell);
  }
}

function openGame(saveFresh = true) {
  size = MODES[mode].size;
  modeBtns.forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  rebuildGridBg();
  bestScore = readBestScore(mode);
  newBestThisGame = false;

  let saved;
  try {
    saved = JSON.parse(readProgress(SAVE_PREFIX + mode));
  } catch {
    // 无法读取的存档可用新棋局替换
  }
  if (!isValidPosition(saved, mode)) {
    initGame();
    if (saveFresh) saveGame();
    return;
  }
  board = saved.board;
  score = saved.score;
  if (Array.isArray(saved.history)) {
    history = saved.history.filter((entry) => isValidPosition(entry, mode)).slice(-MAX_UNDO);
  } else if (isValidPosition(saved.prevState, mode)) {
    history = [saved.prevState];
  } else {
    history = [];
  }
  played = typeof saved.played === 'boolean'
    ? saved.played
    : score > 0 || history.length > 0 || board.flat().filter((v) => v > 0).length > 2;
  victory = saved.victory === 'acknowledged' ? 'acknowledged' : 'pending';
  if (getMaxTile() < 2048) victory = null;
  lastSpawn = null;
  lastMerged = new Set();
  render();
  showOutcome();
}

function initGame() {
  size = MODES[mode].size;
  board = Array.from({ length: size }, () => Array(size).fill(0));
  score = 0;
  played = false;
  history = [];
  victory = null;
  newBestThisGame = false;
  lastSpawn = null;
  lastMerged = new Set();
  if (MODES[mode].obstacle) {
    const inner = [[1, 1], [1, 2], [2, 1], [2, 2]];
    const [or, oc] = inner[Math.floor(Math.random() * inner.length)];
    board[or][oc] = -1;
  }
  addRandomTile();
  addRandomTile();
  render();
  showOutcome();
}

function addRandomTile() {
  const empty = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  board[r][c] = Math.random() < 0.9 ? 2 : 4;
  lastSpawn = r + ',' + c;
}

function showScoreFloat(gained) {
  if (gained <= 0) return;
  const el = document.createElement('span');
  el.className = 'score-float';
  el.textContent = '+' + gained;
  scoreBoxEl.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

function toCoord(dir, i, j) {
  if (dir === 'left') return [i, j];
  if (dir === 'right') return [i, size - 1 - j];
  if (dir === 'up') return [j, i];
  return [size - 1 - j, i];
}

function move(dir) {
  if (overlay.classList.contains('show')) return;

  const snapshotBoard = cloneBoard(board);
  const snapshotScore = score;
  let moved = false;
  let totalGained = 0;
  let highestMerged = 0;
  const mergedCells = new Set();
  const animTiles = [];

  for (let i = 0; i < size; i++) {
    const line = [];
    for (let j = 0; j < size; j++) {
      const [r, c] = toCoord(dir, i, j);
      line.push({ val: board[r][c], idx: j });
    }

    const { result, origins, gained, mergedIdx, highestMerged: hm } = GameRules.merge2048Line(line);
    totalGained += gained;
    if (hm > highestMerged) highestMerged = hm;

    for (let j = 0; j < size; j++) {
      const val = result[j];
      const [r, c] = toCoord(dir, i, j);

      if (board[r][c] !== val) {
        board[r][c] = val;
        moved = true;
      }
      if (val !== 0) {
        const isMerged = mergedIdx.includes(j);
        if (isMerged) mergedCells.add(r + ',' + c);
        origins[j].forEach((fromIdx) => {
          const [fr, fc] = toCoord(dir, i, fromIdx);
          animTiles.push({
            val,
            fromVal: line[fromIdx].val,
            fromR: fr,
            fromC: fc,
            toR: r,
            toC: c,
            isMerged,
          });
        });
      }
    }
  }

  if (!moved) return;

  played = true;

  history.push({ board: snapshotBoard, score: snapshotScore });
  if (history.length > MAX_UNDO) history.shift();
  lastMerged = mergedCells;

  score += totalGained;
  showScoreFloat(totalGained);
  if (score > bestScore) {
    newBestThisGame = true;
    bestScore = score;
    GameKit.saveBestIfHigher(bestKeyFor(mode), bestScore);
  }

  addRandomTile();
  const hit2048Now = victory === null && getMaxTile() >= 2048;
  if (hit2048Now) victory = 'pending';
  if (highestMerged > 0) playMergeTone(highestMerged, hit2048Now);
  else playSlideTone();
  render(animTiles);
  // 滑动结束后再落定合并值与新方块，避免两个“合并后数字”同时滑入
  const seq = renderSeq;
  setTimeout(() => {
    if (seq === renderSeq) render();
  }, 140);
  showOutcome();
  saveGame();
}

function showOutcome() {
  const isNewRecord = newBestThisGame && score > 0 && score >= bestScore;
  if (victory === 'pending') {
    overlayTitle.textContent = t('恭喜合成 2048！🎉');
    overlayDesc.textContent = (isNewRecord ? t('🎉 新纪录！') : '') +
      t('当前得分：{score}，你可以继续挑战更高数字！', { score });
    keepBtn.style.display = 'inline-block';
    overlay.classList.add('show');
  } else if (!GameRules.canMove2048(board)) {
    overlayTitle.textContent = t('没有可移动的方块了');
    overlayDesc.textContent = (isNewRecord ? t('🎉 新纪录！') : '') +
      t('本局得分：{score} · 最大方块：{tile}（本模式最高：{best}）', {
        score,
        tile: getMaxTile(),
        best: bestScore,
      });
    keepBtn.style.display = 'none';
    overlay.classList.add('show');
  } else {
    keepBtn.style.display = 'none';
    overlay.classList.remove('show');
  }
}

function getMaxTile() {
  let m = 0;
  board.forEach((row) => row.forEach((v) => { if (v > m) m = v; }));
  return m;
}

function tileTransform(r, c) {
  return `translate3d(calc(${c} * (100% + var(--gap))), calc(${r} * (100% + var(--gap))), 0)`;
}

function createTileEl(val, r, c, extraClass) {
  const tile = document.createElement('div');
  let cls = 'tile';
  if (size === 5) cls += ' compact';
  if (val === -1) cls += ' obstacle';
  else if (val > 2048) cls += ' super';
  if (extraClass) cls += ' ' + extraClass;
  tile.className = cls;
  tile.dataset.val = String(val);
  tile.style.transform = tileTransform(r, c);

  const inner = document.createElement('div');
  inner.className = 'tile-inner';
  if (val === -1) {
    inner.textContent = '❖';
    tile.setAttribute('aria-label', t('障碍石块'));
  } else {
    inner.textContent = String(val);
  }
  tile.appendChild(inner);
  return tile;
}

function updateUndoButton() {
  undoBtn.disabled = !history.length;
  undoBtn.textContent = history.length ? t('撤回 ({n})', { n: history.length }) : t('撤回');
}

function render(animTiles) {
  renderSeq += 1;
  scoreEl.textContent = score;
  maxEl.textContent = getMaxTile();
  bestEl.textContent = bestScore;
  updateUndoButton();
  tileLayerEl.innerHTML = '';

  if (animTiles && animTiles.length > 0) {
    const moving = [];

    animTiles.forEach((item) => {
      // 起点先显示合并前的数字，滑动到位后再由下一次 render 换成合并结果
      const el = createTileEl(item.fromVal, item.fromR, item.fromC, '');
      tileLayerEl.appendChild(el);
      if (item.fromR !== item.toR || item.fromC !== item.toC) {
        moving.push({ el, toR: item.toR, toC: item.toC });
      }
    });

    if (moving.length > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          moving.forEach(({ el, toR, toC }) => {
            el.style.transform = tileTransform(toR, toC);
          });
        });
      });
    }
    return;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const val = board[r][c];
      if (val === 0) continue;
      const key = r + ',' + c;
      const extra = val > 0 ? (key === lastSpawn ? 'spawn' : lastMerged.has(key) ? 'merged' : '') : '';
      tileLayerEl.appendChild(createTileEl(val, r, c, extra));
    }
  }
}

function performUndo() {
  if (!history.length) return;
  const previous = history.pop();
  board = previous.board;
  score = previous.score;
  // 撤回后按棋盘实际状态重置“已提示胜利”标记，避免回到 2048 之前后再次合成不再提示
  victory = getMaxTile() >= 2048 ? 'acknowledged' : null;
  lastSpawn = null;
  lastMerged = new Set();
  render();
  showOutcome();
  saveGame();
}

undoBtn.addEventListener('click', performUndo);

keepBtn.addEventListener('click', () => {
  victory = 'acknowledged';
  showOutcome();
  saveGame();
});

function switchMode(nextMode) {
  if (!MODES[nextMode] || mode === nextMode) return;
  mode = nextMode;
  writeProgress(MODE_KEY, mode);
  openGame();
}

modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

document.addEventListener('keydown', (e) => {
  if (window.SiteData && SiteData.isDialogOpen && SiteData.isDialogOpen()) return;
  if (window.GameKit && GameKit.isTutorialOpen && GameKit.isTutorialOpen()) return;
  const target = e.target;
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    performUndo();
    return;
  }
  if (GameKit.shouldIgnoreGameKey(e)) return;
  if (e.code === 'KeyU') {
    e.preventDefault();
    performUndo();
    return;
  }
  const map = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
  };
  if (map[e.code]) {
    e.preventDefault();
    move(map[e.code]);
  }
});

GameKit.bindSwipe(boardWrap, { onDirection: move });

function forceRestart() {
  initGame();
  saveGame();
}

async function restartWithConfirm() {
  if (!GameRules.canMove2048(board) || !played) {
    forceRestart();
    return;
  }
  const ok = await window.SiteData.confirmDialog({
    title: t('重开棋局'),
    message: t('重开 {label} 棋局？当前进度将被清除。', { label: t(MODES[mode].label) }),
    confirmText: t('重开'),
    cancelText: t('继续本局'),
    danger: true,
  });
  if (ok) forceRestart();
}

document.getElementById('restart-btn').addEventListener('click', restartWithConfirm);
document.getElementById('overlay-btn').addEventListener('click', forceRestart);

document.addEventListener('i18n:change', () => {
  updateUndoButton();
  tileLayerEl.querySelectorAll('.tile.obstacle').forEach((tile) => {
    tile.setAttribute('aria-label', t('障碍石块'));
  });
  if (overlay.classList.contains('show')) showOutcome();
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) openGame(false);
});

window.addEventListener('storage', (event) => {
  if (event.key === null || event.key === bestKeyFor(mode)) {
    bestScore = readBestScore(mode);
    bestEl.textContent = bestScore;
    showOutcome();
  }
  const saveKey = SAVE_PREFIX + mode;
  if (event.key === null || event.key === saveKey) {
    temporarySaves.delete(saveKey);
    openGame(false);
  }
});

function showTutorial(force) {
  GameKit.showTutorial({
    id: '2048',
    force,
    steps: [
      { icon: 'game-2048', title: t('合并相同数字'), text: t('滑动棋盘或按方向键 / WASD，把相同数字撞在一起翻倍，目标合成 2048。') },
      { icon: 'icon-undo', title: t('撤回与三模式'), text: t('支持 4×4 经典、4×4 障碍与 5×5 轻松棋盘，进度自动保存；走错时支持连续撤回最多 3 步（快捷键 U / Ctrl+Z）。') },
    ],
  });
}

document.getElementById('help-btn').addEventListener('click', () => showTutorial(true));
const savedMode = readProgress(MODE_KEY);
mode = MODES[savedMode] ? savedMode : '4';
migrateLegacyBest(mode);
openGame();
showTutorial(false);
