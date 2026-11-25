import {
  W, H, BOSS_WAVE_INTERVAL, BOSS_KINDS, BOSS_HP_SCALE, BOSS_ENTRY_SPEED,
  BOSS_BEAM_LENGTH, BOSS_CAMP_SECONDS, BOSS_CAMP_RADIUS, BOSS_COUNTER_WARNING,
  MAX_WEAPON_LEVEL, BLAST_AMMO_PER_PICKUP, BLAST_INTERVAL, BLAST_SPEED,
  BLAST_RADIUS, BLAST_DAMAGE, MOTHERSHIP_DEPLOY_SECONDS, MOTHERSHIP_DODGE_SECONDS,
  MOTHERSHIP_LASER_LOCK_SECONDS, PRISM_BEAM_WIDTH, PRISM_MIRROR_BEAM_WIDTH,
  PRISM_REFLECT_WARNING, PRISM_REFLECT_RADIUS, PRISM_REFLECT_ASPECT,
  PRISM_REFLECT_PANELS, PRISM_REFLECT_INTERVAL, PRISM_REFLECT_MAX_BOLTS,
  PRISM_MIRROR_DEPLOY_SECONDS, PRISM_PHASE_TWO_ATTACKS, PRISM_MIRROR_ATTACKS,
  CRIMSON_GUARD_OFFSET, CRIMSON_GUARD_HALF_WIDTH, CRIMSON_SCATTER_ANGLES,
  MAX_PARTICLES, OVERDRIVE_SECONDS, OVERDRIVE_END_CUE, PICKUP_CUE_SECONDS,
  SKINS, PICKUP_THEMES, SPACE_SCENES,
  getBossKind, getBossName, buildWaveQueue, computeBossLasers,
  mothershipShieldLinks, crimsonDashEnd, openingEnemyShots, prismBeam,
  bulletCrossesCircle, ellipseImpactTime, fastRockOverlaps,
  beamHitsPlayer, bossHullImpactTime,
} from './rules.js';
import { createSpaceAudio } from './audio.js';
import { createSpaceRenderer } from './renderer.js';
import { createBossController } from './boss.js';

const t = (key, params) => window.I18N.t(key, params);
const MODE_KEY = 'game_mode_space';
const SKIN_KEY = 'game_skin_space';
const BOSS_SEEN_PREFIX = 'game_save_space_boss_seen_';
const BEST_KEYS = {
  standard: 'game_best_space_standard',
  ace: 'game_best_space_ace',
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-el');
const waveEl = document.getElementById('wave-el');
const waveLabelEl = document.getElementById('wave-label');
const bestEl = document.getElementById('best-el');
const armorEl = document.getElementById('armor-el');
const armorCountEl = document.getElementById('armor-count');
const shieldBadge = document.getElementById('shield-badge');
const weaponBadge = document.getElementById('weapon-badge');
const blastBadge = document.getElementById('blast-badge');
const overdriveBadge = document.getElementById('overdrive-badge');
const battleWave = document.getElementById('battle-wave');
const bossBarWrap = document.getElementById('boss-bar-wrap');
const bossBarTrack = document.getElementById('boss-bar-track');
const bossNameEl = document.getElementById('boss-name');
const bossBarFill = document.getElementById('boss-bar-fill');
const bossHpText = document.getElementById('boss-hp-text');
const bossPhaseLabel = document.getElementById('boss-phase-label');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const overlaySummary = document.getElementById('overlay-summary');
const overlayStats = document.getElementById('overlay-stats');
const bossClearsEl = document.getElementById('overlay-boss-clears');
const bossTargetEl = document.getElementById('overlay-boss-target');
const overlayBtn = document.getElementById('overlay-btn');
const practiceMenu = document.getElementById('practice-menu');
const practiceMenuBtn = document.getElementById('practice-menu-btn');
const practiceBackBtn = document.getElementById('practice-back-btn');
const practiceChoices = [...practiceMenu.querySelectorAll('[data-practice-tier]')];
const gameWrap = document.querySelector('.game-wrap');
const modePills = document.querySelector('.mode-pills');
const flightOptions = document.getElementById('flight-options');
const pauseBtn = document.getElementById('pause-btn');
const soundBtn = document.getElementById('sound-btn');
const helpBtn = document.getElementById('help-btn');
const restartBtn = document.getElementById('restart-btn');
const empBtn = document.getElementById('emp-btn');
const empCountEl = document.getElementById('emp-count');
const modeStandardBtn = document.getElementById('mode-standard');
const modeAceBtn = document.getElementById('mode-ace');
const skinBtns = Array.from(document.querySelectorAll('.skin-pill'));

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

let campaignMode = readStored(MODE_KEY, 'standard');
if (campaignMode !== 'standard' && campaignMode !== 'ace') campaignMode = 'standard';
let mode = campaignMode;
let practiceTier = 0;
let practiceMenuOpen = false;
const seenBosses = new Set();

function hasSeenBoss(kind) {
  return seenBosses.has(kind) || readStored(BOSS_SEEN_PREFIX + kind, '') === '1';
}

function recordBossEncounter(kind) {
  if (hasSeenBoss(kind)) return;
  seenBosses.add(kind);
  writeStored(BOSS_SEEN_PREFIX + kind, '1');
}

let skin = readStored(SKIN_KEY, 'cobalt');
if (!Object.prototype.hasOwnProperty.call(SKINS, skin)) skin = 'cobalt';

let soundEnabled = window.SiteData ? SiteData.getSound() : true;
GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
});

const {
  playWeaponAccent,
  playShoot,
  playHit,
  playExplode,
  playPowerup,
  playEmp,
  playBossAlert,
  playPlayerHit,
  playBossLaserCharge,
  playBossLaserFire,
  playWaveClear,
  playPrismReflectCue,
  playComboMilestone,
} = createSpaceAudio({
  isEnabled: () => soundEnabled,
  getSkin: () => skin,
});

// DPR 高清适配
function syncCanvasDpr() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
syncCanvasDpr();
window.addEventListener('resize', syncCanvasDpr);

// 视差星空、星云、远景行星与流星
const stars = [];
for (let i = 0; i < 95; i += 1) {
  const layer = i < 45 ? 1 : (i < 78 ? 2 : 3);
  stars.push({
    x: Math.random() * W,
    y: Math.random() * H,
    r: layer === 1 ? 0.9 : (layer === 2 ? 1.4 : 2.1),
    speed: layer === 1 ? 26 : (layer === 2 ? 58 : 115),
    alpha: layer === 1 ? 0.35 : (layer === 2 ? 0.6 : 0.9),
    tint: i % 9 === 0 ? '#93c5fd' : (i % 13 === 0 ? '#fde68a' : '#ffffff'),
  });
}

let sceneIndex = 0;
let previousScene = 0;
let sceneBlend = 1;
let backgroundTime = 0;
let meteors = [];
let meteorTimer = 3.5;

// 游戏状态
let state = 'ready'; // 'ready' | 'playing' | 'paused' | 'over'
let interruptionCount = 0;
let score = 0;
let wave = 1;
let bestStandard = GameKit.readBest(BEST_KEYS.standard);
let bestAce = GameKit.readBest(BEST_KEYS.ace);
let newBest = false;
let kills = 0;
const defeatedBosses = new Map();
let combo = 0;
let comboTimer = 0;
let maxCombo = 0;
let bossAlertAlpha = 0;
let bossIntroHint = '';

// 自机状态
const player = {
  x: W * 0.5,
  y: H - 72,
  prevX: W * 0.5,
  bank: 0,
  hp: 3,
  maxHp: 3,
  weaponLv: 1,
  hasShield: false,
  empCharges: 2,
  invulnTimer: 0,
  overdriveTimer: 0,
  fireCd: 0,
  blastAmmo: 0,
  blastCd: 0,
};

// 波次与实体
let spawnQueue = [];
let waveSpawnTimer = 0;
let waveBanner = '';
let waveBannerTimer = 0;
let empWave = null;
let empCooldown = 0;
let boss = null;
let bossSupplyTimer = 0;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let pickups = [];
let pickupCue = null;
let particles = [];
let debris = [];
let muzzleFlashes = [];
let afterimages = [];
let afterimageCd = 0;
let shockwaves = [];
let floatTexts = [];
let shakeTimer = 0;
let shakeMag = 0;
let flashAlpha = 0;
let flashColor = '#ffffff';

// 输入状态
const keys = Object.create(null);
let activeTouchId = null;
let touchLastPt = null;
let mouseTarget = null;

function clearKeys() {
  for (const k of Object.keys(keys)) keys[k] = false;
}

function currentBest() {
  return mode === 'standard' ? bestStandard : bestAce;
}

