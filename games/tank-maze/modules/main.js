import { MAPS, STEP, WINS, createMatch, nextRound, stepMatch } from './engine.js';
import { createAI, AI_DIFFICULTIES } from './ai.js';
import { createRenderer } from './renderer.js';

const { GameKit, SiteData, I18N } = window;
const t = (key, params) => I18N.t(key, params);
const byId = (id) => document.getElementById(id);
const SETTINGS_KEY = 'game_mode_tank-maze';

const arena = byId('tank-arena');
const scoreboard = document.querySelector('.tank-scoreboard');
const renderer = createRenderer(byId('tank-board'));
const mapSelect = byId('tank-map');
const difficultySelect = byId('tank-difficulty');
const overlay = byId('tank-overlay');
const overlayTitle = byId('tank-overlay-title');
const overlayNote = byId('tank-overlay-note');
const primaryButton = byId('tank-primary');
const secondaryButton = byId('tank-secondary');
const startButton = byId('tank-start');
const pauseButton = byId('tank-pause');
const restartButton = byId('tank-restart');
const touch = byId('tank-touch');
const pad = byId('tank-dpad');
const fireButton = byId('tank-fire');
const directionKeys = [...pad.querySelectorAll('[data-dir]')];
const scores = [byId('player-score'), byId('ai-score')];
const pips = [byId('player-pips'), byId('ai-pips')].map((container) => {
  const items = Array.from({ length: WINS }, () => document.createElement('i'));
  container.replaceChildren(...items);
  return items;
});
const roundLabel = byId('round-label');

const sound = GameKit.bindSoundButton(byId('tank-sound'), SiteData.getSound());
let lastBounce = -Infinity;
function playEventSound(events) {
  if (!sound.isEnabled() || !events.length) return;
  const now = performance.now();
  const impact = events.some(({ type }) => type === 'hit');
  const fired = events.some(({ type }) => type === 'shot');
  const bounce = events.some(({ type }) => type === 'bounce') && now - lastBounce > 80;
  if (bounce) lastBounce = now;
  if (!impact && !fired && !bounce) return;
  SiteData.withAudio((context) => {
    const time = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const [from, to, duration, volume] = impact ? [175, 53, 0.30, 0.11]
      : fired ? [270, 95, 0.12, 0.075] : [600, 390, 0.055, 0.036];
    oscillator.type = impact ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(to, time + duration);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration);
  });
}

try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  if (MAPS.some(({ id }) => saved?.map === id)) mapSelect.value = saved.map;
  if (AI_DIFFICULTIES.includes(saved?.difficulty)) difficultySelect.value = saved.difficulty;
} catch {}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ map: mapSelect.value, difficulty: difficultySelect.value }));
  } catch {}
}

let match = createMatch(mapSelect.value);
let ai = createAI(difficultySelect.value);
let phase = 'ready';
let frameId = 0;
let lastFrame = 0;
let accumulator = 0;
let restarting = false;
let interruptions = 0;

const controls = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Space: 'fire' };
const pressed = new Set();
const pointers = new Map();
let queuedShot = false;

function held(action) {
  if (pressed.has(action)) return true;
  for (const actions of pointers.values()) {
    if (actions.includes(action)) return true;
  }
  return false;
}

function updatePad() {
  for (const button of directionKeys) button.classList.toggle('active', held(button.dataset.dir));
  fireButton.classList.toggle('active', held('fire'));
}

function clearInput() {
  pressed.clear();
  pointers.clear();
  queuedShot = false;
  updatePad();
}

function getPlayerInput() {
  const input = {
    drive: Number(held('up')) - Number(held('down')),
    turn: Number(held('right')) - Number(held('left')),
    fire: queuedShot || held('fire'),
  };
  queuedShot = false;
  return input;
}

function roundMessage() {
  if (match.result.winner === null) return t('双方同时命中，本局不计分。');
  if (match.result.selfHit) {
    return match.result.winner === 1 ? t('你被自己的回弹击中。') : t('人机被自己的回弹击中。');
  }
  return match.result.winner === 0 ? t('你击中了人机坦克。') : t('你被人机的炮弹击中。');
}

