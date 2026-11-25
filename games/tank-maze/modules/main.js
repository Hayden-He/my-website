import {
  MAPS, MAX_AMMO, MAX_HEALTH, STEP, createMatch, nextRound, readMatchStats, recordMatchStats, rules, stepMatch,
} from './engine.js';
import { createAI, AI_DIFFICULTIES } from './ai.js';
import { arenaRatio, createRenderer, drawMapPreview, drawTankPreview } from './renderer.js';

const { GameKit, SiteData, I18N } = window;
const t = (key, params) => I18N.t(key, params);
const byId = (id) => document.getElementById(id);
const SETTINGS_KEY = 'game_mode_tank-maze';
const AI_SKIN_BY_DIFFICULTY = { easy: 'standard', normal: 'wedge', hard: 'cabin' };
const MAP_COPY = {
  lanes: ['长直道', '沿长廊对射，也可以从侧门绕过去。'],
  corners: ['连续拐角', '从多个入口穿过交叉区，利用墙角反弹。'],
  loop: ['环路', '双环之间有连接通道，适合迂回和换位。'],
  garden: ['石园回廊', '沿外圈石径绕行，在中部石墙之间找反弹角度。'],
  outpost: ['旷野工事', '利用错位工事挡弹，从上下两条侧路撤离或绕行。'],
};
const DIFFICULTY_COPY = {
  easy: ['简单', '反应较慢，主要用直射进攻。'],
  normal: ['普通', '会绕路逼近，也会利用墙面打反弹。'],
  hard: ['困难', '反应更快，会预判你的移动并躲避回弹。'],
};
const SKIN_COPY = {
  standard: ['标准型', '圆形炮塔与原版车身。'],
  wedge: ['楔形车身', '斜面装甲与收窄的车头。'],
  cabin: ['方舱车身', '宽履带与方形炮塔。'],
};
const PICKER_OPTIONS = {
  map: { title: '选择地图', copy: MAP_COPY, items: MAPS.map(({ id }) => id) },
  difficulty: { title: '选择难度', copy: DIFFICULTY_COPY, items: AI_DIFFICULTIES },
  skin: { title: '选择坦克外观', copy: SKIN_COPY, items: Object.keys(SKIN_COPY) },
};

const arena = byId('tank-arena');
const game = document.querySelector('.tank-game');
const scoreboard = document.querySelector('.tank-stage-header');
const scorePanel = document.querySelector('.tank-scoreboard');
const aiPanel = scorePanel.querySelector('.tank-score-ai');
const viewTools = document.querySelector('.tank-view-tools');
const renderer = createRenderer(byId('tank-board'));
const mapButton = byId('tank-map');
const difficultyButton = byId('tank-difficulty');
const skinButton = byId('tank-skin');
const picker = byId('tank-picker');
const pickerList = byId('tank-picker-list');
const pickerTitle = byId('tank-picker-title');
const overlay = byId('tank-overlay');
const overlayTitle = byId('tank-overlay-title');
const overlayNote = byId('tank-overlay-note');
const primaryButton = byId('tank-primary');
const secondaryButton = byId('tank-secondary');
const startButton = byId('tank-start');
const pauseButton = byId('tank-pause');
const stagePause = byId('tank-stage-pause');
const immersiveButton = byId('tank-immersive');
const restartButton = byId('tank-restart');
const touch = byId('tank-touch');
const stick = byId('tank-stick');
const fireButton = byId('tank-fire');
const scores = [byId('player-score'), byId('ai-score')];
const compactScore = byId('tank-compact-score');
function buildMeter(meter, max) {
  const pips = Array.from({ length: max }, () => document.createElement('i'));
  meter.setAttribute('aria-valuemax', max);
  meter.replaceChildren(...pips);
  return { meter, pips, value: null };
}