function updateBest(val) {
  if (mode === 'standard') {
    if (val > bestStandard) {
      bestStandard = val;
      GameKit.saveBestIfHigher(BEST_KEYS.standard, val);
      return true;
    }
  } else if (val > bestAce) {
    bestAce = val;
    GameKit.saveBestIfHigher(BEST_KEYS.ace, val);
    return true;
  }
  return false;
}

function renderHud() {
  scoreEl.textContent = score;
  waveEl.textContent = wave;
  bestEl.textContent = currentBest();
  battleWave.hidden = Boolean(boss);
  const waveLabel = t('第 {w} 波', { w: wave });
  if (battleWave.textContent !== waveLabel) battleWave.textContent = waveLabel;

  armorEl.setAttribute('aria-label', t('剩余护甲：{hp}', { hp: player.hp }));
  armorEl.setAttribute('aria-valuemax', String(player.maxHp));
  armorEl.setAttribute('aria-valuenow', String(player.hp));
  const armorCount = t('护甲 {hp}/{max}', { hp: player.hp, max: player.maxHp });
  if (armorCountEl.textContent !== armorCount) armorCountEl.textContent = armorCount;
  if (armorEl.childElementCount !== player.maxHp) {
    armorEl.textContent = '';
    for (let i = 0; i < player.maxHp; i += 1) {
      const pip = document.createElement('span');
      pip.className = 'armor-pip' + (i >= player.hp ? ' lost' : '');
      armorEl.appendChild(pip);
    }
  } else {
    for (let i = 0; i < player.maxHp; i += 1) {
      armorEl.children[i].classList.toggle('lost', i >= player.hp);
    }
  }

  shieldBadge.hidden = !player.hasShield;
  weaponBadge.textContent = t('主炮 Lv.{lv}', { lv: player.weaponLv });
  blastBadge.hidden = player.blastAmmo === 0;
  if (player.blastAmmo > 0) {
    const label = t('爆破弹 ×{ammo}', { ammo: player.blastAmmo });
    if (blastBadge.textContent !== label) blastBadge.textContent = label;
  }

  overdriveBadge.classList.toggle('ending', player.overdriveTimer > 0 && player.overdriveTimer <= OVERDRIVE_END_CUE);
  if (player.overdriveTimer > 0) {
    overdriveBadge.hidden = false;
    const remaining = (Math.ceil(player.overdriveTimer * 10) / 10).toFixed(1);
    const label = t('免伤 {sec}s', { sec: remaining });
    if (overdriveBadge.textContent !== label) overdriveBadge.textContent = label;
    overdriveBadge.style.setProperty('--remaining', (100 * player.overdriveTimer / OVERDRIVE_SECONDS) + '%');
  } else {
    overdriveBadge.hidden = true;
  }

  if (boss) {
    bossBarWrap.hidden = false;
    const name = getBossName(boss.kind, true, t);
    if (bossNameEl.textContent !== name) bossNameEl.textContent = name;
    const pct = Math.max(0, Math.min(100, Math.round((boss.hp / boss.maxHp) * 100)));
    if (bossHpText.textContent !== pct + '%' || bossBarFill.style.width === '') {
      bossBarFill.style.width = pct + '%';
      bossHpText.textContent = pct + '%';
      bossBarTrack.setAttribute('aria-valuenow', String(pct));
    }
  } else {
    bossBarWrap.hidden = true;
  }

  if (boss) {
    const phase = String(boss.phase);
    if (bossBarWrap.dataset.phase !== phase) bossBarWrap.dataset.phase = phase;
    if (bossBarWrap.dataset.kind !== boss.kind) bossBarWrap.dataset.kind = boss.kind;
    let phaseLabel = t('阶段 {phase}/2', { phase: boss.phase });
    let cue = '';
    const attack = boss.prismAttack;
    if (boss.maneuver === 'transform') phaseLabel = t('相位转换 · 无敌');
    else if (boss.campCounter) phaseLabel = t('锁定预警 · 移动躲避');
    else if (boss.maneuver === 'reflect-warn') phaseLabel = t('镜面护甲展开中');
    else if (boss.maneuver === 'reflect') phaseLabel = t('镜面护甲 · 小心反弹');
    else if (attack?.step === 'sweep-warn' || attack?.step === 'warn') {
      phaseLabel = attack.step === 'warn' ? t('晶弹齐射预警') : attack.sweep.secondPass ? t('折返预警') : t('扫射预警');
      if (boss.prismMirror) {
        phaseLabel = t('{source} · {warning}', { source: attack.fromMirror ? t('镜像') : t('本体'), warning: phaseLabel });
      }
    } else if (boss.maneuver === 'mirror') phaseLabel = t('镜像交错火力');
    else if (boss.laserState === 'telegraph') {
      phaseLabel = boss.laserTimer > MOTHERSHIP_LASER_LOCK_SECONDS
        ? t('双轨激光 · 正在瞄准')
        : t('激光锁定 · 离开亮带');
      cue = 'dodge';
    } else if (boss.laserState === 'fire') {
      phaseLabel = t('双轨激光 · 避开光束');
      cue = 'dodge';
    } else if (boss.maneuver === 'dash-warn') {
      phaseLabel = boss.dashPass === 2 ? t('折返突进 · 横向躲避') : t('突进预警 · 横向躲避');
      cue = 'dodge';
    }
    else if (boss.maneuver === 'scatter-warn') phaseLabel = t('侧翼散射预警');
    else if (boss.maneuver === 'deploy') phaseLabel = t('部署供盾护卫');
    else if (boss.maneuver === 'recover') {
      if (boss.kind === 'crimson' && boss.guard) {
        phaseLabel = player.empCharges > 0 ? t('护卫挡弹 · 脉冲可破') : t('护卫挡弹 · 先击破护卫');
        cue = 'guard';
      } else {
        if (boss.kind === 'crimson') phaseLabel = t('反击窗口 · 瞄准本体');
        else if (boss.kind === 'mothership') phaseLabel = t('核心暴露 · 攻击母舰');
        else phaseLabel = t('核心暴露');
        cue = 'attack';
      }
    } else if (boss.supports?.length) {
      const jammed = boss.supportJam > 0;
      phaseLabel = jammed
        ? t('供盾中断 · 攻击母舰')
        : t('护卫供盾 {count}/2 · 先打护卫', { count: boss.supports.length });
      cue = jammed ? 'attack' : 'guard';
    } else if (bossIntroHint && boss.y < boss.targetY) {
      phaseLabel = bossIntroHint;
    }
    if (bossPhaseLabel.textContent !== phaseLabel) bossPhaseLabel.textContent = phaseLabel;
    if (bossPhaseLabel.dataset.cue !== cue) bossPhaseLabel.dataset.cue = cue;
    bossPhaseLabel.hidden = false;
  } else {
    if (bossBarWrap.dataset.phase) delete bossBarWrap.dataset.phase;
    if (bossBarWrap.dataset.kind) delete bossBarWrap.dataset.kind;
    bossPhaseLabel.hidden = true;
  }

  empCountEl.textContent = '×' + player.empCharges;
  empBtn.disabled = state !== 'playing' || player.empCharges <= 0 || empCooldown > 0 || boss?.maneuver === 'transform';

  pauseBtn.disabled = state !== 'playing' && state !== 'paused';
  pauseBtn.textContent = t(state === 'paused' ? '继续' : '暂停');
}

function renderBossSummary() {
  const clearedNames = Array.from(defeatedBosses, ([kind, count]) => {
    const name = getBossName(kind, false, t);
    return count > 1 ? `${name} ×${count}` : name;
  });
  bossClearsEl.textContent = clearedNames.length
    ? t('本局击破 Boss：{names}', { names: clearedNames.join(' · ') })
    : t('本局尚未击破 Boss');

  const tier = Math.ceil(wave / BOSS_WAVE_INTERVAL);
  const bossWave = tier * BOSS_WAVE_INTERVAL;
  const remaining = bossWave - wave;
  const target = { wave: bossWave, name: getBossName(getBossKind(tier), false, t), remaining };
  bossTargetEl.textContent = remaining > 0
    ? t('再过 {remaining} 波迎战{name}（第 {wave} 波）', target)
    : t('下次目标：第 {wave} 波 · {name}', target);
}

