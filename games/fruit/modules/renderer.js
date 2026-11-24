import { W, H, SKINS } from './rules.js';

export function createFruitRenderer({ ctx, getState }) {
  let skin, freezeTimer, feverActiveTimer, items, pendingBombs, halves, particles;
  let splatters, floatTexts, bolts, shockwaves, slashes, trail, bombBlast;
  let shakeTimer, shakeMag, flashAlpha, flashColor;

  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = W;
  bgCanvas.height = H;
  (function buildWoodBg() {
    const bctx = bgCanvas.getContext('2d');
    const grad = bctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#3a1f10');
    grad.addColorStop(0.5, '#4c2915');
    grad.addColorStop(1, '#2b1409');
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, W, H);

    // 木板条纹
    const plankH = 76;
    for (let y = 0; y < H; y += plankH) {
      bctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      bctx.fillRect(0, y, W, 2);
      bctx.fillStyle = 'rgba(255, 214, 165, 0.04)';
      bctx.fillRect(0, y + 2, W, 1.5);
      for (let i = 0; i < 6; i += 1) {
        const gy = y + 12 + i * 11;
        bctx.beginPath();
        bctx.moveTo(0, gy);
        bctx.bezierCurveTo(W * 0.3, gy + ((i % 2) ? 4 : -4), W * 0.7, gy + ((i % 2) ? -3 : 3), W, gy);
        bctx.strokeStyle = 'rgba(28, 12, 4, 0.22)';
        bctx.lineWidth = 1.2;
        bctx.stroke();
      }
    }
    // 暗角聚光
    const vig = bctx.createRadialGradient(W * 0.5, H * 0.45, 90, W * 0.5, H * 0.5, W * 0.65);
    vig.addColorStop(0, 'rgba(255, 224, 178, 0.08)');
    vig.addColorStop(1, 'rgba(10, 4, 1, 0.55)');
    bctx.fillStyle = vig;
    bctx.fillRect(0, 0, W, H);
  })();

  // ---------- 精致水果与刀光渲染 ----------
  function addSpecular(x, y, rx, ry, rot) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.fill();
    ctx.restore();
  }

  function drawFruitGraphic(id, r, isInner) {
    if (id === 'watermelon') {
      if (!isInner) {
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
        g.addColorStop(0, '#4ade80');
        g.addColorStop(0.7, '#16a34a');
        g.addColorStop(1, '#14532d');
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        // 3D 贴合球面的波浪深绿西瓜纹
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = '#064e3b';
        ctx.lineWidth = r * 0.14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const ox of [-r * 0.62, -r * 0.2, r * 0.2, r * 0.62]) {
          ctx.beginPath();
          for (let y = -r; y <= r; y += 4) {
            const ny = y / r;
            const curveX = ox * Math.sqrt(Math.max(0.12, 1 - ny * ny * 0.55));
            const wave = Math.sin(y * 0.26 + ox) * 3.2;
            const px = curveX + wave;
            if (y === -r) ctx.moveTo(px, y);
            else ctx.lineTo(px, y);
          }
          ctx.stroke();
        }
        ctx.restore();
        // 顶部小果蒂
        ctx.strokeStyle = '#365314';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r + 1);
        ctx.quadraticCurveTo(3, -r - 6, 7, -r - 5);
        ctx.stroke();
        addSpecular(-r * 0.32, -r * 0.34, r * 0.24, r * 0.13, -0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = '#15803d';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
        ctx.fillStyle = '#dcfce7';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        for (let i = 0; i < 6; i += 1) {
          const a = (Math.PI * 2 * i) / 6;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * r * 0.44, Math.sin(a) * r * 0.44, 2.1, 3.2, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (id === 'banana') {
      ctx.save();
      const br = r * 1.16;
      ctx.translate(0, -br * 0.18);
      ctx.beginPath();
      ctx.moveTo(-br * 0.96, -br * 0.34);
      ctx.bezierCurveTo(-br * 0.52, br * 0.96, br * 0.56, br * 0.96, br * 0.98, -br * 0.34);
      ctx.bezierCurveTo(br * 0.46, br * 0.28, -br * 0.44, br * 0.28, -br * 0.96, -br * 0.34);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -br * 0.25, 0, br * 0.72);
      g.addColorStop(0, isInner ? '#fefce8' : '#fef08a');
      g.addColorStop(0.55, isInner ? '#fef9c3' : '#facc15');
      g.addColorStop(1, isInner ? '#fde047' : '#ca8a04');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = isInner ? '#eab308' : '#a16207';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // 弧面棱线
      ctx.beginPath();
      ctx.moveTo(-br * 0.76, -br * 0.08);
      ctx.quadraticCurveTo(0, br * 0.56, br * 0.78, -br * 0.08);
      ctx.strokeStyle = isInner ? 'rgba(202, 138, 4, 0.35)' : 'rgba(255, 255, 255, 0.48)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 果柄与黑蒂
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.roundRect(-br * 1.04, -br * 0.44, 7, 6, 2);
      ctx.arc(br * 0.98, -br * 0.34, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (id === 'orange') {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#fdba74');
      g.addColorStop(0.55, '#f97316');
      g.addColorStop(1, '#c2410c');
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      if (isInner) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.87, 0, Math.PI * 2);
        ctx.fillStyle = '#fff7ed';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
        ctx.fillStyle = '#fb923c';
        ctx.fill();
        ctx.strokeStyle = '#fff7ed';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 8; i += 1) {
          const a = (Math.PI * i) / 4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = '#fff7ed';
        ctx.fill();
      } else {
        // 橙皮细孔质感
        ctx.fillStyle = 'rgba(154, 52, 18, 0.28)';
        for (const [px, py] of [[-9, 8], [7, 11], [12, -3], [-4, 15], [2, -11], [-14, -2]]) {
          ctx.beginPath();
          ctx.arc(px, py, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.ellipse(r * 0.25, -r * 0.88, 6, 3, -0.4, 0, Math.PI * 2);
        ctx.fill();
        addSpecular(-r * 0.32, -r * 0.34, r * 0.24, r * 0.13, -0.6);
      }
    } else if (id === 'apple') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.68);
      ctx.bezierCurveTo(-r * 0.65, -r * 1.08, -r * 1.12, -r * 0.2, -r * 0.78, r * 0.62);
      ctx.bezierCurveTo(-r * 0.45, r * 1.05, -r * 0.15, r * 0.92, 0, r * 0.82);
      ctx.bezierCurveTo(r * 0.15, r * 0.92, r * 0.45, r * 1.05, r * 0.78, r * 0.62);
      ctx.bezierCurveTo(r * 1.12, -r * 0.2, r * 0.65, -r * 1.08, 0, -r * 0.68);
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.25, r * 0.1, 0, 0, r);
      g.addColorStop(0, isInner ? '#ffffff' : '#f87171');
      g.addColorStop(0.65, isInner ? '#fef3c7' : '#dc2626');
      g.addColorStop(1, isInner ? '#fde68a' : '#991b1b');
      ctx.fillStyle = g;
      ctx.fill();
      if (isInner) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#dc2626';
        ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.ellipse(-4, 0, 2, 3.8, 0.2, 0, Math.PI * 2);
        ctx.ellipse(4, 0, 2, 3.8, -0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.68);
        ctx.quadraticCurveTo(3, -r * 1.02, 7, -r * 1.08);
        ctx.stroke();
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(7, -r * 0.88, 6.5, 3.2, -0.45, 0, Math.PI * 2);
        ctx.fill();
        addSpecular(-r * 0.34, -r * 0.24, r * 0.2, r * 0.12, -0.5);
      }
    } else if (id === 'lemon') {
      ctx.save();
      // 两端带尖突的真实柠檬轮廓
      ctx.beginPath();
      ctx.moveTo(-r * 1.14, 0);
      ctx.bezierCurveTo(-r * 0.96, -r * 0.22, -r * 0.72, -r * 0.78, 0, -r * 0.78);
      ctx.bezierCurveTo(r * 0.72, -r * 0.78, r * 0.96, -r * 0.22, r * 1.14, 0);
      ctx.bezierCurveTo(r * 0.96, r * 0.22, r * 0.72, r * 0.78, 0, r * 0.78);
      ctx.bezierCurveTo(-r * 0.72, r * 0.78, -r * 0.96, r * 0.22, -r * 1.14, 0);
      ctx.closePath();
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.2, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#fef9c3');
      g.addColorStop(0.6, '#facc15');
      g.addColorStop(1, '#ca8a04');
      ctx.fillStyle = g;
      ctx.fill();
      if (isInner) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.86, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fefce8';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.76, r * 0.52, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fde047';
        ctx.fill();
        ctx.strokeStyle = '#fefce8';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 8; i += 1) {
          const a = (Math.PI * i) / 4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.5);
          ctx.stroke();
        }
      } else {
        addSpecular(-r * 0.25, -r * 0.26, r * 0.28, r * 0.12, -0.3);
      }
      ctx.restore();
    } else if (id === 'kiwi') {
      if (isInner) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = '#78350f';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
        ctx.fillStyle = '#84cc16';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = '#ecfccb';
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        for (let i = 0; i < 10; i += 1) {
          const a = (Math.PI * 2 * i) / 10;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // 完整奇异果：椭圆褐皮 + 绒毛点状纹理 + 果蒂
        const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#b45309');
        g.addColorStop(0.65, '#92400e');
        g.addColorStop(1, '#57280a');
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.86, r * 1.04, 0, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.fillStyle = 'rgba(69, 26, 3, 0.45)';
        for (const [fx, fy] of [[-7, -10], [8, -7], [-11, 2], [5, 6], [-4, 13], [9, 12], [0, -3]]) {
          ctx.beginPath();
          ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.ellipse(0, -r * 1.0, 4, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        addSpecular(-r * 0.24, -r * 0.36, r * 0.2, r * 0.11, -0.45);
      }
    } else if (id === 'dragonfruit') {
      // 火焰状青绿尖鳞片（外层）
      const fins = [
        { x: -r * 0.72, y: -r * 0.45, ang: -0.9 },
        { x: r * 0.72, y: -r * 0.45, ang: 0.9 },
        { x: -r * 0.82, y: r * 0.22, ang: -1.45 },
        { x: r * 0.82, y: r * 0.22, ang: 1.45 },
        { x: 0, y: -r * 0.94, ang: 0 },
      ];
      for (const fin of fins) {
        ctx.save();
        ctx.translate(fin.x, fin.y);
        ctx.rotate(fin.ang);
        ctx.beginPath();
        ctx.moveTo(-6, 6);
        ctx.quadraticCurveTo(0, -13, 6, 6);
        ctx.closePath();
        ctx.fillStyle = '#db2777';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-3.2, -2);
        ctx.quadraticCurveTo(0, -13, 3.2, -2);
        ctx.closePath();
        ctx.fillStyle = '#84cc16';
        ctx.fill();
        ctx.restore();
      }

      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#f472b6');
      g.addColorStop(0.7, '#db2777');
      g.addColorStop(1, '#831843');
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.88, r * 1.02, 0, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      if (isInner) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.72, r * 0.84, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fdf2f8';
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        for (let i = 0; i < 12; i += 1) {
          const a = i * 2.1;
          const d = (i % 3) * r * 0.2 + r * 0.12;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // 正面交错贴合鳞片与青绿尖端，消除光滑单调感
        const innerScales = [
          { x: -r * 0.36, y: -r * 0.32, ang: -0.35 },
          { x: r * 0.32, y: -r * 0.22, ang: 0.35 },
          { x: -r * 0.12, y: r * 0.16, ang: -0.15 },
          { x: r * 0.28, y: r * 0.42, ang: 0.25 },
        ];
        for (const sc of innerScales) {
          ctx.save();
          ctx.translate(sc.x, sc.y);
          ctx.rotate(sc.ang);
          ctx.beginPath();
          ctx.moveTo(-7, 5);
          ctx.quadraticCurveTo(0, -10, 7, 5);
          ctx.strokeStyle = 'rgba(131, 24, 67, 0.55)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-2.6, -2);
          ctx.quadraticCurveTo(0, -10, 2.6, -2);
          ctx.closePath();
          ctx.fillStyle = '#a3e635';
          ctx.fill();
          ctx.restore();
        }
        addSpecular(-r * 0.26, -r * 0.34, r * 0.2, r * 0.11, -0.5);
      }
    } else if (id === 'strawberry') {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.96);
      ctx.bezierCurveTo(-r * 0.82, r * 0.42, -r * 0.86, -r * 0.56, 0, -r * 0.64);
      ctx.bezierCurveTo(r * 0.86, -r * 0.56, r * 0.82, r * 0.42, 0, r * 0.96);
      const g = ctx.createRadialGradient(-r * 0.22, -r * 0.18, r * 0.08, 0, 0, r * 0.9);
      g.addColorStop(0, '#fb7185');
      g.addColorStop(0.6, '#e11d48');
      g.addColorStop(1, '#9f1239');
      ctx.fillStyle = g;
      ctx.fill();
      if (isInner) {
        ctx.beginPath();
        ctx.moveTo(0, r * 0.76);
        ctx.bezierCurveTo(-r * 0.58, r * 0.3, -r * 0.62, -r * 0.42, 0, -r * 0.48);
        ctx.bezierCurveTo(r * 0.62, -r * 0.42, r * 0.58, r * 0.3, 0, r * 0.76);
        ctx.fillStyle = '#fecdd3';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, r * 0.06, r * 0.2, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fff1f2';
        ctx.fill();
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.moveTo(-10, -r * 0.56);
        ctx.lineTo(0, -r * 0.74);
        ctx.lineTo(10, -r * 0.56);
        ctx.lineTo(0, -r * 0.48);
        ctx.closePath();
        ctx.fill();
      } else {
        // 细密小果籽
        ctx.fillStyle = '#fef08a';
        const seeds = [
          [-7, -5], [0, -6], [7, -5],
          [-9, 2], [-3, 1], [3, 1], [9, 2],
          [-6, 8], [0, 7], [6, 8],
          [-3, 14], [3, 14],
        ];
        for (const [sx, sy] of seeds) {
          ctx.beginPath();
          ctx.ellipse(sx, sy, 0.85, 1.35, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // 多瓣锯齿绿萼叶 + 小果柄
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.64);
        ctx.lineTo(1, -r * 0.95);
        ctx.stroke();
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.moveTo(-12, -r * 0.56);
        ctx.lineTo(-7, -r * 0.74);
        ctx.lineTo(-3, -r * 0.6);
        ctx.lineTo(0, -r * 0.78);
        ctx.lineTo(3, -r * 0.6);
        ctx.lineTo(7, -r * 0.74);
        ctx.lineTo(12, -r * 0.56);
        ctx.lineTo(5, -r * 0.46);
        ctx.lineTo(0, -r * 0.52);
        ctx.lineTo(-5, -r * 0.46);
        ctx.closePath();
        ctx.fill();
        addSpecular(-r * 0.24, -r * 0.2, r * 0.14, r * 0.08, -0.5);
      }
    } else if (id === 'pineapple') {
      // 完整与切半都保留双层绿叶冠
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.moveTo(-10, -r * 0.72);
      ctx.lineTo(-14, -r * 1.18);
      ctx.lineTo(-3, -r * 0.88);
      ctx.lineTo(0, -r * 1.28);
      ctx.lineTo(3, -r * 0.88);
      ctx.lineTo(14, -r * 1.18);
      ctx.lineTo(10, -r * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(-5, -r * 0.74);
      ctx.lineTo(0, -r * 1.22);
      ctx.lineTo(5, -r * 0.74);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, r * 0.12, r * 0.78, r * 0.92, 0, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.1, r * 0.1, 0, 0, r);
      g.addColorStop(0, isInner ? '#f59e0b' : '#fbbf24');
      g.addColorStop(1, '#b45309');
      ctx.fillStyle = g;
      ctx.fill();
      if (isInner) {
        // 保留棕黄外皮锯齿边 + 金黄果肉 + 放射纹 + 浅黄硬芯
        ctx.beginPath();
        ctx.ellipse(0, r * 0.12, r * 0.66, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.55)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 10; i += 1) {
          const a = (Math.PI * 2 * i) / 10;
          ctx.beginPath();
          ctx.moveTo(0, r * 0.12);
          ctx.lineTo(Math.cos(a) * r * 0.62, r * 0.12 + Math.sin(a) * r * 0.74);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.ellipse(0, r * 0.12, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fef9c3';
        ctx.fill();
      } else {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
        ctx.lineWidth = 1.5;
        for (let k = -r * 1.5; k <= r * 1.5; k += 10) {
          ctx.beginPath();
          ctx.moveTo(k - r, -r);
          ctx.lineTo(k + r, r);
          ctx.moveTo(k + r, -r);
          ctx.lineTo(k - r, r);
          ctx.stroke();
        }
        ctx.restore();
        addSpecular(-r * 0.24, -r * 0.16, r * 0.18, r * 0.1, -0.5);
      }
    } else if (id === 'coconut') {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#92400e');
      g.addColorStop(1, '#451a03');
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      if (isInner) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
      } else {
        // 椰壳纤维纹 + 顶部三芽眼
        ctx.strokeStyle = 'rgba(41, 15, 2, 0.45)';
        ctx.lineWidth = 1.3;
        for (const oy of [-8, 2, 11]) {
          ctx.beginPath();
          ctx.arc(0, oy, r * 0.65, 0.35, 2.75);
          ctx.stroke();
        }
        ctx.fillStyle = '#290f02';
        ctx.beginPath();
        ctx.arc(-4, -r * 0.48, 2.3, 0, Math.PI * 2);
        ctx.arc(4, -r * 0.48, 2.3, 0, Math.PI * 2);
        ctx.arc(0, -r * 0.3, 2.3, 0, Math.PI * 2);
        ctx.fill();
        addSpecular(-r * 0.3, -r * 0.32, r * 0.2, r * 0.11, -0.6);
      }
    } else if (id === 'grapes') {
      // 顶部果梗与绿叶
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.68);
      ctx.quadraticCurveTo(2, -r * 1.0, 6, -r * 1.06);
      ctx.stroke();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.ellipse(8, -r * 0.86, 6.5, 3.2, -0.45, 0, Math.PI * 2);
      ctx.fill();

      const berries = [
        [-9, -11, 0.25], [1, -13, 0.27], [10, -10, 0.24],
        [-11, -2, 0.26], [-2, -2, 0.28], [8, -1, 0.27],
        [-7, 7, 0.26], [3, 8, 0.27], [10, 6, 0.22],
        [-2, 16, 0.25], [4, 15, 0.22],
      ];
      for (const [bx, by, scale] of berries) {
        const br = r * scale;
        const bg = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, br);
        bg.addColorStop(0, '#c084fc');
        bg.addColorStop(0.55, '#7e22ce');
        bg.addColorStop(1, '#4c1d95');
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();
        if (isInner) {
          ctx.beginPath();
          ctx.arc(bx, by, br * 0.72, 0, Math.PI * 2);
          ctx.fillStyle = '#e9d5ff';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(bx, by, br * 0.44, 0, Math.PI * 2);
          ctx.fillStyle = '#d9f99d';
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(bx - 2, by - 2, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
          ctx.fill();
        }
      }
    } else if (id === 'cherry') {
      // Y 字形果梗与绿叶
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(1, -r * 0.96);
      ctx.quadraticCurveTo(-5, -r * 0.4, -r * 0.42, r * 0.16);
      ctx.moveTo(1, -r * 0.96);
      ctx.quadraticCurveTo(6, -r * 0.36, r * 0.44, r * 0.24);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(8, -r * 0.88, 6.5, 3.2, -0.4, 0, Math.PI * 2);
      ctx.fill();

      const cr = r * 0.44;
      for (const [cx, cy, c1, c2] of [
        [-r * 0.42, r * 0.28, '#f87171', '#991b1b'],
        [r * 0.44, r * 0.36, '#fb7185', '#b91c1c'],
      ]) {
        const cg = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, cr);
        cg.addColorStop(0, isInner ? '#fca5a5' : c1);
        cg.addColorStop(0.6, '#dc2626');
        cg.addColorStop(1, c2);
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();
        if (isInner) {
          // 深红果皮外圈 + 鲜红果肉 + 米黄小樱桃核
          ctx.beginPath();
          ctx.arc(cx, cy, cr * 0.84, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx, cy, cr * 0.26, cr * 0.32, 0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#d97706';
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx - 0.6, cy - 0.6, cr * 0.14, cr * 0.18, 0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#fde68a';
          ctx.fill();
        } else {
          addSpecular(cx - 3.5, cy - 3.5, 3.2, 2, -0.5);
        }
      }
    } else if (id === 'avocado') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.98);
      ctx.bezierCurveTo(r * 0.46, -r * 0.98, r * 0.56, -r * 0.36, r * 0.84, r * 0.12);
      ctx.bezierCurveTo(r * 1.0, r * 0.65, r * 0.58, r * 1.02, 0, r * 1.02);
      ctx.bezierCurveTo(-r * 0.58, r * 1.02, -r * 1.0, r * 0.65, -r * 0.84, r * 0.12);
      ctx.bezierCurveTo(-r * 0.56, -r * 0.36, -r * 0.46, -r * 0.98, 0, -r * 0.98);
      const g = ctx.createRadialGradient(-r * 0.22, -r * 0.15, r * 0.08, 0, r * 0.1, r * 1.05);
      g.addColorStop(0, '#84cc16');
      g.addColorStop(0.5, '#3f6212');
      g.addColorStop(1, '#1a2e05');
      ctx.fillStyle = g;
      ctx.fill();
      if (isInner) {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.86);
        ctx.bezierCurveTo(r * 0.38, -r * 0.86, r * 0.46, -r * 0.3, r * 0.72, r * 0.12);
        ctx.bezierCurveTo(r * 0.86, r * 0.58, r * 0.48, r * 0.88, 0, r * 0.88);
        ctx.bezierCurveTo(-r * 0.48, r * 0.88, -r * 0.86, r * 0.58, -r * 0.72, r * 0.12);
        ctx.bezierCurveTo(-r * 0.46, -r * 0.3, -r * 0.38, -r * 0.86, 0, -r * 0.86);
        const fg = ctx.createRadialGradient(0, r * 0.24, r * 0.2, 0, r * 0.2, r * 0.9);
        fg.addColorStop(0, '#fef9c3');
        fg.addColorStop(0.6, '#bef264');
        fg.addColorStop(1, '#65a30d');
        ctx.fillStyle = fg;
        ctx.fill();
        const pg = ctx.createRadialGradient(-3, r * 0.24 - 3, 2, 0, r * 0.28, r * 0.34);
        pg.addColorStop(0, '#b45309');
        pg.addColorStop(0.7, '#78350f');
        pg.addColorStop(1, '#451a03');
        ctx.beginPath();
        ctx.arc(0, r * 0.28, r * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = pg;
        ctx.fill();
      } else {
        // 柔亮边缘轮廓提亮，避免融进深色木板
        ctx.strokeStyle = 'rgba(190, 242, 100, 0.38)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // 顶部木质果蒂纽扣
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.98, 4.5, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        addSpecular(-r * 0.16, -r * 0.4, r * 0.16, r * 0.09, -0.4);
      }
    } else if (id === 'pear') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.bezierCurveTo(r * 0.4, -r * 0.92, r * 0.42, -r * 0.34, r * 0.78, r * 0.1);
      ctx.bezierCurveTo(r * 1.02, r * 0.64, r * 0.58, r * 1.02, 0, r * 1.02);
      ctx.bezierCurveTo(-r * 0.58, r * 1.02, -r * 1.02, r * 0.64, -r * 0.78, r * 0.1);
      ctx.bezierCurveTo(-r * 0.42, -r * 0.34, -r * 0.4, -r * 0.92, 0, -r * 0.92);
      const g = ctx.createRadialGradient(-r * 0.22, -r * 0.1, r * 0.1, 0, r * 0.18, r * 1.05);
      g.addColorStop(0, isInner ? '#ffffff' : '#fef9c3');
      g.addColorStop(0.55, isInner ? '#fefce8' : '#fde047');
      g.addColorStop(1, isInner ? '#fef3c7' : '#ca8a04');
      ctx.fillStyle = g;
      ctx.fill();
      if (isInner) {
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = '#ca8a04';
        ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.ellipse(-3.5, r * 0.25, 1.8, 3.2, 0.2, 0, Math.PI * 2);
        ctx.ellipse(3.5, r * 0.25, 1.8, 3.2, -0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 暖粉橙果颊红晕
        ctx.save();
        ctx.clip();
        const blush = ctx.createRadialGradient(r * 0.35, r * 0.35, 2, r * 0.35, r * 0.35, r * 0.65);
        blush.addColorStop(0, 'rgba(249, 115, 22, 0.42)');
        blush.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = blush;
        ctx.fillRect(-r, -r, r * 2, r * 2.2);
        ctx.restore();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.92);
        ctx.quadraticCurveTo(2, -r * 1.14, 5, -r * 1.17);
        ctx.stroke();
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(6, -r * 1.0, 5.5, 2.6, -0.4, 0, Math.PI * 2);
        ctx.fill();
        addSpecular(-r * 0.2, -r * 0.34, r * 0.15, r * 0.09, -0.45);
      }
    }
  }

  function drawBomb(r, tNow) {
    // 红色危险外圈脉冲，确保暗色木纹背景下也清晰可见
    const dangerPulse = 0.48 + Math.sin(tNow * 0.018) * 0.28;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r + 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(239, 68, 68, ${dangerPulse.toFixed(2)})`;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.restore();

    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#64748b');
    g.addColorStop(0.5, '#1e293b');
    g.addColorStop(1, '#020617');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 危险红环与叉号
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(7, 7);
    ctx.moveTo(7, -7);
    ctx.lineTo(-7, 7);
    ctx.stroke();

    // 引线与闪烁火花
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.45, -r * 0.72);
    ctx.quadraticCurveTo(r * 0.85, -r * 1.05, r * 0.95, -r * 0.78);
    ctx.stroke();

    const pulse = 5 + Math.sin(tNow * 0.025) * 2.5;
    ctx.beginPath();
    ctx.arc(r * 0.95, -r * 0.78, pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 146, 60, 0.65)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.95, -r * 0.78, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  }

  function drawPomegranate(r, hits) {
    // 顶部石榴皇冠花萼
    ctx.fillStyle = '#9f1239';
    ctx.beginPath();
    ctx.moveTo(-10, -r * 0.82);
    ctx.lineTo(-13, -r * 1.18);
    ctx.lineTo(-5, -r * 0.98);
    ctx.lineTo(0, -r * 1.24);
    ctx.lineTo(5, -r * 0.98);
    ctx.lineTo(13, -r * 1.18);
    ctx.lineTo(10, -r * 0.82);
    ctx.closePath();
    ctx.fill();

    // 饱满石榴果身
    const pg = ctx.createRadialGradient(-r * 0.28, -r * 0.26, r * 0.1, 0, 0, r);
    pg.addColorStop(0, '#fb7185');
    pg.addColorStop(0.58, '#e11d48');
    pg.addColorStop(1, '#881337');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();

    // 表面微棱与红宝石裂纹籽粒（随连切次数显现）
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(254, 205, 211, 0.55)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    if (hits > 0) {
      ctx.fillStyle = '#fef2f2';
      const count = Math.min(8, hits + 2);
      for (let i = 0; i < count; i += 1) {
        const a = i * 1.9;
        const d = (i % 2 ? 0.32 : 0.54) * r;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    addSpecular(-r * 0.3, -r * 0.32, r * 0.22, r * 0.12, -0.55);
  }

  function drawSpecialAura(special, r, tNow) {
    const themes = {
      freeze: { ring: 'rgba(56, 189, 248, 0.65)', fill: 'rgba(186, 230, 253, 0.16)', badge: '#0284c7', glyph: '❄' },
      frenzy: { ring: 'rgba(236, 72, 153, 0.68)', fill: 'rgba(244, 114, 182, 0.15)', badge: '#db2777', glyph: '★' },
      double: { ring: 'rgba(250, 204, 21, 0.72)', fill: 'rgba(254, 240, 138, 0.18)', badge: '#d97706', glyph: '×2' },
      pomegranate: { ring: 'rgba(244, 63, 94, 0.72)', fill: 'rgba(254, 205, 211, 0.15)', badge: '#be123c', glyph: '✦' },
      lightning: { ring: 'rgba(253, 224, 71, 0.75)', fill: 'rgba(254, 249, 195, 0.18)', badge: '#ca8a04', glyph: '⚡' },
      heal: { ring: 'rgba(74, 222, 128, 0.68)', fill: 'rgba(187, 247, 208, 0.16)', badge: '#16a34a', glyph: '+♥' },
      splitter: { ring: 'rgba(251, 146, 60, 0.74)', fill: 'rgba(254, 215, 170, 0.16)', badge: '#ea580c', glyph: '❖' },
      magnet: { ring: 'rgba(168, 85, 247, 0.74)', fill: 'rgba(233, 213, 255, 0.16)', badge: '#7c3aed', glyph: '◎' },
      shield: { ring: 'rgba(34, 211, 238, 0.8)', fill: 'rgba(165, 243, 252, 0.16)', badge: '#0891b2', glyph: '◈' },
      clock: { ring: 'rgba(245, 158, 11, 0.76)', fill: 'rgba(254, 243, 199, 0.18)', badge: '#d97706', glyph: '+3s' },
    };
    const th = themes[special];
    if (!th) return;
    const pulse = r + 6 + Math.sin(tNow * 0.01) * 2.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, pulse, 0, Math.PI * 2);
    ctx.fillStyle = th.fill;
    ctx.fill();
    ctx.strokeStyle = th.ring;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 醒目主题色徽章
    const bx = r * 0.76;
    const by = -r * 0.76;
    ctx.fillStyle = th.badge;
    ctx.beginPath();
    ctx.arc(bx, by, 11.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = th.glyph.length >= 3
      ? '800 9.5px ui-sans-serif, system-ui, sans-serif'
      : '800 10.5px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(th.glyph, bx, by + 0.5);
    ctx.restore();
  }

  function drawBladeTrail() {
    if (trail.length < 2) return;
    const st = SKINS[skin];
    let auroraGrad = null;
    if (skin === 'aurora') {
      const pStart = trail[0];
      const pEnd = trail[trail.length - 1];
      auroraGrad = ctx.createLinearGradient(pStart.x, pStart.y, pEnd.x, pEnd.y);
      auroraGrad.addColorStop(0, '#a855f7');
      auroraGrad.addColorStop(0.5, '#38bdf8');
      auroraGrad.addColorStop(1, '#2dd4bf');
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 外层柔光（无 shadowBlur 开销，60fps 顺滑）
    for (let i = 1; i < trail.length; i += 1) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const ratio = i / trail.length;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = auroraGrad || st.glow;
      ctx.lineWidth = st.width * 1.9 * ratio;
      ctx.globalAlpha = 0.24 * ratio;
      ctx.stroke();

      ctx.strokeStyle = auroraGrad || st.glow;
      ctx.lineWidth = st.width * ratio;
      ctx.globalAlpha = 0.58 * ratio;
      ctx.stroke();

      ctx.strokeStyle = st.core;
      ctx.lineWidth = Math.max(1.5, st.width * 0.45 * ratio);
      ctx.globalAlpha = 0.96 * ratio;
      ctx.stroke();
    }

    // 霓虹电刃额外电弧折线
    if (skin === 'neon' && trail.length >= 3) {
      ctx.beginPath();
      for (let i = 0; i < trail.length; i += 1) {
        const jx = trail[i].x + (Math.random() - 0.5) * 9;
        const jy = trail[i].y + (Math.random() - 0.5) * 9;
        if (i === 0) ctx.moveTo(jx, jy);
        else ctx.lineTo(jx, jy);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    const tNow = performance.now();
    ctx.save();
    if (shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * shakeMag * 2;
      const sy = (Math.random() - 0.5) * shakeMag * 2;
      ctx.translate(sx, sy);
    }

    ctx.drawImage(bgCanvas, 0, 0);

    // 果汁飞溅印
    for (const sp of splatters) {
      ctx.save();
      ctx.globalAlpha = sp.alpha;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
      for (const d of sp.drops) {
        ctx.beginPath();
        ctx.arc(sp.x + d.dx, sp.y + d.dy, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 冰冻全屏霜晕 / 超级暴走暖金晕 / 护盾边缘柔光
    if (freezeTimer > 0) {
      ctx.save();
      const fg = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.25, W * 0.5, H * 0.5, W * 0.6);
      fg.addColorStop(0, 'rgba(56, 189, 248, 0)');
      fg.addColorStop(1, 'rgba(56, 189, 248, 0.26)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (feverActiveTimer > 0) {
      ctx.save();
      const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.28, W * 0.5, H * 0.5, W * 0.62);
      vg.addColorStop(0, 'rgba(251, 191, 36, 0)');
      vg.addColorStop(1, 'rgba(249, 115, 22, 0.22)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (hasShield) {
      ctx.save();
      const sg = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.34, W * 0.5, H * 0.5, W * 0.64);
      sg.addColorStop(0, 'rgba(34, 211, 238, 0)');
      sg.addColorStop(1, `rgba(34, 211, 238, ${(0.18 + Math.sin(tNow * 0.008) * 0.06).toFixed(2)})`);
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 切开的两半（真·沿刀锋角度切割）
    for (const h of halves) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot + h.sliceAngle);
      ctx.beginPath();
      if (h.side < 0) ctx.rect(-h.r * 1.5, -h.r * 1.5, h.r * 3, h.r * 1.5);
      else ctx.rect(-h.r * 1.5, 0, h.r * 3, h.r * 1.5);
      ctx.clip();
      ctx.rotate(-h.sliceAngle);
      drawFruitGraphic(h.fruit.id, h.r, true);
      ctx.restore();
    }

    // 完整水果与炸弹（投影随自身轮廓）
    for (const item of items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      if (item.hitBounce > 0) {
        const s = 1 + item.hitBounce;
        ctx.scale(s, s);
      }

      if (item.special && item.special !== 'bomb') {
        drawSpecialAura(item.special, item.r, tNow);
      } else if (item.isMini) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, item.r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.75)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(item.rot);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 7;
      if (item.special === 'bomb') {
        drawBomb(item.r, tNow);
      } else if (item.special === 'pomegranate') {
        drawPomegranate(item.r, item.hits);
      } else {
        drawFruitGraphic(item.fruit.id, item.r, false);
      }
      ctx.restore();

      // 底部炸弹刚冒头时的边缘微预警标
      if (item.special === 'bomb' && item.vy < 0 && item.y > H - 46) {
        ctx.save();
        const bx = Math.max(24, Math.min(W - 24, item.x));
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.beginPath();
        ctx.moveTo(bx, H - 22);
        ctx.lineTo(bx - 8, H - 8);
        ctx.lineTo(bx + 8, H - 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 炸弹发射前底部强先兆（0.45s 提前警示）
    for (const pb of pendingBombs) {
      const progress = 1 - Math.max(0, pb.delay / pb.maxDelay);
      const bx = Math.max(28, Math.min(W - 28, pb.launchX));
      const by = H - 24;
      const blink = 0.65 + Math.sin(tNow * 0.032) * 0.35;
      ctx.save();
      // 脉冲外环
      ctx.beginPath();
      ctx.arc(bx, by, 18 + (1 - progress) * 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${(0.55 * blink).toFixed(2)})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // 发射点红底圆 + 进度弧
      ctx.beginPath();
      ctx.arc(bx, by, 13, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(185, 28, 28, 0.9)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, 15, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * progress);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      // 上指箭头 + !
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(bx, by - 22);
      ctx.lineTo(bx - 6, by - 14);
      ctx.lineTo(bx + 6, by - 14);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 15px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', bx, by + 1);
      ctx.restore();
    }

    // 闪电链
    for (const b of bolts) {
      ctx.save();
      ctx.globalAlpha = b.life / b.maxLife;
      ctx.strokeStyle = '#fef08a';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let i = 0; i < b.points.length; i += 1) {
        const p = b.points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else {
          const prev = b.points[i - 1];
          const mx = (prev.x + p.x) * 0.5 + (Math.random() - 0.5) * 26;
          const my = (prev.y + p.y) * 0.5 + (Math.random() - 0.5) * 26;
          ctx.lineTo(mx, my);
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 粒子
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      if (p.kind === 'petal') {
        ctx.rotate(p.rot || 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.2, p.r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'crystal') {
        ctx.rotate(p.rot || 0);
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.lineTo(p.r * 0.7, 0);
        ctx.lineTo(0, p.r);
        ctx.lineTo(-p.r * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 命中冲击波圆环
    for (const sw of shockwaves) {
      const p = 1 - sw.life / sw.maxLife;
      const r = sw.r + (sw.maxR - sw.r) * p;
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - p) * 0.82);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(1.5, 4 * (1 - p));
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 命中瞬间贯穿斩击白芒
    for (const sl of slashes) {
      const ratio = sl.life / sl.maxLife;
      ctx.save();
      ctx.translate(sl.x, sl.y);
      ctx.rotate(sl.angle);
      ctx.globalAlpha = ratio;
      ctx.fillStyle = sl.color;
      ctx.beginPath();
      ctx.moveTo(-sl.len * 0.5, 0);
      ctx.quadraticCurveTo(0, -4.2 * ratio, sl.len * 0.5, 0);
      ctx.quadraticCurveTo(0, 4.2 * ratio, -sl.len * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 刀光
    drawBladeTrail();

    // 炸弹爆裂放射光束
    if (bombBlast) {
      const p = bombBlast.timer / bombBlast.duration;
      const rayAlpha = p < 0.65 ? Math.min(1, p / 0.25) : Math.max(0, 1 - (p - 0.65) / 0.35);
      ctx.save();
      ctx.translate(bombBlast.x, bombBlast.y);
      ctx.rotate(p * 0.45);
      ctx.globalAlpha = rayAlpha * 0.9;
      for (let i = 0; i < 10; i += 1) {
        const a = (Math.PI * 2 * i) / 10;
        const spread = 0.08 + p * 0.12;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a - spread) * 900, Math.sin(a - spread) * 900);
        ctx.lineTo(Math.cos(a + spread) * 900, Math.sin(a + spread) * 900);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#fef08a';
        ctx.fill();
      }
      ctx.restore();
    }

    // 飘字
    for (const ft of floatTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.font = `900 ${Math.round(18 * ft.scale)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 闪屏
    if (flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    ctx.restore();
  }

  return {
    draw() {
      ({
        skin, freezeTimer, feverActiveTimer, items, pendingBombs, halves, particles,
        splatters, floatTexts, bolts, shockwaves, slashes, trail, bombBlast,
        shakeTimer, shakeMag, flashAlpha, flashColor,
      } = getState());
      draw();
    },
  };
}
