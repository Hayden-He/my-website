import {
  W, BOSS_HP_SCALE, BOSS_ENTRY_SPEED, BOSS_CAMP_SECONDS, BOSS_CAMP_RADIUS, BOSS_COUNTER_WARNING, MOTHERSHIP_DEPLOY_SECONDS, MOTHERSHIP_DODGE_SECONDS, MOTHERSHIP_LASER_LOCK_SECONDS, PRISM_BEAM_WIDTH, PRISM_MIRROR_BEAM_WIDTH, PRISM_REFLECT_WARNING, PRISM_REFLECT_RADIUS, PRISM_REFLECT_ASPECT, PRISM_REFLECT_PANELS, PRISM_REFLECT_INTERVAL, PRISM_REFLECT_MAX_BOLTS, PRISM_MIRROR_DEPLOY_SECONDS, PRISM_PHASE_TWO_ATTACKS, PRISM_MIRROR_ATTACKS, CRIMSON_GUARD_OFFSET, CRIMSON_GUARD_HALF_WIDTH, CRIMSON_SCATTER_ANGLES, getBossKind, getBossName, computeBossLasers, mothershipShieldLinks, crimsonDashEnd, prismBeam, bulletCrossesCircle, ellipseImpactTime, beamHitsPlayer,
} from './rules.js';

