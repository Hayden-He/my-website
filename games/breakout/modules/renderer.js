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

export function createBreakoutRenderer({ ctx, getState }) {
  function drawBackground(sk, now) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, sk.bgTop);
    grad.addColorStop(1, sk.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = sk.grid;
    ctx.lineWidth = 1;
    for (let x = 22; x < W; x += 28) {
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

    // Arena rails
    ctx.fillStyle = sk.rail;
    ctx.fillRect(0, 0, WALL_SIDE, H);
    ctx.fillRect(W - WALL_SIDE, 0, WALL_SIDE, H);
    ctx.fillRect(0, 0, W, WALL_TOP);

    ctx.strokeStyle = sk.railGlow;
    ctx.globalAlpha = 0.55 + 0.15 * Math.sin(now * 0.003);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(WALL_SIDE, H);
    ctx.lineTo(WALL_SIDE, WALL_TOP);
    ctx.lineTo(W - WALL_SIDE, WALL_TOP);
    ctx.lineTo(W - WALL_SIDE, H);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawBricks(bricks, sk, now) {
    for (const brick of bricks) {
      if (brick.hp <= 0) continue;
      let fill = sk.normalPalette[brick.colorIdx % sk.normalPalette.length];
      let border = 'rgba(255, 255, 255, 0.35)';
      if (brick.type === 'steel') {
        fill = brick.hp === 2 ? '#94a3b8' : '#64748b';
        border = '#e2e8f0';
      } else if (brick.type === 'heavy') {
        fill = brick.hp === 3 ? '#6366f1' : brick.hp === 2 ? '#4f46e5' : '#4338ca';
        border = '#c7d2fe';
      } else if (brick.type === 'bomb') {
        const pulse = 0.72 + 0.28 * Math.sin(now * 0.009 + brick.col);
        fill = '#dc2626';
        border = `rgba(254, 215, 170, ${pulse.toFixed(2)})`;
      } else if (brick.type === 'gold') {
        fill = '#d97706';
        border = '#fde68a';
      }

      roundRectPath(ctx, brick.x, brick.y, brick.w, brick.h, 5);
      ctx.fillStyle = fill;
      ctx.fill();

      // Top highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.fillRect(brick.x + 3, brick.y + 2, brick.w - 6, 4);

      ctx.strokeStyle = border;
      ctx.lineWidth = brick.type === 'gold' || brick.type === 'bomb' ? 1.5 : 1;
      roundRectPath(ctx, brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1, 5);
      ctx.stroke();

      // Damage cracks on steel/heavy
      if ((brick.type === 'steel' || brick.type === 'heavy') && brick.hp < brick.maxHp) {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(brick.x + 8, brick.y + 3);
        ctx.lineTo(brick.x + 16, brick.y + 10);
        ctx.lineTo(brick.x + 24, brick.y + 6);
        if (brick.hp === 1) {
          ctx.lineTo(brick.x + 30, brick.y + 15);
        }
        ctx.stroke();
      }

      if (brick.type === 'bomb') {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(brick.x + brick.w / 2, brick.y + brick.h / 2, 3.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (brick.type === 'gold') {
        ctx.fillStyle = 'rgba(254, 243, 199, 0.75)';
        ctx.fillRect(brick.x + 8, brick.y + 7, brick.w - 16, 4);
      }
    }
  }

  function drawPaddle(paddle, effects, sk, now) {
    const left = paddle.x - paddle.w / 2;
    ctx.save();
    if (effects.magnet > 0) {
      ctx.strokeStyle = `rgba(45, 212, 191, ${(0.45 + 0.25 * Math.sin(now * 0.01)).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left + 6, PADDLE_Y - 5);
      ctx.lineTo(left + paddle.w - 6, PADDLE_Y - 5);
      ctx.stroke();
    }

    const grad = ctx.createLinearGradient(left, PADDLE_Y, left, PADDLE_Y + PADDLE_HEIGHT);
    grad.addColorStop(0, sk.paddleGlow);
    grad.addColorStop(0.55, sk.paddleMain);
    grad.addColorStop(1, '#0f172a');
    roundRectPath(ctx, left, PADDLE_Y, paddle.w, PADDLE_HEIGHT, 7);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = sk.paddleAccent;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Center grip accent
    ctx.fillStyle = sk.paddleAccent;
    ctx.fillRect(paddle.x - 10, PADDLE_Y + 4, 20, 3);

    if (effects.laser > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(left + 8, PADDLE_Y - 6, 4, 6);
      ctx.fillRect(left + paddle.w - 12, PADDLE_Y - 6, 4, 6);
    }
    ctx.restore();
  }

  function drawBalls(balls, effects, sk) {
    const fireball = effects.fire > 0;
    for (const ball of balls) {
      if (ball.trail) {
        for (let i = 0; i < ball.trail.length; i += 1) {
          const pt = ball.trail[i];
          const alpha = ((i + 1) / (ball.trail.length + 1)) * (fireball ? 0.48 : 0.24);
          ctx.fillStyle = fireball ? sk.fireRim : sk.ballRim;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ball.r * (0.45 + 0.45 * ((i + 1) / ball.trail.length)), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (ball.stuck) {
        ctx.save();
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        const ang = ball.launchAngle || 0;
        ctx.lineTo(ball.x + Math.sin(ang) * 58, ball.y - Math.cos(ang) * 58);
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r + 2.5, 0, Math.PI * 2);
      ctx.fillStyle = fireball ? 'rgba(249, 115, 22, 0.36)' : 'rgba(56, 189, 248, 0.24)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = fireball ? sk.fireCore : sk.ballCore;
      ctx.fill();
      ctx.strokeStyle = fireball ? sk.fireRim : sk.ballRim;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }

  function drawCapsulesAndShots(capsules, lasers) {
    for (const shot of lasers) {
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(shot.x - 1.5, shot.y, 3, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(shot.x - 0.6, shot.y + 1, 1.2, 10);
    }

    for (const cap of capsules) {
      const meta = POWERUP_META[cap.kind] || POWERUP_META.expand;
      roundRectPath(ctx, cap.x - 15, cap.y - 9, 30, 18, 9);
      ctx.fillStyle = meta.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = meta.text;
      ctx.font = '800 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.badge, cap.x, cap.y + 0.5);
    }
  }

  function drawEffects(particles, floatTexts, state, now) {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const ft of floatTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life / 0.45));
      ctx.fillStyle = ft.color || '#f8fafc';
      ctx.font = '800 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
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
        : 'rgba(248, 113, 113, 0.34)';
      ctx.lineWidth = urgent ? 2 : 1.3;
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
      roundRectPath(ctx, W / 2 - 110, H * 0.56 - 20, 220, 40, 12);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1;
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

    drawBackground(sk, now);
    drawEffects([], [], state, now);
    drawBricks(state.bricks, sk, now);
    drawCapsulesAndShots(state.capsules, state.lasers);
    drawPaddle(state.paddle, state.effects, sk, now);
    drawBalls(state.balls, state.effects, sk);
    drawEffects(state.particles, state.floatTexts, { ...state, mode: null, levelBannerTimer: state.levelBannerTimer }, now);

    ctx.restore();
  }

  return { renderFrame };
}