const healthMeters = ['player-health', 'ai-health'].map((id) => buildMeter(byId(id), MAX_HEALTH));
const ammoMeters = ['player-ammo', 'ai-ammo'].map((id) => buildMeter(byId(id), MAX_AMMO));
const roundLabel = byId('round-label');
const roundNote = byId('tank-round-note');
const roundSummary = roundLabel.parentElement;
const statsText = byId('tank-stats');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const sound = GameKit.bindSoundButton(byId('tank-sound'), SiteData.getSound());
let lastBounce = -Infinity;
let lastShieldSound = -Infinity;
let lastSpawnSound = -Infinity;
let lastEmptyClick = -Infinity;

function playTone(context, { from, to = from, duration, volume, type = 'sine', delay = 0 }) {
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.012, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function playEventSound(events) {
  if (!sound.isEnabled() || !events.length) return;
  const now = performance.now();
  const knockout = events.some(({ type }) => type === 'knockout');
  const impact = !knockout && events.some(({ type }) => type === 'hit');
  const shield = events.some(({ type }) => type === 'shield-block') && now - lastShieldSound > 80;
  const repaired = events.some(({ type }) => type === 'repair');
  const repairSpawn = !repaired && events.some(({ type }) => type === 'repair-spawn') && now - lastSpawnSound > 150;
  const fired = events.some(({ type }) => type === 'shot');
  const bounce = events.some(({ type }) => type === 'bounce') && now - lastBounce > 70;
  if (shield) lastShieldSound = now;
  if (repairSpawn) lastSpawnSound = now;
  if (bounce) lastBounce = now;
  if (!knockout && !impact && !shield && !repaired && !repairSpawn && !fired && !bounce) return;
  SiteData.withAudio((context) => {
    if (knockout) {
      playTone(context, { from: 155, to: 38, duration: 0.36, volume: 0.13, type: 'sawtooth' });
      playTone(context, { from: 95, to: 28, duration: 0.40, volume: 0.10, type: 'triangle', delay: 0.02 });
    } else if (impact) {
      playTone(context, { from: 175, to: 53, duration: 0.26, volume: 0.11, type: 'triangle' });
    }
    if (shield) {
      playTone(context, { from: 660, to: 920, duration: 0.09, volume: 0.065, type: 'triangle' });
    }
    if (repaired) {
      playTone(context, { from: 480, to: 520, duration: 0.08, volume: 0.085, type: 'sine', delay: 0 });
      playTone(context, { from: 640, to: 690, duration: 0.08, volume: 0.085, type: 'sine', delay: 0.06 });
      playTone(context, { from: 860, to: 920, duration: 0.12, volume: 0.09, type: 'sine', delay: 0.12 });
    } else if (repairSpawn) {
      playTone(context, { from: 520, duration: 0.075, volume: 0.065, type: 'sine', delay: 0.05 });
      playTone(context, { from: 740, duration: 0.11, volume: 0.065, type: 'sine', delay: 0.13 });
    }
    if (fired) playTone(context, { from: 270, to: 95, duration: 0.12, volume: 0.075, type: 'sine' });
    if (bounce) playTone(context, { from: 600, to: 390, duration: 0.055, volume: 0.036, type: 'sine' });
  });
}

function playEmptyClick() {
  if (!sound.isEnabled()) return;
  const now = performance.now();
  if (now - lastEmptyClick < 180) return;
  lastEmptyClick = now;
  SiteData.withAudio((context) => {
    playTone(context, { from: 220, to: 140, duration: 0.045, volume: 0.045, type: 'square' });
  });
}

function playOutcomeSound(kind) {
  if (!sound.isEnabled()) return;
  const sequences = {
    'round-win': [[523, 0], [659, 0.08], [784, 0.16]],
    'round-lose': [[340, 0], [260, 0.09], [195, 0.18]],
    draw: [[440, 0], [440, 0.11]],
    'match-win': [[523, 0], [659, 0.08], [784, 0.16], [1046, 0.25]],
    'match-lose': [[330, 0], [277, 0.09], [220, 0.18], [165, 0.28]],
  };
  const notes = sequences[kind];
  if (!notes) return;
  SiteData.withAudio((context) => {
    for (const [freq, delay] of notes) {
      playTone(context, {
        from: freq,
        duration: 0.14,
        volume: 0.085,
        type: kind.includes('lose') ? 'triangle' : 'sine',
        delay: 0.08 + delay,
      });
    }
  });
}

const settings = { map: MAPS[0].id, difficulty: 'normal', skin: 'standard' };
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  if (MAPS.some(({ id }) => saved?.map === id)) settings.map = saved.map;
  if (AI_DIFFICULTIES.includes(saved?.difficulty)) settings.difficulty = saved.difficulty;
  if (PICKER_OPTIONS.skin.items.includes(saved?.skin)) settings.skin = saved.skin;
} catch {}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