function renderOverlay() {
  const practicing = practiceTier > 0;
  const choosingPractice = practiceMenuOpen;
  gameWrap.toggleAttribute('data-practice', practicing);
  modePills.hidden = practicing;
  bestEl.parentElement.hidden = practicing;
  waveLabelEl.dataset.i18n = practicing ? '练习波次' : '当前波次';
  waveLabelEl.textContent = t(waveLabelEl.dataset.i18n);
  practiceMenu.hidden = !choosingPractice;
  practiceMenuBtn.hidden = practicing || choosingPractice || (state !== 'ready' && state !== 'over');
  practiceBackBtn.hidden = !choosingPractice && !(practicing && state === 'over');
  overlayBtn.hidden = choosingPractice;
  overlaySummary.hidden = state !== 'over' || practicing || choosingPractice;
  flightOptions.hidden = choosingPractice;
  restartBtn.disabled = choosingPractice;
  if (state === 'playing') {
    const moveFocus = overlay.contains(document.activeElement);
    flightOptions.open = false;
    overlay.classList.remove('show');
    if (moveFocus) pauseBtn.focus({ preventScroll: true });
    return;
  }
  overlay.classList.add('show');
  if (choosingPractice) {
    overlayTitle.textContent = t('Boss 练习');
    overlayDesc.textContent = t('标准难度 · 3 点护甲 · Lv.4 主炮 · 2 次脉冲');
    practiceBackBtn.textContent = state === 'over' ? t('返回结算') : t('返回开局');
    for (const choice of practiceChoices) {
      const tier = Number(choice.dataset.practiceTier);
      const kind = getBossKind(tier);
      const name = getBossName(kind, false, t);
      choice.disabled = !hasSeenBoss(kind);
      choice.textContent = choice.disabled
        ? t('{name} · 第 {wave} 波遇到后解锁', { name, wave: tier * BOSS_WAVE_INTERVAL })
        : name;
    }
  } else if (state === 'ready') {
    overlayTitle.textContent = t('太空战机');
    overlayDesc.textContent = t(mode === 'standard'
      ? '标准闯关：3 点护甲起步，升级主炮、释放脉冲清弹，每 5 波迎战星际 Boss！'
      : '王牌极速：初始 Lv.2 主炮、弹幕更密集、得分 1.5 倍加成，挑战极限操作！');
    overlayBtn.textContent = t('开始游戏');
  } else if (state === 'paused') {
    overlayTitle.textContent = t('已暂停');
    overlayDesc.textContent = t('当前得分：{score}', { score });
    overlayBtn.textContent = t('继续游戏');
  } else if (state === 'over' && practicing) {
    const kind = getBossKind(practiceTier);
    overlayTitle.textContent = defeatedBosses.has(kind) ? t('练习成功') : t('战机坠毁');
    overlayDesc.textContent = t('练习对象：{name} · 得分：{score}', { name: getBossName(kind, false, t), score });
    overlayBtn.textContent = t('重试');
    practiceBackBtn.textContent = t('返回选择');
  } else if (state === 'over') {
    overlayTitle.textContent = t('战机坠毁');
    const suffix = newBest ? t('（新纪录！）') : '';
    overlayDesc.textContent = t('本局得分：{score}（本模式最高：{best}）', {
      score,
      best: currentBest(),
    }) + suffix;
    overlayStats.textContent = t('击毁 {kills} 架 · 抵达第 {wave} 波 · 最高 {combo} 连击', {
      kills,
      wave,
      combo: maxCombo,
    });
    renderBossSummary();
    overlayBtn.textContent = t('再来一局');
  }
}

function syncModeButtons() {
  modeStandardBtn.classList.toggle('active', mode === 'standard');
  modeAceBtn.classList.toggle('active', mode === 'ace');
  skinBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.skin === skin);
  });
}

function normalWaveBanner(num) {
  if (num === 2) return t('第 2 波 · 躲避瞄准弹');
  if (num === 3) return t('第 3 波 · 留意侧翼拦截');
  if (num === 4) return t('第 4 波 · 从散射间隙穿过');
  if (mode === 'standard' && num === 7) return t('第 7 波 · 留意交叉夹击');
  if (mode === 'standard' && num === 9) return t('第 9 波 · 炮艇护送');
  return t('第 {w} 波', { w: num });
}

function startWave(num) {
  wave = num;
  bossIntroHint = wave === BOSS_WAVE_INTERVAL ? t('留意突进预警，向两侧躲避') : '';
  const nextScene = Math.floor((num - 1) / BOSS_WAVE_INTERVAL) % SPACE_SCENES.length;
  if (nextScene !== sceneIndex) {
    previousScene = sceneIndex;
    sceneIndex = nextScene;
    sceneBlend = 0;
  }
  if (wave % BOSS_WAVE_INTERVAL === 0) {
    spawnQueue = [];
    waveSpawnTimer = 0;
    bossSupplyTimer = 9.5;
    bossAlertAlpha = 1;
    spawnBoss(wave / BOSS_WAVE_INTERVAL);
    if (!practiceTier) recordBossEncounter(boss.kind);
    waveBanner = t('⚠ 第 {w} 波 · {name}', { w: wave, name: boss.name });
    waveBannerTimer = 2.6;
    playBossAlert();
  } else {
    spawnQueue = buildWaveQueue(wave, mode);
    waveSpawnTimer = 0.22;
    bossSupplyTimer = 0;
    waveBanner = normalWaveBanner(wave);
    waveBannerTimer = 1.5;
    if (wave === 4) spawnPickup('blast', W * 0.5, H * 0.42);
  }
}

function resetState(nextState) {
  state = nextState;
  score = 0;
  wave = 1;
  sceneIndex = 0;
  previousScene = 0;
  sceneBlend = 1;
  backgroundTime = 0;
  meteors = [];
  meteorTimer = 3.5;
  newBest = false;
  kills = 0;
  defeatedBosses.clear();
  combo = 0;
  comboTimer = 0;
  maxCombo = 0;

  player.x = W * 0.5;
  player.y = H - 72;
  player.prevX = player.x;
  player.bank = 0;
  player.hp = 3;
  player.maxHp = 3;
  player.weaponLv = practiceTier ? 4 : mode === 'ace' ? 2 : 1;
  player.hasShield = false;
  player.empCharges = 2;
  player.invulnTimer = 0;
  player.overdriveTimer = 0;
  player.fireCd = 0;
  player.blastAmmo = 0;
  player.blastCd = 0;

  boss = null;
  bullets = [];
  enemyBullets = [];
  enemies = [];
  pickups = [];
  pickupCue = null;
  particles = [];
  debris = [];
  muzzleFlashes = [];
  afterimages = [];
  afterimageCd = 0;
  shockwaves = [];
  floatTexts = [];
  empWave = null;
  empCooldown = 0;
  shakeTimer = 0;
  flashAlpha = 0;
  bossAlertAlpha = 0;
  bossIntroHint = '';
  bossSupplyTimer = 0;
  activeTouchId = null;
  touchLastPt = null;
  mouseTarget = null;
  clearKeys();

  if (nextState === 'playing') {
    startWave(practiceTier ? practiceTier * BOSS_WAVE_INTERVAL : 1);
  } else {
    spawnQueue = [];
    waveBanner = '';
    waveBannerTimer = 0;
  }

  renderHud();
  renderOverlay();
}

function startGame() {
  if (practiceMenuOpen) return;
  resetState('playing');
}

function openPracticeMenu() {
  if (state !== 'ready' && state !== 'over') return;
  practiceMenuOpen = true;
  if (practiceTier) {
    practiceTier = 0;
    mode = campaignMode;
    syncModeButtons();
    resetState('ready');
  } else {
    renderOverlay();
  }
  (practiceChoices.find((choice) => !choice.disabled) || practiceBackBtn).focus();
}

function startPractice(tier) {
  const kind = BOSS_KINDS[tier - 1];
  if (!practiceMenuOpen || !kind || !hasSeenBoss(kind)) return;
  practiceMenuOpen = false;
  practiceTier = tier;
  mode = 'standard';
  startGame();
}

function endGame() {
  if (state === 'over') return;
  state = 'over';
  newBest = !practiceTier && updateBest(score);
  activeTouchId = null;
  touchLastPt = null;
  mouseTarget = null;
  clearKeys();
  renderHud();
  renderOverlay();
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  activeTouchId = null;
  touchLastPt = null;
  mouseTarget = null;
  clearKeys();
  renderHud();
  renderOverlay();
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  renderHud();
  renderOverlay();
}

function pauseForInterruption() {
  interruptionCount += 1;
  pauseGame();
}

function bindImmersiveLayout() {
  const options = document.getElementById('flight-options-content');
  const controls = [
    modeStandardBtn.parentElement, soundBtn, helpBtn, restartBtn,
    skinBtns[0].parentElement, document.querySelector('.space-legend'),
  ].map((control) => {
    const anchor = document.createComment('flight option');
    control.before(anchor);
    return { control, anchor };
  });
  let immersive = false;
  GameKit.bindMobileLayout('space', document.getElementById('immersive-btn'), pauseForInterruption, {
    portraitOnly: true,
    onRender(active) {
      if (active === immersive) return;
      immersive = active;
      for (const { control, anchor } of controls) {
        if (active) options.appendChild(control);
        else anchor.after(control);
      }
    },
  });
}

