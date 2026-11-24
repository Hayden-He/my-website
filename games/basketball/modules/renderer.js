import {
  W, H, FLOOR_Y, BALL_R, BOARD_X, RIM_LEFT_X, RIM_RIGHT_X, RIM_CENTER_X,
  BALL_SKINS, SKYLINE, getBlockers,
} from './rules.js';

export function createBasketballRenderer({ ctx, dpr, getState, getPractice, getSkinIndex, isReducedMotion, t }) {
  let state = {};
  let practice = false;
  let skinIndex = 0;

  function drawNightGlow(x, y, radiusX, radiusY, color, opacity) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, radiusY / radiusX);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    glow.addColorStop(0, `rgba(${color}, ${opacity})`);
    glow.addColorStop(0.5, `rgba(${color}, ${opacity * 0.38})`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFloodlight(x, groundX, color) {
    const lampY = 61;
    const beam = ctx.createLinearGradient(x, lampY, groundX, FLOOR_Y);
    beam.addColorStop(0, `rgba(${color}, 0.27)`);
    beam.addColorStop(0.44, `rgba(${color}, 0.10)`);
    beam.addColorStop(1, `rgba(${color}, 0.02)`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 13, lampY);
    ctx.lineTo(x + 13, lampY);
    ctx.lineTo(groundX + 124, FLOOR_Y);
    ctx.lineTo(groundX - 124, FLOOR_Y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#253b4c';
    ctx.fillRect(x - 2, lampY, 4, FLOOR_Y - lampY);
    ctx.fillStyle = '#425b66';
    ctx.fillRect(x - 2, lampY, 1, FLOOR_Y - lampY);
    drawNightGlow(x, lampY, 51, 43, color, 0.48);
    ctx.fillStyle = '#122332';
    ctx.beginPath();
    ctx.roundRect(x - 21, lampY - 12, 42, 15, 4);
    ctx.fill();
    ctx.fillStyle = `rgb(${color})`;
    for (let panel = -1; panel <= 1; panel++) {
      ctx.fillRect(x + panel * 12 - 5, lampY - 7, 10, 6);
    }
  }

  function drawCourtClouds(color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const x = ((state.skyTime * (6 + i * 2) + i * 230) % (W + 180)) - 90;
      ctx.beginPath();
      ctx.ellipse(x, 58 + i * 32, 64 + i * 12, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawNightCityAndFence(opts) {
    // 远层楼顶穿插于近层天际线后，近层保留少量亮窗与围栏
    ctx.fillStyle = opts.far;
    SKYLINE.forEach((building, i) => {
      const roof = FLOOR_Y - building.h - 16 - (i % 3) * 12;
      ctx.fillRect(building.x - 17, roof, building.w - 6, FLOOR_Y - roof);
    });
    SKYLINE.forEach((building, i) => {
      const roof = FLOOR_Y - building.h;
      ctx.fillStyle = i % 2 ? opts.nearA : opts.nearB;
      ctx.fillRect(building.x, roof, building.w, building.h);
      ctx.fillStyle = typeof opts.roofLine === 'function' ? opts.roofLine(i) : opts.roofLine;
      ctx.fillRect(building.x + 1, roof, building.w - 2, 2);
      for (let row = 0; roof + 14 + row * 17 < FLOOR_Y - 56; row++) {
        for (let column = 0; 10 + column * 13 < building.w - 7; column++) {
          if ((i * 11 + row * 13 + column * 7) % 17 < 4) {
            ctx.fillStyle = (i + row + column) % 3 === 0 ? opts.winA : opts.winB;
            ctx.fillRect(building.x + 10 + column * 13, roof + 14 + row * 17, 4, 7);
          }
        }
      }
    });

    drawFloodlight(185, 142, opts.lightL);
    drawFloodlight(514, 506, opts.lightR);

    const fenceTop = FLOOR_Y - 49;
    ctx.strokeStyle = opts.fenceMesh;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -49; x < W + 49; x += 16) {
      ctx.moveTo(x, fenceTop);
      ctx.lineTo(x + 49, FLOOR_Y);
      ctx.moveTo(x + 49, fenceTop);
      ctx.lineTo(x, FLOOR_Y);
    }
    ctx.stroke();
    ctx.fillStyle = opts.fenceRail;
    ctx.fillRect(0, fenceTop, W, 2);
    ctx.fillStyle = opts.fencePost;
    for (let x = 34; x < W; x += 101) ctx.fillRect(x, fenceTop - 2, 3, 51);

    // 光区裁在地面内，避免光晕盖住围栏或投篮区
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.clip();
    const floor = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    floor.addColorStop(0, opts.floor0);
    floor.addColorStop(0.5, opts.floor1);
    floor.addColorStop(1, opts.floor2);
    ctx.fillStyle = floor;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    drawNightGlow(142, FLOOR_Y + 23, 185, 47, opts.lightL, opts.glowAlpha);
    drawNightGlow(506, FLOOR_Y + 20, 170, 42, opts.lightR, opts.glowAlpha * 0.9);
    ctx.restore();
    drawCourtMarkings(opts.boundary, opts.lines);
  }

  function drawNightCourt() {
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    sky.addColorStop(0, '#060e1c');
    sky.addColorStop(0.57, '#152c43');
    sky.addColorStop(1, '#345366');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, FLOOR_Y);
    drawNightGlow(365, 238, 280, 132, '112, 162, 180', 0.19);
    drawCourtClouds('rgba(125, 166, 185, 0.04)');

    drawNightCityAndFence({
      far: '#203b50',
      nearA: '#0e2131',
      nearB: '#102637',
      roofLine: '#263e4a',
      winA: '#715947',
      winB: '#4b4942',
      lightL: '255, 224, 173',
      lightR: '162, 219, 239',
      fenceMesh: 'rgba(96, 130, 142, 0.20)',
      fenceRail: '#48606b',
      fencePost: '#253d4b',
      floor0: '#26454c',
      floor1: '#20363e',
      floor2: '#101e29',
      glowAlpha: 0.27,
      boundary: '#a6bcb8',
      lines: 'rgba(216, 231, 220, 0.55)',
    });
  }

  function drawAuroraCourt() {
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    sky.addColorStop(0, '#040914');
    sky.addColorStop(0.55, '#0b192e');
    sky.addColorStop(1, '#182b47');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, FLOOR_Y);

    // 柔和青紫极光带：顶部与底部均平滑衰减至 0，无硬边
    for (let band = 0; band < 2; band++) {
      ctx.save();
      const baseY = 64 + band * 44;
      const grad = ctx.createLinearGradient(0, baseY - 26, 0, baseY + 62);
      grad.addColorStop(0, 'rgba(45, 212, 191, 0)');
      grad.addColorStop(0.42, band === 0 ? 'rgba(45, 212, 191, 0.17)' : 'rgba(167, 139, 250, 0.15)');
      grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 32) {
        const wave = Math.sin(x * 0.012 + state.skyTime * (0.45 + band * 0.2) + band * 2) * 14;
        if (x === 0) ctx.moveTo(x, baseY + wave);
        else ctx.lineTo(x, baseY + wave);
      }
      ctx.lineTo(W, baseY + 62);
      ctx.lineTo(0, baseY + 62);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    drawNightCityAndFence({
      far: '#142642',
      nearA: '#0b1626',
      nearB: '#0f1d32',
      roofLine: (i) => (i % 2 ? 'rgba(56, 189, 248, 0.42)' : 'rgba(192, 132, 252, 0.38)'),
      winA: 'rgba(103, 232, 249, 0.36)',
      winB: 'rgba(196, 181, 253, 0.3)',
      lightL: '103, 232, 249',
      lightR: '196, 181, 253',
      fenceMesh: 'rgba(103, 232, 249, 0.16)',
      fenceRail: '#334155',
      fencePost: '#1e293b',
      floor0: '#1e293b',
      floor1: '#172033',
      floor2: '#0b1120',
      glowAlpha: 0.24,
      boundary: '#7dd3fc',
      lines: 'rgba(186, 230, 253, 0.48)',
    });
  }

  function drawStarryCourt() {
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    sky.addColorStop(0, '#02040a');
    sky.addColorStop(0.5, '#0b1026');
    sky.addColorStop(1, '#1b1d3d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, FLOOR_Y);

    // 淡银河光带
    ctx.save();
    ctx.translate(W * 0.5, 130);
    ctx.rotate(-0.22);
    const milky = ctx.createRadialGradient(0, 0, 10, 0, 0, 290);
    milky.addColorStop(0, 'rgba(129, 140, 248, 0.14)');
    milky.addColorStop(0.55, 'rgba(56, 189, 248, 0.06)');
    milky.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = milky;
    ctx.scale(1.6, 0.45);
    ctx.beginPath();
    ctx.arc(0, 0, 290, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 确定性星辰闪烁
    for (let i = 0; i < 42; i++) {
      const sx = (i * 97 + 41) % W;
      const sy = (i * 53 + 17) % (FLOOR_Y - 90);
      const twinkle = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(state.skyTime * (1.5 + (i % 4) * 0.6) + i));
      ctx.fillStyle = i % 5 === 0 ? `rgba(253, 224, 71, ${twinkle})` : `rgba(226, 232, 240, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(sx, sy, i % 6 === 0 ? 1.7 : 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 偶发流星（每 5.2 秒划过一次）
    const meteorCycle = state.skyTime % 5.2;
    if (meteorCycle < 0.75) {
      const p = meteorCycle / 0.75;
      const mx = 520 - p * 220;
      const my = 32 + p * 85;
      ctx.strokeStyle = `rgba(254, 240, 138, ${(1 - p) * 0.75})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + 34, my - 13);
      ctx.stroke();
    }

    drawNightCityAndFence({
      far: '#181c3a',
      nearA: '#0a0f1f',
      nearB: '#0f172a',
      roofLine: 'rgba(253, 230, 138, 0.28)',
      winA: 'rgba(253, 224, 71, 0.32)',
      winB: 'rgba(147, 197, 253, 0.25)',
      lightL: '253, 224, 140',
      lightR: '147, 197, 253',
      fenceMesh: 'rgba(147, 197, 253, 0.14)',
      fenceRail: '#312e81',
      fencePost: '#1e1b4b',
      floor0: '#1e1b3a',
      floor1: '#15142d',
      floor2: '#090919',
      glowAlpha: 0.24,
      boundary: '#fde68a',
      lines: 'rgba(224, 231, 255, 0.5)',
    });
  }

  function drawSunsetCourt() {
    const isDusk = state.score >= 15;

    // 随分数段渐进切换天空氛围（黄昏 -> 暮色 -> 霓虹夜场）
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    if (isDusk) {
      sky.addColorStop(0, '#0f172a');
      sky.addColorStop(0.45, '#1e1b4b');
      sky.addColorStop(0.82, '#4338ca');
      sky.addColorStop(1, '#7c3aed');
    } else {
      sky.addColorStop(0, '#312e81');
      sky.addColorStop(0.45, '#7c2d12');
      sky.addColorStop(0.82, '#ea580c');
      sky.addColorStop(1, '#fdba74');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, FLOOR_Y);

    const sunY = isDusk ? 255 : 235;
    const sunGrad = ctx.createRadialGradient(480, sunY, 10, 480, sunY, 95);
    sunGrad.addColorStop(0, isDusk ? 'rgba(221, 214, 254, 0.45)' : 'rgba(254, 240, 138, 0.92)');
    sunGrad.addColorStop(0.5, isDusk ? 'rgba(139, 92, 246, 0.22)' : 'rgba(251, 146, 60, 0.35)');
    sunGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(480, sunY, 95, 0, Math.PI * 2);
    ctx.fill();

    if (isDusk) drawCourtClouds('rgba(226, 232, 240, 0.08)');

    // 城市剪影（暮色亮起暖色窗灯）
    ctx.fillStyle = 'rgba(30, 27, 75, 0.65)';
    SKYLINE.forEach((b, idx) => {
      const topY = FLOOR_Y - b.h;
      ctx.fillRect(b.x, topY, b.w, b.h);
      if (isDusk) {
        ctx.fillStyle = 'rgba(253, 186, 116, 0.28)';
        for (let wy = topY + 14; wy < FLOOR_Y - 84; wy += 16) {
          for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 14) {
            if ((wx + wy + idx) % 3 !== 0) {
              ctx.fillRect(wx, wy, 5, 7);
            }
          }
        }
        ctx.fillStyle = 'rgba(30, 27, 75, 0.65)';
      }
    });

    // 街头铁丝围栏（下半背景）
    const fenceTop = FLOOR_Y - 78;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, fenceTop);
    ctx.lineTo(W, fenceTop);
    for (let x = -80; x < W + 80; x += 18) {
      ctx.moveTo(x, fenceTop);
      ctx.lineTo(x + 78, FLOOR_Y);
      ctx.moveTo(x + 78, fenceTop);
      ctx.lineTo(x, FLOOR_Y);
    }
    ctx.stroke();

    // 街头塑胶/木纹球场地面
    const floorGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    floorGrad.addColorStop(0, '#c2410c');
    floorGrad.addColorStop(0.25, '#9a3412');
    floorGrad.addColorStop(1, '#431407');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    drawCourtMarkings('rgba(254, 243, 199, 0.85)', 'rgba(255, 255, 255, 0.38)');
  }

  function drawCourtMarkings(boundary, lines) {
    // 极淡木地板横向拼接线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let fy = FLOOR_Y + 14; fy < H; fy += 16) {
      ctx.moveTo(0, fy);
      ctx.lineTo(W, fy);
    }
    ctx.stroke();

    // 左侧三秒区深色块（占地面中间纵深，顺应中心透视）
    const keyTopY = FLOOR_Y + 14;
    const keyBotY = H - 12;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.42)';
    ctx.beginPath();
    ctx.moveTo(0, keyTopY);
    ctx.lineTo(176, keyTopY);
    ctx.lineTo(154, keyBotY);
    ctx.lineTo(0, keyBotY);
    ctx.closePath();
    ctx.fill();

    // 场边主线 + 简洁透视标线（三秒区框线 + 右侧分界线）
    ctx.fillStyle = boundary;
    ctx.fillRect(0, FLOOR_Y, W, 3);

    ctx.strokeStyle = lines;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // 三秒区上、右、下框线
    ctx.moveTo(0, keyTopY);
    ctx.lineTo(176, keyTopY);
    ctx.lineTo(154, keyBotY);
    ctx.lineTo(0, keyBotY);
    // 右侧透视分界线（向中心消失点收敛）
    ctx.moveTo(430, FLOOR_Y);
    ctx.lineTo(470, H);
    ctx.stroke();
  }

  function drawNetLayer(ry, isFront) {
    const swing = Math.sin(state.netSwing * Math.PI * 3) * 9 * state.netSwing;
    const expand = Math.sin(state.netExpand * Math.PI) * 7;
    const cols = 6;
    const rimW = RIM_RIGHT_X - RIM_LEFT_X;
    const botY = ry + 48 + expand * 0.4;

    ctx.save();
    ctx.strokeStyle = isFront ? 'rgba(255, 255, 255, 0.92)' : 'rgba(203, 213, 225, 0.55)';
    ctx.lineWidth = isFront ? 1.9 : 1.4;
    ctx.lineCap = 'round';

    for (let i = 0; i < cols; i++) {
      const t1 = i / cols;
      const t2 = (i + 1) / cols;
      const x1 = RIM_LEFT_X + rimW * t1;
      const x2 = RIM_LEFT_X + rimW * t2;
      const bx1 = RIM_LEFT_X + 8 - expand * 0.5 + (rimW - 16 + expand) * t1 + swing;
      const bx2 = RIM_LEFT_X + 8 - expand * 0.5 + (rimW - 16 + expand) * t2 + swing;
      const midY = ry + 24;
      const cx1 = (x1 + bx2) * 0.5 + (t1 - 0.5) * expand * 0.6 + swing * 0.45;
      const cx2 = (x2 + bx1) * 0.5 + (t2 - 0.5) * expand * 0.6 + swing * 0.45;

      ctx.beginPath();
      if (isFront) {
        ctx.moveTo(x1, ry + 3);
        ctx.quadraticCurveTo(cx1, midY, bx2, botY);
      } else {
        ctx.moveTo(x2, ry + 1);
        ctx.quadraticCurveTo(cx2, midY, bx1, botY);
      }
      ctx.stroke();
    }

    if (isFront) {
      // 篮网横向收口绳圈
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.6)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(RIM_LEFT_X + 5 - expand * 0.3 + swing * 0.4, ry + 24);
      ctx.quadraticCurveTo(RIM_CENTER_X + swing * 0.5, ry + 28 + expand * 0.3, RIM_RIGHT_X - 5 + expand * 0.3 + swing * 0.4, ry + 24);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHoop(frontLayer) {
    const springOffset = Math.sin(state.rimSpring * Math.PI) * 2.5;
    const ry = state.rimY + springOffset;
    const boardTop = state.rimY - 82;
    const boardBottom = state.rimY + 26;
    const rimRx = (RIM_RIGHT_X - RIM_LEFT_X) / 2;
    const rimRy = 6.5;

    if (!frontLayer) {
      // 底部：地面投影 + 加厚配重底座 + 斜向支撑杆
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(30, FLOOR_Y + 4, 34, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 底座：使用较亮的填充与浅色描边，避免在夜场与深色楼群剪影融为一体
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(6, FLOOR_Y - 26, 48, 26, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillRect(12, FLOOR_Y - 22, 36, 4);

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(46, FLOOR_Y - 24);
      ctx.lineTo(32, FLOOR_Y - 70);
      ctx.stroke();

      // 中部：自适应液压立柱 + 立体防撞护垫
      const poleTop = Math.min(boardTop + 26, state.rimY - 48);
      ctx.fillStyle = '#334155';
      ctx.fillRect(24, poleTop, 12, FLOOR_Y - poleTop - 20);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(26, poleTop, 3, FLOOR_Y - poleTop - 20);

      // 橙色防撞柱套与高光
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.roundRect(19, FLOOR_Y - 128, 22, 102, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(22, FLOOR_Y - 122, 4, 90);

      // 上部：斜向鹅颈悬臂 + 三角支撑
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(30, poleTop + 10);
      ctx.lineTo(BOARD_X - 4, state.rimY - 44);
      ctx.moveTo(30, state.rimY - 10);
      ctx.lineTo(BOARD_X - 4, state.rimY - 16);
      ctx.stroke();

      // 玻璃篮板与金属包边
      ctx.fillStyle = state.boardFlash > 0
        ? 'rgba(255, 255, 255, 0.96)'
        : 'rgba(241, 245, 249, 0.86)';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(BOARD_X - 6, boardTop, 12, boardBottom - boardTop, 4);
      ctx.fill();
      ctx.stroke();

      // 玻璃高光与红色方框标记
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(BOARD_X - 3, boardTop + 10, 3, 42);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(BOARD_X + 2, state.rimY - 40, 4, 30);

      // 篮筐弹簧减震盒 + 连接杆 + 后半圈
      ctx.fillStyle = '#64748b';
      ctx.fillRect(BOARD_X + 6, state.rimY - 5, 7, 10);

      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(BOARD_X + 12, ry);
      ctx.lineTo(RIM_LEFT_X, ry);
      ctx.stroke();

      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.ellipse(RIM_CENTER_X, ry, rimRx, rimRy, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // 后半层篮网
      drawNetLayer(ry, false);
    } else {
      // 前半层篮网（遮住穿网而过的球）
      drawNetLayer(ry, true);

      // 立体橙色金属篮筐前半圈
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 6.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(RIM_CENTER_X, ry + 1, rimRx, rimRy, 0, 0, Math.PI);
      ctx.stroke();

      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(RIM_CENTER_X, ry - 0.5, rimRx, rimRy, 0, 0.08, Math.PI - 0.08);
      ctx.stroke();

      ctx.fillStyle = '#fdba74';
      ctx.beginPath();
      ctx.arc(RIM_LEFT_X, ry, 4.2, 0, Math.PI * 2);
      ctx.arc(RIM_RIGHT_X, ry, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBlocker() {
    const blockers = getBlockers(state, practice);
    if (blockers.length === 0) return;

    blockers.forEach((blk) => {
      const bx = blk.x;
      const by = blk.y;
      const h = blk.h;
      const top = by - h / 2;

      ctx.save();
      ctx.shadowColor = blk.flash > 0 ? '#fef08a' : 'rgba(239, 68, 68, 0.65)';
      ctx.shadowBlur = blk.flash > 0 ? 18 : 10;

      const grad = ctx.createLinearGradient(bx - 6, top, bx + 6, top + h);
      grad.addColorStop(0, blk.flash > 0 ? '#fef08a' : '#f87171');
      grad.addColorStop(0.5, blk.flash > 0 ? '#facc15' : '#dc2626');
      grad.addColorStop(1, '#991b1b');

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(bx - 6, top, 12, h, 6);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      for (let y = top + 10; y <= top + h - 10; y += 9) {
        ctx.beginPath();
        ctx.moveTo(bx - 4, y - 3);
        ctx.lineTo(bx + 4, y + 3);
        ctx.stroke();
      }

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(bx - 7, top - 2, 14, 6, 3);
      ctx.roundRect(bx - 7, top + h - 4, 14, 6, 3);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawBall() {
    const b = state.ball;
    const onFire = state.combo >= 2;

    // 火焰/金球/普通气流拖尾
    state.trail.forEach((t) => {
      ctx.save();
      const maxL = t.maxLife || 0.35;
      ctx.globalAlpha = Math.max(0, t.life * (t.alpha || 1.4));
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * (t.life / maxL), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 火焰连击外光晕
    if (onFire && !b.scored) {
      ctx.save();
      const aura = ctx.createRadialGradient(b.x, b.y, BALL_R * 0.6, b.x, b.y, BALL_R * 1.65);
      aura.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
      aura.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R * 1.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const heightRatio = Math.max(0.25, 1 - (FLOOR_Y - BALL_R - b.y) / 280);
    ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.38 * heightRatio).toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(b.x, FLOOR_Y + 6, BALL_R * heightRatio, 5 * heightRatio, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(b.x, b.y);
    const sx = 1 + b.squash;
    const sy = 1 - b.squash;
    ctx.scale(sx, sy);

    const skin = BALL_SKINS[skinIndex];
    const useFixedLighting = !b.isGold && (skin.id === 'planet' || skin.id === 'ice' || skin.id === 'water');

    // 1. 旋转纹理层
    ctx.save();
    ctx.rotate(b.rot);
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.clip();

    if (b.isGold || skin.id === 'classic' || skin.id === 'darkgold') {
      const grad = ctx.createRadialGradient(-BALL_R * 0.32, -BALL_R * 0.32, BALL_R * 0.12, 0, 0, BALL_R);
      if (b.isGold) {
        grad.addColorStop(0, '#fef9c3');
        grad.addColorStop(0.5, '#facc15');
        grad.addColorStop(1, '#a16207');
      } else {
        grad.addColorStop(0, skin.c0);
        grad.addColorStop(0.45, skin.c1);
        grad.addColorStop(1, skin.c2);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(-BALL_R, -BALL_R, BALL_R * 2, BALL_R * 2);

      ctx.strokeStyle = b.isGold ? '#713f12' : skin.seam;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(-BALL_R, 0);
      ctx.lineTo(BALL_R, 0);
      ctx.moveTo(0, -BALL_R);
      ctx.lineTo(0, BALL_R);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-BALL_R * 0.92, 0, BALL_R * 0.72, -0.75, 0.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(BALL_R * 0.92, 0, BALL_R * 0.72, Math.PI - 0.75, Math.PI + 0.75);
      ctx.stroke();
    } else if (skin.id === 'planet') {
      // 蔚蓝星球：深海底色 + 多块翠绿/沙金大陆 + 极地冰盖 + 流云带
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(-BALL_R, -BALL_R, BALL_R * 2, BALL_R * 2);

      // 浅海浅滩过渡
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.ellipse(-5, -2, 11, 8, 0.3, 0, Math.PI * 2);
      ctx.ellipse(8, 6, 9, 7, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // 陆地板块（深绿底 + 沙金高地）
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(-6, -4, 7.5, 4.8, 0.35, 0, Math.PI * 2);
      ctx.ellipse(7, 5, 6.8, 5.2, -0.45, 0, Math.PI * 2);
      ctx.ellipse(-7, 9, 4.5, 3, 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.ellipse(-6.5, -4.5, 4, 2.2, 0.35, 0, Math.PI * 2);
      ctx.ellipse(6.5, 4.5, 3.5, 2.4, -0.45, 0, Math.PI * 2);
      ctx.fill();

      // 南北极冰盖
      ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
      ctx.beginPath();
      ctx.ellipse(0, -BALL_R + 2, 10, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(0, BALL_R - 1.5, 8, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // 斜向白色云带
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-2, -6, 13, 0.2, 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3, 5, 11, 2.7, 3.8);
      ctx.stroke();
    } else if (skin.id === 'ice') {
      // 寒冰晶球：冷白亮底 + 几何冰晶切面 + 六角雪花核心
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(-BALL_R, -BALL_R, BALL_R * 2, BALL_R * 2);

      const facets = [
        { pts: [[-19, -19], [2, -19], [-4, -2], [-19, 3]], col: '#e0f2fe' },
        { pts: [[2, -19], [19, -19], [19, 2], [-4, -2]], col: '#7dd3fc' },
        { pts: [[-19, 3], [-4, -2], [3, 19], [-19, 19]], col: '#38bdf8' },
        { pts: [[-4, -2], [19, 2], [19, 19], [3, 19]], col: '#0284c7' },
      ];
      facets.forEach((f) => {
        ctx.fillStyle = f.col;
        ctx.beginPath();
        ctx.moveTo(f.pts[0][0], f.pts[0][1]);
        for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i][0], f.pts[i][1]);
        ctx.closePath();
        ctx.fill();
      });

      // 六角雪花晶核
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let a = 0; a < 3; a++) {
        const ang = (a * Math.PI) / 3;
        const dx = Math.cos(ang) * 11;
        const dy = Math.sin(ang) * 11;
        ctx.beginPath();
        ctx.moveTo(-dx, -dy);
        ctx.lineTo(dx, dy);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (skin.id === 'water') {
      // 深海气泡：晶莹通透水蓝底 + 双层波纹 + 错落气泡群
      const wGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, BALL_R);
      wGrad.addColorStop(0, '#cffafe');
      wGrad.addColorStop(0.65, '#22d3ee');
      wGrad.addColorStop(1, '#0e7490');
      ctx.fillStyle = wGrad;
      ctx.fillRect(-BALL_R, -BALL_R, BALL_R * 2, BALL_R * 2);

      // 内部深色水波层
      ctx.fillStyle = 'rgba(8, 145, 178, 0.42)';
      ctx.beginPath();
      ctx.moveTo(-BALL_R, 2);
      ctx.quadraticCurveTo(-7, -4, 0, 2);
      ctx.quadraticCurveTo(8, 8, BALL_R, 1);
      ctx.lineTo(BALL_R, BALL_R);
      ctx.lineTo(-BALL_R, BALL_R);
      ctx.closePath();
      ctx.fill();

      // 错落气泡
      const bubbles = [
        { x: -7, y: -6, r: 3.6 },
        { x: 6, y: -7, r: 2.3 },
        { x: 7, y: 4, r: 4.1 },
        { x: -4, y: 8, r: 2.7 },
        { x: 0, y: -1, r: 1.8 },
      ];
      bubbles.forEach((bb) => {
        ctx.fillStyle = 'rgba(236, 254, 255, 0.5)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(bb.x, bb.y, bb.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bb.x - bb.r * 0.32, bb.y - bb.r * 0.32, Math.max(0.8, bb.r * 0.28), 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();

    // 2. 固定球面立体光影层（不随旋转转动，塑造真实 3D 球体感）
    if (useFixedLighting) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
      ctx.clip();

      // 右下角球面暗部阴影
      const shadowGrad = ctx.createRadialGradient(-BALL_R * 0.38, -BALL_R * 0.38, BALL_R * 0.25, 0, 0, BALL_R * 1.05);
      shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
      shadowGrad.addColorStop(0.55, 'rgba(15, 23, 42, 0)');
      shadowGrad.addColorStop(1, 'rgba(2, 6, 23, 0.52)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(-BALL_R, -BALL_R, BALL_R * 2, BALL_R * 2);

      // 左上角玻璃/大气高光月牙
      ctx.fillStyle = skin.id === 'water' ? 'rgba(255, 255, 255, 0.58)' : 'rgba(255, 255, 255, 0.38)';
      ctx.beginPath();
      ctx.ellipse(-BALL_R * 0.42, -BALL_R * 0.42, 5.5, 2.8, -0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // 球体边缘柔和轮廓，确保在黄昏/夜场背景下同样醒目
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(sx, sy);
    ctx.strokeStyle = b.isGold
      ? 'rgba(254, 240, 138, 0.65)'
      : skin.id === 'planet'
        ? 'rgba(125, 211, 252, 0.65)'
        : skin.id === 'ice'
          ? 'rgba(224, 242, 254, 0.78)'
          : skin.id === 'water'
            ? 'rgba(165, 243, 252, 0.72)'
            : 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = useFixedLighting ? 1.6 : 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R - 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (b.isGold && !b.scored) {
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t('×2 金球'), b.x, b.y - BALL_R - 8);
    }
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    // 5 阶段场景：0-14 黄昏 -> 15-29 暮色 -> 30-59 夜场 -> 60-99 极光 -> 100+ 星河
    if (!practice && state.score >= 100) {
      drawStarryCourt();
    } else if (!practice && state.score >= 60) {
      drawAuroraCourt();
    } else if (!practice && state.score >= 30) {
      drawNightCourt();
    } else {
      drawSunsetCourt();
    }
    if (!isReducedMotion() && state.shake > 0.2) {
      const sx = (Math.random() - 0.5) * state.shake * 2;
      const sy = (Math.random() - 0.5) * state.shake * 2;
      ctx.translate(sx, sy);
    }

    drawHoop(false);
    drawBlocker();
    drawBall();
    drawHoop(true);

    state.rings.forEach((rg) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, rg.life);
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    state.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    if (!state.started && !state.ended) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 150, 118, 300, 48, 12);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t('连续点击升空 · 停手落网'), W / 2, 148);
    }

    if (state.paused) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t('已暂停（P / 点击继续）'), W / 2, H / 2);
    }

    state.popups.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    });

    // 画面右上角状态徽章：火焰连击 / 金球回合
    if (state.started && !state.ended) {
      let badgeText = '';
      let badgeColor = '#fb923c';
      let badgeIcon = '';
      if (state.ball && state.ball.isGold) {
        badgeText = t('金球回合 ×2');
        badgeColor = '#facc15';
        badgeIcon = 'star';
      } else if (state.combo >= 2) {
        badgeText = t('火焰连击 ×{combo}', { combo: state.combo });
        badgeColor = '#fb923c';
        badgeIcon = 'fire';
      }
      if (badgeText) {
        ctx.save();
        ctx.font = 'bold 13px sans-serif';
        const tw = ctx.measureText(badgeText).width + 22 + (badgeIcon ? 18 : 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
        ctx.beginPath();
        ctx.roundRect(W - tw - 14, 14, tw, 28, 999);
        ctx.fill();
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (badgeIcon && window.GameArt) {
          const iconX = W - tw - 14 + 15;
          if (badgeIcon === 'star') GameArt.drawStar(ctx, iconX, 28, 7);
          else GameArt.drawFire(ctx, iconX, 28, 7);
        }
        ctx.fillStyle = badgeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, W - tw / 2 - 12, 28.5);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  return {
    render() {
      state = getState();
      practice = getPractice();
      skinIndex = getSkinIndex();
      render();
    },
  };
}