let match = createMatch(settings.map);
let ai = createAI(settings.difficulty);
let phase = 'ready';
let pickerKind = null;
let pickerOrigin = null;
let immersive = false;
let frameId = 0;
let lastFrame = 0;
let accumulator = 0;
let resolveTimer = 0;
let restarting = false;
let interruptions = 0;
let latestStats = readMatchStats(localStorage, settings.difficulty);

const movementKeys = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE',
]);
const neutral = { x: 0, y: 0 };
const pressed = new Set();
let stickPointer = null;
let firePointer = null;
let stickMove = neutral;
let queuedShot = false;

function clearInput() {
  pressed.clear();
  resetStick();
  firePointer = null;
  queuedShot = false;
  updateFire();
}

function getPlayerInput() {
  const x = Number(pressed.has('KeyD') || pressed.has('ArrowRight')) -
    Number(pressed.has('KeyA') || pressed.has('ArrowLeft'));
  const y = Number(pressed.has('KeyS') || pressed.has('ArrowDown')) -
    Number(pressed.has('KeyW') || pressed.has('ArrowUp'));
  const turn = (Number(pressed.has('KeyE')) - Number(pressed.has('KeyQ'))) * 0.72;
  const input = {
    move: x || y ? { x, y } : stickMove,
    turn,
    fire: queuedShot || pressed.has('Space') || firePointer !== null,
  };
  queuedShot = false;
  return input;
}

function roundMessage() {
  if (match.result.winner === null) return t('双方同时被击毁，本局不计分。');
  if (match.result.selfHit) {
    return match.result.winner === 1 ? t('你被自己的回弹击中。') : t('人机被自己的回弹击中。');
  }
  return match.result.winner === 0 ? t('你击中了人机坦克。') : t('你被人机的炮弹击中。');
}

function renderHealth() {
  healthMeters.forEach((indicator, id) => renderMeter(indicator, match.tanks[id].health));
}

function renderMeter(indicator, value) {
  if (indicator.value === value) return;
  indicator.value = value;
  indicator.meter.setAttribute('aria-valuenow', value);
  indicator.pips.forEach((pip, index) => pip.classList.toggle('filled', index < value));
}

function renderAmmo() {
  ammoMeters.forEach((indicator, id) => {
    const { ammo, reload } = match.tanks[id];
    const changed = indicator.value !== ammo;
    renderMeter(indicator, ammo);
    const progress = ammo < MAX_AMMO ? Math.max(0, Math.floor((1 - reload / rules.AMMO_RECHARGE) * 100)) : 0;
    if (changed) {
      indicator.pips.forEach((pip, index) => pip.classList.toggle('charging', index === ammo));
    }
    if (changed || progress !== indicator.progress) {
      indicator.progress = progress;
      indicator.meter.style.setProperty('--reload-progress', progress + '%');
    }
  });
  fireButton.classList.toggle('empty', match.tanks[0].ammo === 0);
}

function renderRoundNote() {
  const available = match.repair?.takenBy === null && !match.result;
  roundNote.textContent = available ? t('维修补给 +1') : t('三局两胜');
  roundNote.classList.toggle('available', available);
}

function renderStats() {
  if (!statsText) return;
  latestStats = readMatchStats(localStorage, settings.difficulty);
  statsText.textContent = t('累计胜场 {total} · {difficulty} {wins} 胜 · 最高连胜 {streak}', {
    total: latestStats.totalWins,
    difficulty: t(DIFFICULTY_COPY[settings.difficulty][0]),
    wins: latestStats.difficultyWins,
    streak: latestStats.bestStreak,
  });
}