function renderState() {
  const ready = phase === 'ready';
  mapSelect.disabled = difficultySelect.disabled = !ready || !renderer;
  startButton.hidden = !ready;
  startButton.disabled = !renderer;
  restartButton.disabled = ready || phase === 'finished';
  pauseButton.disabled = phase !== 'playing' && phase !== 'paused';
  pauseButton.dataset.i18n = phase === 'paused' ? '继续游戏' : '暂停';
  pauseButton.textContent = t(pauseButton.dataset.i18n);
  touch.hidden = phase !== 'playing';
  scores.forEach((score, id) => {
    score.textContent = match.scores[id];
    pips[id].forEach((pip, index) => pip.classList.toggle('filled', index < match.scores[id]));
  });
  roundLabel.textContent = t('第 {round} 局', { round: match.round });
  overlay.hidden = ready || phase === 'playing';
  secondaryButton.hidden = phase !== 'finished';
  if (phase === 'paused') {
    overlayTitle.textContent = t('已暂停');
    overlayNote.textContent = '';
    primaryButton.textContent = t('继续游戏');
  } else if (phase === 'round-end') {
    overlayTitle.textContent = match.result.winner === null ? t('本局平局')
      : match.result.winner === 0 ? t('你赢了本局') : t('人机赢了本局');
    overlayNote.textContent = roundMessage();
    primaryButton.textContent = t('下一局');
  } else if (phase === 'finished') {
    overlayTitle.textContent = match.winner === 0 ? t('你赢了比赛') : t('人机赢了比赛');
    overlayNote.textContent = t('最终比分 {player} 比 {ai}', { player: match.scores[0], ai: match.scores[1] });
    primaryButton.textContent = t('原图再战');
  }
}

function scheduleFrame() {
  if (!frameId) frameId = requestAnimationFrame(frame);
}

function frame(timestamp) {
  frameId = 0;
  const elapsed = lastFrame ? Math.min(0.05, (timestamp - lastFrame) / 1000) : 0;
  lastFrame = timestamp;
  if (phase === 'playing') {
    accumulator += elapsed;
    while (accumulator >= STEP && phase === 'playing') {
      accumulator -= STEP;
      stepMatch(match, [getPlayerInput(), ai(match, STEP)], STEP);
      renderer.addEvents(match.events);
      playEventSound(match.events);
      if (match.result) setPhase(match.winner === null ? 'round-end' : 'finished', primaryButton);
    }
  }
  renderer.draw(match, elapsed);
  if (phase === 'playing' || renderer.hasEffects()) scheduleFrame();
  else lastFrame = 0;
}

function setPhase(next, focusTarget) {
  clearInput();
  phase = next;
  accumulator = 0;
  lastFrame = 0;
  renderState();
  if (renderer) scheduleFrame();
  if (focusTarget === arena) scoreboard.scrollIntoView({ block: 'nearest' });
  focusTarget?.focus({ preventScroll: true });
}

function startMatch() {
  if (!renderer) return;
  match = createMatch(mapSelect.value);
  ai = createAI(difficultySelect.value);
  renderer.clear();
  setPhase('playing', arena);
}

function nextMatchRound() {
  nextRound(match);
  renderer.clear();
  setPhase('playing', arena);
}

function pause({ focus = false } = {}) {
  if (phase === 'playing') setPhase('paused', focus ? primaryButton : null);
  else clearInput();
}

function resume() {
  if (phase !== 'paused' || document.hidden || SiteData.isDialogOpen() || GameKit.isTutorialOpen()) return;
  setPhase('playing', arena);
}

async function confirmRestart() {
  if (restarting || phase === 'ready' || phase === 'finished') return;
  restarting = true;
  const wasPlaying = phase === 'playing';
  const interruptionCount = interruptions;
  pause();
  const confirmed = await SiteData.confirmDialog({
    title: t('重新开始'),
    message: t('重新开始这场比赛？当前比分会清零。'),
    confirmText: t('重开'),
  });
  restarting = false;
  if (confirmed) {
    startMatch();
    if (document.hidden) pause();
  } else if (wasPlaying && interruptions === interruptionCount) {
    resume();
  }
}

