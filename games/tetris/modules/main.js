import {
  BUFFER_ROWS, GARBAGE_INTERVAL_MS, SPRINT_TARGET, createGame, deserializeMarathonSave,
  hardDrop, holdPiece, movePiece, rotatePiece, serializeMarathonSave, stepGame,
} from './engine.js';
import { createRenderer } from './renderer.js';
import { createAudio } from './audio.js';

const t = (key, params) => (window.I18N ? window.I18N.t(key, params) : key);

const MODE_KEY = 'game_mode_tetris';
const BEST_MARATHON_KEY = 'game_best_tetris_marathon';
const BEST_SPRINT_KEY = 'game_best_tetris_sprint';
const BEST_PARTY_KEY = 'game_best_tetris_party';
const SAVE_MARATHON_KEY = 'game_save_tetris_marathon';

const DAS_MS = 140;
const ARR_MS = 40;
const SOFT_ARR_MS = 45;

const boardCanvas = document.getElementById('tetris-canvas');
const holdBtn = document.getElementById('hold-btn');
const holdCanvas = document.getElementById('hold-canvas');
const nextCanvases = [
  document.getElementById('next-0'),
  document.getElementById('next-1'),
  document.getElementById('next-2'),
];

const hudPrimaryLabel = document.getElementById('hud-primary-label');
const hudPrimaryVal = document.getElementById('hud-primary-val');
const hudBestLabel = document.getElementById('hud-best-label');
const hudBestVal = document.getElementById('hud-best-val');
const hudThirdLabel = document.getElementById('hud-third-label');
const hudThirdVal = document.getElementById('hud-third-val');
const hudFourthLabel = document.getElementById('hud-fourth-label');
const hudFourthVal = document.getElementById('hud-fourth-val');

const modeButtons = [...document.querySelectorAll('.mode-pill[data-mode]')];
const pauseBtn = document.getElementById('pause-btn');
const soundBtn = document.getElementById('sound-btn');
const helpBtn = document.getElementById('help-btn');
const immersiveBtn = document.getElementById('immersive-btn');
const restartBtn = document.getElementById('restart-btn');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const overlayStats = document.getElementById('overlay-stats');
const overlayPrimaryBtn = document.getElementById('overlay-primary-btn');
const overlaySecondaryBtn = document.getElementById('overlay-secondary-btn');
const calloutEl = document.getElementById('tetris-callout');
const padButtons = [...document.querySelectorAll('.tetris-pad [data-action]')];
const padHoldBtn = document.querySelector('.tetris-pad [data-action="hold"]');

let soundEnabled = window.SiteData ? window.SiteData.getSound() : true;
const soundCtrl = window.GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
});
const audio = createAudio(() => soundCtrl.isEnabled());
const renderer = createRenderer(boardCanvas);

let currentMode = readSavedMode();
let game = loadInitialGame(currentMode);
let lastRunIsNewBest = false;
let calloutTimer = null;
let lastFrameTime = 0;

const repeatState = {
  left: { held: false, timerMs: 0, firedDas: false },
  right: { held: false, timerMs: 0, firedDas: false },
  soft: { held: false, timerMs: 0 },
};

function readSavedMode() {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === 'sprint' || saved === 'party') return saved;
    return 'marathon';
  } catch {
    return 'marathon';
  }
}

function saveMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
}

function readMarathonBest() {
  return window.GameKit.readBest(BEST_MARATHON_KEY);
}

function readPartyBest() {
  return window.GameKit.readBest(BEST_PARTY_KEY);
}