async function confirmAbandonIfActive(switchingMode = false) {
  if (SiteData.isDialogOpen()) return false;
  if (state !== 'playing' && state !== 'paused') return true;

  const wasPlaying = state === 'playing';
  const previousInterruptions = interruptionCount;
  pauseGame();
  const confirmed = await SiteData.confirmDialog({
    title: switchingMode ? t('切换模式') : t('重开本局'),
    message: switchingMode ? t('切换模式会结束当前飞行。') : t('当前进度将被清除，确定重开吗？'),
    confirmText: switchingMode ? t('切换') : t('重开'),
    cancelText: wasPlaying ? t('继续本局') : t('取消'),
    danger: true,
  });
  if (!confirmed && wasPlaying && !document.hidden && interruptionCount === previousInterruptions) {
    resumeGame();
  }
  return confirmed;
}

// 特效辅助
function pushParticle(p) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
}

function addFloatText(x, y, text, color, scale) {
  floatTexts.push({
    x: Math.max(48, Math.min(W - 48, x)),
    y: Math.max(36, Math.min(H - 36, y)),
    text,
    color: color || '#fde047',
    scale: scale || 1,
    life: 0.75,
    maxLife: 0.75,
  });
}

function triggerShake(mag, time) {
  shakeMag = Math.max(shakeMag, mag);
  shakeTimer = Math.max(shakeTimer, time);
}

function spawnExplosion(x, y, color, count, radius, debrisCount, blast = false) {
  const life = blast ? 0.50 : 0.30;
  shockwaves.push({
    x,
    y,
    r: 8,
    maxR: radius || 46,
    color,
    life,
    maxLife: life,
    blast,
  });
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const spd = 55 + Math.random() * 195;
    pushParticle({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: 1.8 + Math.random() * 3.4,
      color: i % 3 === 0 ? '#ffffff' : color,
      life: 0.28 + Math.random() * 0.28,
      maxLife: 0.56,
    });
  }
  const shards = debrisCount == null ? Math.min(8, Math.max(3, Math.floor(count / 4))) : debrisCount;
  for (let i = 0; i < shards; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const spd = 65 + Math.random() * 155;
    debris.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      w: 4 + Math.random() * 6,
      h: 2.5 + Math.random() * 3.5,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 14,
      color: i % 2 === 0 ? color : '#cbd5e1',
      life: 0.45 + Math.random() * 0.3,
      maxLife: 0.75,
    });
  }
}

function addScore(basePts) {
  const modeMult = mode === 'ace' ? 1.5 : 1;
  const comboMult = combo >= 12 ? 1.5 : (combo >= 6 ? 1.25 : 1);
  const pts = Math.round(basePts * modeMult * comboMult);
  score += pts;
  return pts;
}

// 敌机与 Boss 生成
function createAsteroidPolygon(r, rockStyle) {
  const pts = [];
  const shard = rockStyle === 'shard';
  const n = shard ? 6 : 9;
  for (let i = 0; i < n; i += 1) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const dist = r * (0.75 + Math.random() * 0.25);
    pts.push({ x: Math.cos(a) * dist * (shard ? 0.72 : 1), y: Math.sin(a) * dist });
  }
  return pts;
}

function spawnEnemyAt(spec) {
  const kind = (spec && spec.kind) || 'scout';
  const aceBoost = mode === 'ace' ? 1 : 0;
  const hpScale = 1 + Math.floor((wave - 1) / 3) * 0.42 + aceBoost * 0.25;
  const fireScale = Math.max(0.56, 1 - wave * 0.032 - aceBoost * 0.14);

  if (kind === 'scout') {
    const hp = Math.max(1, Math.round(1.0 * hpScale));
    enemies.push({
      kind,
      x: spec.x != null ? Math.max(28, Math.min(W - 28, spec.x)) : 34 + Math.random() * (W - 68),
      y: spec.y != null ? spec.y : -26,
      vx: spec.x != null ? 0 : (Math.random() - 0.5) * 58,
      vy: 138 + wave * 5.5 + aceBoost * 22,
      r: 15,
      hp,
      maxHp: hp,
      pts: 18,
      fireCd: (wave >= 4 ? (0.9 + Math.random() * 0.9) : (1.5 + Math.random() * 1.1)) * fireScale,
      hitFlash: 0,
      phase: Math.random() * Math.PI * 2,
    });
  } else if (kind === 'interceptor') {
    const hp = Math.round(2.4 * hpScale);
    enemies.push({
      kind,
      x: spec.x != null ? Math.max(36, Math.min(W - 36, spec.x)) : 44 + Math.random() * (W - 88),
      y: spec.y != null ? spec.y : -30,
      vx: 0,
      vy: 96 + wave * 4 + aceBoost * 16,
      r: 18,
      hp,
      maxHp: hp,
      pts: 32,
      fireCd: spec.lesson ? 0.44 : (0.65 + Math.random() * 0.65) * fireScale,
      lesson: spec.lesson,
      entryX: spec.x,
      entrySide: spec.side,
      lockTimer: 0,
      lockAngle: Math.PI * 0.5,
      hitFlash: 0,
      phase: Math.random() * Math.PI * 2,
    });
  } else if (kind === 'drone') {
    const hp = Math.round(3 * hpScale);
    enemies.push({
      kind,
      x: spec.x != null ? Math.max(34, Math.min(W - 34, spec.x)) : 40 + Math.random() * (W - 80),
      y: spec.y != null ? spec.y : -30,
      targetY: 85 + Math.random() * 95,
      vx: (Math.random() < 0.5 ? -1 : 1) * (42 + wave * 2),
      vy: 112 + wave * 3,
      r: 16,
      hp,
      maxHp: hp,
      pts: 45,
      fireCd: (1.05 + Math.random() * 0.45) * fireScale,
      lockTimer: 0,
      lockAngle: Math.PI * 0.5,
      hitFlash: 0,
      phase: Math.random() * Math.PI * 2,
    });
  } else if (kind === 'gunship') {
    const hp = Math.round(5.5 * hpScale);
    enemies.push({
      kind,
      x: spec.x != null ? Math.max(46, Math.min(W - 46, spec.x)) : 56 + Math.random() * (W - 112),
      y: spec.y != null ? spec.y : -38,
      vx: spec.lesson ? 0 : (Math.random() < 0.5 ? -1 : 1) * (32 + wave * 1.5),
      vy: 56 + wave * 2.5,
      r: 25,
      hp,
      maxHp: hp,
      pts: 70,
      fireCd: spec.lesson ? 0.18 : (0.95 + Math.random() * 0.5) * fireScale,
      lesson: spec.lesson,
      lockTimer: 0,
      hitFlash: 0,
      phase: Math.random() * Math.PI * 2,
    });
  } else {
    const rockStyle = spec.rockStyle || (Math.random() < 0.50 ? 'boulder' : 'shard');
    const fast = rockStyle === 'shard';
    const r = fast ? 12 + Math.random() * 5 : 24 + Math.random() * 5;
    const pace = Math.min(54, wave * 3);
    const hp = Math.round(3.8 * hpScale);
    enemies.push({
      kind: 'asteroid',
      x: spec.x != null ? Math.max(r + 14, Math.min(W - r - 14, spec.x)) : 40 + Math.random() * (W - 80),
      y: spec.y != null ? spec.y : -r - 12,
      vx: (Math.random() - 0.5) * (fast ? 108 : 42),
      vy: (fast ? 158 : 75) + Math.random() * (fast ? 31 : 24) + pace,
      r,
      hp,
      maxHp: hp,
      pts: 40,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * (fast ? 2.6 : 1.15),
      rockStyle,
      poly: createAsteroidPolygon(r, rockStyle),
      fireCd: 99,
      hitFlash: 0,
    });
  }
}

function updateOpeningEnemyAttack(enemy, dt) {
  const spread = enemy.lesson === 'spread';
  if (enemy.lockTimer > 0) {
    enemy.lockTimer = Math.max(0, enemy.lockTimer - dt);
    if (enemy.lockTimer > 0) return;
    const speed = spread ? 205 : enemy.lesson === 'aim' ? 218 : 228;
    for (const shot of openingEnemyShots(enemy, mode)) {
      enemyBullets.push({ x: enemy.x + shot.x, y: enemy.y + shot.y,
        vx: Math.cos(shot.angle) * speed, vy: Math.sin(shot.angle) * speed,
        r: spread ? 5.5 : 4.5, color: spread ? '#fbbf24' : '#6ee7b7' });
    }
    enemy.fireCd = spread ? (mode === 'ace' ? 1.55 : 1.9) : 2.05;
    return;
  }

  const minY = enemy.lesson === 'flank' ? 150 : spread ? 61 : 55;
  if (enemy.y < minY || enemy.y > H - 180) return;
  enemy.fireCd -= dt;
  if (enemy.fireCd > 0) return;
  enemy.lockAngle = Math.atan2(player.y - enemy.y - 12, player.x - enemy.x);
  enemy.lockTimer = spread ? (mode === 'ace' ? 0.45 : 0.64) : enemy.lesson === 'aim' ? 0.52 : 0.36;
}