function renderState() {
  arena.style.setProperty('--arena-ratio', String(arenaRatio(match.map)));
  game.dataset.phase = phase;
  const ready = phase === 'ready';
  if (immersive && !ready) {
    if (roundSummary.parentElement !== viewTools) viewTools.prepend(roundSummary);
  } else if (roundSummary.parentElement !== scorePanel) {
    scorePanel.insertBefore(roundSummary, aiPanel);
  }
  mapButton.disabled = difficultyButton.disabled = skinButton.disabled = !ready || !renderer;
  byId('tank-map-value').textContent = t(MAP_COPY[settings.map][0]);
  byId('tank-difficulty-value').textContent = t(DIFFICULTY_COPY[settings.difficulty][0]);
  byId('tank-skin-value').textContent = t(SKIN_COPY[settings.skin][0]);
  startButton.hidden = !ready;
  startButton.disabled = !renderer;
  restartButton.disabled = ready || phase === 'finished' || phase === 'resolving';
  for (const button of [pauseButton, stagePause]) {
    button.disabled = phase !== 'playing' && phase !== 'paused';
    button.dataset.i18n = phase === 'paused' ? '继续游戏' : '暂停';
    button.textContent = t(button.dataset.i18n);
  }
  stagePause.hidden = !immersive || stagePause.disabled;
  touch.hidden = phase !== 'playing';
  scores.forEach((score, id) => { score.textContent = match.scores[id]; });
  compactScore.textContent = match.scores.join(' – ');
  renderHealth();
  renderAmmo();
  roundLabel.textContent = t('第 {round} 局', { round: match.round });
  renderRoundNote();
  renderStats();
  overlay.hidden = ready || phase === 'playing' || phase === 'resolving';
  secondaryButton.hidden = phase !== 'paused' && phase !== 'finished';
  if (phase === 'paused') {
    secondaryButton.dataset.i18n = '返回设置';
    secondaryButton.textContent = t('返回设置');
    overlayTitle.textContent = t('已暂停');
    overlayNote.textContent = '';
    primaryButton.textContent = t('继续游戏');
  } else if (phase === 'round-end') {
    overlayTitle.textContent = match.result.winner === null ? t('本局平局')
      : match.result.winner === 0 ? t('你赢了本局') : t('人机赢了本局');
    overlayNote.textContent = roundMessage();
    primaryButton.textContent = t('下一局');
  } else if (phase === 'finished') {
    secondaryButton.dataset.i18n = '换图';
    secondaryButton.textContent = t('换图');
    overlayTitle.textContent = match.winner === 0 ? t('你赢了比赛') : t('人机赢了比赛');
    overlayNote.textContent = match.winner === 0
      ? t('{cause} · 最终比分 {player} 比 {ai} · {difficulty}胜场 {wins} · 连胜 {streak}', {
          cause: roundMessage(),
          player: match.scores[0],
          ai: match.scores[1],
          difficulty: t(DIFFICULTY_COPY[settings.difficulty][0]),
          wins: latestStats.difficultyWins,
          streak: latestStats.currentStreak,
        })
      : t('{cause} · 最终比分 {player} 比 {ai} · 累计胜场 {wins} 局', {
          cause: roundMessage(),
          player: match.scores[0],
          ai: match.scores[1],
          wins: latestStats.totalWins,
        });
    primaryButton.textContent = t('原图再战');
  }
}

function scheduleFrame() {
  if (!frameId) frameId = requestAnimationFrame(frame);
}