function readSprintBestMs() {
  try {
    const val = parseInt(localStorage.getItem(BEST_SPRINT_KEY) || '0', 10);
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

function saveSprintBestIfFaster(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return false;
  const rounded = Math.round(ms);
  const current = readSprintBestMs();
  if (current > 0 && rounded >= current) return false;
  try {
    localStorage.setItem(BEST_SPRINT_KEY, String(rounded));
    return true;
  } catch {
    return false;
  }
}

function writeMarathonSave() {
  if (game.mode !== 'marathon') return;
  try {
    const encoded = serializeMarathonSave(game);
    if (encoded) localStorage.setItem(SAVE_MARATHON_KEY, encoded);
  } catch {}
}

function clearMarathonSave() {
  try {
    localStorage.removeItem(SAVE_MARATHON_KEY);
  } catch {}
}

function loadInitialGame(mode) {
  if (mode === 'marathon') {
    try {
      const saved = deserializeMarathonSave(localStorage.getItem(SAVE_MARATHON_KEY));
      if (saved) return saved;
    } catch {}
  }
  return createGame({ mode });
}

function formatTime(ms) {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const sec = Math.floor(tenths / 10);
  const min = Math.floor(sec / 60);
  const remSec = String(sec % 60).padStart(2, '0');
  const remTenth = tenths % 10;
  return min > 0 ? `${min}:${remSec}.${remTenth}` : `${sec}.${remTenth}s`;
}

const CALLOUT_DURATIONS = {
  normal: 1450,
  danger: 1650,
  powerup: 1750,
  special: 1850,
};

function hideCallout() {
  clearTimeout(calloutTimer);
  calloutTimer = null;
  calloutEl.classList.remove('show', 'pop');
}

function showCallout(text, { tone = 'normal', durationMs } = {}) {
  calloutEl.textContent = text;
  calloutEl.dataset.tone = tone;
  calloutEl.classList.remove('pop');
  void calloutEl.offsetWidth;
  calloutEl.classList.add('show', 'pop');
  clearTimeout(calloutTimer);
  const holdMs = durationMs || CALLOUT_DURATIONS[tone] || CALLOUT_DURATIONS.normal;
  calloutTimer = setTimeout(() => {
    calloutEl.classList.remove('show', 'pop');
  }, holdMs);
}

function clearHeldInputs() {
  repeatState.left.held = false;
  repeatState.right.held = false;
  repeatState.soft.held = false;
  padButtons.forEach((btn) => btn.classList.remove('active'));
}

function updateModePills() {
  modeButtons.forEach((btn) => {
    const active = btn.dataset.mode === currentMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateHud() {
  if (game.mode === 'marathon') {
    delete hudThirdVal.dataset.state;
    hudPrimaryLabel.textContent = t('得分');
    hudPrimaryVal.textContent = String(game.score);
    hudBestLabel.textContent = t('最高纪录');
    hudBestVal.textContent = String(Math.max(readMarathonBest(), game.score));
    hudThirdLabel.textContent = t('等级');
    hudThirdVal.textContent = String(game.level);
    hudFourthLabel.textContent = t('消行');
    hudFourthVal.textContent = String(game.lines);
  } else if (game.mode === 'party') {
    hudPrimaryLabel.textContent = t('得分');
    hudPrimaryVal.textContent = String(game.score);
    hudBestLabel.textContent = t('最高纪录');
    hudBestVal.textContent = String(Math.max(readPartyBest(), game.score));
    if (game.iceTimerMs > 0) {
      hudThirdVal.dataset.state = 'ice';
      hudThirdLabel.textContent = t('冰霜');
      hudThirdVal.textContent = Math.ceil(game.iceTimerMs / 1000) + 's';
    } else {
      delete hudThirdVal.dataset.state;
      hudThirdLabel.textContent = t('涨行');
      hudThirdVal.textContent = Math.max(1, Math.ceil((GARBAGE_INTERVAL_MS - game.garbageTimerMs) / 1000)) + 's';
    }
    hudFourthLabel.textContent = t('消行');
    hudFourthVal.textContent = String(game.lines);
  } else {
    delete hudThirdVal.dataset.state;
    const remaining = Math.max(0, SPRINT_TARGET - game.lines);
    const bestMs = readSprintBestMs();
    hudPrimaryLabel.textContent = t('剩余行数');
    hudPrimaryVal.textContent = String(remaining);
    hudBestLabel.textContent = t('最快用时');
    hudBestVal.textContent = bestMs > 0 ? formatTime(bestMs) : '—';
    hudThirdLabel.textContent = t('用时');
    hudThirdVal.textContent = formatTime(game.elapsedMs);
    hudFourthLabel.textContent = t('已消');
    hudFourthVal.textContent = `${game.lines}/${SPRINT_TARGET}`;
  }
}

function renderOverlayStats(items) {
  overlayStats.replaceChildren();
  if (!items || !items.length) {
    overlayStats.hidden = true;
    return;
  }
  for (const { label, value } of items) {
    const box = document.createElement('div');
    box.className = 'overlay-stat';
    const labelEl = document.createElement('span');
    labelEl.className = 'overlay-stat-label';
    labelEl.textContent = label;
    const valEl = document.createElement('span');
    valEl.className = 'overlay-stat-value';
    valEl.textContent = value;
    box.append(labelEl, valEl);
    overlayStats.appendChild(box);
  }
  overlayStats.hidden = false;
}

function syncOverlayAndButtons() {
  pauseBtn.disabled = game.status === 'ready' || game.status === 'gameover' || game.status === 'cleared';
  pauseBtn.textContent = game.status === 'paused' ? t('继续') : t('暂停');

  if (game.status === 'playing') {
    overlay.classList.remove('show');
    return;
  }

  overlay.classList.add('show');
  if (game.status === 'ready') {
    if (currentMode === 'sprint') {
      overlayTitle.textContent = t('40 行竞速');
      overlayDesc.textContent = t('以最快速度消除 40 行，拼手速与节奏感。');
    } else if (currentMode === 'party') {
      overlayTitle.textContent = t('道具狂热');
      overlayDesc.textContent = t('炸弹、激光与冰霜方块轮番助阵，同时迎战定时涨行挑战！');
    } else {
      overlayTitle.textContent = t('经典马拉松');
      overlayDesc.textContent = t('堆叠下落方块凑满整行消除，不断升级挑战更高分。');
    }
    renderOverlayStats([]);
    overlayPrimaryBtn.textContent = t('开始游戏');
    overlaySecondaryBtn.hidden = true;
    return;
  }

  if (game.status === 'paused') {
    const hasProgress = game.piecesPlaced > 0 || game.score > 0 || game.lines > 0;
    overlayTitle.textContent = t('已暂停');
    if (game.mode === 'marathon') {
      overlayDesc.textContent = hasProgress
        ? t('当前棋局已保存，随时回来继续。')
        : t('尚未开始落块，准备好随时继续。');
    } else {
      overlayDesc.textContent = t('暂停期间不计时，准备好随时继续。');
    }
    renderOverlayStats([
      {
        label: game.mode === 'sprint' ? t('剩余行数') : t('当前得分'),
        value: game.mode === 'sprint' ? String(Math.max(0, SPRINT_TARGET - game.lines)) : String(game.score),
      },
      { label: t('已消行'), value: String(game.lines) },
    ]);
    overlayPrimaryBtn.textContent = t('继续游戏');
    overlaySecondaryBtn.textContent = t('重新开始');
    overlaySecondaryBtn.hidden = false;
    return;
  }

  if (game.status === 'cleared') {
    const isNewBest = lastRunIsNewBest;
    const secs = Math.max(0.1, game.elapsedMs / 1000);
    const pps = (game.piecesPlaced / secs).toFixed(2);
    overlayTitle.textContent = isNewBest ? t('新最快纪录！') : t('40 行完成！');
    overlayDesc.textContent = t('用时 {time}，手速 {pps} 块/秒。', { time: formatTime(game.elapsedMs), pps });
    renderOverlayStats([
      { label: t('用时'), value: formatTime(game.elapsedMs) },
      { label: t('最快用时'), value: formatTime(readSprintBestMs() || game.elapsedMs) },
      { label: t('四消次数'), value: String(game.tetrises) },
      { label: t('最高连击'), value: String(game.maxCombo) },
    ]);
    overlayPrimaryBtn.textContent = t('再来一局');
    overlaySecondaryBtn.hidden = true;
    return;
  }

  // gameover
  const isNewBest = game.mode !== 'sprint' && lastRunIsNewBest;
  overlayTitle.textContent = isNewBest ? t('刷新最高分！') : t('游戏结束');
  if (game.mode === 'sprint') {
    overlayDesc.textContent = t('在 {lines} 行时触顶，再接再厉！', { lines: game.lines });
  } else {
    overlayDesc.textContent = t('本局得分 {score}，共消除 {lines} 行。', { score: game.score, lines: game.lines });
  }
  const stats = game.mode === 'party'
    ? [
        { label: t('本局得分'), value: String(game.score) },
        { label: t('道具触发'), value: String(game.powerupsUsed) },
        { label: t('四消次数'), value: String(game.tetrises) },
        { label: t('最高连击'), value: String(game.maxCombo) },
      ]
    : [
        { label: game.mode === 'sprint' ? t('已消行') : t('本局得分'), value: game.mode === 'sprint' ? `${game.lines}/${SPRINT_TARGET}` : String(game.score) },
        { label: t('达到等级'), value: String(game.level) },
        { label: t('四消次数'), value: String(game.tetrises) },
        { label: t('最高连击'), value: String(game.maxCombo) },
      ];
  renderOverlayStats(stats);
  overlayPrimaryBtn.textContent = t('再来一局');
  overlaySecondaryBtn.hidden = true;
}

function renderAll() {
  updateModePills();
  updateHud();
  syncOverlayAndButtons();
  holdBtn.classList.toggle('dimmed', game.holdUsed);
  padHoldBtn?.classList.toggle('dimmed', game.holdUsed);
  renderer.renderBoard(game);
  renderer.renderMiniPiece(holdCanvas, game.hold, {
    dimmed: game.holdUsed,
    powerup: game.holdPowerup,
  });
  for (let i = 0; i < nextCanvases.length; i++) {
    renderer.renderMiniPiece(nextCanvases[i], game.queue[i] || null, {
      powerup: game.queuePowerups?.[i] || null,
    });
  }
}

function handleGarbageEvent() {
  audio.playGarbageRise();
  showCallout(t('底部涨行！'), { tone: 'danger' });
  renderer.triggerShake(2.5, 110);
}

function handleLockEvent(event) {
  if (!event) return;
  if (event.garbageRisen) handleGarbageEvent();

  if (event.lockedCells) {
    renderer.triggerLockPulse(event.lockedCells, event.lockedType, !!event.hardDropDistance);
  }
  if (!event.hardDropDistance && event.type === 'lock') {
    audio.playLock();
  }

  const p = event.powerupTriggered;
  const calloutParts = [];
  if (p) {
    if (p.type === 'bomb') {
      renderer.triggerBomb(p.cx, p.cy);
      renderer.triggerShake(4.5, 180);
      audio.playBomb();
      calloutParts.push(t('炸弹爆破！'));
      if (event.linesCleared === 0 && event.gained > 0 && game.mode !== 'sprint') {
        renderer.triggerFloatingText('+' + event.gained, Math.max(3, p.cy - BUFFER_ROWS), '#fb923c');
      }
    } else if (p.type === 'laser') {
      renderer.triggerLaser(p.row);
      renderer.triggerShake(3.5, 150);
      audio.playLaser();
      calloutParts.push(t('激光清行！'));
    } else if (p.type === 'ice') {
      audio.playIce();
      calloutParts.push(t('冰霜减速 8s'));
    }
  }

  if (event.linesCleared > 0) {
    renderer.triggerLineClear(event.clearedRows, event.isTetris || event.isTSpin, {
      withFlash: !game.pendingClear,
    });
    audio.playClear(event.linesCleared, event.isBackToBack, event.combo);
    if (event.isTSpin) audio.playTSpin();
    if (event.isAllClear) audio.playAllClear();
    if (event.isTetris || event.isTSpin || event.isAllClear) {
      renderer.triggerShake(event.isAllClear ? 5 : 3.8, 160);
    }

    if (event.isAllClear) calloutParts.push(t('全消！'));
    if (event.isBackToBack) calloutParts.push(t('连续四消 ×1.5'));
    if (event.isTSpin) calloutParts.push(t('T-Spin!'));
    else if (event.isTetris) calloutParts.push(t('四消！'));
    else if (event.linesCleared === 3) calloutParts.push(t('三消'));
    else if (event.linesCleared === 2) calloutParts.push(t('双消'));
    if (event.combo >= 1) calloutParts.push(t('{n} 连击', { n: event.combo }));

    if (event.gained > 0 && game.mode !== 'sprint') {
      const avgRow = event.clearedRows.length
        ? Math.round(event.clearedRows.reduce((s, r) => s + r, 0) / event.clearedRows.length) - BUFFER_ROWS
        : 10;
      renderer.triggerFloatingText(
        '+' + event.gained,
        avgRow,
        event.isAllClear ? '#a7f3d0' : event.isTSpin ? '#d8b4fe' : '#fde047'
      );
    }
  }

  if (calloutParts.length) {
    const isSpecialTone = event.isAllClear || event.isBackToBack || event.isTSpin || event.isTetris;
    const tone = isSpecialTone ? 'special' : (p ? 'powerup' : 'normal');
    showCallout(calloutParts.join(' · '), { tone });
  }

  if (event.levelUp) audio.playLevelUp();

  if (game.status === 'cleared') {
    clearHeldInputs();
    audio.playWin();
    lastRunIsNewBest = saveSprintBestIfFaster(game.elapsedMs);
  } else if (game.status === 'gameover') {
    clearHeldInputs();
    if (game.mode === 'marathon') {
      lastRunIsNewBest = window.GameKit.saveBestIfHigher(BEST_MARATHON_KEY, game.score);
      clearMarathonSave();
    } else if (game.mode === 'party') {
      lastRunIsNewBest = window.GameKit.saveBestIfHigher(BEST_PARTY_KEY, game.score);
    } else {
      lastRunIsNewBest = false;
    }
    audio.playGameOver();
  } else if (game.mode === 'marathon') {
    writeMarathonSave();
  }
}

function startOrResume() {
  if (game.status === 'ready' || game.status === 'paused') {
    game.status = 'playing';
    lastFrameTime = performance.now();
    renderAll();
  } else if (game.status === 'gameover' || game.status === 'cleared') {
    restartImmediate();
  }
}

function pauseGame() {
  if (game.status !== 'playing') return;
  game.status = 'paused';
  clearHeldInputs();
  writeMarathonSave();
  renderAll();
}

function restartImmediate() {
  hideCallout();
  clearHeldInputs();
  lastRunIsNewBest = false;
  if (currentMode === 'marathon') clearMarathonSave();
  game = createGame({ mode: currentMode });
  game.status = 'playing';
  lastFrameTime = performance.now();
  renderAll();
}

async function confirmRestart() {
  const hasProgress = game.status !== 'ready' && game.status !== 'gameover' && game.status !== 'cleared'
    && (game.piecesPlaced > 0 || game.score > 0 || game.lines > 0);
  if (hasProgress) {
    if (game.status === 'playing') pauseGame();
    const ok = await window.SiteData.confirmDialog({
      title: t('重开本局'),
      message: t('当前进度将被清除，确定重开吗？'),
      confirmText: t('重开'),
      cancelText: t('继续本局'),
      danger: true,
    });
    if (!ok) return;
  }
  restartImmediate();
}

async function switchMode(nextMode) {
  if (nextMode === currentMode) return;
  const hasProgress = game.status !== 'ready' && game.status !== 'gameover' && game.status !== 'cleared'
    && (game.piecesPlaced > 0 || game.score > 0 || game.lines > 0);
  if (hasProgress) {
    if (game.status === 'playing') pauseGame();
    const ok = await window.SiteData.confirmDialog({
      title: t('切换模式'),
      message: t('当前进行中的对局将暂停或结束，确定切换吗？'),
      confirmText: t('切换'),
      cancelText: t('取消'),
    });
    if (!ok) return;
  }
  hideCallout();
  clearHeldInputs();
  lastRunIsNewBest = false;
  currentMode = nextMode;
  saveMode(nextMode);
  game = loadInitialGame(nextMode);
  renderAll();
}

function doMove(dx, dy) {
  if (game.status !== 'playing') return false;
  const res = movePiece(game, dx, dy);
  if (!res.moved) return false;
  if (dy > 0) audio.playSoftDrop();
  else audio.playMove();
  updateHud();
  renderer.renderBoard(game);
  return true;
}

function doRotate(dir) {
  if (game.status !== 'playing') return;
  const res = rotatePiece(game, dir);
  if (res.rotated) {
    audio.playRotate();
    renderer.renderBoard(game);
  }
}

function doHold() {
  if (game.status !== 'playing') return;
  const res = holdPiece(game);
  if (res.held) {
    audio.playHold();
    renderAll();
  } else if (game.status === 'gameover') {
    handleLockEvent(game.lastEvent);
    renderAll();
  }
}

function doHardDrop() {
  if (game.status !== 'playing' || !game.active) return;
  const startY = game.active.y;
  const snapshot = { ...game.active };
  const event = hardDrop(game);
  if (!event) return;
  renderer.triggerHardDrop(startY, startY + (event.hardDropDistance || 0), snapshot);
  renderer.triggerBoardBump(2.5, 95);
  audio.playHardDrop();
  handleLockEvent(event);
  renderAll();
}

function updateHeldRepeat(dtMs) {
  if (game.status !== 'playing') return;
  if (repeatState.left.held !== repeatState.right.held) {
    const dir = repeatState.left.held ? -1 : 1;
    const st = repeatState.left.held ? repeatState.left : repeatState.right;
    st.timerMs += dtMs;
    if (!st.firedDas) {
      if (st.timerMs >= DAS_MS) {
        st.firedDas = true;
        st.timerMs -= DAS_MS;
        doMove(dir, 0);
      }
    } else {
      while (st.timerMs >= ARR_MS && game.status === 'playing') {
        st.timerMs -= ARR_MS;
        if (!doMove(dir, 0)) break;
      }
    }
  }

  if (repeatState.soft.held) {
    repeatState.soft.timerMs += dtMs;
    while (repeatState.soft.timerMs >= SOFT_ARR_MS && game.status === 'playing') {
      repeatState.soft.timerMs -= SOFT_ARR_MS;
      if (!doMove(0, 1)) break;
    }
  }
}

function loop(now) {
  if (!lastFrameTime) lastFrameTime = now;
  const dtMs = Math.min(100, Math.max(0, now - lastFrameTime));
  lastFrameTime = now;

  if (game.status === 'playing') {
    updateHeldRepeat(dtMs);
    const prevLines = game.lines;
    const prevScore = game.score;
    const event = stepGame(game, dtMs);
    if (event) {
      if (event.type === 'garbage') handleGarbageEvent();
      else if (event.type === 'clearComplete') {
        if (game.mode === 'marathon') writeMarathonSave();
      } else {
        handleLockEvent(event);
      }
    }
    if (event || game.mode !== 'marathon' || game.lines !== prevLines || game.score !== prevScore) {
      updateHud();
      if (event) {
        syncOverlayAndButtons();
        holdBtn.classList.toggle('dimmed', game.holdUsed);
        padHoldBtn?.classList.toggle('dimmed', game.holdUsed);
        renderer.renderMiniPiece(holdCanvas, game.hold, {
          dimmed: game.holdUsed,
          powerup: game.holdPowerup,
        });
        for (let i = 0; i < nextCanvases.length; i++) {
          renderer.renderMiniPiece(nextCanvases[i], game.queue[i] || null, {
            powerup: game.queuePowerups?.[i] || null,
          });
        }
      }
    }
    renderer.updateEffects(dtMs);
    renderer.renderBoard(game);
  } else if (renderer.hasActiveEffects()) {
    renderer.updateEffects(dtMs);
    renderer.renderBoard(game);
  }

  requestAnimationFrame(loop);
}

// 键盘控制
document.addEventListener('keydown', (event) => {
  if (window.GameKit.shouldIgnoreGameKey(event, { ignoreOnControl: true })) return;
  if (window.SiteData?.isDialogOpen?.() || window.GameKit.isTutorialOpen?.()) return;

  if (event.code === 'KeyP') {
    event.preventDefault();
    if (game.status === 'playing') pauseGame();
    else if (game.status === 'paused' || game.status === 'ready') startOrResume();
    return;
  }

  if (game.status !== 'playing') {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      startOrResume();
    }
    return;
  }

  switch (event.code) {
    case 'ArrowLeft':
    case 'KeyA':
      event.preventDefault();
      if (!event.repeat) {
        repeatState.left.held = true;
        repeatState.left.timerMs = 0;
        repeatState.left.firedDas = false;
        doMove(-1, 0);
      }
      break;
    case 'ArrowRight':
    case 'KeyD':
      event.preventDefault();
      if (!event.repeat) {
        repeatState.right.held = true;
        repeatState.right.timerMs = 0;
        repeatState.right.firedDas = false;
        doMove(1, 0);
      }
      break;
    case 'ArrowDown':
    case 'KeyS':
      event.preventDefault();
      if (!event.repeat) {
        repeatState.soft.held = true;
        repeatState.soft.timerMs = 0;
        doMove(0, 1);
      }
      break;
    case 'ArrowUp':
    case 'KeyW':
    case 'KeyX':
      event.preventDefault();
      if (!event.repeat) doRotate(1);
      break;
    case 'KeyZ':
      event.preventDefault();
      if (!event.repeat) doRotate(-1);
      break;
    case 'Space':
      event.preventDefault();
      if (!event.repeat) doHardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      event.preventDefault();
      if (!event.repeat) doHold();
      break;
    default:
      break;
  }
});

document.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') repeatState.left.held = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') repeatState.right.held = false;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') repeatState.soft.held = false;
});

window.addEventListener('blur', clearHeldInputs);

// 触屏虚拟键
const activePointers = new Map();

function pressAction(action) {
  if (game.status !== 'playing') return;
  if (action === 'left') {
    repeatState.left.held = true;
    repeatState.left.timerMs = 0;
    repeatState.left.firedDas = false;
    doMove(-1, 0);
  } else if (action === 'right') {
    repeatState.right.held = true;
    repeatState.right.timerMs = 0;
    repeatState.right.firedDas = false;
    doMove(1, 0);
  } else if (action === 'soft') {
    repeatState.soft.held = true;
    repeatState.soft.timerMs = 0;
    doMove(0, 1);
  } else if (action === 'rotate') {
    doRotate(1);
  } else if (action === 'hold') {
    doHold();
  } else if (action === 'hard') {
    doHardDrop();
  }
}

function releaseAction(action) {
  if (action === 'left') repeatState.left.held = false;
  else if (action === 'right') repeatState.right.held = false;
  else if (action === 'soft') repeatState.soft.held = false;
}

padButtons.forEach((btn) => {
  const action = btn.dataset.action;
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    activePointers.set(e.pointerId, { btn, action });
    btn.classList.add('active');
    try { btn.setPointerCapture(e.pointerId); } catch {}
    pressAction(action);
  });

  const endPointer = (e) => {
    const info = activePointers.get(e.pointerId);
    if (!info) return;
    activePointers.delete(e.pointerId);
    info.btn.classList.remove('active');
    releaseAction(info.action);
  };

  btn.addEventListener('pointerup', endPointer);
  btn.addEventListener('pointercancel', endPointer);
  btn.addEventListener('lostpointercapture', endPointer);
});