const {
  spawnBoss,
  damageBoss,
  updateBossCampCounter,
  hitMothershipSupport,
  damageMothershipSupport,
  updateMothership,
  updateCrimsonBoss,
  hitCrimsonGuard,
  damageCrimsonGuard,
  destroyCrimsonGuard,
  endPrismReflection,
  reflectPrismBolt,
  hitPrismMirror,
  damagePrismMirror,
  updatePrismBoss,
} = createBossController({
  getBoss: () => boss,
  setBoss: (next) => { boss = next; },
  getMode: () => mode,
  getPlayer: () => player,
  getEnemyBullets: () => enemyBullets,
  clearEnemyBullets: () => { enemyBullets = []; },
  t,
  triggerShake,
  spawnExplosion,
  pushParticle,
  damagePlayer,
  onDefeat: () => defeatBoss(),
  renderHud,
  playBossAlert,
  playBossLaserCharge,
  playBossLaserFire,
  playExplode,
  playHit,
  playPrismReflectCue,
});

function maybeDropPickup(x, y, guaranteed, allowEmp) {
  if (!guaranteed && Math.random() > 0.18) return;
  const pool = ['weapon', 'weapon', 'shield', 'overdrive'];
  if (player.hp < player.maxHp) pool.push('heal', 'heal');
  else pool.push('heal');
  if (allowEmp !== false && player.empCharges < 3 && Math.random() < 0.14) {
    pool.push('emp');
  }
  spawnPickup(pool[Math.floor(Math.random() * pool.length)], x, y);
}

function spawnPickup(type, x, y) {
  pickups.push({
    type,
    x: Math.max(24, Math.min(W - 24, x)),
    y,
    vy: 92,
    r: 14,
    life: 0,
  });
}

function firePlayerWeapons() {
  const sk = SKINS[skin];
  const overdrive = player.overdriveTimer > 0;
  const lv = player.weaponLv;
  const heavyCannon = lv === MAX_WEAPON_LEVEL;
  const y0 = player.y - 22;
  const dmg = overdrive ? 1.35 : 1;
  const spd = -650;

  function pushBolt(x, y, vx, vy, color, heavy = false) {
    bullets.push({
      x,
      y,
      vx,
      vy,
      r: heavy ? 6 : overdrive ? 5 : 4,
      dmg: heavy ? dmg + 0.8 : dmg,
      style: skin,
      color: color || (overdrive ? '#fde047' : sk.bolt),
      heavy,
    });
  }

  function pushFlash(x, y, r, color = sk.bolt, life = 0.06) {
    muzzleFlashes.push({ x, y, r, color, style: skin, life, maxLife: life });
  }

  if (lv === 1) {
    pushBolt(player.x, y0, 0, spd);
    pushFlash(player.x, y0, 9);
  } else if (lv === 2) {
    pushBolt(player.x - 10, y0 + 4, 0, spd);
    pushBolt(player.x + 10, y0 + 4, 0, spd);
    pushFlash(player.x - 10, y0 + 2, 8);
    pushFlash(player.x + 10, y0 + 2, 8);
  } else if (lv === 3) {
    pushBolt(player.x, y0, 0, spd);
    pushBolt(player.x - 12, y0 + 6, -55, spd * 0.96);
    pushBolt(player.x + 12, y0 + 6, 55, spd * 0.96);
    pushFlash(player.x, y0, 11);
  } else {
    pushBolt(player.x - 7, y0, 0, spd);
    pushBolt(player.x + 7, y0, 0, spd);
    pushBolt(player.x - 16, y0 + 8, -95, spd * 0.94);
    pushBolt(player.x + 16, y0 + 8, 95, spd * 0.94);
    pushBolt(player.x, y0 - 4, 0, spd * 1.06, heavyCannon ? sk.heavy.color : '#ffffff', heavyCannon);
    pushFlash(player.x, y0 - 3, heavyCannon ? 19 : 13, heavyCannon ? sk.heavy.edge : overdrive ? '#fde047' : '#ffffff', 0.065);
  }
  if (heavyCannon) playWeaponAccent('heavyShot');
  playShoot(sk.shot, overdrive, heavyCannon ? 0.50 : 1);
}

function fireBlastRound(dt) {
  player.blastCd = Math.max(0, player.blastCd - dt);
  if (player.blastAmmo === 0 || player.blastCd > 0) return;
  const y = player.y - 22;
  const onCourse = (target, radius, vx = 0, vy = 0) => {
    if (target.y < 0 || target.y >= y) return false;
    const travel = (y - target.y) / (BLAST_SPEED + vy);
    return Math.abs(target.x + vx * travel - player.x) <= radius + 6;
  };
  let aimed = enemies.some((e) => onCourse(e, e.r, e.vx, e.vy));
  if (!aimed && boss) {
    const bodyWidth = boss.kind === 'mothership' ? (boss.phase === 2 ? 69 : 61) : boss.r;
    const bodyReady = boss.maneuver !== 'transform' && boss.y >= boss.targetY - 12;
    const mirror = boss.prismMirror;
    aimed = (bodyReady && onCourse(boss, bodyWidth, boss.maneuver === 'patrol' ? boss.vx : 0))
      || (mirror && mirror.age >= PRISM_MIRROR_DEPLOY_SECONDS && onCourse(mirror, mirror.r))
      || (boss.guard && onCourse(boss.guard, CRIMSON_GUARD_HALF_WIDTH))
      || boss.supports?.some((craft) => onCourse(craft, 16));
  }
  if (!aimed) return;

  player.blastAmmo -= 1;
  player.blastCd = BLAST_INTERVAL;
  bullets.push({ x: player.x, y, vx: 0, vy: -BLAST_SPEED, r: 6, dmg: BLAST_DAMAGE,
    color: '#fb923c', explosive: true });
}

function detonateBlastRound(bullet) {
  const { x, y, dmg } = bullet;
  const withinBlast = (target, radius) =>
    (target.x - x) ** 2 + (target.y - y) ** 2 <= (BLAST_RADIUS + radius) ** 2;
  spawnExplosion(x, y, '#fb923c', 24, BLAST_RADIUS, 7, true);
  playWeaponAccent('blastImpact');
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const e = enemies[i];
    if (!withinBlast(e, e.r)) continue;
    e.hp -= dmg;
    e.hitFlash = 0.10;
    if (e.hp <= 0) destroyEnemy(i);
  }

  // Resolve hull damage before the blast can destroy the shield links.
  if (boss && boss.y >= boss.targetY - 12 && bossHullImpactTime(boss, x, y, BLAST_RADIUS) !== null) damageBoss(dmg, 0.10);
  if (boss?.guard && withinBlast(boss.guard, CRIMSON_GUARD_HALF_WIDTH)) damageCrimsonGuard(dmg);
  const mirror = boss?.prismMirror;
  if (mirror && mirror.age >= PRISM_MIRROR_DEPLOY_SECONDS && withinBlast(mirror, mirror.r)) damagePrismMirror(dmg);
  if (boss?.supports) {
    for (let i = boss.supports.length - 1; i >= 0; i -= 1) {
      if (withinBlast(boss.supports[i], 16)) damageMothershipSupport(i, dmg);
    }
  }
}

function collectPickup(pickup) {
  const { x, y } = pickup;
  const type = pickup.type === 'weapon' && player.weaponLv >= MAX_WEAPON_LEVEL ? 'blast' : pickup.type;
  let label;
  let duplicatePoints = 0;
  if (type === 'weapon') {
    player.weaponLv += 1;
    label = t('火力 Lv.{lv}!', { lv: player.weaponLv });
  } else if (type === 'blast') {
    player.blastAmmo += BLAST_AMMO_PER_PICKUP;
    label = t('爆破弹 +{count}', { count: BLAST_AMMO_PER_PICKUP });
  } else if (type === 'shield') {
    if (!player.hasShield) {
      player.hasShield = true;
      label = t('能量护盾!');
    } else {
      duplicatePoints = 40;
    }
  } else if (type === 'overdrive') {
    if (player.overdriveTimer === 0) {
      shockwaves.push({ x: player.x, y: player.y, r: 15, maxR: 58,
        color: SKINS[skin].boostColor, life: 0.28, maxLife: 0.28 });
      playWeaponAccent('overdriveStart');
    }
    player.overdriveTimer = OVERDRIVE_SECONDS;
    label = t('超载暴走!');
  } else if (type === 'heal') {
    if (player.hp < player.maxHp) {
      player.hp += 1;
      label = t('护甲 +1');
    } else {
      duplicatePoints = 50;
    }
  } else {
    if (player.empCharges < 3) {
      player.empCharges += 1;
      label = t('+1 脉冲!');
    } else {
      duplicatePoints = 60;
    }
  }

  playPowerup(type);
  if (duplicatePoints) {
    label = '+' + addScore(duplicatePoints);
  } else {
    pickupCue = { type, remaining: PICKUP_CUE_SECONDS };
  }
  addFloatText(x, y - 8, label, PICKUP_THEMES[type].rim, duplicatePoints ? 1.1 : 1.25);
}

