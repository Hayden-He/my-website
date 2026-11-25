import {
  W, H, WALL_SIDE, WALL_TOP, PADDLE_Y, PADDLE_HEIGHT,
  ENDLESS_DANGER_Y, SKINS, POWERUP_META,
} from './rules.js';

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function shadeHex(hex, delta) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const clampByte = (v) => Math.max(0, Math.min(255, v));
  const r = clampByte(parseInt(clean.slice(0, 2), 16) + delta);
  const g = clampByte(parseInt(clean.slice(2, 4), 16) + delta);
  const b = clampByte(parseInt(clean.slice(4, 6), 16) + delta);
  return `rgb(${r}, ${g}, ${b})`;
}

export function createBreakoutRenderer({ ctx, getState }) {
  function drawBackground(sk, now, wallFlash) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, sk.bgTop);
    grad.addColorStop(1, sk.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Upper ambient spotlight glow
    const spot = ctx.createRadialGradient(W * 0.5, 110, 18, W * 0.5, 145, 290);
    spot.addColorStop(0, sk.bgSpot || 'rgba(56, 189, 248, 0.14)');
    spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(WALL_SIDE, WALL_TOP, W - WALL_SIDE * 2, H - WALL_TOP);

    // Subtle tactical grid + intersection nodes
    ctx.strokeStyle = sk.grid;
    ctx.lineWidth = 1;
    for (let x = 22; x < W - WALL_SIDE; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, WALL_TOP);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 32; y < H; y += 28) {
      ctx.beginPath();
      ctx.moveTo(WALL_SIDE, y);
      ctx.lineTo(W - WALL_SIDE, y);
      ctx.stroke();
    }
    ctx.fillStyle = sk.grid;
    for (let x = 22; x < W - WALL_SIDE; x += 56) {
      for (let y = 60; y < H; y += 56) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }

    // Metallic beveled arena rails
    const leftGrad = ctx.createLinearGradient(0, 0, WALL_SIDE, 0);
    leftGrad.addColorStop(0, '#090d1a');
    leftGrad.addColorStop(1, sk.rail);
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, WALL_SIDE, H);

    const rightGrad = ctx.createLinearGradient(W - WALL_SIDE, 0, W, 0);
    rightGrad.addColorStop(0, sk.rail);
    rightGrad.addColorStop(1, '#090d1a');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(W - WALL_SIDE, 0, WALL_SIDE, H);

    const topGrad = ctx.createLinearGradient(0, 0, 0, WALL_TOP);
    topGrad.addColorStop(0, '#090d1a');
    topGrad.addColorStop(1, sk.rail);
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, WALL_TOP);

    // Energy conduit trim along inner rails
    const flashBoost = Math.min(0.4, (wallFlash || 0) * 0.4);
    ctx.strokeStyle = sk.railGlow;
    ctx.globalAlpha = 0.52 + 0.14 * Math.sin(now * 0.003) + flashBoost;
    ctx.lineWidth = 1.6 + (wallFlash || 0) * 1.2;
    ctx.beginPath();
    ctx.moveTo(WALL_SIDE, H);
    ctx.lineTo(WALL_SIDE, WALL_TOP);
    ctx.lineTo(W - WALL_SIDE, WALL_TOP);
    ctx.lineTo(W - WALL_SIDE, H);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Chamfered corner brackets
    ctx.fillStyle = sk.railGlow;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(WALL_SIDE - 3, WALL_TOP - 3, 14, 3);
    ctx.fillRect(WALL_SIDE - 3, WALL_TOP - 3, 3, 14);
    ctx.fillRect(W - WALL_SIDE - 11, WALL_TOP - 3, 14, 3);
    ctx.fillRect(W - WALL_SIDE, WALL_TOP - 3, 3, 14);
    ctx.globalAlpha = 1;
  }

  function drawBricks(bricks, sk, now) {
    for (const brick of bricks) {
      if (brick.hp <= 0) continue;
      let base = sk.normalPalette[brick.colorIdx % sk.normalPalette.length];
      let topTone = shadeHex(base, 36);
      let botTone = shadeHex(base, -44);
      let border = 'rgba(255, 255, 255, 0.32)';

      if (brick.type === 'steel') {
        base = brick.hp === 2 ? '#94a3b8' : '#64748b';
        topTone = brick.hp === 2 ? '#cbd5e1' : '#94a3b8';
        botTone = brick.hp === 2 ? '#475569' : '#334155';
        border = '#e2e8f0';
      } else if (brick.type === 'heavy') {
        base = brick.hp === 3 ? '#6366f1' : brick.hp === 2 ? '#4f46e5' : '#4338ca';
        topTone = brick.hp === 3 ? '#a5b4fc' : brick.hp === 2 ? '#818cf8' : '#6366f1';
        botTone = '#312e81';
        border = '#c7d2fe';
      } else if (brick.type === 'bomb') {
        const pulse = 0.65 + 0.35 * Math.sin(now * 0.009 + brick.col);
        base = '#dc2626';
        topTone = '#f87171';
        botTone = '#991b1b';
        border = `rgba(254, 215, 170, ${pulse.toFixed(2)})`;
      } else if (brick.type === 'gold') {
        base = '#d97706';
        topTone = '#fbbf24';
        botTone = '#92400e';
        border = '#fde68a';
      }

      // Main 3D beveled body
      const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
      grad.addColorStop(0, topTone);
      grad.addColorStop(0.45, base);
      grad.addColorStop(1, botTone);
      roundRectPath(ctx, brick.x, brick.y, brick.w, brick.h, 5);
      ctx.fillStyle = grad;
      ctx.fill();

      // Glossy top specular strip & bottom depth lip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fillRect(brick.x + 3, brick.y + 1.5, brick.w - 6, 3);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.24)';
      ctx.fillRect(brick.x + 2, brick.y + brick.h - 3, brick.w - 4, 2);

      ctx.strokeStyle = border;
      ctx.lineWidth = brick.type === 'gold' || brick.type === 'bomb' ? 1.5 : 1;
      roundRectPath(ctx, brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1, 5);
      ctx.stroke();

      if (brick.type === 'steel') {
        // 4 brushed steel corner rivets
        ctx.fillStyle = 'rgba(241, 245, 249, 0.72)';
        ctx.fillRect(brick.x + 3, brick.y + 3, 2, 2);
        ctx.fillRect(brick.x + brick.w - 5, brick.y + 3, 2, 2);
        ctx.fillRect(brick.x + 3, brick.y + brick.h - 5, 2, 2);
        ctx.fillRect(brick.x + brick.w - 5, brick.y + brick.h - 5, 2, 2);
      } else if (brick.type === 'heavy') {
        // Armored central plate + HP indicator pips
        roundRectPath(ctx, brick.x + 7, brick.y + 5, brick.w - 14, brick.h - 10, 3);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
        ctx.fill();
        for (let pip = 0; pip < brick.hp; pip += 1) {
          ctx.fillStyle = '#e0e7ff';
          ctx.beginPath();
          ctx.arc(brick.x + brick.w / 2 + (pip - (brick.hp - 1) / 2) * 6, brick.y + brick.h / 2, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (brick.type === 'bomb') {
        const cx = brick.x + brick.w / 2;
        const cy = brick.y + brick.h / 2;
        const pulse = 0.55 + 0.45 * Math.sin(now * 0.01 + brick.row + brick.col);
        ctx.fillStyle = `rgba(251, 146, 60, ${(0.25 * pulse).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 1, cy - 1, 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (brick.type === 'gold') {
        // Gilded metallic center bar + studs + diagonal sheen
        ctx.fillStyle = 'rgba(254, 243, 199, 0.78)';
        ctx.fillRect(brick.x + 7, brick.y + 7, brick.w - 14, 4);
        const sheenOffset = ((now * 0.03 + brick.col * 9) % (brick.w + 18)) - 9;
        const sx = Math.max(brick.x + 2, brick.x + sheenOffset);
        const sw = Math.min(brick.x + brick.w - 2 - sx, 6);
        if (sw > 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(sx, brick.y + 2, sw, brick.h - 4);
        }
      }

      // Battle-damage cracks on steel & heavy bricks
      if ((brick.type === 'steel' || brick.type === 'heavy') && brick.hp < brick.maxHp) {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(brick.x + 8, brick.y + 3);
        ctx.lineTo(brick.x + 16, brick.y + 10);
        ctx.lineTo(brick.x + 23, brick.y + 6);
        if (brick.hp === 1) {
          ctx.lineTo(brick.x + 31, brick.y + 15);
        }
        ctx.stroke();
      }
    }
  }

  function drawPaddle(paddle, effects, sk, now, paddleHitFlash) {
    const left = paddle.x - paddle.w / 2;
    const capW = 10;
    const flash = paddleHitFlash || 0;
    ctx.save();

    // Soft under-paddle thruster aura
    const thruster = ctx.createRadialGradient(
      paddle.x, PADDLE_Y + PADDLE_HEIGHT + 3, 4,
      paddle.x, PADDLE_Y + PADDLE_HEIGHT + 3, paddle.w * 0.56
    );
    thruster.addColorStop(0, sk.paddleGlow);
    thruster.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.28 + flash * 0.3;
    ctx.fillStyle = thruster;
    ctx.fillRect(left - 10, PADDLE_Y + 2, paddle.w + 20, PADDLE_HEIGHT + 16);
    ctx.globalAlpha = 1;

    // Pulsing magnetic capture field
    if (effects.magnet > 0) {
      const magAlpha = 0.45 + 0.3 * Math.sin(now * 0.012);
      ctx.strokeStyle = `rgba(45, 212, 191, ${magAlpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left + 8, PADDLE_Y - 4);
      ctx.quadraticCurveTo(paddle.x, PADDLE_Y - 10, left + paddle.w - 8, PADDLE_Y - 4);
      ctx.stroke();
    }

    // Twin laser cannons mounted on wings
    if (effects.laser > 0) {
      for (const cx of [left + 10, left + paddle.w - 10]) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(cx - 3, PADDLE_Y - 7, 6, 8);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(cx - 1.5, PADDLE_Y - 9, 3, 5);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(cx - 1, PADDLE_Y - 10, 2, 2);
      }
    }

    // Main sculpted metallic chassis
    const bodyGrad = ctx.createLinearGradient(left, PADDLE_Y, left, PADDLE_Y + PADDLE_HEIGHT);
    bodyGrad.addColorStop(0, flash > 0.2 ? '#ffffff' : sk.paddleGlow);
    bodyGrad.addColorStop(0.45, sk.paddleMain);
    bodyGrad.addColorStop(1, sk.paddleDark || '#0f172a');
    roundRectPath(ctx, left, PADDLE_Y, paddle.w, PADDLE_HEIGHT, 7);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Side metallic bumper caps
    ctx.fillStyle = sk.paddleCap || '#94a3b8';
    roundRectPath(ctx, left, PADDLE_Y, capW, PADDLE_HEIGHT, 7);
    ctx.fill();
    roundRectPath(ctx, left + paddle.w - capW, PADDLE_Y, capW, PADDLE_HEIGHT, 7);
    ctx.fill();

    // Gloss bevel rim
    ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
    ctx.fillRect(left + capW + 2, PADDLE_Y + 2, paddle.w - capW * 2 - 4, 2.5);
    ctx.strokeStyle = sk.paddleAccent;
    ctx.lineWidth = 1.2;
    roundRectPath(ctx, left + 0.5, PADDLE_Y + 0.5, paddle.w - 1, PADDLE_HEIGHT - 1, 7);
    ctx.stroke();

    // Central dynamic power core
    const coreColor = effects.fire > 0
      ? '#fb923c'
      : effects.laser > 0
        ? '#38bdf8'
        : effects.magnet > 0
          ? '#2dd4bf'
          : effects.expand > 0
            ? '#60a5fa'
            : sk.paddleAccent;
    roundRectPath(ctx, paddle.x - 13, PADDLE_Y + 4, 26, 6, 3);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    roundRectPath(ctx, paddle.x - 11, PADDLE_Y + 5, 22, 4, 2);
    ctx.fillStyle = coreColor;
    ctx.fill();

    ctx.restore();
  }

  function drawBalls(balls, effects, sk) {
    const fireball = effects.fire > 0;
    for (const ball of balls) {
      if (ball.trail) {
        for (let i = 0; i < ball.trail.length; i += 1) {
          const pt = ball.trail[i];
          const ratio = (i + 1) / (ball.trail.length + 1);
          const alpha = ratio * (fireball ? 0.52 : 0.28);
          ctx.fillStyle = fireball ? sk.fireRim : sk.ballRim;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ball.r * (0.38 + 0.5 * ratio), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (ball.stuck) {
        ctx.save();
        const ang = ball.launchAngle || 0;
        const tipX = ball.x + Math.sin(ang) * 62;
        const tipY = ball.y - Math.cos(ang) * 62;
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
        ctx.beginPath();
        ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Outer halo / fireball corona
      const halo = ctx.createRadialGradient(ball.x, ball.y, ball.r * 0.4, ball.x, ball.y, ball.r + (fireball ? 6 : 4));
      halo.addColorStop(0, fireball ? 'rgba(249, 115, 22, 0.56)' : 'rgba(56, 189, 248, 0.34)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r + (fireball ? 6 : 4), 0, Math.PI * 2);
      ctx.fill();

      // 3D radial sphere shading
      const sphere = ctx.createRadialGradient(
        ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, 1,
        ball.x, ball.y, ball.r
      );
      sphere.addColorStop(0, '#ffffff');
      sphere.addColorStop(0.55, fireball ? sk.fireCore : sk.ballCore);
      sphere.addColorStop(1, fireball ? sk.fireRim : sk.ballRim);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = sphere;
      ctx.fill();
      ctx.strokeStyle = fireball ? sk.fireRim : sk.ballRim;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Specular glint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(ball.x - ball.r * 0.32, ball.y - ball.r * 0.34, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCapsulesAndShots(capsules, lasers) {
    for (const shot of lasers) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.36)';
      ctx.fillRect(shot.x - 3, shot.y - 2, 6, 16);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(shot.x - 1.6, shot.y, 3.2, 13);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(shot.x - 0.7, shot.y + 1, 1.4, 11);
    }

    for (const cap of capsules) {
      const meta = POWERUP_META[cap.kind] || POWERUP_META.expand;

      // Subtle outer glow aura
      ctx.fillStyle = meta.color;
      ctx.globalAlpha = 0.24;
      roundRectPath(ctx, cap.x - 18, cap.y - 11.5, 36, 23, 11.5);
      ctx.fill();
      ctx.globalAlpha = 1;

      // 3D glossy capsule shell
      const grad = ctx.createLinearGradient(cap.x, cap.y - 9, cap.x, cap.y + 9);
      grad.addColorStop(0, shadeHex(meta.color, 38));
      grad.addColorStop(0.55, meta.color);
      grad.addColorStop(1, shadeHex(meta.color, -48));
      roundRectPath(ctx, cap.x - 15, cap.y - 9, 30, 18, 9);
      ctx.fillStyle = grad;
      ctx.fill();

      // Metallic end-caps
      ctx.fillStyle = 'rgba(226, 232, 240, 0.32)';
      roundRectPath(ctx, cap.x - 15, cap.y - 9, 6, 18, 6);
      ctx.fill();
      roundRectPath(ctx, cap.x + 9, cap.y - 9, 6, 18, 6);
      ctx.fill();

      // Glass highlight band
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      roundRectPath(ctx, cap.x - 11, cap.y - 7, 22, 4, 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.2;
      roundRectPath(ctx, cap.x - 15, cap.y - 9, 30, 18, 9);
      ctx.stroke();

      ctx.fillStyle = meta.text;
      ctx.font = '800 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.badge, cap.x, cap.y + 0.5);
    }
  }

  function drawEffects(particles, floatTexts, shockwaves, state, now) {
    if (shockwaves) {
      for (const sw of shockwaves) {
        const alpha = Math.max(0, sw.life / sw.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha * 0.72;
        ctx.strokeStyle = sw.color || '#fb923c';
        ctx.lineWidth = 3 * alpha + 1;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.2, p.size * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const ft of floatTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life / 0.45));
      ctx.font = '800 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color || '#f8fafc';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    if (state.mode === 'endless') {
      const maxBrickY = state.bricks.reduce((m, b) => (b.hp > 0 ? Math.max(m, b.y + b.h) : m), 0);
      const urgent = maxBrickY >= ENDLESS_DANGER_Y - 56;
      ctx.save();
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = urgent
        ? `rgba(248, 113, 113, ${(0.55 + 0.35 * Math.sin(now * 0.014)).toFixed(2)})`
        : 'rgba(248, 113, 113, 0.36)';
      ctx.lineWidth = urgent ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.moveTo(WALL_SIDE + 2, ENDLESS_DANGER_Y);
      ctx.lineTo(W - WALL_SIDE - 2, ENDLESS_DANGER_Y);
      ctx.stroke();
      ctx.restore();
    }

    if (state.levelBannerTimer > 0 && state.levelBannerText) {
      const alpha = Math.min(1, state.levelBannerTimer * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      roundRectPath(ctx, W / 2 - 116, H * 0.56 - 21, 232, 42, 12);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 14px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.levelBannerText, W / 2, H * 0.56);
      ctx.restore();
    }
  }

  function renderFrame() {
    const state = getState();
    const sk = SKINS[state.skin] || SKINS.neon;
    const now = state.now || 0;

    ctx.save();
    if (state.shakeTimer > 0) {
      const mag = state.shakeMag * Math.min(1, state.shakeTimer / 0.2);
      const ox = (Math.sin(now * 0.09) + Math.cos(now * 0.13)) * 0.5 * mag;
      const oy = Math.sin(now * 0.11) * mag;
      ctx.translate(ox, oy);
    }

    drawBackground(sk, now, state.wallFlash);
    drawEffects([], [], [], state, now);
    drawBricks(state.bricks, sk, now);
    drawCapsulesAndShots(state.capsules, state.lasers);
    drawPaddle(state.paddle, state.effects, sk, now, state.paddleHitFlash);
    drawBalls(state.balls, state.effects, sk);
    drawEffects(
      state.particles,
      state.floatTexts,
      state.shockwaves || [],
      { ...state, mode: null, levelBannerTimer: state.levelBannerTimer },
      now
    );

    ctx.restore();
  }

  return { renderFrame };
}