// 点击 Hold 预览框暂存方块
holdBtn.addEventListener('click', (e) => {
  if (e.detail > 0) holdBtn.blur();
  doHold();
});

// 棋盘轻点旋转辅助
let boardTap = null;
boardCanvas.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary || e.button !== 0 || game.status !== 'playing') return;
  boardTap = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
boardCanvas.addEventListener('pointerup', (e) => {
  if (!boardTap || boardTap.id !== e.pointerId) return;
  const moved = Math.hypot(e.clientX - boardTap.x, e.clientY - boardTap.y);
  boardTap = null;
  if (moved < 10 && game.status === 'playing') doRotate(1);
});
boardCanvas.addEventListener('pointercancel', () => { boardTap = null; });

// 工具栏与遮罩按钮
modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});
pauseBtn.addEventListener('click', () => {
  if (game.status === 'playing') pauseGame();
  else if (game.status === 'paused') startOrResume();
});
restartBtn.addEventListener('click', confirmRestart);
overlayPrimaryBtn.addEventListener('click', startOrResume);
overlaySecondaryBtn.addEventListener('click', confirmRestart);

function openTutorial(force) {
  if (game.status === 'playing') pauseGame();
  return window.GameKit.showTutorial({
    id: 'tetris',
    force: !!force,
    steps: [
      {
        icon: 'game-tetris',
        title: t('俄罗斯方块'),
        text: t('凑满整行即可消除。四消、T-Spin 与全消得分最高，连续四消和连击还有额外加成！'),
      },
      {
        icon: 'art-tap',
        title: t('移动与暂存'),
        text: t('电脑用方向键操作、空格落底、C 暂存；手机点底部按键或轻点棋盘旋转，点左上角「暂存」框可保留当前方块。'),
      },
      {
        icon: 'art-star',
        title: t('三种玩法模式'),
        text: t('经典马拉松会自动存档；40 行竞速冲刺最快用时；道具狂热可触发炸弹、激光和冰霜！'),
      },
    ],
  });
}

helpBtn.addEventListener('click', () => openTutorial(true));

window.GameKit.bindMobileLayout('tetris', immersiveBtn, () => {
  pauseGame();
  requestAnimationFrame(renderAll);
}, { portraitOnly: true });

window.GameKit.onHidden(pauseGame);
document.addEventListener('site:dialogopen', pauseGame);
document.addEventListener('i18n:change', renderAll);
document.addEventListener('theme:change', renderAll);
window.addEventListener('resize', renderAll);
window.addEventListener('pagehide', writeMarathonSave);

renderAll();
openTutorial(false);
requestAnimationFrame(loop);