function triggerEmp() {
  if (state !== 'playing' || player.empCharges <= 0 || empCooldown > 0 || boss?.maneuver === 'transform') return;
  player.empCharges -= 1;
  empCooldown = 0.6;
  empWave = { x: player.x, y: player.y, r: 24, maxR: 620, life: 0.45, maxLife: 0.45 };
  flashColor = '#7dd3fc';
  flashAlpha = 0.42;
  triggerShake(10, 0.35);
  playEmp();

  // 清除敌方弹幕，重创常规敌机与 Boss
  enemyBullets = [];
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const e = enemies[i];
    e.hp -= 12;
    e.hitFlash = 0.14;
    if (e.hp <= 0) {
      destroyEnemy(i);
    }
  }
  if (boss) {
    if (boss.guard) destroyCrimsonGuard();
    if (boss.supports?.length) boss.supportJam = 1.30;
    if (boss.prismReflect) endPrismReflection();
    damageBoss(28, 0.14);
  }
  addFloatText(player.x, player.y - 34, t('脉冲清屏！'), '#7dd3fc', 1.3);
  renderHud();
}

function damagePlayer() {
  if (player.invulnTimer > 0 || player.overdriveTimer > 0) return;
  if (boss?.campSpot) boss.campSpot = null;
  if (player.hasShield) {
    player.hasShield = false;
    player.invulnTimer = 1.1;
    playPlayerHit();
    spawnExplosion(player.x, player.y, '#38bdf8', 16, 65);
    triggerShake(7, 0.22);
    addFloatText(player.x, player.y - 26, t('护盾抵消！'), '#67e8f9', 1.2);
    renderHud();
    return;
  }
  player.hp -= 1;
  player.invulnTimer = 1.6;
  if (player.weaponLv > 1) player.weaponLv -= 1;
  combo = 0;
  comboTimer = 0;
  playPlayerHit();
  flashColor = '#ef4444';
  flashAlpha = 0.38;
  triggerShake(11, 0.35);
  spawnExplosion(player.x, player.y, '#f97316', 20, 72);
  renderHud();
  if (player.hp <= 0) {
    player.hp = 0;
    playExplode(true);
    endGame();
  }
}

function destroyEnemy(index) {
  const e = enemies[index];
  enemies.splice(index, 1);
  kills += 1;
  combo += 1;
  comboTimer = 2.6;
  if (combo > maxCombo) maxCombo = combo;
  if (combo === 6 || combo === 12 || combo === 20) {
    playComboMilestone();
    addFloatText(player.x, player.y - 38, t('×{c} 连击！', { c: combo }), '#38bdf8', 1.25);
  }
  const gained = addScore(e.pts);
  const col = e.kind === 'asteroid' ? (e.rockStyle === 'shard' ? '#e9ad82' : '#94a3b8')
    : e.kind === 'gunship' ? '#f59e0b'
    : e.kind === 'drone' ? '#a855f7'
    : e.kind === 'interceptor' ? '#34d399'
    : '#fb7185';
  spawnExplosion(e.x, e.y, col, e.kind === 'gunship' ? 22 : 14, e.r * 2.3);
  playExplode(e.kind === 'gunship');
  addFloatText(e.x, e.y - 8, '+' + gained, '#fef08a', e.kind === 'gunship' ? 1.15 : 0.92);
  maybeDropPickup(e.x, e.y, (e.kind === 'gunship' || e.kind === 'drone') && Math.random() < 0.42);
}

function defeatBoss() {
  if (!boss) return;
  defeatedBosses.set(boss.kind, (defeatedBosses.get(boss.kind) ?? 0) + 1);
  const bx = boss.x;
  const by = boss.y;
  const pts = addScore(boss.pts);
  kills += 1;
  combo += 1;
  comboTimer = 2.8;
  if (combo > maxCombo) maxCombo = combo;
  boss = null;
  enemyBullets = [];
  bossSupplyTimer = 0;
  flashColor = '#fde047';
  flashAlpha = 0.52;
  triggerShake(15, 0.55);
  playExplode(true);
  playWaveClear();
  spawnExplosion(bx, by, '#f97316', 46, 150, 14);
  addFloatText(bx, by, '+' + pts, '#fde047', 1.45);
  if (practiceTier) {
    endGame();
    return;
  }
  if (player.empCharges < 3) player.empCharges += 1;
  maybeDropPickup(bx - 26, by, true, false);
  maybeDropPickup(bx + 26, by, true, false);
  startWave(wave + 1);
}

function decayVisualEffects(dt) {
  if (pickupCue) {
    pickupCue.remaining -= dt;
    if (pickupCue.remaining <= 0) pickupCue = null;
  }
  if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);
  if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - dt * 2.2);
  if (bossAlertAlpha > 0) bossAlertAlpha = Math.max(0, bossAlertAlpha - dt * 0.75);
  if (empWave) {
    empWave.life -= dt;
    const p = 1 - empWave.life / empWave.maxLife;
    empWave.r = 24 + (empWave.maxR - 24) * p;
    if (empWave.life <= 0) empWave = null;
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
  }
  for (let i = debris.length - 1; i >= 0; i -= 1) {
    const d = debris[i];
    d.life -= dt;
    if (d.life <= 0) {
      debris.splice(i, 1);
      continue;
    }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rot += d.vRot * dt;
  }
  for (let i = muzzleFlashes.length - 1; i >= 0; i -= 1) {
    muzzleFlashes[i].life -= dt;
    if (muzzleFlashes[i].life <= 0) muzzleFlashes.splice(i, 1);
  }
  for (let i = afterimages.length - 1; i >= 0; i -= 1) {
    afterimages[i].life -= dt;
    if (afterimages[i].life <= 0) afterimages.splice(i, 1);
  }
  for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
    shockwaves[i].life -= dt;
    if (shockwaves[i].life <= 0) shockwaves.splice(i, 1);
  }
  for (let i = floatTexts.length - 1; i >= 0; i -= 1) {
    const ft = floatTexts[i];
    ft.life -= dt;
    ft.y -= 32 * dt;
    if (ft.life <= 0) floatTexts.splice(i, 1);
  }
}