export function createBossController({
  getBoss,
  setBoss,
  getMode,
  getPlayer,
  getEnemyBullets,
  clearEnemyBullets,
  t,
  triggerShake,
  spawnExplosion,
  pushParticle,
  damagePlayer,
  onDefeat,
  renderHud,
  playBossAlert,
  playBossLaserCharge,
  playBossLaserFire,
  playExplode,
  playHit,
  playPrismReflectCue,
}) {
  function spawnBoss(tier) {
    const kind = getBossKind(tier);
    const hpBase = kind === 'mothership' ? 115 : (kind === 'prism' ? 100 : 90);
    const hp = Math.round((hpBase + tier * 60) * BOSS_HP_SCALE * (getMode() === 'ace' ? 1.25 : 1));
    const boss = {
      tier,
      kind,
      name: getBossName(kind, true, t),
      x: W * 0.5,
      y: -92,
      targetY: 98,
      vx: (110 + Math.min(tier * 13, 56)) * (kind === 'mothership' ? 0.85 : 1) * (getMode() === 'ace' ? 1.14 : 1),
      r: kind === 'mothership' ? 50 : 46,
      hp,
      maxHp: hp,
      pts: 450 + tier * 160,
      hitFlash: 0,
      patternTimer: getMode() === 'ace' ? 0.38 : 0.52,
      patternIndex: 0,
      phase: 1,
      maneuver: 'patrol',
      maneuverTimer: kind === 'crimson' ? 0.24 : 0,
      prismAttack: null,
      sweepDirection: 1,
      dashX: W * 0.5,
      dashPass: 1,
      guard: null,
      laserState: 'idle', // 'idle' | 'telegraph' | 'fire'
      laserTimer: 0,
      lasers: [],
      laserWidth: 16,
    };
    if (kind === 'mothership') {
      boss.lasers = computeBossLasers(boss);
      boss.supports = [];
      boss.supportJam = 0;
      boss.supportCooldown = 0;
    }
    setBoss(boss);
    return boss;
  }

  function damageBoss(amount, flash) {
    const boss = getBoss();
    if (boss.maneuver === 'transform') return false;
    const links = mothershipShieldLinks(boss);
    let damageScale = 1;
    if (boss.kind === 'mothership') {
      damageScale = links === 2 ? 0.22 : links === 1 ? 0.58 : 1;
    } else if (boss.maneuver !== 'recover') {
      damageScale = boss.phase === 2 ? 0.45 : 0.64;
    }
    const nextHp = boss.hp - amount * damageScale;
    if (boss.phase === 1 && nextHp <= boss.maxHp / 2) {
      if (boss.prismReflect) endPrismReflection();
      boss.hp = boss.maxHp / 2;
      boss.hitFlash = 0;
      boss.maneuver = 'transform';
      boss.maneuverTimer = 1;
      boss.prismAttack = null;
      boss.campSpot = null;
      boss.campCounter = null;
      boss.guard = null;
      boss.laserState = 'idle';
      clearEnemyBullets();
      playBossAlert();
      renderHud();
    } else {
      boss.hp = nextHp;
      boss.hitFlash = flash;
      if (boss.hp <= 0) onDefeat();
    }
    return true;
  }

  function setBossManeuver(next, duration) {
    const boss = getBoss();
    boss.maneuver = next;
    boss.maneuverTimer = duration;
  }

  function patrolBoss(dt) {
    const boss = getBoss();
    boss.x += boss.vx * dt;
    if (boss.x < boss.r + 22) {
      boss.x = boss.r + 22;
      boss.vx = Math.abs(boss.vx);
    } else if (boss.x > W - boss.r - 22) {
      boss.x = W - boss.r - 22;
      boss.vx = -Math.abs(boss.vx);
    }
  }

  function updateBossCampCounter(dt) {
    const boss = getBoss();
    if (boss.maneuver === 'transform' || boss.y < boss.targetY) return false;

    const counter = boss.campCounter;
    if (counter) {
      counter.remaining -= dt;
      if (counter.remaining <= 0) {
        const angle = Math.atan2(counter.targetY - counter.y, counter.targetX - counter.x);
        getEnemyBullets().push({ x: counter.x, y: counter.y, vx: Math.cos(angle) * 360,
          vy: Math.sin(angle) * 360, r: 7, color: '#fbbf24' });
        boss.campCounter = null;
        boss.campSpot = null;
        playBossLaserFire();
      }
      return true;
    }

    const spot = boss.campSpot;
    if (!spot || (getPlayer().x - spot.x) ** 2 + (getPlayer().y - spot.y) ** 2 > BOSS_CAMP_RADIUS ** 2) {
      boss.campSpot = { x: getPlayer().x, y: getPlayer().y, elapsed: 0 };
      return false;
    }
    spot.elapsed += dt;
    const betweenAttacks = boss.maneuver === 'patrol' || boss.maneuver === 'reposition'
      || (boss.maneuver === 'mirror' && !boss.prismAttack);
    if (spot.elapsed < BOSS_CAMP_SECONDS || !betweenAttacks) return false;

    boss.campCounter = {
      x: boss.x, y: boss.y, targetX: getPlayer().x, targetY: getPlayer().y, remaining: BOSS_COUNTER_WARNING,
    };
    playBossLaserCharge();
    return true;
  }

  function deployMothershipSupports() {
    const boss = getBoss();
    const hp = (getMode() === 'ace' ? 19 : 15) + Math.floor((boss.tier - 3) / 3) * 2;
    for (const side of [-1, 1]) {
      if (boss.supports.some((craft) => craft.side === side)) continue;
      boss.supports.push({
        side,
        x: boss.x + side * 34,
        y: boss.y + 22,
        hp,
        maxHp: hp,
        age: 0,
        flash: 0,
        fireCd: side > 0 ? 1.05 : 0.70,
        dodgeTimer: 0,
        dodgeCooldown: 0,
        dodgeDirection: 0,
      });
    }
    boss.laserState = 'idle';
    setBossManeuver('deploy', MOTHERSHIP_DEPLOY_SECONDS);
    playBossLaserCharge();
  }

  function updateMothershipSupports(dt) {
    const boss = getBoss();
    for (const craft of boss.supports) {
      craft.age += dt;
      craft.flash = Math.max(0, craft.flash - dt);
      const progress = Math.min(1, craft.age / MOTHERSHIP_DEPLOY_SECONDS);
      craft.dodgeTimer = Math.max(0, craft.dodgeTimer - dt);
      craft.dodgeCooldown = Math.max(0, craft.dodgeCooldown - dt);
      if (progress === 1 && craft.dodgeCooldown === 0) {
        for (const bullet of bullets) {
          const ahead = bullet.y - craft.y;
          if (ahead < 20 || ahead > 108 || bullet.vy >= 0) continue;
          const crossingX = bullet.x + bullet.vx * ahead / -bullet.vy;
          if (Math.abs(crossingX - craft.x) > 22) continue;
          const away = crossingX < craft.x ? 1 : -1;
          const target = craft.x + away * 32;
          craft.dodgeDirection = target < 26 || target > W - 26 ? -away : away;
          craft.dodgeTimer = MOTHERSHIP_DODGE_SECONDS;
          craft.dodgeCooldown = getMode() === 'ace' ? 1.05 : 1.35;
          break;
        }
      }
      const dodge = Math.sin(Math.PI * craft.dodgeTimer / MOTHERSHIP_DODGE_SECONDS) * craft.dodgeDirection * 32;
      const weave = Math.sin(craft.age * 3.8 + (craft.side > 0 ? 1.4 : 0)) * 18 * progress;
      const offset = 34 + (72 + weave) * progress;
      craft.x = Math.max(26, Math.min(W - 26, boss.x + craft.side * offset + dodge));
      craft.y = boss.y + 22 + (64 + Math.cos(craft.age * 3.1 + craft.side) * 12) * progress;
      craft.fireCd = Math.max(0, craft.fireCd - dt);
      if (craft.fireCd === 0 && state === 'playing') {
        const angle = Math.atan2(getPlayer().y - craft.y - 10, getPlayer().x - craft.x);
        const speed = 255 + Math.min(boss.tier * 8, 72);
        getEnemyBullets().push({
          x: craft.x,
          y: craft.y + 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 5,
          color: '#f0abfc',
        });
        craft.fireCd = getMode() === 'ace' ? 1.15 : 1.45;
      }
    }
  }

  function hitMothershipSupport(bullet, previousX, previousY) {
    const boss = getBoss();
    const supports = boss?.supports;
    if (!supports?.length) return false;
    for (let i = 0; i < supports.length; i += 1) {
      const craft = supports[i];
      if (!bulletCrossesCircle(bullet, previousX, previousY, craft.x, craft.y, 16 + bullet.r)) continue;
      if (!bullet.explosive) damageMothershipSupport(i, bullet.dmg, bullet);
      return true;
    }
    return false;
  }

  function damageMothershipSupport(index, amount, bullet) {
    const boss = getBoss();
    const supports = boss.supports;
    const craft = supports[index];
    craft.hp -= amount;
    craft.flash = 0.1;
    playHit(bullet?.heavy, true, bullet?.style);
    if (craft.hp > 0) return;
    spawnExplosion(craft.x, craft.y, '#c084fc', 15, 28, 4);
    playExplode(false);
    supports.splice(index, 1);
    boss.supportCooldown = getMode() === 'ace' ? 2.0 : 2.8;
    if (!supports.length) {
      boss.laserState = 'idle';
      setBossManeuver('recover', getMode() === 'ace' ? 0.85 : 1.15);
    }
  }

  function updateMothership(dt) {
    const boss = getBoss();
    boss.supportJam = Math.max(0, boss.supportJam - dt);
    boss.supportCooldown = Math.max(0, boss.supportCooldown - dt);
    boss.maneuverTimer = Math.max(0, boss.maneuverTimer - dt);

    if (boss.maneuver === 'transform') {
      boss.y = Math.min(boss.targetY, boss.y + BOSS_ENTRY_SPEED * dt);
      if (boss.maneuverTimer === 0) {
        boss.phase = 2;
        deployMothershipSupports();
      }
    } else if (boss.maneuver === 'deploy' || boss.maneuver === 'recover') {
      if (boss.maneuverTimer === 0) {
        boss.patternTimer = 0.36;
        setBossManeuver('patrol', 0);
      }
    } else if (boss.y < boss.targetY) {
      boss.y = Math.min(boss.targetY, boss.y + BOSS_ENTRY_SPEED * dt);
    } else if (boss.laserState === 'idle') {
      if (boss.phase === 2 && boss.supports.length < 2 && boss.supportCooldown === 0) {
        deployMothershipSupports();
      } else {
        patrolBoss(dt);
        boss.patternTimer -= dt;
        if (boss.patternTimer <= 0) attackWithMothership();
      }
    } else {
      updateMothershipLaser(dt);
    }
    updateMothershipSupports(dt);
  }

  function attackWithMothership() {
    const boss = getBoss();
    boss.patternIndex = (boss.patternIndex + 1) % 3;
    if (boss.patternIndex === 0) {
      const speed = 225 + Math.min(boss.tier * 12, 95);
      for (let offset = -5; offset <= 5; offset += 1) {
        const angle = Math.PI * (0.5 + 0.07 * offset);
        getEnemyBullets().push({ x: boss.x, y: boss.y + 26, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 6.5, color: '#c084fc' });
      }
      boss.patternTimer = getMode() === 'ace' ? 0.72 : 0.95;
    } else if (boss.patternIndex === 1) {
      for (const offset of [-52, 0, 52]) {
        const x = boss.x + offset;
        const y = boss.y + 20;
        const angle = Math.atan2(getPlayer().y - y, getPlayer().x - x);
        getEnemyBullets().push({ x, y, vx: Math.cos(angle) * 275, vy: Math.sin(angle) * 275, r: 5.5, color: '#e879f9' });
      }
      boss.patternTimer = getMode() === 'ace' ? 0.78 : 1.02;
    } else {
      boss.laserState = 'telegraph';
      boss.laserTimer = getMode() === 'ace' ? 0.66 : 0.78;
      boss.laserWidth = 14;
      const target = getPlayer().x + (getPlayer().x >= boss.x ? -46 : 46);
      boss.laserTargetX = Math.max(94, Math.min(W - 94, target));
      boss.lasers = computeBossLasers(boss);
      boss.patternTimer = getMode() === 'ace' ? 0.42 : 0.57;
      playBossLaserCharge();
    }
  }

  function updateMothershipLaser(dt) {
    const boss = getBoss();
    boss.laserTimer -= dt;
    if (boss.laserState === 'telegraph') {
      if (boss.laserTimer > MOTHERSHIP_LASER_LOCK_SECONDS) {
        boss.x += (boss.laserTargetX - boss.x) * Math.min(1, dt * 9);
        boss.lasers = computeBossLasers(boss);
      }
      if (boss.laserTimer <= 0) {
        boss.laserState = 'fire';
        boss.laserTimer = 0.92;
        triggerShake(6, 0.22);
        playBossLaserFire();
      }
    } else {
      if (boss.lasers.some((beam) => beamHitsPlayer(beam, boss.laserWidth, getPlayer()))) damagePlayer();
      if (boss.laserTimer <= 0) boss.laserState = 'idle';
    }
  }

  function alignCrimsonDash() {
    const boss = getBoss();
    boss.dashX = Math.max(boss.r + 22, Math.min(W - boss.r - 22, getPlayer().x));
    setBossManeuver('dash-align', boss.phase === 2 ? 0.19 : 0.29);
  }

  function fireCrimsonScatter() {
    const boss = getBoss();
    const speed = (getMode() === 'ace' ? 325 : 285) + Math.min(35, boss.tier * 5);
    for (const side of [-1, 1]) {
      for (const spread of CRIMSON_SCATTER_ANGLES) {
        const angle = Math.PI * 0.5 - side * spread;
        getEnemyBullets().push({ x: boss.x + side * 31, y: boss.y + 21,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 5, color: '#fb923c' });
      }
    }
    playBossLaserFire();
  }

  function updateCrimsonBoss(dt) {
    const boss = getBoss();
    if (boss.maneuver === 'patrol' && boss.y < boss.targetY) {
      boss.y = Math.min(boss.targetY, boss.y + BOSS_ENTRY_SPEED * dt);
      return;
    }

    const ace = getMode() === 'ace';
    const enraged = boss.phase === 2;
    const before = boss.maneuverTimer;
    boss.maneuverTimer = Math.max(0, before - dt);
    if (boss.guard) updateCrimsonGuard(dt);

    switch (boss.maneuver) {
      case 'transform':
        boss.y += (boss.targetY - boss.y) * Math.min(1, dt * 6);
        if (boss.maneuverTimer === 0) {
          boss.y = boss.targetY;
          boss.phase = 2;
          boss.dashPass = 1;
          alignCrimsonDash();
        }
        break;
      case 'patrol':
        patrolBoss(dt);
        if (boss.maneuverTimer === 0) alignCrimsonDash();
        break;
      case 'recover':
        if (boss.maneuverTimer === 0) {
          boss.guard = null;
          setBossManeuver('scatter-warn', ace ? 0.48 : 0.60);
          playBossLaserCharge();
        }
        break;
      case 'scatter-warn':
        if (boss.maneuverTimer === 0) {
          fireCrimsonScatter();
          boss.dashPass = 1;
          setBossManeuver('patrol', ace ? 0.40 : 0.56);
        }
        break;
      case 'dash-align':
        boss.x += (boss.dashX - boss.x) * Math.min(1, dt / before);
        if (boss.maneuverTimer === 0) {
          setBossManeuver('dash-warn', enraged ? (ace ? 0.46 : 0.55) : (ace ? 0.55 : 0.68));
          playBossLaserCharge();
        }
        break;
      case 'dash-warn':
        if (boss.maneuverTimer === 0) {
          setBossManeuver('dash', enraged ? (ace ? 0.30 : 0.36) : (ace ? 0.35 : 0.42));
          playBossLaserFire();
        }
        break;
      case 'dash':
        boss.y += (crimsonDashEnd(boss) - boss.y) * Math.min(1, dt / before);
        if (boss.maneuverTimer === 0) {
          if (enraged && boss.dashPass === 1) setBossManeuver('dash-pause', 0.15);
          else setBossManeuver('dash-retreat', enraged ? 0.48 : 0.58);
        }
        break;
      case 'dash-pause':
        if (boss.maneuverTimer === 0) setBossManeuver('dash-retreat', 0.40);
        break;
      case 'dash-retreat':
        boss.y += (boss.targetY - boss.y) * Math.min(1, dt / before);
        if (boss.maneuverTimer === 0) {
          if (enraged && boss.dashPass === 1) {
            boss.dashPass = 2;
            alignCrimsonDash();
          } else {
            if (enraged) spawnCrimsonGuard();
            setBossManeuver('recover', enraged ? (ace ? 0.95 : 1.2) : 1.04);
          }
        }
        break;
    }
  }

  function spawnCrimsonGuard() {
    const boss = getBoss();
    const side = boss.x < W * 0.5 ? 1 : -1;
    const hp = (getMode() === 'ace' ? 13 : 10) + Math.floor(boss.tier / 3);
    boss.guard = { x: boss.x + side * 36, y: boss.y + 8, hp, maxHp: hp, flash: 0, side, age: 0 };
  }

  function updateCrimsonGuard(dt) {
    const boss = getBoss();
    const guard = boss.guard;
    guard.age += dt;
    guard.flash = Math.max(0, guard.flash - dt);
    const opening = Math.min(1, guard.age / 0.34);
    const leaving = Math.max(0, 1 - boss.maneuverTimer / 0.22);
    const flight = Math.max(1 - opening, leaving);
    guard.x = boss.x + guard.side * (36 * flight + 23 * Math.sin(Math.PI * flight));
    guard.y = boss.y + CRIMSON_GUARD_OFFSET + (8 - CRIMSON_GUARD_OFFSET) * flight;
  }

  function hitCrimsonGuard(bullet, previousX, previousY) {
    const boss = getBoss();
    const guard = boss?.guard;
    if (!guard) return false;
    const y = guard.y;
    if (bullet.y > y + 12 + bullet.r || previousY < y - 12 - bullet.r) return false;
    const distance = previousY - bullet.y;
    const travel = distance > 0 ? Math.min(1, Math.max(0, (previousY - y) / distance)) : 0;
    const x = previousX + (bullet.x - previousX) * travel;
    if (Math.abs(x - guard.x) > CRIMSON_GUARD_HALF_WIDTH + bullet.r) return false;
    if (!bullet.explosive) damageCrimsonGuard(bullet.dmg, bullet);
    return true;
  }

  function damageCrimsonGuard(amount, bullet) {
    const boss = getBoss();
    const guard = boss.guard;
    guard.hp -= amount;
    guard.flash = 0.10;
    playHit(bullet?.heavy, true, bullet?.style);
    if (guard.hp <= 0) destroyCrimsonGuard();
  }

  function destroyCrimsonGuard() {
    const boss = getBoss();
    spawnExplosion(boss.guard.x, boss.guard.y, '#fb923c', 12, 27, 3);
    playExplode(false);
    boss.guard = null;
  }

  function firePrismFan(source, second) {
    const boss = getBoss();
    const spacing = Math.PI / 14;
    const count = (getMode() === 'ace' ? 9 : 7) - (source === boss ? 0 : 2);
    const speed = 235 + Math.min(boss.tier * 12, 95) + (second ? 42 : 0);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 0.5 + (i - (count - 1) / 2 + (second ? 0.5 : 0)) * spacing;
      getEnemyBullets().push({ x: source.x + (second ? 22 : -22), y: source.y + 24,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 5,
        color: source === boss ? '#38bdf8' : '#e9a5ff' });
    }
  }

  function startPrismReflection() {
    const boss = getBoss();
    boss.prismReflect = {
      panels: Array(PRISM_REFLECT_PANELS).fill(0),
      cooldown: 0,
      bolts: 0,
    };
    setBossManeuver('reflect-warn', PRISM_REFLECT_WARNING);
    playPrismReflectCue(false);
  }

  function endPrismReflection() {
    const boss = getBoss();
    boss.prismReflect = null;
    spawnExplosion(boss.x, boss.y, '#c4b5fd', 16, 94, 8);
    playPrismReflectCue(true);
    setBossManeuver('recover', getMode() === 'ace' ? 1.05 : 1.30);
  }

  function reflectPrismBolt(bullet, previousX, previousY) {
    const boss = getBoss();
    if (boss?.maneuver !== 'reflect') return false;
    const radius = PRISM_REFLECT_RADIUS + bullet.r;
    const impact = ellipseImpactTime(bullet.x, bullet.y, previousX, previousY, boss.x, boss.y,
      radius, radius * PRISM_REFLECT_ASPECT);
    if (impact === null) return false;
    const x = previousX + (bullet.x - previousX) * impact;
    const y = previousY + (bullet.y - previousY) * impact;
    const dx = x - boss.x;
    const dy = (y - boss.y) / PRISM_REFLECT_ASPECT;

    const shield = boss.prismReflect;
    const sector = Math.round(Math.atan2(dy, dx) / (2 * Math.PI) * PRISM_REFLECT_PANELS);
    shield.panels[(sector + PRISM_REFLECT_PANELS) % PRISM_REFLECT_PANELS] = 0.17;
    if (shield.cooldown > 0 || shield.bolts >= PRISM_REFLECT_MAX_BOLTS) return false;
    shield.cooldown = PRISM_REFLECT_INTERVAL;
    shield.bolts += 1;
    const vx = Math.max(-150, Math.min(150, -bullet.vx * 0.6 + dx * 1.9));
    getEnemyBullets().push({
      x, y, vx, vy: getMode() === 'ace' ? 315 : 280, r: 5.5, reflected: true,
    });
    pushParticle({ x, y, vx: vx * 0.3, vy: 92,
      r: 3.8, color: '#fce7a4', life: 0.20, maxLife: 0.20 });
    return true;
  }

  function startPrismMirror() {
    const boss = getBoss();
    const side = getPlayer().x < W * 0.5 ? -1 : 1;
    const hp = (getMode() === 'ace' ? 270 : 235) + Math.min(45, (boss.tier - 2) * 3);
    boss.prismMirror = {
      side,
      x: W * 0.5 + side * 128,
      y: boss.y - 30,
      r: boss.r,
      hp,
      maxHp: hp,
      age: 0,
      hitFlash: 0,
      attackIndex: 0,
      attackDelay: 0.58,
      nextFromMirror: false,
    };
    setBossManeuver('mirror', 0);
    playBossAlert();
  }

  function destroyPrismMirror() {
    const boss = getBoss();
    const { x, y } = boss.prismMirror;
    if (boss.prismAttack?.fromMirror) boss.prismAttack = null;
    boss.prismMirror = null;
    spawnExplosion(x, y, '#e9a5ff', 17, 62, 7);
    playExplode(false);
    if (boss.prismAttack) setBossManeuver('attack', 0);
    else prismRetreat();
  }

  function hitPrismMirror(bullet, previousX, previousY) {
    const boss = getBoss();
    const mirror = boss?.prismMirror;
    if (!mirror || mirror.age < PRISM_MIRROR_DEPLOY_SECONDS) return false;
    if (!bulletCrossesCircle(bullet, previousX, previousY, mirror.x, mirror.y, mirror.r + bullet.r)) return false;
    if (!bullet.explosive) damagePrismMirror(bullet.dmg, bullet);
    return true;
  }

  function damagePrismMirror(amount, bullet) {
    const boss = getBoss();
    const mirror = boss.prismMirror;
    if (mirror.hitFlash < 0.04) playHit(bullet?.heavy, false, bullet?.style);
    mirror.hp -= amount;
    mirror.hitFlash = 0.09;
    if (mirror.hp <= 0) destroyPrismMirror();
  }

  function updatePrismMirror(dt) {
    const boss = getBoss();
    const mirror = boss.prismMirror;
    const attack = boss.prismAttack;
    mirror.age += dt;
    mirror.hitFlash = Math.max(0, mirror.hitFlash - dt);
    // Keep each warning fixed to its source until that ship finishes attacking.
    if (!attack?.fromMirror) {
      const target = W * 0.5 + mirror.side * 128 + Math.sin(mirror.age * 3.2) * 23;
      mirror.x += Math.sign(target - mirror.x) * Math.min(Math.abs(target - mirror.x), 230 * dt);
      mirror.y = 150 + Math.cos(mirror.age * 4) * 9;
    }
    if (!attack || attack.fromMirror) {
      const target = W * 0.5 - mirror.side * 94 + Math.sin(mirror.age * 2.4) * 21;
      boss.x += Math.sign(target - boss.x) * Math.min(Math.abs(target - boss.x), 230 * dt);
    }
    if (attack) {
      if (updatePrismAttack(dt)) {
        boss.prismAttack = null;
        mirror.nextFromMirror = !attack.fromMirror;
        if (attack.fromMirror) mirror.attackIndex = (mirror.attackIndex + 1) % PRISM_MIRROR_ATTACKS.length;
        mirror.attackDelay = getMode() === 'ace' ? 0.15 : 0.20;
      }
    } else {
      mirror.attackDelay = Math.max(0, mirror.attackDelay - dt);
      if (mirror.attackDelay === 0) {
        startPrismAttack(PRISM_MIRROR_ATTACKS[mirror.attackIndex], mirror.nextFromMirror);
      }
    }
  }

  function setPrismAttackStep(attack, step, duration) {
    attack.step = step;
    attack.remaining = duration;
  }

  function startPrismSweep(attack, secondPass = false) {
    const boss = getBoss();
    const direction = boss.sweepDirection;
    const arc = boss.phase === 2 ? 0.47 : 0.53;
    attack.sweep = {
      from: Math.PI * 0.5 - direction * arc,
      to: Math.PI * 0.5 + direction * arc,
      duration: getMode() === 'ace' ? 0.84 : 1.00,
      width: attack.fromMirror ? PRISM_MIRROR_BEAM_WIDTH : PRISM_BEAM_WIDTH,
      secondPass,
    };
    boss.sweepDirection = -direction;
    setPrismAttackStep(attack, 'sweep-warn', secondPass ? (getMode() === 'ace' ? 0.51 : 0.60) : (getMode() === 'ace' ? 0.62 : 0.74));
    playBossLaserCharge();
  }

  function startPrismAttack(kind, fromMirror = false) {
    const boss = getBoss();
    const attack = { kind, fromMirror };
    boss.prismAttack = attack;
    if (kind === 'fan') {
      firePrismFan(fromMirror ? boss.prismMirror : boss, false);
      setPrismAttackStep(attack, 'fan', getMode() === 'ace' ? 0.23 : 0.30);
    } else if (kind === 'sweep') {
      startPrismSweep(attack);
    } else {
      setPrismAttackStep(attack, 'warn', getMode() === 'ace' ? 0.50 : 0.64);
      playBossLaserCharge();
    }
  }

  function startPrismSoloAttack(kind) {
    setBossManeuver('attack', 0);
    startPrismAttack(kind);
  }

  function updatePrismAttack(dt) {
    const boss = getBoss();
    const attack = boss.prismAttack;
    const source = attack.fromMirror ? boss.prismMirror : boss;
    const before = attack.remaining;
    attack.remaining = Math.max(0, before - dt);
    const finished = attack.remaining === 0;
    switch (attack.step) {
      case 'fan':
        if (finished) firePrismFan(source, true);
        return finished;
      case 'sweep-warn':
        if (finished) {
          setPrismAttackStep(attack, 'sweep-fire', attack.sweep.duration);
          playBossLaserFire();
        }
        break;
      case 'sweep-fire':
        if (beamHitsPlayer(prismBeam(attack, source), attack.sweep.width, getPlayer())) {
          damagePlayer();
          if (state === 'over') return false;
        }
        if (finished) {
          if (boss.phase === 1 || attack.sweep.secondPass) return true;
          startPrismSweep(attack, true);
        }
        break;
      case 'warn':
        if (finished) {
          playBossLaserFire();
          setPrismAttackStep(attack, 'barrage', 0.30);
        }
        break;
      case 'barrage': {
        const color = attack.fromMirror ? '#e9a5ff' : '#67e8f9';
        for (const beat of [0.30, 0.20, 0.10]) {
          if (before < beat || attack.remaining >= beat) continue;
          for (const offset of [-20, 0, 20]) {
            getEnemyBullets().push({ x: source.x + offset, y: source.y + 30,
              vx: 0, vy: 420, r: 8, color, crystal: true });
          }
        }
        return finished;
      }
    }
    return false;
  }

  function prismRetreat() {
    const boss = getBoss();
    boss.vx = -boss.vx;
    setBossManeuver('retreat', 0.43);
  }

  function updatePrismBoss(dt) {
    const boss = getBoss();
    if (boss.maneuver !== 'patrol') {
      updatePrismManeuver(dt);
    } else if (boss.y < boss.targetY) {
      boss.y = Math.min(boss.targetY, boss.y + BOSS_ENTRY_SPEED * dt);
    } else {
      patrolBoss(dt);
      boss.patternTimer -= dt;
      if (boss.patternTimer <= 0) {
        boss.patternIndex = (boss.patternIndex + 1) % 3;
        if (boss.patternIndex === 1) {
          startPrismSoloAttack('fan');
        } else if (boss.patternIndex === 2) {
          startPrismReflection();
        } else {
          startPrismSoloAttack('sweep');
        }
      }
    }
  }

  function updatePrismManeuver(dt) {
    const boss = getBoss();
    const before = boss.maneuverTimer;
    boss.maneuverTimer = Math.max(0, boss.maneuverTimer - dt);
    switch (boss.maneuver) {
      case 'reflect-warn':
        if (boss.maneuverTimer === 0) setBossManeuver('reflect', getMode() === 'ace' ? 2.10 : 1.80);
        break;
      case 'reflect': {
        const shield = boss.prismReflect;
        shield.cooldown = Math.max(0, shield.cooldown - dt);
        for (let i = 0; i < shield.panels.length; i += 1) {
          shield.panels[i] = Math.max(0, shield.panels[i] - dt);
        }
        if (boss.maneuverTimer === 0) endPrismReflection();
        break;
      }
      case 'mirror':
        updatePrismMirror(dt);
        break;
      case 'attack':
        if (updatePrismAttack(dt)) {
          const { kind } = boss.prismAttack;
          boss.prismAttack = null;
          if (boss.phase === 2) {
            prismRetreat();
          } else if (kind === 'fan') {
            boss.patternTimer = getMode() === 'ace' ? 0.66 : 0.90;
            setBossManeuver('patrol', 0);
          } else {
            setBossManeuver('recover', getMode() === 'ace' ? 0.58 : 0.72);
          }
        }
        break;
      case 'transform':
        if (boss.maneuverTimer === 0) {
          boss.phase = 2;
          boss.patternIndex = 0;
          setBossManeuver('reposition', 0.42);
        }
        break;
      case 'reposition': {
        // 留出两侧的躲避通道，先横移，再进入玩家视野的中段。
        const target = W * 0.5;
        boss.x += Math.sign(target - boss.x) * Math.min(Math.abs(target - boss.x), 465 * dt);
        if (boss.maneuverTimer === 0) setBossManeuver('advance', 0.39);
        break;
      }
      case 'advance':
        boss.y = Math.min(188, boss.y + 265 * dt);
        if (boss.maneuverTimer === 0) {
          const attack = PRISM_PHASE_TWO_ATTACKS[boss.patternIndex];
          boss.patternIndex = (boss.patternIndex + 1) % PRISM_PHASE_TWO_ATTACKS.length;
          switch (attack) {
            case 'mirror': startPrismMirror(); break;
            case 'sweep':
            case 'barrage': startPrismSoloAttack(attack); break;
            case 'reflect': startPrismReflection(); break;
          }
        }
        break;
      case 'retreat': {
        boss.y = Math.max(boss.targetY, boss.y - 230 * dt);
        const side = W * 0.5 + Math.sign(boss.vx) * 82;
        boss.x += Math.sign(side - boss.x) * Math.min(Math.abs(side - boss.x), 205 * dt);
        if (getMode() === 'ace' && before > 0.18 && boss.maneuverTimer <= 0.18) {
          for (const offset of [-24, 24]) {
            const x = boss.x + offset;
            const y = boss.y + 27;
            const angle = Math.atan2(getPlayer().y - y, getPlayer().x - x);
            getEnemyBullets().push({ x, y, vx: Math.cos(angle) * 225, vy: Math.sin(angle) * 225,
              r: 5.5, color: '#c4b5fd' });
          }
        }
        if (boss.maneuverTimer === 0) setBossManeuver('recover', getMode() === 'ace' ? 0.78 : 1.08);
        break;
      }
      case 'recover':
        if (boss.maneuverTimer === 0) {
          if (boss.phase === 1) {
            boss.patternTimer = 0.18;
            setBossManeuver('patrol', 0);
          } else {
            setBossManeuver('reposition', 0.42);
          }
        }
        break;
    }
  }

  return {
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
  };
}
