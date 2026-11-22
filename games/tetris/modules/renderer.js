import {
  BUFFER_ROWS, COLS, GARBAGE_INTERVAL_MS, GARBAGE_STYLE, GARBAGE_WARN_MS,
  LOCK_DELAY_MS, PIECES, ROWS, getDangerRatio, getGhostY, getPieceCells,
} from './engine.js';

export function createRenderer(boardCanvas) {
  const ctx = boardCanvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let flashes = [];
  let particles = [];
  let trails = [];
  let bombs = [];
  let lasers = [];
  let floatingTexts = [];
  let shake = null;

  function syncCanvasSize(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    return { width: rect.width, height: rect.height, dpr };
  }

  function getBlockPalette(type) {
    if (type === 'G') return GARBAGE_STYLE;
    return PIECES[type] || null;
  }

  function drawPowerupEmblem(targetCtx, bx, by, bs, powerup) {
    const cx = bx + bs / 2;
    const cy = by + bs / 2;
    targetCtx.save();
    if (powerup === 'bomb') {
      const r = Math.max(2.6, bs * 0.26);
      // 炸弹球体
      targetCtx.fillStyle = '#0f172a';
      targetCtx.beginPath();
      targetCtx.arc(cx - bs * 0.04, cy + bs * 0.06, r, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      targetCtx.lineWidth = Math.max(0.8, bs * 0.05);
      targetCtx.beginPath();
      targetCtx.arc(cx - bs * 0.04, cy + bs * 0.06, r * 0.65, Math.PI * 1.05, Math.PI * 1.55);
      targetCtx.stroke();
      // 引线与火星
      targetCtx.strokeStyle = '#fdba74';
      targetCtx.lineWidth = Math.max(1, bs * 0.07);
      targetCtx.beginPath();
      targetCtx.moveTo(cx + r * 0.45, cy - r * 0.55);
      targetCtx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.15, cx + r * 1.15, cy - r * 0.95);
      targetCtx.stroke();
      targetCtx.fillStyle = '#fef08a';
      targetCtx.beginPath();
      targetCtx.arc(cx + r * 1.15, cy - r * 0.95, Math.max(1.4, bs * 0.11), 0, Math.PI * 2);
      targetCtx.fill();
    } else if (powerup === 'laser') {
      const haloH = Math.max(4, bs * 0.4);
      const coreH = Math.max(1.8, bs * 0.16);
      targetCtx.fillStyle = 'rgba(34, 211, 238, 0.35)';
      targetCtx.beginPath();
      targetCtx.roundRect(bx + bs * 0.12, cy - haloH / 2, bs * 0.76, haloH, haloH / 2);
      targetCtx.fill();
      targetCtx.fillStyle = '#ecfeff';
      targetCtx.beginPath();
      targetCtx.roundRect(bx + bs * 0.16, cy - coreH / 2, bs * 0.68, coreH, coreH / 2);
      targetCtx.fill();
      // 左右能量箭头
      const tip = Math.max(1.8, bs * 0.14);
      targetCtx.strokeStyle = '#cffafe';
      targetCtx.lineWidth = Math.max(1, bs * 0.065);
      targetCtx.lineCap = 'round';
      targetCtx.beginPath();
      targetCtx.moveTo(bx + bs * 0.28, cy - tip);
      targetCtx.lineTo(bx + bs * 0.16, cy);
      targetCtx.lineTo(bx + bs * 0.28, cy + tip);
      targetCtx.moveTo(bx + bs * 0.72, cy - tip);
      targetCtx.lineTo(bx + bs * 0.84, cy);
      targetCtx.lineTo(bx + bs * 0.72, cy + tip);
      targetCtx.stroke();
    } else if (powerup === 'ice') {
      const r = Math.max(3, bs * 0.3);
      targetCtx.shadowColor = '#38bdf8';
      targetCtx.shadowBlur = bs * 0.25;
      targetCtx.strokeStyle = '#e0f2fe';
      targetCtx.lineWidth = Math.max(1, bs * 0.075);
      targetCtx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 3) * i;
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        targetCtx.beginPath();
        targetCtx.moveTo(cx - dx, cy - dy);
        targetCtx.lineTo(cx + dx, cy + dy);
        targetCtx.stroke();
      }
      targetCtx.fillStyle = '#ffffff';
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, Math.max(1.2, bs * 0.09), 0, Math.PI * 2);
      targetCtx.fill();
    }
    targetCtx.restore();
  }

  function drawBlock(targetCtx, x, y, size, type, alpha = 1, lockRatio = 0, powerup = null) {
    const palette = getBlockPalette(type);
    if (!palette) return;
    const pad = Math.max(0.65, size * 0.032);
    const bx = x + pad;
    const by = y + pad;
    const bs = size - pad * 2;
    const bevel = Math.max(2, bs * 0.17);
    const radius = Math.max(2, bs * 0.14);

    targetCtx.save();
    targetCtx.globalAlpha = alpha;

    // 主体圆角填充
    targetCtx.beginPath();
    targetCtx.roundRect(bx, by, bs, bs, radius);
    targetCtx.fillStyle = palette.color;
    targetCtx.fill();

    // 顶部与左侧高光斜边
    targetCtx.fillStyle = palette.light;
    targetCtx.beginPath();
    targetCtx.moveTo(bx + radius, by);
    targetCtx.lineTo(bx + bs - radius, by);
    targetCtx.lineTo(bx + bs - bevel, by + bevel);
    targetCtx.lineTo(bx + bevel, by + bevel);
    targetCtx.lineTo(bx + bevel, by + bs - bevel);
    targetCtx.lineTo(bx, by + bs - radius);
    targetCtx.lineTo(bx, by + radius);
    targetCtx.closePath();
    targetCtx.fill();

    // 底部与右侧暗部斜边
    targetCtx.fillStyle = palette.dark;
    targetCtx.beginPath();
    targetCtx.moveTo(bx + bs, by + radius);
    targetCtx.lineTo(bx + bs, by + bs - radius);
    targetCtx.lineTo(bx + bs - radius, by + bs);
    targetCtx.lineTo(bx + radius, by + bs);
    targetCtx.lineTo(bx + bevel, by + bs - bevel);
    targetCtx.lineTo(bx + bs - bevel, by + bs - bevel);
    targetCtx.lineTo(bx + bs - bevel, by + bevel);
    targetCtx.closePath();
    targetCtx.fill();

    // 内芯高光光泽
    targetCtx.fillStyle = type === 'G' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.22)';
    const innerSize = Math.max(2, bs * 0.24);
    targetCtx.fillRect(bx + bevel + 1, by + bevel + 1, innerSize, Math.max(2, bs * 0.13));

    // 外描边分隔线（保证同色相邻块清晰可辨）
    targetCtx.beginPath();
    targetCtx.roundRect(bx, by, bs, bs, radius);
    targetCtx.lineWidth = Math.max(1, size * 0.05);
    targetCtx.strokeStyle = 'rgba(2, 6, 23, 0.56)';
    targetCtx.stroke();

    if (powerup) {
      drawPowerupEmblem(targetCtx, bx, by, bs, powerup);
    }

    // 贴底锁定倒计时提示
    if (lockRatio > 0) {
      targetCtx.fillStyle = `rgba(255, 255, 255, ${(lockRatio * 0.34).toFixed(3)})`;
      targetCtx.beginPath();
      targetCtx.roundRect(bx, by, bs, bs, radius);
      targetCtx.fill();
    }

    targetCtx.restore();
  }

  function drawGhostBlock(targetCtx, x, y, size, type) {
    const palette = PIECES[type];
    if (!palette) return;
    const pad = Math.max(1, size * 0.06);
    const bx = x + pad;
    const by = y + pad;
    const bs = size - pad * 2;
    const radius = Math.max(2, bs * 0.14);

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.roundRect(bx, by, bs, bs, radius);
    targetCtx.fillStyle = palette.color;
    targetCtx.globalAlpha = 0.16;
    targetCtx.fill();
    targetCtx.globalAlpha = 0.65;
    targetCtx.lineWidth = Math.max(1.3, size * 0.06);
    targetCtx.strokeStyle = palette.light;
    targetCtx.stroke();
    targetCtx.restore();
  }

  function triggerLineClear(clearedBoardRows, isTetris) {
    if (reducedMotion.matches || !clearedBoardRows.length) return;
    const visibleRows = clearedBoardRows
      .map((r) => r - BUFFER_ROWS)
      .filter((r) => r >= 0 && r < ROWS);
    if (!visibleRows.length) return;

    flashes.push({
      rows: visibleRows,
      ageMs: 0,
      durationMs: isTetris ? 270 : 190,
      isTetris,
    });

    const count = isTetris ? 30 : 14;
    for (let i = 0; i < count; i++) {
      const row = visibleRows[i % visibleRows.length];
      particles.push({
        col: Math.random() * COLS,
        row: row + 0.5,
        vx: (Math.random() - 0.5) * 6.5,
        vy: -1.5 - Math.random() * 4.5,
        size: 0.13 + Math.random() * 0.14,
        color: isTetris ? '#fde047' : '#e2e8f0',
        ageMs: 0,
        durationMs: 280 + Math.random() * 190,
      });
    }
  }

  function triggerHardDrop(startY, endY, active) {
    if (reducedMotion.matches || !active || endY <= startY) return;
    const cells = getPieceCells(active.type, active.rot, active.x, endY);
    const minRow = Math.max(0, startY - BUFFER_ROWS);
    const cols = [...new Set(cells.map(([cx]) => cx))];
    const maxRow = Math.max(minRow + 1, endY - BUFFER_ROWS + 1);
    trails.push({
      cols,
      topRow: minRow,
      bottomRow: maxRow,
      color: PIECES[active.type].light,
      ageMs: 0,
      durationMs: 140,
    });
  }

  function triggerBomb(cx, cy) {
    if (reducedMotion.matches) return;
    const vy = cy - BUFFER_ROWS;
    bombs.push({ cx: cx + 0.5, cy: vy + 0.5, ageMs: 0, durationMs: 320 });
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.25;
      const speed = 2.5 + Math.random() * 5.5;
      particles.push({
        col: cx + 0.5,
        row: vy + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        size: 0.16 + Math.random() * 0.14,
        color: i % 2 === 0 ? '#fb923c' : '#fde047',
        ageMs: 0,
        durationMs: 320 + Math.random() * 140,
      });
    }
  }

  function triggerLaser(boardRow) {
    if (reducedMotion.matches) return;
    const vy = Math.max(0, Math.min(ROWS - 1, boardRow - BUFFER_ROWS));
    lasers.push({ row: vy, ageMs: 0, durationMs: 300 });
    for (let i = 0; i < 16; i++) {
      const goRight = i % 2 === 0;
      particles.push({
        col: goRight ? 5 + Math.random() * 4 : Math.random() * 5,
        row: vy + 0.5 + (Math.random() - 0.5) * 0.35,
        vx: (goRight ? 1 : -1) * (6 + Math.random() * 7),
        vy: (Math.random() - 0.5) * 2.2,
        size: 0.11 + Math.random() * 0.11,
        color: i % 3 === 0 ? '#ffffff' : '#67e8f9',
        ageMs: 0,
        durationMs: 240 + Math.random() * 140,
      });
    }
  }

  function triggerFloatingText(text, visibleRow = 8, color = '#fde047') {
    if (!text) return;
    floatingTexts.push({
      text,
      row: Math.max(2, Math.min(ROWS - 3, visibleRow)),
      color,
      ageMs: 0,
      durationMs: reducedMotion.matches ? 650 : 900,
    });
  }

  function triggerShake(intensity = 3, durationMs = 130) {
    if (reducedMotion.matches) return;
    shake = { intensity, ageMs: 0, durationMs };
  }

  function updateEffects(dtMs) {
    if (!dtMs) return;
    const dtSec = dtMs / 1000;
    flashes = flashes.filter((f) => { f.ageMs += dtMs; return f.ageMs < f.durationMs; });
    trails = trails.filter((tr) => { tr.ageMs += dtMs; return tr.ageMs < tr.durationMs; });
    bombs = bombs.filter((b) => { b.ageMs += dtMs; return b.ageMs < b.durationMs; });
    lasers = lasers.filter((l) => { l.ageMs += dtMs; return l.ageMs < l.durationMs; });
    floatingTexts = floatingTexts.filter((ft) => { ft.ageMs += dtMs; return ft.ageMs < ft.durationMs; });
    if (shake) {
      shake.ageMs += dtMs;
      if (shake.ageMs >= shake.durationMs) shake = null;
    }
    particles = particles.filter((p) => {
      p.ageMs += dtMs;
      p.col += p.vx * dtSec;
      p.row += p.vy * dtSec;
      p.vy += 12 * dtSec;
      return p.ageMs < p.durationMs;
    });
  }

  function renderBoard(state) {
    const metrics = syncCanvasSize(boardCanvas);
    if (!metrics) return;
    const { width, height, dpr } = metrics;
    const cell = Math.min(width / COLS, height / ROWS);
    const offsetX = (width - cell * COLS) / 2;
    const offsetY = (height - cell * ROWS) / 2;

    let shakeX = 0;
    let shakeY = 0;
    if (shake && !reducedMotion.matches) {
      const mag = shake.intensity * (1 - shake.ageMs / shake.durationMs);
      shakeX = (Math.random() - 0.5) * 2 * mag;
      shakeY = (Math.random() - 0.5) * 2 * mag;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr);

    // 深色高对比棋盘底板
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#0b1224');
    bg.addColorStop(1, '#111c33');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 网格线
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.11)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      const gx = Math.round(offsetX + c * cell) + 0.5;
      ctx.moveTo(gx, offsetY);
      ctx.lineTo(gx, offsetY + ROWS * cell);
    }
    for (let r = 1; r < ROWS; r++) {
      const gy = Math.round(offsetY + r * cell) + 0.5;
      ctx.moveTo(offsetX, gy);
      ctx.lineTo(offsetX + COLS * cell, gy);
    }
    ctx.stroke();

    // 堆高危险区红光预警（顶区 4 行）
    const danger = getDangerRatio(state);
    if (danger > 0) {
      const pulse = reducedMotion.matches ? 0.8 : (0.65 + 0.35 * Math.sin(performance.now() * 0.008));
      const dangerGrad = ctx.createLinearGradient(0, offsetY, 0, offsetY + cell * 4);
      dangerGrad.addColorStop(0, `rgba(239, 68, 68, ${(0.24 * danger * pulse).toFixed(3)})`);
      dangerGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = dangerGrad;
      ctx.fillRect(offsetX, offsetY, COLS * cell, cell * 4);
    }

    // 活动方块垂直对齐引导光带
    if (state.active && state.status === 'playing') {
      const ghostY = getGhostY(state);
      const activeCells = getPieceCells(state.active.type, state.active.rot, state.active.x, state.active.y);
      const minY = Math.max(0, Math.min(...activeCells.map(([, y]) => y)) - BUFFER_ROWS);
      const maxY = Math.min(ROWS, ghostY - BUFFER_ROWS + 3);
      const cols = new Set(activeCells.map(([cx]) => cx));
      if (maxY > minY) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.042)';
        for (const cx of cols) {
          ctx.fillRect(offsetX + cx * cell, offsetY + minY * cell, cell, (maxY - minY) * cell);
        }
      }
    }

    // 硬降光束拖尾
    for (const tr of trails) {
      const progress = tr.ageMs / tr.durationMs;
      const alpha = (1 - progress) * 0.2;
      for (const c of tr.cols) {
        const grad = ctx.createLinearGradient(0, offsetY + tr.topRow * cell, 0, offsetY + tr.bottomRow * cell);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(1, tr.color);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.fillRect(offsetX + c * cell + 1, offsetY + tr.topRow * cell, cell - 2, (tr.bottomRow - tr.topRow) * cell);
        ctx.restore();
      }
    }

    // 已锁定方块
    for (let r = BUFFER_ROWS; r < BUFFER_ROWS + ROWS; r++) {
      const row = state.board[r];
      const vy = r - BUFFER_ROWS;
      for (let c = 0; c < COLS; c++) {
        const cellType = row[c];
        if (cellType) {
          drawBlock(ctx, offsetX + c * cell, offsetY + vy * cell, cell, cellType);
        }
      }
    }

    // 落点虚影 & 当前活动方块
    if (state.active) {
      const { type, rot, x, y, powerup } = state.active;
      const ghostY = getGhostY(state);
      const activeCells = getPieceCells(type, rot, x, y);
      const activeSet = new Set(activeCells.map(([cx, cy]) => cx + ':' + cy));

      if (ghostY !== y) {
        for (const [gx, gy] of getPieceCells(type, rot, x, ghostY)) {
          if (gy < BUFFER_ROWS || activeSet.has(gx + ':' + gy)) continue;
          drawGhostBlock(ctx, offsetX + gx * cell, offsetY + (gy - BUFFER_ROWS) * cell, cell, type);
        }
      }

      const lockRatio = state.grounded ? Math.min(1, state.lockTimerMs / LOCK_DELAY_MS) : 0;
      for (const [ax, ay] of activeCells) {
        if (ay < BUFFER_ROWS) continue;
        drawBlock(ctx, offsetX + ax * cell, offsetY + (ay - BUFFER_ROWS) * cell, cell, type, 1, lockRatio, powerup);
      }
    }

    // 消行闪白
    for (const f of flashes) {
      const t = f.ageMs / f.durationMs;
      const alpha = (1 - t) * (f.isTetris ? 0.78 : 0.52);
      ctx.fillStyle = f.isTetris ? `rgba(253, 224, 71, ${alpha})` : `rgba(248, 250, 252, ${alpha})`;
      for (const r of f.rows) {
        ctx.fillRect(offsetX, offsetY + r * cell, COLS * cell, cell);
      }
    }

    // 激光横扫光束（发光渐变 + 由宽收窄消散）
    for (const l of lasers) {
      const p = l.ageMs / l.durationMs;
      const alpha = 1 - p;
      const thickness = cell * (0.9 * (1 - p * 0.65));
      const cy = offsetY + (l.row + 0.5) * cell;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      const glowGrad = ctx.createLinearGradient(0, cy - thickness, 0, cy + thickness);
      glowGrad.addColorStop(0, 'rgba(34, 211, 238, 0)');
      glowGrad.addColorStop(0.5, 'rgba(34, 211, 238, 0.85)');
      glowGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(offsetX, cy - thickness, COLS * cell, thickness * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(offsetX, cy - thickness * 0.22, COLS * cell, thickness * 0.44);
      ctx.restore();
    }

    // 炸弹冲击波 + 径向闪光核
    for (const b of bombs) {
      const p = b.ageMs / b.durationMs;
      const bx = offsetX + b.cx * cell;
      const by = offsetY + b.cy * cell;
      const flashR = (1.1 + p * 2.1) * cell;
      const ringR = (0.5 + p * 2.6) * cell;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flashGrad = ctx.createRadialGradient(bx, by, 0, bx, by, flashR);
      flashGrad.addColorStop(0, `rgba(255, 247, 237, ${(0.88 * (1 - p)).toFixed(3)})`);
      flashGrad.addColorStop(0.42, `rgba(251, 146, 60, ${(0.55 * (1 - p)).toFixed(3)})`);
      flashGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(bx, by, flashR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.lineWidth = Math.max(1.8, cell * 0.14 * (1 - p));
      ctx.strokeStyle = '#fdba74';
      ctx.beginPath();
      ctx.arc(bx, by, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 消行 / 爆炸发光圆点粒子
    for (const p of particles) {
      const alpha = 1 - p.ageMs / p.durationMs;
      const px = offsetX + p.col * cell;
      const py = offsetY + p.row * cell;
      const pr = Math.max(1.5, p.size * cell * 0.65);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 道具狂热状态指示（柔和寒霜渐变暗角与飘雪微粒 / 即将涨行底部警报）
    if (state.mode === 'party' && state.status === 'playing') {
      if (state.iceTimerMs > 0) {
        const edge = cell * 1.8;
        ctx.save();
        const topG = ctx.createLinearGradient(0, offsetY, 0, offsetY + edge);
        topG.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
        topG.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = topG;
        ctx.fillRect(offsetX, offsetY, COLS * cell, edge);

        const botG = ctx.createLinearGradient(0, offsetY + ROWS * cell, 0, offsetY + ROWS * cell - edge);
        botG.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
        botG.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = botG;
        ctx.fillRect(offsetX, offsetY + ROWS * cell - edge, COLS * cell, edge);

        const leftG = ctx.createLinearGradient(offsetX, 0, offsetX + edge, 0);
        leftG.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
        leftG.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = leftG;
        ctx.fillRect(offsetX, offsetY, edge, ROWS * cell);

        const rightG = ctx.createLinearGradient(offsetX + COLS * cell, 0, offsetX + COLS * cell - edge, 0);
        rightG.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
        rightG.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = rightG;
        ctx.fillRect(offsetX + COLS * cell - edge, offsetY, edge, ROWS * cell);

        if (!reducedMotion.matches) {
          const nowSec = performance.now() / 1000;
          ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
          for (let i = 0; i < 12; i++) {
            const xNorm = ((i * 0.37 + Math.sin(nowSec * 0.9 + i) * 0.06) % 1 + 1) % 1;
            const yNorm = ((i * 0.23 + nowSec * (0.11 + (i % 3) * 0.03)) % 1 + 1) % 1;
            const r = Math.max(1.2, cell * (0.06 + (i % 3) * 0.025));
            ctx.beginPath();
            ctx.arc(offsetX + xNorm * COLS * cell, offsetY + yNorm * ROWS * cell, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      } else if (state.garbageTimerMs >= GARBAGE_INTERVAL_MS - GARBAGE_WARN_MS) {
        const pulse = reducedMotion.matches ? 0.75 : (0.45 + 0.55 * Math.abs(Math.sin(performance.now() * 0.012)));
        ctx.save();
        ctx.fillStyle = `rgba(245, 158, 11, ${(0.85 * pulse).toFixed(3)})`;
        ctx.fillRect(offsetX, offsetY + ROWS * cell - 4, COLS * cell, 4);
        ctx.restore();
      }
    }

    // 棋盘内得分/特技飘字（加粗大字 + 阴影提升清晰度）
    for (const ft of floatingTexts) {
      const p = ft.ageMs / ft.durationMs;
      const alpha = p < 0.7 ? 1 : Math.max(0, (1 - p) / 0.3);
      const lift = reducedMotion.matches ? 0 : p * cell * 1.4;
      const yPos = offsetY + ft.row * cell - lift;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.max(17, Math.round(cell * 0.92))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.shadowColor = 'rgba(2, 6, 23, 0.85)';
      ctx.shadowBlur = 6;
      ctx.strokeText(ft.text, offsetX + (COLS * cell) / 2, yPos);
      ctx.shadowBlur = 0;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, offsetX + (COLS * cell) / 2, yPos);
      ctx.restore();
    }

    ctx.restore();
  }

  function renderMiniPiece(canvas, type, { dimmed = false, powerup = null } = {}) {
    const metrics = syncCanvasSize(canvas);
    if (!metrics) return;
    const { width, height, dpr } = metrics;
    const mctx = canvas.getContext('2d');
    mctx.save();
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, width, height);

    if (!type || !PIECES[type]) {
      mctx.restore();
      return;
    }

    const shape = PIECES[type].shapes[0];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [dx, dy] of shape) {
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy;
      if (dy > maxY) maxY = dy;
    }
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const cell = Math.floor(Math.min((width - 8) / 4, (height - 8) / 2.6));
    const startX = (width - cols * cell) / 2;
    const startY = (height - rows * cell) / 2;

    for (const [dx, dy] of shape) {
      drawBlock(
        mctx,
        startX + (dx - minX) * cell,
        startY + (dy - minY) * cell,
        cell,
        type,
        dimmed ? 0.38 : 1,
        0,
        powerup
      );
    }
    mctx.restore();
  }

  function hasActiveEffects() {
    return flashes.length > 0 || particles.length > 0 || trails.length > 0
      || bombs.length > 0 || lasers.length > 0 || floatingTexts.length > 0 || !!shake;
  }

  return {
    renderBoard,
    renderMiniPiece,
    triggerLineClear,
    triggerHardDrop,
    triggerBomb,
    triggerLaser,
    triggerFloatingText,
    triggerShake,
    updateEffects,
    hasActiveEffects,
  };
}