function update(dt) {
  if (state === 'paused') return;
  backgroundTime += dt;
  sceneBlend = Math.min(1, sceneBlend + dt / 1.35);

  const starSpeedMult = player.overdriveTimer > 0 ? 2.4 : (state === 'ready' ? 0.55 : 1);
  for (const s of stars) {
    s.y += s.speed * starSpeedMult * dt;
    if (s.y > H + 4) {
      s.y = -4;
      s.x = Math.random() * W;
    }
  }
  meteorTimer -= dt;
  if (meteorTimer <= 0) {
    meteorTimer = 2.4 + Math.random() * 3.8;
    const fromLeft = Math.random() < 0.5;
    meteors.push({
      x: fromLeft ? Math.random() * W * 0.65 : W * 0.35 + Math.random() * W * 0.65,
      y: -16,
      vx: (fromLeft ? 1 : -1) * (150 + Math.random() * 110),
      vy: 340 + Math.random() * 140,
      len: 42 + Math.random() * 28,
      life: 1.4,
    });
  }
  for (let i = meteors.length - 1; i >= 0; i -= 1) {
    const m = meteors[i];
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.life -= dt;
    if (m.life <= 0 || m.y > H + 80) meteors.splice(i, 1);
  }

  if (state === 'over') {
    decayVisualEffects(dt);
    return;
  }
  if (state === 'ready') {
    const nowS = performance.now() * 0.001;
    player.x = W * 0.5 + Math.sin(nowS * 1.15) * 32;
    player.y = H - 74 + Math.cos(nowS * 1.8) * 6;
    player.bank = Math.cos(nowS * 1.15) * 0.08;
    return;
  }
  if (state !== 'playing') return;

  // 计时器衰减
  if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  if (player.overdriveTimer > 0) {
    const before = player.overdriveTimer;
    player.overdriveTimer = Math.max(0, before - dt);
    if (before > OVERDRIVE_END_CUE && player.overdriveTimer <= OVERDRIVE_END_CUE) {
      playWeaponAccent('overdriveEnding');
    }
  }
  if (empCooldown > 0) empCooldown = Math.max(0, empCooldown - dt);
  if (waveBannerTimer > 0) waveBannerTimer = Math.max(0, waveBannerTimer - dt);
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;
  }

  // 战机键盘 / 鼠标移动
  player.prevX = player.x;
  let kx = 0;
  let ky = 0;
  if (keys.ArrowLeft || keys.KeyA) kx -= 1;
  if (keys.ArrowRight || keys.KeyD) kx += 1;
  if (keys.ArrowUp || keys.KeyW) ky -= 1;
  if (keys.ArrowDown || keys.KeyS) ky += 1;
  if (kx !== 0 || ky !== 0) {
    mouseTarget = null;
    const len = Math.hypot(kx, ky) || 1;
    player.x += (kx / len) * 355 * dt;
    player.y += (ky / len) * 355 * dt;
  } else if (mouseTarget) {
    const dx = mouseTarget.x - player.x;
    const dy = mouseTarget.y - player.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, 920 * dt);
    if (dist > 0.5) {
      player.x += (dx / dist) * step;
      player.y += (dy / dist) * step;
    }
    if (dist < 2) mouseTarget = null;
  }

  player.x = Math.max(22, Math.min(W - 22, player.x));
  player.y = Math.max(54, Math.min(H - 28, player.y));
  const vxEst = (player.x - player.prevX) / Math.max(0.001, dt);
  const targetBank = Math.max(-0.28, Math.min(0.28, vxEst * 0.00075));
  player.bank += (targetBank - player.bank) * Math.min(1, dt * 14);

  if (player.overdriveTimer > 0) {
    afterimageCd -= dt;
    if (afterimageCd <= 0) {
      afterimageCd = 0.045;
      afterimages.push({
        x: player.x,
        y: player.y,
        bank: player.bank,
        style: skin,
        life: 0.16,
        maxLife: 0.16,
      });
    }
  }

  // 自动开火
  player.fireCd -= dt;
  if (player.fireCd <= 0) {
    const interval = player.overdriveTimer > 0 ? 0.08 : 0.155;
    player.fireCd = interval;
    firePlayerWeapons();
  }
  fireBlastRound(dt);

  // 波次编队生成
  if (spawnQueue.length > 0) {
    waveSpawnTimer -= dt;
    if (waveSpawnTimer <= 0) {
      const batch = spawnQueue.shift();
      for (const item of batch.items) {
        spawnEnemyAt(item);
      }
      waveSpawnTimer = batch.delay;
    }
  } else if (!boss && enemies.length === 0) {
    startWave(wave + 1);
  }

  // Boss 战周期性补给空投（避免持久战零道具）
  if (boss) {
    bossSupplyTimer -= dt;
    if (bossSupplyTimer <= 0) {
      bossSupplyTimer = 10.5;
      maybeDropPickup(W * (0.22 + Math.random() * 0.56), -16, true, true);
    }
  }

  // 更新己方子弹
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    const previousX = b.x;
    const previousY = b.y;
    const sweep = b.heavy || b.explosive;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const escortHit = hitCrimsonGuard(b, previousX, previousY) || hitMothershipSupport(b, previousX, previousY);
    if (escortHit || b.y < -16 || b.x < -20 || b.x > W + 20) {
      if (escortHit && b.explosive) detonateBlastRound(b);
      bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const e = enemies[j];
      if (b.piercedEnemy === e) continue;
      const rr = e.r + b.r;
      const collided = e.rockStyle === 'shard'
        ? fastRockOverlaps(e, previousX, previousY, b.x, b.y, b.r, dt)
        : (sweep
          ? bulletCrossesCircle(b, previousX, previousY, e.x, e.y, rr)
          : (b.x - e.x) ** 2 + (b.y - e.y) ** 2 <= rr * rr);
      if (collided) {
        if (b.explosive) {
          hit = true;
          break;
        }
        e.hp -= b.dmg;
        e.hitFlash = 0.065;
        playHit(b.heavy, false, b.style);
        pushParticle({
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 90,
          vy: -40 + Math.random() * 80,
          r: b.heavy ? 4.5 : 2,
          color: b.color,
          life: 0.16,
          maxLife: 0.16,
        });
        if (e.hp <= 0) destroyEnemy(j);
        if (b.heavy && !b.piercedEnemy) {
          b.piercedEnemy = e;
          continue;
        }
        hit = true;
        break;
      }
    }
    if (!hit) hit = hitPrismMirror(b, previousX, previousY);
    if (!hit && reflectPrismBolt(b, previousX, previousY)) {
      if (b.heavy) playHit(true, true, b.style);
      bullets.splice(i, 1);
      continue;
    }
    const bossImpact = !hit && boss && boss.y >= boss.targetY - 12
      ? bossHullImpactTime(boss, b.x, b.y, b.r, sweep ? previousX : b.x, sweep ? previousY : b.y)
      : null;
    if (bossImpact !== null) {
      hit = true;
      if (sweep) {
        b.x = previousX + (b.x - previousX) * bossImpact;
        b.y = previousY + (b.y - previousY) * bossImpact;
      }
      const armored = boss.kind === 'mothership' ? mothershipShieldLinks(boss) > 0 : boss.maneuver !== 'recover';
      if (!b.explosive && damageBoss(b.dmg, 0.065)) {
        playHit(b.heavy, armored, b.style);
        pushParticle({
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 110,
          vy: 40 + Math.random() * 70,
          r: b.heavy ? 4.5 : 2.2,
          color: b.color,
          life: 0.16,
          maxLife: 0.16,
        });
      }
    }
    if (hit) {
      if (b.explosive) detonateBlastRound(b);
      bullets.splice(i, 1);
    }
  }

  if (state === 'over') return;

  // 更新敌机
  const enemyFireScale = Math.max(0.58, 1 - wave * 0.032 - (mode === 'ace' ? 0.12 : 0));
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const e = enemies[i];
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.lesson) {
      if (e.lockTimer <= 0) {
        e.y += e.vy * dt;
        if (e.lesson === 'flank') {
          const entry = Math.max(0, Math.min(1, (e.y - 8) / 138));
          e.x = e.entryX - e.entrySide * 114 * entry * entry * (3 - 2 * entry);
        }
      }
    } else if (e.kind === 'interceptor') {
      e.phase += dt * 3.4;
      e.x += Math.sin(e.phase) * 115 * dt;
      e.y += e.vy * dt;
    } else if (e.kind === 'drone') {
      e.phase += dt * 2.2;
      if (e.lockTimer <= 0) {
        e.x += e.vx * dt;
      }
      if (e.y < e.targetY) {
        e.y = Math.min(e.targetY, e.y + e.vy * dt);
      } else if (e.lockTimer <= 0) {
        e.y += (16 + Math.sin(e.phase) * 12) * dt;
      }
    } else {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }

    if (e.x < e.r + 10) {
      e.x = e.r + 10;
      e.vx = Math.abs(e.vx);
    } else if (e.x > W - e.r - 10) {
      e.x = W - e.r - 10;
      e.vx = -Math.abs(e.vx);
    }
    if (e.kind === 'asteroid') e.rot += e.vRot * dt;

    // 敌机开火（攻击欲望随关数递进）
    if (e.lesson) {
      updateOpeningEnemyAttack(e, dt);
    } else if (e.y > 20 && e.y < H - 140) {
      if (e.kind === 'drone' && e.lockTimer > 0) {
        e.lockTimer -= dt;
        if (e.lockTimer <= 0) {
          const spd = 280 + wave * 5;
          enemyBullets.push({
            x: e.x,
            y: e.y + 12,
            vx: Math.cos(e.lockAngle) * spd,
            vy: Math.sin(e.lockAngle) * spd,
            r: 5.5,
            color: '#c084fc',
          });
          e.fireCd = 2.0 * enemyFireScale;
        }
      } else {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          if (e.kind === 'scout' && wave > 4) {
            e.fireCd = 2.15 * enemyFireScale;
            const spd = 205 + wave * 3.5;
            enemyBullets.push({ x: e.x, y: e.y + 14, vx: 0, vy: spd, r: 4.5, color: '#fb7185' });
          } else if (e.kind === 'interceptor') {
            e.fireCd = Math.max(0.82, 1.55 * enemyFireScale);
            const ang = Math.atan2(player.y - e.y, player.x - e.x);
            const spd = 215 + wave * 4;
            enemyBullets.push({ x: e.x, y: e.y + 12, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: 5, color: '#fb7185' });
          } else if (e.kind === 'drone') {
            e.lockAngle = Math.atan2(player.y - e.y, player.x - e.x);
            e.lockTimer = 0.45;
          } else if (e.kind === 'gunship') {
            e.fireCd = Math.max(1.05, 1.9 * enemyFireScale);
            const spd = 195 + wave * 3.5;
            const offsets = (wave >= 7 || mode === 'ace') ? [-0.42, -0.2, 0, 0.2, 0.42] : [-0.28, 0, 0.28];
            for (const offset of offsets) {
              const ang = Math.PI * 0.5 + offset;
              enemyBullets.push({ x: e.x, y: e.y + 18, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: 5.5, color: '#f59e0b' });
            }
          }
        }
      }
    }

    if (e.y > H + e.r + 25) {
      enemies.splice(i, 1);
      continue;
    }

    // 与自机碰撞
    const hitR = e.r + 10;
    const playerHit = e.rockStyle === 'shard'
      ? fastRockOverlaps(e, player.x, player.y, player.x, player.y, 10)
      : (e.x - player.x) ** 2 + (e.y - player.y) ** 2 <= hitR * hitR;
    if (playerHit) {
      if (player.overdriveTimer > 0) {
        destroyEnemy(i);
      } else {
        destroyEnemy(i);
        damagePlayer();
        if (state === 'over') return;
      }
    }
  }

  // 更新 Boss（3 种形态与专属弹幕/激光模式）
  if (boss) {
    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
    if (boss.kind === 'mothership') {
      updateMothership(dt);
    } else if (!updateBossCampCounter(dt)) {
      if (boss.kind === 'crimson') updateCrimsonBoss(dt);
      else updatePrismBoss(dt);
    }
    if (state === 'over') return;

    // Boss 本体碰撞
    if (boss.maneuver !== 'transform' && bossHullImpactTime(boss, player.x, player.y, 10) !== null) {
      damagePlayer();
      if (state === 'over') return;
    }
  }

  // 更新敌方子弹
  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const eb = enemyBullets[i];
    eb.x += eb.vx * dt;
    eb.y += eb.vy * dt;
    if (eb.y > H + 18 || eb.y < -18 || eb.x < -18 || eb.x > W + 18) {
      enemyBullets.splice(i, 1);
      continue;
    }
    const rr = eb.r + 8;
    if ((eb.x - player.x) ** 2 + (eb.y - player.y) ** 2 <= rr * rr) {
      enemyBullets.splice(i, 1);
      damagePlayer();
      if (state === 'over') return;
    }
  }

  // 更新道具（近距离轻吸附）
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pk = pickups[i];
    pk.life += dt;
    pk.y += pk.vy * dt;
    const dx = player.x - pk.x;
    const dy = player.y - pk.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 105 && dist > 1) {
      pk.x += (dx / dist) * 260 * dt;
      pk.y += (dy / dist) * 260 * dt;
    }
    if (pk.y > H + 20) {
      pickups.splice(i, 1);
      continue;
    }
    if (dist <= pk.r + 18) {
      pickups.splice(i, 1);
      collectPickup(pk);
    }
  }

  decayVisualEffects(dt);
  renderHud();
}