function settleMatchOutcome() {
  setPhase(match.winner === null ? 'round-end' : 'finished', primaryButton);
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
      if (match.result) {
        if (match.winner !== null) {
          latestStats = recordMatchStats(localStorage, settings.difficulty, match.winner === 0);
          playOutcomeSound(match.winner === 0 ? 'match-win' : 'match-lose');
        } else {
          playOutcomeSound(match.result.winner === null ? 'draw' : match.result.winner === 0 ? 'round-win' : 'round-lose');
        }
        renderHealth();
        renderAmmo();
        renderRoundNote();
        scores.forEach((score, id) => { score.textContent = match.scores[id]; });
        compactScore.textContent = match.scores.join(' – ');
        renderStats();
        if (reducedMotion.matches) {
          settleMatchOutcome();
        } else {
          clearInput();
          phase = 'resolving';
          resolveTimer = 0.46;
          renderState();
        }
        break;
      } else if (match.events.length) {
        if (match.events.some(({ type }) => type === 'hit' || type === 'repair')) renderHealth();
        if (match.events.some(({ type }) => type === 'repair-spawn' || type === 'repair')) renderRoundNote();
      }
    }
  } else if (phase === 'resolving') {
    resolveTimer -= elapsed;
    if (resolveTimer <= 0) settleMatchOutcome();
  }
  if (phase === 'playing') renderAmmo();
  renderer.draw(match, elapsed, {
    playerSkin: settings.skin,
    aiSkin: AI_SKIN_BY_DIFFICULTY[settings.difficulty] || 'standard',
    showAim: phase === 'playing',
  });
  if (phase === 'playing' || phase === 'resolving' || renderer.hasEffects()) scheduleFrame();
  else lastFrame = 0;
}

function setPhase(next, focusTarget) {
  clearInput();
  phase = next;
  accumulator = 0;
  lastFrame = 0;
  renderState();
  if (renderer) scheduleFrame();
  if (focusTarget === arena && !immersive) scoreboard.scrollIntoView({ block: 'nearest' });
  focusTarget?.focus({ preventScroll: true });
}

function startMatch() {
  if (!renderer) return;
  match = createMatch(settings.map);
  ai = createAI(settings.difficulty);
  renderer.clear();
  renderer.announceSpawn();
  setPhase('playing', arena);
}

function nextMatchRound() {
  nextRound(match);
  renderer.clear();
  renderer.announceSpawn();
  setPhase('playing', arena);
}

function pause({ focus = false } = {}) {
  if (phase === 'playing') setPhase('paused', focus ? primaryButton : null);
  else if (phase === 'resolving') settleMatchOutcome();
  else clearInput();
}

function resume() {
  if (phase !== 'paused' || document.hidden || SiteData.isDialogOpen() || GameKit.isTutorialOpen()) return;
  setPhase('playing', arena);
}

