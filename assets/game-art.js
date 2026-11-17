/**
 * 画布内游戏元素（自绘，零依赖）
 * 用途：蛇的减速提示、投篮的火焰/金球徽章等画布元素，避免依赖系统 emoji。
 */
(function () {
  function drawStar(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? r : r * 0.45;
      const angle = (Math.PI / 5) * i;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color || '#f59e0b';
    ctx.fill();
    ctx.restore();
  }

  function drawFire(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.bezierCurveTo(-r * 0.95, r * 0.35, -r * 0.7, -r * 0.45, 0, -r);
    ctx.bezierCurveTo(r * 0.7, -r * 0.45, r * 0.95, r * 0.35, 0, r);
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, r * 0.72);
    ctx.bezierCurveTo(-r * 0.48, r * 0.28, -r * 0.36, -r * 0.18, 0, -r * 0.55);
    ctx.bezierCurveTo(r * 0.36, -r * 0.18, r * 0.48, r * 0.28, 0, r * 0.72);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.restore();
  }

  function drawSnowflake(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color || '#38bdf8';
    ctx.lineWidth = Math.max(1.4, r * 0.24);
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(dx * r, dy * r);
      ctx.stroke();
      const branchX = dx * r * 0.62;
      const branchY = dy * r * 0.62;
      const perpX = -dy * r * 0.28;
      const perpY = dx * r * 0.28;
      ctx.beginPath();
      ctx.moveTo(branchX + perpX, branchY + perpY);
      ctx.lineTo(branchX, branchY);
      ctx.lineTo(branchX - perpX, branchY - perpY);
      ctx.stroke();
    }
    ctx.restore();
  }

  window.GameArt = { drawStar, drawFire, drawSnowflake };
})();