const { draw } = createSpaceRenderer({
  ctx,
  t,
  getState: () => ({
    mode, skin, stars, meteors, sceneIndex, previousScene, sceneBlend, backgroundTime,
    state, player, boss, bullets, enemyBullets, enemies, pickups, pickupCue,
    particles, debris, muzzleFlashes, afterimages, shockwaves, floatTexts,
    empWave, bossAlertAlpha, waveBanner, waveBannerTimer, combo, comboTimer,
    shakeTimer, shakeMag, flashAlpha, flashColor,
  }),
});

// 输入事件（触屏相对拖动 + 鼠标跟随 + 键盘）
function toCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (state !== 'playing') return;
  if (event.pointerType === 'mouse') {
    mouseTarget = toCanvasPoint(event);
    return;
  }
  if (!event.isPrimary) return;
  activeTouchId = event.pointerId;
  touchLastPt = { x: event.clientX, y: event.clientY };
  try { canvas.setPointerCapture(event.pointerId); } catch {}
});

canvas.addEventListener('pointermove', (event) => {
  if (state !== 'playing') return;
  if (event.pointerType === 'mouse') {
    mouseTarget = toCanvasPoint(event);
    return;
  }
  if (event.pointerId !== activeTouchId || !touchLastPt) return;
  // 计算手指在视口中的位移，避免血条出现时画布下移带动战机。
  const { width, height } = canvas.getBoundingClientRect();
  player.x += (event.clientX - touchLastPt.x) * W / width;
  player.y += (event.clientY - touchLastPt.y) * H / height * 1.05;
  player.x = Math.max(22, Math.min(W - 22, player.x));
  player.y = Math.max(54, Math.min(H - 28, player.y));
  touchLastPt = { x: event.clientX, y: event.clientY };
});

function endTouch(event) {
  if (event.pointerType === 'mouse') {
    if (event.type === 'pointerleave') mouseTarget = null;
    return;
  }
  if (event.pointerId === activeTouchId) {
    activeTouchId = null;
    touchLastPt = null;
  }
}
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);
canvas.addEventListener('lostpointercapture', endTouch);
canvas.addEventListener('pointerleave', endTouch);

document.addEventListener('keydown', (event) => {
  if (GameKit.isTutorialOpen() || (window.SiteData && SiteData.isDialogOpen())) return;
  const ignoreShortcut = GameKit.shouldIgnoreGameKey(event, { ignoreOnControl: true });
  if (event.repeat && ['KeyP', 'Space', 'Enter'].includes(event.code)) {
    const gameAction = [overlayBtn, pauseBtn, empBtn].includes(event.target);
    if (!ignoreShortcut || (gameAction && !GameKit.shouldIgnoreGameKey(event))) event.preventDefault();
    return;
  }
  if (ignoreShortcut) return;
  keys[event.code] = true;

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  } else if (event.code === 'Space') {
    if (state === 'playing') triggerEmp();
    else if (state === 'ready' || state === 'over') startGame();
    else if (state === 'paused') resumeGame();
  } else if (event.code === 'Enter') {
    if (state === 'ready' || state === 'over') startGame();
    else if (state === 'paused') resumeGame();
  }
});

document.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

window.addEventListener('blur', clearKeys);

empBtn.addEventListener('click', triggerEmp);
overlayBtn.addEventListener('click', () => {
  if (state === 'paused') resumeGame();
  else startGame();
});
practiceMenuBtn.addEventListener('click', openPracticeMenu);
practiceBackBtn.addEventListener('click', () => {
  if (practiceTier) {
    openPracticeMenu();
  } else {
    practiceMenuOpen = false;
    renderOverlay();
    practiceMenuBtn.focus();
  }
});
practiceChoices.forEach((choice) => {
  choice.addEventListener('click', () => startPractice(Number(choice.dataset.practiceTier)));
});
pauseBtn.addEventListener('click', () => {
  if (state === 'playing') pauseGame();
  else if (state === 'paused') resumeGame();
});
restartBtn.addEventListener('click', async () => {
  if (await confirmAbandonIfActive()) startGame();
});

async function switchMode(nextMode) {
  if (practiceTier || nextMode === mode) return;
  if (!(await confirmAbandonIfActive(true))) return;
  campaignMode = mode = nextMode;
  writeStored(MODE_KEY, campaignMode);
  syncModeButtons();
  resetState('ready');
}
modeStandardBtn.addEventListener('click', () => switchMode('standard'));
modeAceBtn.addEventListener('click', () => switchMode('ace'));

skinBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.skin;
    if (!SKINS[next]) return;
    skin = next;
    writeStored(SKIN_KEY, skin);
    syncModeButtons();
  });
});

function openTutorial(force) {
  if (state === 'playing') pauseGame();
  GameKit.showTutorial({
    id: 'space',
    force: !!force,
    steps: [
      {
        icon: 'game-space',
        title: t('拖动战机迎战'),
        text: t('手机在画布内拖动、电脑移动鼠标或按方向键/WASD 控制战机走位，主炮会自动连射。'),
      },
      {
        icon: 'art-zap',
        title: t('拾取强化与脉冲清屏'),
        text: t('击毁敌机掉落火力升级、护盾、超载与修甲道具；危机时按空格或点脉冲按钮消除全屏弹幕！'),
      },
      {
        icon: 'art-explosion',
        title: t('迎战星际 Boss'),
        text: t('第 5 波遇到绯红裁决者。横向躲开突进，用脉冲清除护卫，趁反击窗口瞄准本体。'),
      },
    ],
  });
}

helpBtn.addEventListener('click', () => openTutorial(true));
GameKit.onHidden(pauseForInterruption);
document.addEventListener('site:dialogopen', () => {
  clearKeys();
  pauseGame();
});
document.addEventListener('i18n:change', () => {
  renderHud();
  renderOverlay();
});

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

syncModeButtons();
resetState('ready');
bindImmersiveLayout();
requestAnimationFrame(frame);
openTutorial(false);