async function confirmRestart() {
  if (restarting || phase === 'ready' || phase === 'finished' || phase === 'resolving') return;
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

async function confirmReturnToSetup() {
  if (restarting || phase !== 'paused') return;
  restarting = true;
  const interruptionCount = interruptions;
  const confirmed = await SiteData.confirmDialog({
    title: t('返回设置'),
    message: t('离开当前对局并返回设置？当前比分会清零。'),
    confirmText: t('返回设置'),
  });
  restarting = false;
  if (confirmed) {
    match = createMatch(settings.map);
    renderer.clear();
    setPhase('ready', startButton);
  } else if (interruptions === interruptionCount) {
    primaryButton.focus({ preventScroll: true });
  }
}

function showTutorial(force) {
  GameKit.showTutorial({
    id: 'tank-maze', force,
    steps: [
      { icon: 'game-tank-maze', title: t('坦克迷宫'), text: t('每局双方各有 3 点血，先赢两局者获胜。每局交换出生侧。') },
      { icon: 'art-tap', title: t('驾驶'), text: t('用 WASD 或方向键移动，Q/E 原地微调炮口，空格开火。手机左侧摇杆移动，右侧开火。停下后炮口保留最后的朝向。') },
      { icon: 'art-target', title: t('弹药'), text: t('每辆坦克开局有三发。开火消耗一格，未满时每 {seconds} 秒回充一格。', { seconds: rules.AMMO_RECHARGE }) },
      { icon: 'art-target', title: t('炮弹反弹'), text: t('命中扣 1 点血，短时间内不会再扣血。自己的炮弹撞墙反弹后也可能打中自己。') },
      { icon: 'art-star', title: t('维修补给'), text: t('每局第一次有人受伤后，地图中部会出现一份维修补给。掉血的坦克可以拾取，恢复 1 点血。') },
    ],
  });
}

function togglePause() {
  if (phase === 'paused') resume();
  else pause({ focus: true });
}

function renderPicker() {
  const { title: heading, copy, items } = PICKER_OPTIONS[pickerKind];
  const visual = pickerKind !== 'difficulty';
  pickerTitle.textContent = t(heading);
  pickerList.classList.toggle('tank-picker-maps', pickerKind === 'map');
  pickerList.classList.toggle('tank-picker-skins', pickerKind === 'skin');
  pickerList.replaceChildren(...items.map((id, index) => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'tank-option';
    choice.dataset.option = id;
    choice.setAttribute('aria-pressed', settings[pickerKind] === id);
    const detail = document.createElement('span');
    detail.className = 'tank-option-detail';
    const title = document.createElement('strong');
    title.textContent = t(copy[id][0]);
    const description = document.createElement('span');
    description.textContent = t(copy[id][1]);
    detail.append(title, description);
    if (visual) {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.setAttribute('aria-hidden', 'true');
      if (pickerKind === 'map') {
        drawMapPreview(canvas, MAPS[index]);
      } else {
        canvas.height = 144;
        drawTankPreview(canvas, id);
      }
      choice.append(canvas);
    } else {
      const level = document.createElement('span');
      level.className = 'tank-option-level';
      level.setAttribute('aria-hidden', 'true');
      for (let i = 0; i <= index; i++) level.append(document.createElement('i'));
      choice.append(level);
    }
    choice.append(detail);
    return choice;
  }));
}

function openPicker(kind, trigger) {
  if (phase !== 'ready' || picker.open) return;
  pickerKind = kind;
  pickerOrigin = trigger;
  renderPicker();
  picker.showModal();
  document.body.classList.add('tank-picker-open');
  pickerList.querySelector('[aria-pressed="true"]')?.focus();
}

mapButton.addEventListener('click', () => openPicker('map', mapButton));
difficultyButton.addEventListener('click', () => openPicker('difficulty', difficultyButton));
skinButton.addEventListener('click', () => openPicker('skin', skinButton));
pickerList.addEventListener('click', (event) => {
  const option = event.target.closest('[data-option]');
  if (!option || phase !== 'ready') return;
  settings[pickerKind] = option.dataset.option;
  if (pickerKind === 'map') match = createMatch(settings.map);
  saveSettings();
  picker.close();
  renderState();
  if (renderer) scheduleFrame();
});
picker.addEventListener('click', (event) => {
  if (event.target !== picker) return;
  const { left, right, top, bottom } = picker.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) picker.close();
});
picker.addEventListener('close', () => {
  document.body.classList.remove('tank-picker-open');
  pickerKind = null;
  pickerOrigin?.focus({ preventScroll: true });
  pickerOrigin = null;
});

startButton.addEventListener('click', startMatch);
pauseButton.addEventListener('click', togglePause);
stagePause.addEventListener('click', togglePause);
restartButton.addEventListener('click', confirmRestart);
byId('tank-help').addEventListener('click', () => showTutorial(true));
primaryButton.addEventListener('click', () => {
  if (phase === 'paused') resume();
  else if (phase === 'round-end') nextMatchRound();
  else if (phase === 'finished') startMatch();
});
secondaryButton.addEventListener('click', () => {
  if (phase === 'paused') {
    confirmReturnToSetup();
    return;
  }
  match = createMatch(settings.map);
  renderer.clear();
  setPhase('ready');
  openPicker('map', mapButton);
});

