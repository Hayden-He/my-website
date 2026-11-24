import {
  W, H, BOSS_BEAM_LENGTH, BOSS_COUNTER_WARNING, CRIMSON_GUARD_HALF_WIDTH,
  CRIMSON_SCATTER_ANGLES, MOTHERSHIP_DEPLOY_SECONDS, MOTHERSHIP_LASER_LOCK_SECONDS,
  OVERDRIVE_END_CUE, OVERDRIVE_SECONDS, PICKUP_CUE_SECONDS,
  PRISM_MIRROR_DEPLOY_SECONDS, PRISM_REFLECT_ASPECT, PRISM_REFLECT_PANELS,
  PRISM_REFLECT_WARNING, SKINS, PICKUP_THEMES, SPACE_SCENES,
  computeBossLasers, mothershipShieldLinks, crimsonDashEnd, openingEnemyShots, prismBeam,
} from './rules.js';

export function createSpaceRenderer({ ctx, getState, t }) {
  let mode, skin, stars, meteors, sceneIndex, previousScene, sceneBlend, backgroundTime;
  let state, player, boss, bullets, enemyBullets, enemies, pickups, pickupCue;
  let particles, debris, muzzleFlashes, afterimages, shockwaves, floatTexts;
  let empWave, bossAlertAlpha, waveBanner, waveBannerTimer, combo, comboTimer;
  let shakeTimer, shakeMag, flashAlpha, flashColor;

  function drawPlayer(tNow) {
    const sk = SKINS[skin];
    for (const af of afterimages) {
      const trailingSkin = SKINS[af.style];
      ctx.save();
      ctx.globalAlpha = Math.max(0, (af.life / af.maxLife) * 0.28);
      ctx.translate(af.x, af.y);
      ctx.rotate(af.bank);
      traceArmorPlate(trailingSkin.hull);
      ctx.fillStyle = trailingSkin.boostColor;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(player.x, player.y);
    drawPlayerStatus(tNow, sk);
    if (player.invulnTimer > 0 && Math.floor(tNow / 65) % 2 === 0) {
      ctx.restore();
      return;
    }

    ctx.rotate(player.bank);
    ctx.lineJoin = 'round';
    const boost = Math.min(1, player.overdriveTimer / OVERDRIVE_END_CUE);
    const ignition = Math.max(0, 1 - (OVERDRIVE_SECONDS - player.overdriveTimer) / 0.25);
    for (const [x, y, width, base] of sk.engines) {
      const reach = base + Math.sin(tNow * 0.045 + x) * 3 + (9 + ignition * 9) * boost;
      traceArmorPlate([[x - width, y], [x + width, y], [x + width * 0.55, y + reach * 0.55],
        [x, y + reach], [x - width * 0.55, y + reach * 0.55]]);
      ctx.fillStyle = boost > 0 ? sk.boostColor : sk.flame;
      ctx.fill();
      traceArmorPlate([[x - width * 0.38, y], [x + width * 0.38, y], [x, y + reach * 0.60]]);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    traceArmorPlate(sk.hull);
    ctx.fillStyle = sk.wing;
    ctx.strokeStyle = sk.wingHi;
    ctx.lineWidth = 1.45;
    ctx.fill();
    ctx.stroke();

    for (const side of [-1, 1]) {
      if (player.weaponLv >= 2) {
        ctx.fillStyle = sk.wingHi;
        ctx.fillRect(side * 15 - 1.5, 1, 3, 11);
      }
      if (player.weaponLv >= 4) {
        ctx.fillStyle = '#fde047';
        ctx.fillRect(side * 19 - 1.5, 6, 3, 8);
      }
    }

    const shoulder = skin === 'crimson' ? 8 : 6;
    const nose = skin === 'cobalt' ? -23 : -21;
    traceArmorPlate([[0, nose], [shoulder, 8], [4, 14], [-4, 14], [-shoulder, 8]]);
    ctx.fillStyle = sk.body;
    ctx.fill();
    traceArmorPlate([[0, -12], [3.5, -4], [2.5, 3], [-2.5, 3], [-3.5, -4]]);
    ctx.fillStyle = sk.cockpit;
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillRect(-0.8, -7, 1.6, 4);
    ctx.restore();
  }

  function drawPlayerStatus(tNow, sk) {
    if (player.hasShield) {
      const radius = 29 + Math.sin(tNow * 0.012) * 1.4;
      tracePickupFrame('shield', radius);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 1.8;
      ctx.fill();
      ctx.stroke();
    }
    if (player.overdriveTimer > 0) {
      ctx.save();
      const ending = player.overdriveTimer <= OVERDRIVE_END_CUE;
      ctx.rotate(tNow * 0.002);
      ctx.strokeStyle = ending ? '#fbbf24' : sk.boostColor;
      ctx.lineWidth = 2;
      const radius = player.hasShield ? 37 : 30;
      for (let i = 0; i < 4; i += 1) {
        const from = i * Math.PI / 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius, from, from + 0.47);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (pickupCue) {
      const alpha = pickupCue.remaining / PICKUP_CUE_SECONDS;
      ctx.save();
      ctx.globalAlpha = alpha * 0.82;
      tracePickupFrame(pickupCue.type, 29 + (1 - alpha) * 17);
      ctx.strokeStyle = PICKUP_THEMES[pickupCue.type].rim;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemyHpBar(e) {
    if (e.maxHp < 2 || e.hp >= e.maxHp) return;
    const w = Math.max(24, Math.min(40, e.r * 1.45));
    const y = -e.r - 10;
    const pct = Math.max(0, Math.min(1, e.hp / e.maxHp));
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(-w * 0.5 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = pct > 0.5 ? '#4ade80' : (pct > 0.25 ? '#fbbf24' : '#fb7185');
    ctx.fillRect(-w * 0.5, y, w * pct, 4);
  }

  function drawEnemy(e, tNow) {
    ctx.save();
    ctx.translate(e.x, e.y);
    drawOpeningEnemyWarning(e);
    if (e.kind === 'asteroid') {
      drawAsteroid(e);
    } else if (e.kind === 'scout') {
      drawScoutHull(e, tNow);
    } else if (e.kind === 'interceptor') {
      drawInterceptorHull(e, tNow);
    } else if (e.kind === 'drone') {
      // 狙击无人机：激光锁定预警细线
      if (e.lockTimer > 0) {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.72)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(Math.cos(e.lockAngle) * 380, Math.sin(e.lockAngle) * 380);
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(16, 0);
      ctx.lineTo(10, -15);
      ctx.lineTo(-10, -15);
      ctx.lineTo(-16, 0);
      ctx.closePath();
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#6d28d9';
      ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 1, 5.2, 0, Math.PI * 2);
      ctx.fillStyle = '#e879f9';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 1, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else if (e.kind === 'gunship') {
      drawGunshipHull(e, tNow);
    }
    drawEnemyHpBar(e);
    ctx.restore();
  }

  function drawAsteroid(rock) {
    const fast = rock.rockStyle === 'shard';
    const r = rock.r;
    if (fast) {
      const speed = Math.hypot(rock.vx, rock.vy);
      const x = -rock.vx / speed * 33;
      const y = -rock.vy / speed * 33;
      const streak = ctx.createLinearGradient(0, 0, x, y);
      streak.addColorStop(0, 'rgba(252, 180, 113, 0.70)');
      streak.addColorStop(1, 'rgba(252, 180, 113, 0)');
      ctx.lineCap = 'round';
      ctx.lineWidth = r * 0.56;
      ctx.strokeStyle = streak;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.save();
    ctx.rotate(rock.rot);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(rock.poly[0].x, rock.poly[0].y);
    for (let i = 1; i < rock.poly.length; i += 1) ctx.lineTo(rock.poly[i].x, rock.poly[i].y);
    ctx.closePath();
    const face = ctx.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.6, r * 0.65);
    face.addColorStop(0, rock.hitFlash > 0 ? '#fff7ed' : fast ? '#d19a76' : '#808fa4');
    face.addColorStop(1, fast ? '#705056' : '#37455e');
    ctx.fillStyle = face;
    ctx.strokeStyle = rock.hitFlash > 0 ? '#fff7ed' : fast ? '#ffcd9f' : '#adbbce';
    ctx.lineWidth = 1.65;
    ctx.fill();
    ctx.stroke();

    if (fast) {
      traceArmorPlate([[0, -r * 0.67], [r * 0.35, -r * 0.16], [r * 0.16, r * 0.55],
        [-r * 0.19, r * 0.26], [-r * 0.23, -r * 0.14]]);
      ctx.fillStyle = 'rgba(255, 206, 159, 0.45)';
      ctx.fill();
    } else {
      for (const [x, y, size] of [[-0.29, -0.18, 0.21], [0.29, 0.27, 0.15]]) {
        ctx.beginPath();
        ctx.ellipse(r * x, r * y, r * size, r * size * 0.73, 0.27, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(18, 27, 47, 0.61)';
        ctx.strokeStyle = 'rgba(200, 215, 225, 0.47)';
        ctx.lineWidth = 1.1;
        ctx.fill();
        ctx.stroke();
      }
    }

    if (rock.hp < rock.maxHp) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rock.hp <= rock.maxHp * 0.5 ? '#fdba83' : 'rgba(241, 189, 162, 0.72)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.43, r * 0.26);
      ctx.lineTo(-r * 0.10, r * 0.08);
      ctx.lineTo(r * 0.08, r * 0.31);
      ctx.lineTo(r * 0.34, -r * 0.34);
      if (rock.hp <= rock.maxHp * 0.5) {
        ctx.moveTo(r * 0.08, r * 0.31);
        ctx.lineTo(r * 0.20, r * 0.60);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOpeningEnemyWarning(enemy) {
    if (!enemy.lesson || enemy.lockTimer <= 0) return;
    ctx.save();
    ctx.setLineDash(enemy.lesson === 'spread' ? [6, 7] : [4, 6]);
    ctx.strokeStyle = enemy.lesson === 'spread' ? 'rgba(251, 191, 36, 0.69)' : 'rgba(110, 231, 183, 0.72)';
    ctx.lineWidth = 1.6;
    for (const shot of openingEnemyShots(enemy, mode)) {
      ctx.beginPath();
      ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.x + Math.cos(shot.angle) * H, shot.y + Math.sin(shot.angle) * H);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemyEngine(x, y, length, width, color) {
    traceArmorPlate([[x - width, y], [x, y - length], [x + width, y]]);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawScoutHull(enemy, tNow) {
    drawEnemyEngine(0, -12, 6 + Math.sin(tNow * 0.04 + enemy.phase) * 2.5, 3, '#fb923c');
    traceArmorPlate([[0, -15], [7, -6], [10, -2], [5, 8], [0, 17], [-5, 8], [-10, -2], [-7, -6]]);
    ctx.fillStyle = enemy.hitFlash > 0 ? '#fff1f2' : '#9f254a';
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1.4;
    ctx.fill();
    ctx.stroke();
    traceArmorPlate([[0, -10], [4, -3], [2, 8], [0, 12], [-2, 8], [-4, -3]]);
    ctx.fillStyle = '#fc6d90';
    ctx.fill();
    ctx.fillStyle = '#fff1cf';
    ctx.fillRect(-1.5, -2, 3, 7);
  }

  function drawInterceptorHull(enemy, tNow) {
    ctx.save();
    if (enemy.lesson === 'flank') {
      const phase = Math.max(0, Math.min(1, (enemy.y - 8) / 138));
      ctx.rotate(enemy.entrySide * Math.sin(Math.PI * phase) * 0.42);
    }
    const thrust = 7 + Math.sin(tNow * 0.04 + enemy.phase) * 2.5;
    for (const side of [-1, 1]) {
      drawEnemyEngine(side * 10, -8, thrust, 2.4, '#45e6bd');
    }
    traceArmorPlate([[0, 19], [9, 6], [20, -6], [18, -14], [10, -8], [5, -9],
      [0, -14], [-5, -9], [-10, -8], [-18, -14], [-20, -6], [-9, 6]]);
    ctx.fillStyle = enemy.hitFlash > 0 ? '#f0fdfa' : '#0b594c';
    ctx.strokeStyle = '#87e8c1';
    ctx.lineWidth = 1.4;
    ctx.fill();
    ctx.stroke();
    for (const side of [-1, 1]) {
      traceArmorPlate([[side * 17, -10], [side * 17, -6], [side * 8, 4], [side * 9, -4]]);
      ctx.fillStyle = '#37b89b';
      ctx.fill();
    }
    traceArmorPlate([[0, -7], [4, 0], [0, 11], [-4, 0]]);
    ctx.fillStyle = enemy.lockTimer > 0 ? '#f8fafc' : '#71e7cf';
    ctx.fill();
    ctx.restore();
  }

  function drawGunshipHull(enemy, tNow) {
    const thrust = 8 + Math.sin(tNow * 0.035 + enemy.phase) * 3;
    for (const side of [-1, 1]) {
      drawEnemyEngine(side * 15, -16, thrust, 4, '#fb923c');
    }
    traceArmorPlate([[-26, -3], [-21, -19], [-11, -22], [11, -22], [21, -19], [26, -3],
      [23, 13], [13, 16], [8, 22], [-8, 22], [-13, 16], [-23, 13]]);
    ctx.fillStyle = enemy.hitFlash > 0 ? '#fff7ed' : '#5e3b36';
    ctx.strokeStyle = '#facc78';
    ctx.lineWidth = 1.7;
    ctx.fill();
    ctx.stroke();
    traceArmorPlate([[-9, -17], [9, -17], [13, -10], [9, 9], [-9, 9], [-13, -10]]);
    ctx.fillStyle = '#b37345';
    ctx.fill();
    for (const side of [-1, 1]) {
      const x = side * 16;
      ctx.fillStyle = '#2d2026';
      ctx.fillRect(x - 4, -9, 8, 18);
      ctx.fillStyle = '#feb86d';
      ctx.fillRect(x - 3, 8, 6, 5);
    }
    ctx.fillStyle = enemy.lockTimer > 0 ? '#fff7ca' : '#f0a94f';
    ctx.fillRect(-4, 11, 8, 7);
  }

  function drawBoss(tNow) {
    if (!boss) return;
    const lasers = boss.lasers || computeBossLasers(boss);
    const beamPalette = { outer: 'rgba(192, 132, 252, 0.34)', core: '#e9d5ff', warn: '192, 132, 252' };

    const prismAttack = boss.prismAttack;
    const prismSource = prismAttack?.fromMirror ? boss.prismMirror : boss;
    if (prismAttack?.sweep) drawPrismSweep(prismAttack, prismSource);
    if (boss.campCounter) drawBossCampWarning(boss.campCounter);
    if (boss.maneuver === 'dash-warn') drawCrimsonDashWarning();
    if (boss.maneuver === 'scatter-warn') drawCrimsonScatterWarning();

    if (prismAttack?.step === 'warn') {
      const x = prismSource.x - 36;
      const y = prismSource.y + 30;
      ctx.save();
      ctx.fillStyle = prismAttack.fromMirror ? 'rgba(232, 121, 249, 0.18)' : 'rgba(56, 189, 248, 0.18)';
      ctx.fillRect(x, y, 72, H - y);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = prismAttack.fromMirror ? '#e9a5ff' : '#7dd3fc';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 72, H - y);
      ctx.restore();
    }

    // 虚线随炮口瞄准，锁定后用实线标出两条光束的边界。
    if (boss.laserState === 'telegraph') {
      const locked = boss.laserTimer <= MOTHERSHIP_LASER_LOCK_SECONDS;
      const blink = 0.48 + Math.sin(tNow * 0.038) * 0.36;
      for (const beam of lasers) {
        ctx.save();
        ctx.translate(beam.x, beam.y);
        ctx.beginPath();
        ctx.arc(0, 0, 5 + blink * 4, 0, Math.PI * 2);
        ctx.fillStyle = locked ? '#fed7aa' : `rgba(${beamPalette.warn}, ${(0.45 + blink * 0.35).toFixed(2)})`;
        ctx.fill();
        ctx.rotate(beam.angle);
        ctx.fillStyle = locked ? 'rgba(251, 146, 60, 0.26)' : 'rgba(' + beamPalette.warn + ', 0.12)';
        ctx.fillRect(0, -boss.laserWidth, BOSS_BEAM_LENGTH, boss.laserWidth * 2);
        if (locked) {
          ctx.strokeStyle = '#fed7aa';
          ctx.lineWidth = 2.2;
          ctx.strokeRect(0, -boss.laserWidth, BOSS_BEAM_LENGTH, boss.laserWidth * 2);
        } else {
          ctx.setLineDash([8, 6]);
          ctx.strokeStyle = `rgba(${beamPalette.warn}, ${(0.28 + blink * 0.65).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(BOSS_BEAM_LENGTH, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (boss.laserState === 'fire') {
      for (const beam of lasers) {
        drawBossBeam(beam, boss.laserWidth, beamPalette.outer, beamPalette.core);
      }
    }

    if (boss.supports?.length) drawMothershipSupports(tNow);
    if (boss.prismMirror) drawPrismMirror(tNow);

    ctx.save();
    ctx.translate(boss.x, boss.y);
    const hit = boss.hitFlash > 0;

    if (boss.kind === 'prism') {
      drawPrismHull(tNow, hit);
      if (boss.prismReflect) drawPrismReflection(tNow);
      if (boss.prismMirror) drawPrismFightLabel(t('本体'), -58, '#fde68a');
    } else if (boss.kind === 'mothership') {
      drawMothershipHull(tNow, hit);
    } else {
      drawCrimsonHull(tNow, hit);
      if (boss.guard) drawCrimsonGuard();
    }
    ctx.restore();
  }

  function drawBossCampWarning(counter) {
    const progress = 1 - counter.remaining / BOSS_COUNTER_WARNING;
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5 + progress;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(counter.x, counter.y);
    ctx.lineTo(counter.targetX, counter.targetY);
    ctx.stroke();
    ctx.translate(counter.targetX, counter.targetY);
    ctx.setLineDash([]);
    const radius = 25 - progress * 7;
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, angle - 0.38, angle + 0.38);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMothershipHull(tNow, hit) {
    const transforming = boss.maneuver === 'transform';
    const opened = transforming ? 1 - boss.maneuverTimer : boss.phase === 2 ? 1 : 0;
    const exposed = boss.maneuver === 'recover';
    const edge = boss.phase === 2 ? '#f0abfc' : '#c4b5fd';
    const links = mothershipShieldLinks(boss);
    ctx.lineJoin = 'round';

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.translate(opened * 8, -opened * 4);
      traceArmorPlate([[12, -31], [37, -30], [54, -17], [61, 10], [46, 28], [23, 17], [15, 2]]);
      const wing = ctx.createLinearGradient(20, -32, 58, 28);
      wing.addColorStop(0, '#665687');
      wing.addColorStop(0.47, '#37305b');
      wing.addColorStop(1, '#181429');
      ctx.fillStyle = hit ? '#e9d5ff' : wing;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.7;
      ctx.fill();
      ctx.stroke();

      traceArmorPlate([[24, -25], [36, -24], [48, -15], [44, -4], [36, -9], [24, -10]]);
      ctx.fillStyle = '#72618e';
      ctx.fill();
      const bay = ctx.createLinearGradient(0, 0, 0, 25);
      bay.addColorStop(0, '#0b1021');
      bay.addColorStop(1, opened > 0.5 ? '#423176' : '#241b46');
      traceArmorPlate([[22, -3], [38, -4], [48, 9], [40, 21], [28, 17]]);
      ctx.fillStyle = bay;
      ctx.strokeStyle = '#9f8bca';
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = boss.maneuver === 'deploy' ? '#a5f3fc' : '#ab88e0';
      ctx.fillRect(29, 13, 10, 2);
      ctx.fillRect(26, 7, 14, 2);
      ctx.restore();
    }

    traceArmorPlate([[-27, -34], [27, -34], [43, -17], [40, 13], [25, 33],
      [0, 42], [-25, 33], [-40, 13], [-43, -17]]);
    const hull = ctx.createLinearGradient(-32, -38, 31, 43);
    hull.addColorStop(0, '#59506e');
    hull.addColorStop(0.55, '#241c3b');
    hull.addColorStop(1, '#120e21');
    ctx.fillStyle = hit && !links ? '#f3e8ff' : hull;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.2;
    ctx.fill();
    ctx.stroke();
    traceArmorPlate([[-20, -28], [20, -28], [28, -18], [10, -12], [-10, -12], [-28, -18]]);
    ctx.fillStyle = '#7e7198';
    ctx.fill();
    ctx.fillStyle = '#d8b4fe';
    ctx.fillRect(-12, -24, 24, 3);

    const coreWidth = exposed ? 14 : 8 + opened * 1.7;
    const core = exposed ? '#ffecaa' : '#d8b4fe';
    traceArmorPlate([[0, -4], [coreWidth + 6, 9], [coreWidth, 22], [0, 32],
      [-coreWidth, 22], [-coreWidth - 6, 9]]);
    ctx.fillStyle = exposed ? '#583753' : '#150e27';
    ctx.strokeStyle = exposed ? '#fcd37a' : '#9779c3';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    const pulse = Math.sin(tNow * 0.012) * (exposed ? 1.6 : 0.65);
    traceArmorPlate([[0, 3 - pulse], [coreWidth, 13], [0, 25 + pulse], [-coreWidth, 13]]);
    ctx.fillStyle = core;
    ctx.fill();
    traceArmorPlate([[0, 3 - pulse], [0, 25 + pulse], [-coreWidth, 13]]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fill();

    if (links || transforming) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 71 + opened * 3, 49, 0, 0, Math.PI * 2);
      ctx.fillStyle = links === 2 ? 'rgba(103, 232, 249, 0.13)' : 'rgba(103, 232, 249, 0.05)';
      ctx.fill();
      ctx.strokeStyle = transforming ? '#e9d5ff' : hit ? '#e0fdff' : '#67e8f9';
      ctx.lineWidth = links === 2 ? 2.5 : 1.6;
      if (links < 2) ctx.setLineDash([7, 5]);
      ctx.stroke();
    }
  }

  function drawMothershipSupports(tNow) {
    for (const craft of boss.supports) {
      const linked = boss.supportJam === 0 && craft.age >= MOTHERSHIP_DEPLOY_SECONDS;
      ctx.save();
      if (linked) {
        const x = boss.x + craft.side * 41;
        const y = boss.y + 16;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(craft.x, craft.y);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.strokeStyle = '#a5f3fc';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        const pulse = (craft.age * 1.7) % 1;
        ctx.beginPath();
        ctx.arc(craft.x + (x - craft.x) * pulse, craft.y + (y - craft.y) * pulse, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ecfeff';
        ctx.fill();
      }

      ctx.translate(craft.x, craft.y);
      ctx.lineJoin = 'round';
      traceArmorPlate([[0, -15], [8, -8], [16, -2], [15, 8], [6, 8], [0, 15], [-6, 8],
        [-15, 8], [-16, -2], [-8, -8]]);
      ctx.fillStyle = craft.flash > 0 ? '#e0fcff' : '#204760';
      ctx.strokeStyle = '#85f1fa';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      traceArmorPlate([[0, -7], [6, 0], [0, 8], [-6, 0]]);
      ctx.fillStyle = linked ? '#b7f9ff' : '#4f90a5';
      ctx.fill();

      const thrust = 4 + Math.sin(tNow * 0.05 + craft.side) * 2;
      for (const side of [-1, 1]) {
        traceArmorPlate([[side * 8, 7], [side * 13, 7], [side * 10, 9 + thrust]]);
        ctx.fillStyle = '#bc91ff';
        ctx.fill();
      }
      ctx.fillStyle = '#160f2a';
      ctx.fillRect(-17, -24, 34, 6);
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(-16, -23, 32 * craft.hp / craft.maxHp, 4);
      ctx.restore();
    }
  }

  function drawCrimsonDashWarning() {
    const end = crimsonDashEnd(boss);
    const halfWidth = boss.r + 10;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = halfWidth * 2;
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.20)';
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y);
    ctx.lineTo(boss.x, end);
    ctx.stroke();

    ctx.lineCap = 'butt';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fda4af';
    ctx.setLineDash([7, 6]);
    for (const side of [-1, 1]) {
      const x = boss.x + side * halfWidth;
      ctx.beginPath();
      ctx.moveTo(x, boss.y);
      ctx.lineTo(x, end);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(boss.x, end, halfWidth, 0, Math.PI);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 2.5;
    for (let y = boss.y + 75; y < end; y += 74) {
      ctx.beginPath();
      ctx.moveTo(boss.x - 10, y - 6);
      ctx.lineTo(boss.x, y + 5);
      ctx.lineTo(boss.x + 10, y - 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCrimsonScatterWarning() {
    const y = boss.y + 21;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(253, 186, 116, 0.68)';
    ctx.setLineDash([5, 8]);
    for (const side of [-1, 1]) {
      const x = boss.x + side * 31;
      for (const spread of CRIMSON_SCATTER_ANGLES) {
        const angle = Math.PI * 0.5 - side * spread;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * H, y + Math.sin(angle) * H);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, 5 + (1 - boss.maneuverTimer) * 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fed7aa';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCrimsonHull(tNow, hit) {
    const transforming = boss.maneuver === 'transform';
    const opening = transforming ? 1 - boss.maneuverTimer : boss.phase === 2 ? 1 : 0;
    const charging = boss.maneuver === 'dash-warn';
    const diving = boss.maneuver === 'dash';
    const recovering = boss.maneuver === 'recover';
    const glow = recovering ? '#fef3c7' : opening > 0.5 ? '#fb923c' : '#f43f5e';
    ctx.lineJoin = 'round';

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      if (opening > 0) {
        ctx.globalAlpha = opening;
        traceArmorPlate([[21, -31], [33, -28], [39, -12], [34, 5], [26, 0], [22, -13]]);
        ctx.fillStyle = '#5a2b32';
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1.7;
        ctx.fill();
        ctx.stroke();
        traceArmorPlate([[26, -26], [32, -24], [36, -11], [31, -3], [27, -12]]);
        ctx.fillStyle = charging || diving ? '#fff5cf' : '#fb923c';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.translate(opening * 14, 0);
      const exhaust = 8 + (diving ? 60 : charging ? 23 : opening * 14) + Math.sin(tNow * 0.052 + side) * 3;
      const plume = ctx.createLinearGradient(0, -25, 0, -25 - exhaust);
      plume.addColorStop(0, '#fff5cf');
      plume.addColorStop(0.25, glow);
      plume.addColorStop(1, 'rgba(244, 63, 94, 0)');
      traceArmorPlate([[12, -25], [22, -25 - exhaust], [31, -27], [26, -18], [17, -17]]);
      ctx.fillStyle = plume;
      ctx.fill();

      traceArmorPlate([[10, -32], [31, -31], [43, -20], [46, 1], [28, 25], [17, 15], [13, -2]]);
      const armor = ctx.createLinearGradient(12, -34, 42, 20);
      armor.addColorStop(0, '#e1475e');
      armor.addColorStop(0.45, '#912138');
      armor.addColorStop(1, '#310d20');
      ctx.fillStyle = hit ? '#fff1f2' : armor;
      ctx.strokeStyle = opening > 0.5 ? '#fdab80' : '#fda4af';
      ctx.lineWidth = 1.7;
      ctx.fill();
      ctx.stroke();

      traceArmorPlate([[15, -28], [28, -27], [36, -17], [38, -6], [32, -1], [25, -18], [16, -18]]);
      ctx.fillStyle = '#f47b7f';
      ctx.fill();
      traceArmorPlate([[27, 2], [40, -1], [35, 9], [28, 17]]);
      ctx.fillStyle = '#431325';
      ctx.fill();
      if (opening > 0) {
        ctx.globalAlpha = opening;
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(18, -29);
        ctx.lineTo(23, -14);
        ctx.lineTo(18, 1);
        ctx.lineTo(22, 9);
        ctx.stroke();
      }
      ctx.restore();
    }

    traceArmorPlate([[-22, -28], [22, -28], [31, -9], [24, 15], [0, 43], [-24, 15], [-31, -9]]);
    const hull = ctx.createLinearGradient(-23, -27, 24, 41);
    hull.addColorStop(0, '#733143');
    hull.addColorStop(0.5, '#321324');
    hull.addColorStop(1, '#180b16');
    ctx.fillStyle = hit ? '#fecdd3' : hull;
    ctx.strokeStyle = opening > 0.5 ? '#fdba74' : '#fecdd3';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    traceArmorPlate([[-15, -12], [0, -22], [15, -12], [11, 11], [0, 29], [-11, 11]]);
    ctx.fillStyle = opening > 0.5 ? '#7c2035' : '#a6324d';
    ctx.fill();
    traceArmorPlate([[-5, -13], [5, -13], [4 + opening * 4, 8], [0, 20], [-4 - opening * 4, 8]]);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.fillStyle = '#fff6df';
    ctx.fillRect(-2, -11, 4, 17 + opening * 3);

    if (transforming) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 56 + opening * 11, 49, 0, 0, Math.PI * 2);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#fed7aa';
      ctx.stroke();
    }
  }

  function drawCrimsonGuard() {
    const guard = boss.guard;
    const half = CRIMSON_GUARD_HALF_WIDTH;
    ctx.save();
    ctx.translate(guard.x - boss.x, guard.y - boss.y);
    const thrust = 5 + Math.sin(guard.age * 34) * 2;
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      traceArmorPlate([[8, -10], [12, -10 - thrust], [16, -10]]);
      ctx.fillStyle = '#fb923c';
      ctx.fill();
      traceArmorPlate([[6, -10], [17, -11], [half, -2], [16, 7], [6, 5]]);
      ctx.fillStyle = guard.flash > 0 ? '#fff1dc' : '#87412c';
      ctx.strokeStyle = '#fdba74';
      ctx.lineWidth = 1.3;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    traceArmorPlate([[-7, -11], [7, -11], [10, 2], [0, 12], [-10, 2]]);
    ctx.fillStyle = guard.flash > 0 ? '#fff1dc' : '#302126';
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 1.4;
    ctx.fill();
    ctx.stroke();
    traceArmorPlate([[0, -5], [4, 1], [0, 6], [-4, 1]]);
    ctx.fillStyle = '#fde68a';
    ctx.fill();
    ctx.fillStyle = '#29121b';
    ctx.fillRect(-half - 1, -24, half * 2 + 2, 6);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-half, -23, half * 2 * guard.hp / guard.maxHp, 4);
    ctx.restore();
  }

  function drawBossBeam(beam, width, outer, core) {
    ctx.save();
    ctx.translate(beam.x, beam.y);
    ctx.rotate(beam.angle);
    ctx.fillStyle = outer;
    ctx.fillRect(0, -width, BOSS_BEAM_LENGTH, width * 2);
    ctx.fillStyle = core;
    ctx.fillRect(0, -width * 0.52, BOSS_BEAM_LENGTH, width * 1.04);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, -width * 0.26, BOSS_BEAM_LENGTH, width * 0.52);
    ctx.beginPath();
    ctx.arc(0, 0, width * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPrismSweep(attack, source) {
    const beam = prismBeam(attack, source);
    const { from, to, secondPass, width } = attack.sweep;
    const color = attack.fromMirror ? '240, 171, 252' : secondPass ? '196, 181, 253' : '125, 211, 252';
    if (attack.step === 'sweep-fire') {
      drawBossBeam(beam, width, 'rgba(' + color + ', 0.46)', 'rgb(' + color + ')');
      return;
    }

    ctx.save();
    ctx.translate(beam.x, beam.y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, BOSS_BEAM_LENGTH, from, to, to < from);
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + color + ', 0.14)';
    ctx.fill();

    ctx.save();
    ctx.rotate(from);
    ctx.fillStyle = 'rgba(' + color + ', 0.28)';
    ctx.fillRect(0, -width, BOSS_BEAM_LENGTH, width * 2);
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = 'rgb(' + color + ')';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(BOSS_BEAM_LENGTH, 0);
    ctx.stroke();
    ctx.restore();

    const radius = 126;
    const angle = from + (to - from) * 0.78;
    ctx.strokeStyle = 'rgb(' + color + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, from, angle, to < from);
    ctx.stroke();
    ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.rotate(angle + Math.sign(to - from) * Math.PI * 0.5);
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(0, 0);
    ctx.lineTo(-9, 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawPrismHull(tNow, hit, mirror = false) {
    const transforming = !mirror && boss.maneuver === 'transform';
    const exposed = !mirror && boss.maneuver === 'recover';
    const progress = transforming ? 1 - boss.maneuverTimer : boss.phase === 2 ? 1 : 0;
    const opened = progress * progress * (3 - 2 * progress);
    const attack = boss.prismAttack;
    const charging = attack && attack.fromMirror === mirror && attack.kind !== 'fan';
    const edge = mirror ? '#e9a5ff' : boss.phase === 2 ? '#a5a4ff' : '#7dd3fc';
    const glow = mirror ? '#f5c2ff' : exposed ? '#ffdd8b' : charging ? '#e6fcff' : '#66ddff';
    ctx.lineJoin = 'round';

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      if (opened > 0) {
        ctx.beginPath();
        ctx.moveTo(19, 0);
        ctx.lineTo(47 + opened * 16, -opened * 14);
        ctx.strokeStyle = 'rgba(147, 197, 253, ' + (opened * 0.72) + ')';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.translate(27 + opened * 34, -opened * 10);
      ctx.rotate(-opened * 0.67);
      ctx.globalAlpha *= 1 - opened * 0.16;
      traceArmorPlate([[0, -28], [19, -19], [23, 9], [5, 30], [-8, 15], [-11, -12]]);
      const plating = ctx.createLinearGradient(-10, -22, 25, 24);
      plating.addColorStop(0, hit ? '#c6efff' : '#466f96');
      plating.addColorStop(0.55, '#182e52');
      plating.addColorStop(1, '#091325');
      ctx.fillStyle = plating;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.8;
      ctx.fill();
      ctx.stroke();

      traceArmorPlate([[1, -22], [15, -13], [17, 7], [4, 23], [-2, 4]]);
      ctx.fillStyle = charging ? '#63e0f9' : '#21668d';
      ctx.fill();
      traceArmorPlate([[1, -22], [8, -5], [4, 23], [-2, 4]]);
      ctx.fillStyle = charging ? '#d9ffff' : '#459bbb';
      ctx.fill();

      ctx.strokeStyle = '#87acc5';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-7, -11);
      ctx.lineTo(-4, 13);
      ctx.lineTo(1, 19);
      ctx.stroke();
      ctx.restore();
    }

    const shoulder = 28 - opened * 10;
    const nose = 38 - opened * 13;
    traceArmorPlate([[0, -39], [shoulder, -17], [shoulder + 3, 11], [15, 24],
      [0, nose], [-15, 24], [-shoulder - 3, 11], [-shoulder, -17]]);
    const hull = ctx.createLinearGradient(-28, -37, 24, 31);
    hull.addColorStop(0, '#526c8d');
    hull.addColorStop(0.42, '#20385a');
    hull.addColorStop(0.43, '#14223d');
    hull.addColorStop(1, '#081021');
    ctx.fillStyle = hit ? '#d0ecff' : hull;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    traceArmorPlate([[0, -32], [shoulder - 4, -14], [10, -10], [0, -22],
      [-10, -10], [-shoulder + 4, -14]]);
    ctx.fillStyle = '#789bb4';
    ctx.fill();
    ctx.fillStyle = glow;
    ctx.fillRect(-2, -29, 4, 11);

    ctx.save();
    ctx.translate(0, 6);
    ctx.strokeStyle = '#060d1d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 15 + opened * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = edge;
    ctx.stroke();

    const angle = charging && attack.sweep ? prismBeam(attack, mirror ? boss.prismMirror : boss).angle
      : Math.PI * 0.5 + Math.sin(tNow * 0.003) * (0.25 + opened * 0.22);
    ctx.rotate(angle - Math.PI * 0.5);
    traceArmorPlate([[-7, -9], [7, -9], [9, 10], [4, 17], [-4, 17], [-9, 10]]);
    ctx.fillStyle = '#192d46';
    ctx.strokeStyle = '#8fb7d0';
    ctx.fill();
    ctx.stroke();
    traceArmorPlate([[0, -11 - opened * 4], [8 + opened * 3, 1], [0, 13 + opened * 3], [-8 - opened * 3, 1]]);
    ctx.fillStyle = glow;
    ctx.fill();
    traceArmorPlate([[0, -11 - opened * 4], [0, 13 + opened * 3], [-8 - opened * 3, 1]]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.fill();
    ctx.restore();

    if (transforming) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 54 + opened * 31, 46 - opened * 9, 0, 0, Math.PI * 2);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#d5edff';
      ctx.stroke();
    }
  }

  function drawPrismFightLabel(text, y, color) {
    ctx.save();
    ctx.font = '800 15px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(text).width * 0.5 + 11;
    traceArmorPlate([[-width, y], [-width + 5, y - 10], [width - 5, y - 10], [width, y],
      [width - 5, y + 10], [-width + 5, y + 10]]);
    ctx.fillStyle = 'rgba(9, 13, 27, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(text, 0, y);
    ctx.restore();
  }

  function drawPrismMirror(tNow) {
    const mirror = boss.prismMirror;
    const arriving = Math.min(1, mirror.age / PRISM_MIRROR_DEPLOY_SECONDS);
    ctx.save();
    ctx.translate(mirror.x, mirror.y);
    ctx.globalAlpha = 0.19 + arriving * 0.49;
    const aura = ctx.createRadialGradient(0, 0, 17, 0, 0, 48);
    aura.addColorStop(0, 'rgba(216, 135, 255, 0.10)');
    aura.addColorStop(0.65, 'rgba(216, 135, 255, 0.34)');
    aura.addColorStop(1, 'rgba(216, 135, 255, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(-48, -48, 96, 96);
    drawPrismHull(tNow, mirror.hitFlash > 0, true);
    ctx.beginPath();
    ctx.ellipse(0, 0, 54, 40, 0, 0, Math.PI * 2);
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -mirror.age * 30;
    ctx.strokeStyle = '#e9a5ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.50 + arriving * 0.50;
    drawPrismFightLabel(t('镜像'), -58, '#f0abfc');
    ctx.fillStyle = '#170d2b';
    ctx.fillRect(-27, -43, 54, 6);
    ctx.fillStyle = '#e879f9';
    ctx.fillRect(-26, -42, 52 * mirror.hp / mirror.maxHp, 4);
    ctx.restore();
  }

  function drawPrismReflection(tNow) {
    const active = boss.maneuver === 'reflect';
    const progress = active ? 1 : 1 - boss.maneuverTimer / PRISM_REFLECT_WARNING;
    ctx.save();
    ctx.scale(1, PRISM_REFLECT_ASPECT);
    const halo = ctx.createRadialGradient(0, 0, 42, 0, 0, 84);
    halo.addColorStop(0, 'rgba(224, 219, 255, 0)');
    halo.addColorStop(0.50, active ? 'rgba(196, 181, 253, 0.36)' : 'rgba(196, 181, 253, 0.18)');
    halo.addColorStop(1, 'rgba(126, 96, 231, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-84, -84, 168, 168);

    const angleStep = Math.PI * 2 / PRISM_REFLECT_PANELS;
    for (let i = 0; i < PRISM_REFLECT_PANELS; i += 1) {
      const lit = Math.max(0, Math.min(1, (progress - i * 0.12) * 5));
      const flash = boss.prismReflect.panels[i] / 0.17;
      ctx.save();
      ctx.rotate(angleStep * i);
      ctx.translate((1 - lit) * 10, 0);
      ctx.globalAlpha = 0.18 + lit * 0.82;
      traceArmorPlate([[49, -15], [57, -23], [66, -21], [66, 21], [57, 23], [49, 15]]);
      const glass = ctx.createLinearGradient(48, -20, 68, 20);
      glass.addColorStop(0, flash > 0 ? '#fff7d6' : '#ede9fe');
      glass.addColorStop(0.38, '#a5a3fc');
      glass.addColorStop(0.43, '#4f3aa0');
      glass.addColorStop(0.72, '#7629a5');
      glass.addColorStop(1, '#281a57');
      ctx.fillStyle = glass;
      ctx.strokeStyle = flash > 0 ? '#fff2bc' : '#e9ddff';
      ctx.lineWidth = 1.6 + flash;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(52, -12);
      ctx.lineTo(58, -18);
      ctx.lineTo(62, -16);
      ctx.lineTo(62, 13);
      ctx.strokeStyle = flash > 0 ? '#ffffff' : '#c7d2fe';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(73, 0, 1.6 + flash * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff1b5';
      ctx.fill();
      ctx.restore();
    }

    ctx.rotate(tNow * 0.0009);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = active ? 'rgba(233, 213, 255, 0.70)' : 'rgba(233, 213, 255, 0.35)';
    ctx.setLineDash([8, 9, 2, 9]);
    ctx.beginPath();
    ctx.arc(0, 0, 77, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawReflectedBolt(bullet) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(Math.atan2(-bullet.vx, bullet.vy));
    const trail = ctx.createLinearGradient(0, 2, 0, -26);
    trail.addColorStop(0, '#fbbf24');
    trail.addColorStop(0.40, '#ec4899');
    trail.addColorStop(1, 'rgba(236, 72, 153, 0)');
    traceArmorPlate([[-5, 1], [-3, -14], [0, -26], [3, -14], [5, 1]]);
    ctx.fillStyle = trail;
    ctx.fill();
    traceArmorPlate([[-5, -2], [-3, -6], [3, -6], [5, -2], [0, 8]]);
    ctx.fillStyle = '#fff3be';
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -4, 2, 7);
    ctx.restore();
  }

  function traceArmorPlate(points) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
  }

  function tracePickupFrame(type, r) {
    if (type === 'weapon') {
      traceArmorPlate([[0, -r], [r, -r * 0.18], [r * 0.8, r], [-r * 0.8, r], [-r, -r * 0.18]]);
    } else if (type === 'shield') {
      traceArmorPlate([[0, -r], [r * 0.92, -r * 0.57], [r * 0.78, r * 0.40],
        [0, r], [-r * 0.78, r * 0.40], [-r * 0.92, -r * 0.57]]);
    } else if (type === 'overdrive') {
      traceArmorPlate([[0, -r * 1.13], [r, 0], [0, r * 1.13], [-r, 0]]);
    } else if (type === 'heal') {
      const a = r * 0.48;
      traceArmorPlate([[-a, -r], [a, -r], [a, -a], [r, -a], [r, a], [a, a],
        [a, r], [-a, r], [-a, a], [-r, a], [-r, -a], [-a, -a]]);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
  }

  function drawPickup(pickup, tNow) {
    const { type, x, y, r } = pickup;
    const theme = PICKUP_THEMES[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.40 + Math.sin(tNow * 0.01) * 0.13;
    tracePickupFrame(type, r + 3);
    ctx.strokeStyle = theme.rim;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.globalAlpha = 1;
    tracePickupFrame(type, r);
    ctx.fillStyle = theme.body;
    ctx.strokeStyle = theme.rim;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    if (type === 'weapon') {
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(0, -5);
      ctx.lineTo(5, 0);
      ctx.moveTo(-5, 5);
      ctx.lineTo(0, 0);
      ctx.lineTo(5, 5);
      ctx.stroke();
    } else if (type === 'shield') {
      tracePickupFrame(type, 6.5);
      ctx.stroke();
    } else if (type === 'overdrive') {
      traceArmorPlate([[1.5, -7], [-4.5, 1], [0, 1], [-1.5, 7], [4.5, -1], [0, -1]]);
      ctx.fill();
    } else if (type === 'heal') {
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else if (type === 'blast') {
      traceArmorPlate([[0, -8], [2.7, -2.8], [8, 0], [2.7, 2.8], [0, 8], [-2.7, 2.8], [-8, 0], [-2.7, -2.8]]);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayerBolt(bullet) {
    const { x, y, vx, vy, r, color, style, explosive, heavy } = bullet;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(vx, -vy));
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    if (explosive) {
      const exhaust = ctx.createLinearGradient(0, 5, 0, 24);
      exhaust.addColorStop(0, '#fbbf24');
      exhaust.addColorStop(1, 'rgba(249, 115, 22, 0)');
      traceArmorPlate([[-4, 5], [4, 5], [2, 16], [0, 24], [-2, 16]]);
      ctx.fillStyle = exhaust;
      ctx.fill();
      traceArmorPlate([[0, -12], [4, -6], [4, 3], [7, 9], [2, 7], [-2, 7], [-7, 9], [-4, 3], [-4, -6]]);
      ctx.fillStyle = '#fb923c';
      ctx.strokeStyle = '#fed7aa';
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff7ed';
      ctx.fillRect(-1, -7, 2, 11);
    } else if (heavy) {
      const look = SKINS[style].heavy;
      const trail = ctx.createLinearGradient(0, 1, 0, look.reach);
      trail.addColorStop(0, look.edge);
      trail.addColorStop(0.45, look.color);
      trail.addColorStop(1, look.fade);
      ctx.fillStyle = trail;
      for (const shape of look.trails) {
        traceArmorPlate(shape);
        ctx.fill();
      }
      traceArmorPlate(look.hull);
      ctx.fillStyle = look.color;
      ctx.strokeStyle = look.edge;
      ctx.lineWidth = 1.3;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.75, -9, 3.5, 16);
    } else if (style === 'crimson') {
      traceArmorPlate([[0, -9], [r, -1], [r * 0.43, 7], [0, 11], [-r * 0.43, 7], [-r, -1]]);
      ctx.fill();
      traceArmorPlate([[0, -7], [1.2, -1], [0, 4], [-1.2, -1]]);
      ctx.fillStyle = '#fff7e6';
      ctx.fill();
    } else if (style === 'phantom') {
      traceArmorPlate([[0, -9], [r * 0.81, 0], [0, 10], [-r * 0.81, 0]]);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-0.85, -4, 1.7, 8);
    } else {
      ctx.fillRect(-r * 0.45, -9, r * 0.9, 17);
      ctx.globalAlpha = 0.42;
      ctx.fillRect(-r * 0.28, 8, r * 0.56, 9);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.85, -8, 1.7, 12);
    }
    ctx.restore();
  }

  function drawMuzzleFlash(flash) {
    ctx.save();
    ctx.translate(flash.x, flash.y);
    ctx.globalAlpha = Math.max(0, flash.life / flash.maxLife);
    const r = flash.r;
    if (flash.style === 'phantom') {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.65, r * 0.35, 0, 0, Math.PI * 2);
      ctx.strokeStyle = flash.color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else {
      const spread = flash.style === 'crimson' ? r * 0.7 : r * 0.35;
      traceArmorPlate([[0, -r], [spread, 0], [0, r * 0.55], [-spread, 0]]);
      ctx.fillStyle = flash.color;
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1.25, -3, 2.5, 6);
    ctx.restore();
  }

  function drawSpaceScene(index, opacity) {
    const scene = SPACE_SCENES[index];
    ctx.save();
    ctx.globalAlpha = opacity;
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, scene.top);
    base.addColorStop(0.52, scene.middle);
    base.addColorStop(1, scene.bottom);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    const hazeX = index === 2 ? W * 0.22 : W * 0.74;
    const hazeY = H * 0.37 + Math.sin(backgroundTime * 0.14) * 32;
    const haze = ctx.createRadialGradient(hazeX, hazeY, 14, hazeX, hazeY, 213);
    haze.addColorStop(0, scene.haze);
    haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    if (index === 1) drawRingedPlanet();
    else if (index === 2) drawDistantWreckage();
    ctx.restore();
  }

  function drawRingedPlanet() {
    ctx.save();
    ctx.translate(W * 0.78, H * 0.26 + Math.sin(backgroundTime * 0.15) * 13);
    ctx.rotate(-0.42);
    for (const [width, height] of [[137, 26], [153, 32]]) {
      ctx.strokeStyle = 'rgba(142, 143, 209, 0.23)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const face = ctx.createRadialGradient(-22, -23, 5, 0, 0, 66);
    face.addColorStop(0, '#263354');
    face.addColorStop(0.60, '#1b2543');
    face.addColorStop(1, '#10162b');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(162, 164, 221, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 142, 28, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawDistantWreckage() {
    const drift = Math.sin(backgroundTime * 0.11) * 9;
    for (const [x, y, scale, tilt] of [[W * 0.11, H * 0.40, 1.04, -0.36], [W * 0.92, H * 0.62, 0.82, 0.45]]) {
      ctx.save();
      ctx.translate(x + drift, y - drift);
      ctx.rotate(tilt);
      ctx.scale(scale, scale);
      traceArmorPlate([[-116, -22], [-34, -29], [-9, -18], [18, -25], [67, -10], [31, 2],
        [57, 11], [25, 26], [-17, 14], [-61, 25], [-106, 13]]);
      ctx.fillStyle = '#242436';
      ctx.strokeStyle = 'rgba(153, 143, 165, 0.23)';
      ctx.lineWidth = 1.7;
      ctx.fill();
      ctx.stroke();
      for (const rib of [-72, -47, -22, 3]) {
        ctx.beginPath();
        ctx.moveTo(rib, -11);
        ctx.lineTo(rib + 11, 8);
        ctx.lineTo(rib - 5, 12);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function draw() {
    ({
      mode, skin, stars, meteors, sceneIndex, previousScene, sceneBlend, backgroundTime,
      state, player, boss, bullets, enemyBullets, enemies, pickups, pickupCue,
      particles, debris, muzzleFlashes, afterimages, shockwaves, floatTexts,
      empWave, bossAlertAlpha, waveBanner, waveBannerTimer, combo, comboTimer,
      shakeTimer, shakeMag, flashAlpha, flashColor,
    } = getState());
    const tNow = performance.now();
    ctx.save();

    if (sceneBlend < 1) {
      drawSpaceScene(previousScene, 1);
      drawSpaceScene(sceneIndex, sceneBlend * sceneBlend * (3 - 2 * sceneBlend));
    } else {
      drawSpaceScene(sceneIndex, 1);
    }

    // 背景流星
    for (const m of meteors) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.16, m.life * 0.24);
      const mag = Math.hypot(m.vx, m.vy) || 1;
      const tx = m.x - (m.vx / mag) * m.len;
      const ty = m.y - (m.vy / mag) * m.len;
      const mg = ctx.createLinearGradient(m.x, m.y, tx, ty);
      mg.addColorStop(0, '#e0f2fe');
      mg.addColorStop(1, 'rgba(224, 242, 254, 0)');
      ctx.strokeStyle = mg;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
    }

    // Boss 登场红色警戒边缘光效
    if (bossAlertAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = bossAlertAlpha * (0.22 + Math.sin(tNow * 0.024) * 0.14);
      const rg = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.25, W * 0.5, H * 0.5, H * 0.65);
      rg.addColorStop(0, 'rgba(239, 68, 68, 0)');
      rg.addColorStop(1, 'rgba(239, 68, 68, 0.85)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 星空（超载暴走时拉成流光线条）
    const warp = player.overdriveTimer > 0;
    for (const s of stars) {
      ctx.globalAlpha = s.alpha * (warp ? 0.43 : 0.67);
      if (warp) {
        ctx.strokeStyle = s.tint;
        ctx.lineWidth = s.r;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, s.y - 12);
        ctx.stroke();
      } else {
        ctx.fillStyle = s.tint;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Keep the flash behind ships, shots and warning lines.
    if (flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(flashAlpha, 0.22);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    ctx.save();
    if (shakeTimer > 0) {
      const offset = Math.min(4, shakeMag) * Math.min(1, shakeTimer / 0.2);
      ctx.translate((Math.random() - 0.5) * offset * 2, (Math.random() - 0.5) * offset * 2);
    }

    // 道具胶囊（高辨识度矢量图标）
    for (const pickup of pickups) drawPickup(pickup, tNow);
    for (const bullet of bullets) drawPlayerBolt(bullet);

    // 敌机与 Boss
    for (const e of enemies) drawEnemy(e, tNow);
    drawBoss(tNow);

    // 自机与炮口闪光
    drawPlayer(tNow);
    for (const flash of muzzleFlashes) drawMuzzleFlash(flash);

    // 脉冲清屏波
    if (empWave) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, empWave.life / empWave.maxLife);
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(empWave.x, empWave.y, empWave.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 冲击波与粒子
    for (const sw of shockwaves) {
      const p = 1 - sw.life / sw.maxLife;
      ctx.save();
      if (sw.blast) {
        const radius = sw.maxR * (1 - 0.48 * (1 - p) ** 3);
        const glow = ctx.createRadialGradient(sw.x, sw.y, 0, sw.x, sw.y, radius);
        glow.addColorStop(0, 'rgba(255, 245, 191, 0.58)');
        glow.addColorStop(0.55, 'rgba(251, 146, 60, 0.28)');
        glow.addColorStop(1, 'rgba(249, 115, 22, 0.08)');
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, radius * 0.66, 0, Math.PI * 2);
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.max(0, (1 - p) * 0.8);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3 * (1 - p);
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r + (sw.maxR - sw.r) * p, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const d of debris) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life / d.maxLife);
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.w * 0.5, -d.h * 0.5, d.w, d.h);
      ctx.restore();
    }
    drawEnemyBullets();
    ctx.restore();

    // 右上角连击与得分倍率指示器
    if (state === 'playing' && combo >= 2 && comboTimer > 0) {
      ctx.save();
      const mult = combo >= 12 ? '1.5×' : (combo >= 6 ? '1.25×' : '');
      const label = mult ? `${combo} COMBO · ${mult}` : `${combo} COMBO`;
      ctx.font = '800 12px ui-sans-serif, system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 18;
      const bx = W - tw - 12;
      const by = 14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.beginPath();
      ctx.roundRect(bx, by, tw, 24, 999);
      ctx.fill();
      ctx.strokeStyle = combo >= 12 ? '#fde047' : (combo >= 6 ? '#38bdf8' : 'rgba(148, 163, 184, 0.5)');
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = combo >= 12 ? '#fde047' : (combo >= 6 ? '#7dd3fc' : '#e2e8f0');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + tw * 0.5, by + 11.5);
      // 倒计时细进度条
      const barW = (tw - 16) * Math.max(0, Math.min(1, comboTimer / 2.8));
      ctx.fillStyle = combo >= 12 ? '#fde047' : '#38bdf8';
      ctx.fillRect(bx + 8, by + 20, barW, 2);
      ctx.restore();
    }

    // 飘字
    for (const ft of floatTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.font = `900 ${Math.round(16 * ft.scale)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.82)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 波次播报条
    if (waveBannerTimer > 0 && waveBanner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, waveBannerTimer * 1.6);
      ctx.font = '900 18px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = boss ? '#fca5a5' : '#93c5fd';
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(waveBanner, W * 0.5, H * 0.42);
      ctx.fillText(waveBanner, W * 0.5, H * 0.42);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawEnemyBullets() {
    for (const bullet of enemyBullets) {
      if (bullet.reflected) {
        drawReflectedBolt(bullet);
        continue;
      }
      const { x, y, r, color } = bullet;
      ctx.save();
      ctx.beginPath();
      if (bullet.crystal) {
        traceArmorPlate([[x, y - r * 1.5], [x + r, y], [x, y + r * 1.5], [x - r, y]]);
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.strokeStyle = '#1b1224';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.46, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
    }
  }

  return { draw };
}