function showTutorial(force) {
  GameKit.showTutorial({
    id: 'tank-maze', force,
    steps: [
      { icon: 'game-tank-maze', title: t('坦克迷宫'), text: t('选好地图和难度，先赢 3 局就赢下比赛。每局交换出生侧。') },
      { icon: 'art-tap', title: t('驾驶'), text: t('方向键控制车身，空格开火。手机用左侧方向控制，右侧开火。倒车时炮口保持朝前。') },
      { icon: 'art-target', title: t('炮弹反弹'), text: t('炮弹会从墙上反复弹开，也可能打中发射它的坦克。打一发以后，留好躲避的路线。') },
    ],
  });
}

startButton.addEventListener('click', startMatch);
pauseButton.addEventListener('click', () => {
  if (phase === 'paused') resume();
  else pause({ focus: true });
});
restartButton.addEventListener('click', confirmRestart);
byId('tank-help').addEventListener('click', () => showTutorial(true));
primaryButton.addEventListener('click', () => {
  if (phase === 'paused') resume();
  else if (phase === 'round-end') nextMatchRound();
  else if (phase === 'finished') startMatch();
});
secondaryButton.addEventListener('click', () => {
  match = createMatch(mapSelect.value);
  renderer.clear();
  setPhase('ready');
  mapSelect.focus();
});
mapSelect.addEventListener('change', () => {
  saveSettings();
  match = createMatch(mapSelect.value);
  if (renderer) scheduleFrame();
});
difficultySelect.addEventListener('change', saveSettings);

document.addEventListener('keydown', (event) => {
  if (GameKit.isTutorialOpen() || SiteData.isDialogOpen() ||
      GameKit.shouldIgnoreGameKey(event, { ignoreOnControl: true }) ||
      event.target.closest?.('select, input, textarea, [contenteditable="true"]')) return;
  if ((event.code === 'KeyP' || event.code === 'Escape') && (phase === 'playing' || phase === 'paused')) {
    event.preventDefault();
    if (!event.repeat) {
      if (phase === 'paused') resume();
      else pause({ focus: true });
    }
    return;
  }
  const action = controls[event.code];
  if (!action || phase !== 'playing') return;
  event.preventDefault();
  pressed.add(action);
  if (action === 'fire' && !event.repeat) queuedShot = true;
  updatePad();
});
document.addEventListener('keyup', (event) => {
  pressed.delete(controls[event.code]);
  updatePad();
});

function padActions(event) {
  const rect = pad.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  const actions = [];
  if (Math.abs(x) > 0.15) actions.push(x < 0 ? 'left' : 'right');
  if (Math.abs(y) > 0.15) actions.push(y < 0 ? 'up' : 'down');
  return actions;
}

function bindPointer(element, getActions) {
  element.addEventListener('pointerdown', (event) => {
    if (phase !== 'playing' || event.button !== 0) return;
    event.preventDefault();
    const actions = getActions(event);
    pointers.set(event.pointerId, actions);
    if (actions.includes('fire')) queuedShot = true;
    try { element.setPointerCapture(event.pointerId); } catch {}
    updatePad();
  });
  element.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, getActions(event));
    updatePad();
  });
  const release = (event) => {
    pointers.delete(event.pointerId);
    updatePad();
  };
  for (const eventType of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(eventType, release);
  }
}

bindPointer(pad, padActions);
bindPointer(fireButton, () => ['fire']);

function pauseForInterruption() {
  interruptions += 1;
  pause();
}

GameKit.onHidden(pauseForInterruption);
window.addEventListener('blur', pauseForInterruption);
window.addEventListener('pagehide', pauseForInterruption);
document.addEventListener('site:dialogopen', () => pause());
document.addEventListener('i18n:change', renderState);
document.addEventListener('theme:change', () => { if (renderer) scheduleFrame(); });
if (renderer) {
  if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleFrame).observe(arena);
  else window.addEventListener('resize', scheduleFrame);
  scheduleFrame();
} else {
  byId('tank-unavailable').hidden = false;
}
renderState();
if (renderer) showTutorial(false);