document.addEventListener('keydown', (event) => {
  if (picker.open || GameKit.isTutorialOpen() || SiteData.isDialogOpen() ||
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
  if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat &&
      (phase === 'ready' || phase === 'round-end' || phase === 'finished')) {
    event.preventDefault();
    if (phase === 'ready') startMatch();
    else if (phase === 'round-end') nextMatchRound();
    else startMatch();
    return;
  }
  if (phase !== 'playing' || (!movementKeys.has(event.code) && event.code !== 'Space')) return;
  event.preventDefault();
  pressed.add(event.code);
  if (event.code === 'Space' && !event.repeat) {
    if (match.tanks[0].ammo === 0 && match.tanks[0].cooldown <= 0.02) playEmptyClick();
    else queuedShot = true;
  }
  updateFire();
});
document.addEventListener('keyup', (event) => {
  if (pressed.delete(event.code)) updateFire();
});

function updateFire() {
  fireButton.classList.toggle('active', pressed.has('Space') || firePointer !== null);
}

function positionStick(x, y) {
  stick.style.setProperty('--stick-x', x + 'px');
  stick.style.setProperty('--stick-y', y + 'px');
}

function resetStick() {
  stickPointer = null;
  stickMove = neutral;
  stick.classList.remove('active');
  positionStick(0, 0);
}

function moveStick(event) {
  const rect = stick.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const distance = Math.hypot(x, y);
  const travel = rect.width * 0.29;
  if (!travel || !distance) {
    stickMove = neutral;
    positionStick(0, 0);
    return;
  }
  const thumbScale = Math.min(1, travel / distance);
  positionStick(x * thumbScale, y * thumbScale);
  const deadzone = 0.14;
  const force = Math.max(0, (Math.min(1, distance / travel) - deadzone) / (1 - deadzone));
  stickMove = { x: x / distance * force, y: y / distance * force };
}

stick.addEventListener('pointerdown', (event) => {
  if (phase !== 'playing' || event.button !== 0 || stickPointer !== null) return;
  event.preventDefault();
  stickPointer = event.pointerId;
  stick.setPointerCapture(event.pointerId);
  stick.classList.add('active');
  moveStick(event);
});
stick.addEventListener('pointermove', (event) => {
  if (event.pointerId === stickPointer) moveStick(event);
});
fireButton.addEventListener('pointerdown', (event) => {
  if (phase !== 'playing' || event.button !== 0 || firePointer !== null) return;
  event.preventDefault();
  firePointer = event.pointerId;
  fireButton.setPointerCapture(event.pointerId);
  if (match.tanks[0].ammo === 0 && match.tanks[0].cooldown <= 0.02) playEmptyClick();
  else queuedShot = true;
  updateFire();
});
for (const eventType of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stick.addEventListener(eventType, (event) => {
    if (event.pointerId === stickPointer) resetStick();
  });
  fireButton.addEventListener(eventType, (event) => {
    if (event.pointerId !== firePointer) return;
    firePointer = null;
    updateFire();
  });
}

function pauseForInterruption() {
  interruptions += 1;
  pause();
}

GameKit.onHidden(pauseForInterruption);
window.addEventListener('blur', pauseForInterruption);
window.addEventListener('pagehide', pauseForInterruption);
document.addEventListener('site:dialogopen', () => pause());
document.addEventListener('i18n:change', () => {
  renderState();
  if (picker.open) renderPicker();
});
document.addEventListener('theme:change', () => {
  if (renderer) scheduleFrame();
  if (picker.open && pickerKind !== 'difficulty') renderPicker();
});
GameKit.bindMobileLayout('tank-maze', immersiveButton, pauseForInterruption, {
  landscapeOnly: true,
  defaultLandscape: false,
  onRotateHint() {
    SiteData.alertDialog({
      title: t('横屏沉浸'),
      message: t('将手机转为横屏，再点「横屏沉浸」，即可把棋盘放到两个触控之间。'),
    });
  },
  onRender(enabled) {
    immersive = enabled;
    renderState();
    if (renderer) scheduleFrame();
  },
});
if (renderer) {
  if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleFrame).observe(arena);
  else window.addEventListener('resize', scheduleFrame);
  scheduleFrame();
} else {
  byId('tank-unavailable').hidden = false;
}
renderState();
if (renderer) showTutorial(false);
