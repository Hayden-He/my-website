import { SHELL_RADIUS, TANK_RADIUS, collidesCircle, rules } from './engine.js';

const FRAME = 0.55;
const PALETTES = {
  light: {
    frame: '#465b73', frameLine: '#91a6bb', floor: '#e4edf4', floorEnd: '#d3e0ec',
    grid: '#b9cbd9', wall: '#647f99', wallTop: '#9cafc1', wallBottom: '#354e68',
    shadow: '#334d6836', shield: '#a05a10', repair: '#0b7258',
    teams: [
      { body: '#0d9278', edge: '#073c34', light: '#ceffed', shell: '#08705b', halo: '#147f70' },
      { body: '#cc573e', edge: '#682b2b', light: '#fff1cc', shell: '#a33120', halo: '#b8432c' },
    ],
  },
  dark: {
    frame: '#2b4054', frameLine: '#71879d', floor: '#1b2b3b', floorEnd: '#111f2e',
    grid: '#3b5467', wall: '#4c6982', wallTop: '#91a8bb', wallBottom: '#23374c',
    shadow: '#050d18a0', shield: '#ffc264', repair: '#72f5c4',
    teams: [
      { body: '#25b89b', edge: '#092e2e', light: '#d3fff2', shell: '#92ffdd', halo: '#3ed5b4' },
      { body: '#ee7954', edge: '#45211f', light: '#fff1cf', shell: '#ffd097', halo: '#ff965e' },
    ],
  },
};
const GARDEN_PALETTES = {
  light: {
    ...PALETTES.light,
    frame: '#6c604c', frameLine: '#b2a383', floor: '#cdd6ab', floorEnd: '#b7c297',
    grid: '#a1af87', wall: '#9b8868', wallTop: '#d3be93', wallBottom: '#5b513f',
    shadow: '#4d573735', paving: '#e5d6b1', paverSeam: '#b6a78a', hedge: '#7a8d5c',
    leaf: '#536f43', flower: '#efd891',
  },
  dark: {
    ...PALETTES.dark,
    frame: '#413e33', frameLine: '#918671', floor: '#323f35', floorEnd: '#23302b',
    grid: '#52634d', wall: '#77705a', wallTop: '#b4a282', wallBottom: '#413d32',
    shadow: '#10181091', paving: '#565747', paverSeam: '#6b6a56', hedge: '#4b6045',
    leaf: '#5b7551', flower: '#d9b961',
  },
};
const OUTPOST_PALETTES = {
  light: {
    ...PALETTES.light,
    frame: '#625b43', frameLine: '#ac9a6e', floor: '#d6cba2', floorEnd: '#b7ab85',
    grid: '#aaa27e', wall: '#696f60', wallTop: '#a7aa91', wallBottom: '#3b463b',
    shadow: '#382f234a', track: '#e6d9b3', grass: '#68714d', roof: '#899078',
  },
  dark: {
    ...PALETTES.dark,
    frame: '#433c2d', frameLine: '#99855c', floor: '#44412f', floorEnd: '#322d25',
    grid: '#655d43', wall: '#5f6959', wallTop: '#a1aa8a', wallBottom: '#303a30',
    shadow: '#14110b9c', track: '#5d533b', grass: '#7a7751', roof: '#778168',
  },
};

function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function paletteFor(map, theme) {
  if (map.theme === 'outpost') return OUTPOST_PALETTES[theme];
  return map.theme === 'garden' ? GARDEN_PALETTES[theme] : PALETTES[theme];
}

export function arenaRatio(map) {
  return (map.width + FRAME * 2) / (map.height + FRAME * 2);
}

function setBoardTransform(ctx, width, height, map) {
  const sx = width / (map.width + FRAME * 2);
  const sy = height / (map.height + FRAME * 2);
  ctx.setTransform(sx, 0, 0, sy, FRAME * sx, FRAME * sy);
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function rounded(ctx, x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawGardenFloor(ctx, map, palette) {
  const { width, height, repair } = map;
  ctx.strokeStyle = palette.paving;
  ctx.lineWidth = 1.27;
  ctx.strokeRect(1.23, 1.23, width - 2.46, height - 2.46);
  ctx.strokeStyle = palette.paverSeam;
  ctx.lineWidth = 0.036;
  ctx.beginPath();
  for (let x = 2.3; x < width - 1.6; x += 1.15) {
    ctx.moveTo(x, 0.6);
    ctx.lineTo(x, 1.86);
    ctx.moveTo(width - x, height - 0.6);
    ctx.lineTo(width - x, height - 1.86);
  }
  for (let y = 2.3; y < height - 1.6; y += 1.15) {
    ctx.moveTo(0.6, y);
    ctx.lineTo(1.86, y);
    ctx.moveTo(width - 0.6, height - y);
    ctx.lineTo(width - 1.86, height - y);
  }
  ctx.stroke();
  circle(ctx, repair.x, repair.y, 0.76, palette.paving);
  ctx.beginPath();
  ctx.arc(repair.x, repair.y, 0.57, 0, Math.PI * 2);
  ctx.stroke();

  for (const y of [0.29, height - 0.29]) {
    for (let x = 2.8; x < width - 2.4; x += 3.4) {
      rounded(ctx, x - 0.61, y - 0.19, 1.22, 0.38, 0.15, palette.hedge);
      circle(ctx, x - 0.38, y, 0.15, palette.leaf);
      circle(ctx, x + 0.34, y + 0.014, 0.15, palette.leaf);
      circle(ctx, x - 0.15, y + 0.044, 0.05, palette.flower);
      circle(ctx, x + 0.14, y - 0.04, 0.065, palette.flower);
    }
  }
}

function drawOutpostFloor(ctx, map, palette) {
  for (const y of [1.8, map.height - 1.8]) {
    rounded(ctx, 0.60, y - 0.58, map.width - 1.20, 1.16, 0.42, palette.track);
    ctx.beginPath();
    ctx.strokeStyle = palette.grass;
    ctx.globalAlpha = 0.56;
    ctx.lineWidth = 0.045;
    for (let x = 1.35; x < map.width - 1.3; x += 1.88) {
      ctx.moveTo(x, y - 0.8);
      ctx.lineTo(x + 0.14, y - 0.96);
      ctx.moveTo(x + 0.28, y + 0.77);
      ctx.lineTo(x + 0.43, y + 0.87);
      ctx.moveTo(x + 0.38, y + 0.77);
      ctx.lineTo(x + 0.39, y + 0.96);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawMaze(ctx, map, palette) {
  const { width, height } = map;
  ctx.fillStyle = palette.frame;
  ctx.fillRect(-FRAME, -FRAME, width + FRAME * 2, height + FRAME * 2);
  const floor = ctx.createLinearGradient(0, 0, width * 0.45, height);
  floor.addColorStop(0, palette.floor);
  floor.addColorStop(1, palette.floorEnd);
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, width, height);

  if (map.theme === 'garden') drawGardenFloor(ctx, map, palette);
  if (map.theme === 'outpost') drawOutpostFloor(ctx, map, palette);
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 0.021;
  ctx.globalAlpha = map.theme ? 0.20 : 0.52;
  ctx.beginPath();
  for (let x = 1; x < width; x++) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 1; y < height; y++) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Draw the frame entirely outside the collision bounds. Its inner edge is
  // the same boundary that moveShell and collidesCircle use.
  ctx.strokeStyle = palette.frameLine;
  ctx.lineWidth = 0.07;
  ctx.strokeRect(-0.04, -0.04, width + 0.08, height + 0.08);
  ctx.lineWidth = 0.025;
  ctx.strokeRect(-0.39, -0.39, width + 0.78, height + 0.78);
  for (const x of [-0.27, width + 0.27]) {
    for (const y of [-0.27, height + 0.27]) circle(ctx, x, y, 0.09, palette.frameLine);
  }

  for (const { x, y, w, h } of map.walls) {
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(x + 0.095, y + 0.12, w, h);
  }
  for (const { x, y, w, h } of map.walls) {
    ctx.fillStyle = palette.wallBottom;
    ctx.fillRect(x, y, w, h);
  }
  for (const { x, y, w, h } of map.walls) {
    ctx.fillStyle = palette.wall;
    ctx.fillRect(x + 0.045, y + 0.045, w - 0.09, h - 0.11);
    ctx.fillStyle = palette.wallTop;
    ctx.fillRect(x + 0.065, y + 0.06, w - 0.13, 0.06);
    ctx.fillRect(x + 0.065, y + 0.06, 0.055, h - 0.17);
    // Panel joints run along the long axis and stay inside the wall face.
    ctx.fillStyle = palette.wallBottom;
    if (w > h) {
      for (let offset = 1.05; offset < w - 0.16; offset += 1.05) {
        ctx.fillRect(x + offset, y + 0.12, 0.03, h - 0.23);
      }
    } else {
      for (let offset = 1.05; offset < h - 0.16; offset += 1.05) {
        ctx.fillRect(x + 0.12, y + offset, w - 0.23, 0.03);
      }
    }
    if (map.theme === 'outpost' && h > 1.25) {
      rounded(ctx, x + 0.27, y + 0.24, w - 0.54, h - 0.48, 0.12, palette.roof);
      ctx.strokeStyle = palette.wallBottom;
      ctx.lineWidth = 0.042;
      ctx.strokeRect(x + 0.42, y + 0.38, w - 0.84, h - 0.76);
      for (const offset of [0.58, w - 0.58]) {
        circle(ctx, x + offset, y + h / 2, 0.076, palette.wallBottom);
      }
    }
  }
}

export function drawMapPreview(canvas, map) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.height = Math.round(canvas.width / arenaRatio(map));
  setBoardTransform(ctx, canvas.width, canvas.height, map);
  drawMaze(ctx, map, paletteFor(map, getTheme()));
}

function drawShield(ctx, tank, color, cssScale, reducedMotion) {
  const fraction = tank.protection / rules.HIT_PROTECTION;
  const radius = Math.max(0.69, 8.5 / cssScale) + (reducedMotion ? 0.19 : 0.26 * fraction);
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.083, 1.45 / cssScale);
  ctx.beginPath();
  for (let side = 0; side < 6; side++) {
    const angle = Math.PI * side / 3;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (side === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.24;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.restore();
}

function drawTrack(ctx, skin, y, team) {
  if (skin === 'wedge') {
    ctx.beginPath();
    ctx.moveTo(-1.08, y);
    ctx.lineTo(0.72, y);
    ctx.lineTo(1.08, y + 0.16);
    ctx.lineTo(1.08, y + 0.40);
    ctx.lineTo(0.76, y + 0.57);
    ctx.lineTo(-1.08, y + 0.57);
    ctx.closePath();
    ctx.fillStyle = team.edge;
    ctx.fill();
    ctx.fillStyle = team.body;
    ctx.fillRect(-0.86, y + 0.12, 1.48, 0.12);
    ctx.fillRect(0.73, y + 0.22, 0.18, 0.12);
    return;
  }
  const cabin = skin === 'cabin';
  rounded(ctx, -1.06, y, 2.13, cabin ? 0.64 : 0.57, cabin ? 0.09 : 0.15, team.edge);
  ctx.fillStyle = team.body;
  for (const x of cabin ? [-0.84, -0.44, -0.04, 0.36, 0.76] : [-0.8, -0.42, -0.04, 0.34, 0.72]) {
    ctx.fillRect(x, y + 0.12, 0.13, cabin ? 0.30 : 0.24);
  }
}

function drawWedgeBody(ctx, team) {
  ctx.beginPath();
  ctx.moveTo(-0.94, -0.65);
  ctx.lineTo(0.34, -0.65);
  ctx.lineTo(1.02, -0.28);
  ctx.lineTo(1.02, 0.28);
  ctx.lineTo(0.34, 0.65);
  ctx.lineTo(-0.94, 0.65);
  ctx.closePath();
  ctx.fillStyle = team.edge;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.82, -0.53);
  ctx.lineTo(0.29, -0.53);
  ctx.lineTo(0.87, -0.22);
  ctx.lineTo(0.87, 0.22);
  ctx.lineTo(0.29, 0.53);
  ctx.lineTo(-0.82, 0.53);
  ctx.closePath();
  ctx.fillStyle = team.body;
  ctx.fill();
  // The bright chevron makes the pointed nose readable at game scale.
  ctx.strokeStyle = team.light;
  ctx.lineWidth = 0.13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.45, -0.35);
  ctx.lineTo(0.82, 0);
  ctx.lineTo(0.45, 0.35);
  ctx.stroke();
}

function drawCabinBody(ctx, team) {
  rounded(ctx, -0.91, -0.68, 1.92, 1.36, 0.10, team.edge);
  rounded(ctx, -0.82, -0.59, 1.74, 1.18, 0.07, team.body);
  // A taller square cabin and roof stripe distinguish this heavy silhouette.
  rounded(ctx, -0.64, -0.52, 1.02, 1.04, 0.08, team.edge);
  rounded(ctx, -0.53, -0.41, 0.80, 0.82, 0.05, team.body);
  ctx.fillStyle = team.light;
  ctx.fillRect(-0.43, -0.33, 0.60, 0.11);
  ctx.fillRect(-0.43, 0.22, 0.60, 0.11);
  ctx.fillStyle = team.edge;
  ctx.fillRect(-0.06, -0.39, 0.12, 0.78);
}

function drawSkinMarker(ctx, skin, radius, color, lineWidth) {
  ctx.beginPath();
  if (skin === 'wedge') {
    ctx.moveTo(radius, 0);
    ctx.lineTo(-radius * 0.73, -radius * 0.76);
    ctx.lineTo(-radius * 0.73, radius * 0.76);
    ctx.closePath();
  } else if (skin === 'cabin') {
    ctx.rect(-radius * 0.74, -radius * 0.74, radius * 1.48, radius * 1.48);
  } else {
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawTank(ctx, tank, team, palette, cssScale, reducedMotion, skin) {
  ctx.save();
  ctx.translate(tank.x, tank.y);
  if (!tank.active) ctx.globalAlpha = 0.33;
  const shielded = tank.protection > 0;
  if (shielded) {
    drawShield(ctx, tank, palette.shield, cssScale, reducedMotion);
  } else if (cssScale < 28) {
    // Keep the selected silhouette readable when the tank itself is only a
    // few pixels wide. The marker is cosmetic and distinct from the shield.
    const radius = Math.max(0.51, 7 / cssScale);
    ctx.save();
    ctx.rotate(tank.angle);
    drawSkinMarker(ctx, skin, radius, team.halo, Math.max(0.037, 0.85 / cssScale));
    ctx.restore();
  }
  ctx.rotate(tank.angle);
  ctx.scale(TANK_RADIUS, TANK_RADIUS);

  drawTrack(ctx, skin, -0.95, team);
  drawTrack(ctx, skin, 0.38, team);
  if (skin === 'wedge') {
    drawWedgeBody(ctx, team);
  } else if (skin === 'cabin') {
    drawCabinBody(ctx, team);
  } else {
    rounded(ctx, -0.91, -0.68, 1.92, 1.36, 0.24, team.edge);
    rounded(ctx, -0.82, -0.60, 1.76, 1.20, 0.21, team.body);
  }
  ctx.fillStyle = team.light;
  const lightY = skin === 'wedge' ? 0.30 : 0.45;
  ctx.fillRect(0.66, -lightY - 0.08, 0.21, 0.16);
  ctx.fillRect(0.66, lightY - 0.08, 0.21, 0.16);
  ctx.fillStyle = team.edge;
  ctx.fillRect(-0.78, -0.38, 0.22, 0.76);
  if (skin === 'cabin') {
    rounded(ctx, -0.09, -0.22, 1.70, 0.44, 0.08, team.edge);
    rounded(ctx, 0.22, -0.11, 1.39, 0.22, 0.04, team.light);
    ctx.fillStyle = team.light;
    ctx.fillRect(0.64, -0.08, 0.23, 0.16);
  } else if (skin === 'wedge') {
    ctx.beginPath();
    ctx.moveTo(-0.48, -0.36);
    ctx.lineTo(0.22, -0.36);
    ctx.lineTo(0.45, -0.22);
    ctx.lineTo(0.45, 0.22);
    ctx.lineTo(0.22, 0.36);
    ctx.lineTo(-0.48, 0.36);
    ctx.closePath();
    ctx.fillStyle = team.edge;
    ctx.fill();
    ctx.fillStyle = team.body;
    ctx.fillRect(-0.36, -0.24, 0.62, 0.48);
    rounded(ctx, 0.12, -0.18, 1.51, 0.36, 0.08, team.edge);
    rounded(ctx, 0.35, -0.10, 1.27, 0.20, 0.04, team.light);
    ctx.fillStyle = team.light;
    ctx.fillRect(0.68, -0.08, 0.20, 0.16);
  } else {
    circle(ctx, -0.10, 0, 0.48, team.edge);
    circle(ctx, -0.10, 0, 0.35, team.body);
    circle(ctx, -0.10, 0, 0.11, team.light);
    rounded(ctx, 0.21, -0.20, 1.37, 0.40, 0.10, team.edge);
    rounded(ctx, 0.23, -0.10, 1.37, 0.20, 0.05, team.light);
  }
  ctx.restore();
}

export function drawTankPreview(canvas, skin) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const palette = PALETTES[getTheme()];
  const { width, height } = canvas;
  const team = palette.teams[0];
  ctx.save();
  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, 0, width, height);
  circle(ctx, width / 2, height / 2, height * 0.42, palette.floorEnd);
  ctx.save();
  ctx.translate(height * 0.26, height * 0.26);
  drawSkinMarker(ctx, skin, height * 0.13, team.halo, height * 0.035);
  ctx.restore();
  const scale = height * 0.98;
  ctx.setTransform(scale, 0, 0, scale, width / 2 - height * 0.06, height / 2);
  drawTank(ctx, { x: 0, y: 0, angle: -0.21, active: true }, team, palette, scale, true, skin);
  ctx.restore();
}

function drawShell(ctx, map, shell, team, cssScale) {
  const speed = Math.hypot(shell.vx, shell.vy);
  if (!speed) return;
  const dx = shell.vx / speed;
  const dy = shell.vy / speed;
  const radius = Math.max(SHELL_RADIUS * 1.15, 1.6 / cssScale);
  const tail = Math.max(0.34, 4.5 / cssScale);
  let clearTail = 0;
  for (let back = 0.08; back <= tail; back += 0.08) {
    if (collidesCircle(map, shell.x - dx * back, shell.y - dy * back)) break;
    clearTail = back;
  }
  ctx.globalAlpha = Math.min(1, shell.life * 5);
  if (clearTail) {
    const x = shell.x - dx * clearTail;
    const y = shell.y - dy * clearTail;
    const fade = ctx.createLinearGradient(x, y, shell.x, shell.y);
    fade.addColorStop(0, 'transparent');
    fade.addColorStop(1, team.halo);
    ctx.lineWidth = radius * 1.35;
    ctx.lineCap = 'round';
    ctx.strokeStyle = fade;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(shell.x, shell.y);
    ctx.stroke();
  }
  circle(ctx, shell.x, shell.y, radius, team.shell);
  circle(ctx, shell.x + dx * radius * 0.27, shell.y + dy * radius * 0.27, radius * 0.56, team.light);
  ctx.globalAlpha = 1;
}

function drawRepair(ctx, repair, palette, cssScale) {
  const { x, y } = repair;
  const radius = Math.max(rules.REPAIR_RADIUS, 6.5 / cssScale);
  const accent = palette.repair;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.29, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(0.031, 0.85 / cssScale);
  ctx.strokeStyle = accent;
  ctx.stroke();
  rounded(ctx, x - radius, y - radius, radius * 2, radius * 2, radius * 0.32, palette.frame);
  ctx.fillStyle = accent;
  ctx.fillRect(x - radius * 0.61, y - radius * 0.17, radius * 1.22, radius * 0.34);
  ctx.fillRect(x - radius * 0.17, y - radius * 0.61, radius * 0.34, radius * 1.22);
}

function drawEffect(ctx, effect, color) {
  const progress = effect.age / effect.duration;
  ctx.globalAlpha = (1 - progress) * 0.84;
  ctx.strokeStyle = color;
  ctx.lineWidth = effect.type === 'hit' ? 0.072 : 0.044;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, 0.07 + progress * effect.radius, 0, 2 * Math.PI);
  ctx.stroke();
  if (effect.type === 'bounce') {
    ctx.beginPath();
    for (let index = 0; index < 4; index++) {
      const angle = index * Math.PI / 2 + Math.PI / 4;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      const spread = 0.075 + progress * 0.28;
      ctx.moveTo(effect.x + x * spread, effect.y + y * spread);
      ctx.lineTo(effect.x + x * (spread + 0.09), effect.y + y * (spread + 0.09));
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const backdrop = document.createElement('canvas');
  const background = backdrop.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let cachedMap;
  let cachedTheme;
  let effects = [];

  function draw(match, elapsed = 0, playerSkin = 'standard') {
    const { map } = match;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const theme = getTheme();
    const palette = paletteFor(map, theme);
    if (cachedMap !== map || cachedTheme !== theme || backdrop.width !== width || backdrop.height !== height) {
      backdrop.width = width;
      backdrop.height = height;
      setBoardTransform(background, width, height, map);
      drawMaze(background, map, palette);
      cachedMap = map;
      cachedTheme = theme;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(backdrop, 0, 0);
    setBoardTransform(ctx, width, height, map);
    const cssScale = rect.width / (map.width + FRAME * 2);
    if (match.repair?.takenBy === null && !match.result) drawRepair(ctx, match.repair, palette, cssScale);
    for (const tank of match.tanks) {
      drawTank(ctx, tank, palette.teams[tank.id], palette, cssScale, reducedMotion.matches,
        tank.id === 0 ? playerSkin : 'standard');
    }
    for (const shell of match.shells) drawShell(ctx, map, shell, palette.teams[shell.owner], cssScale);

    if (reducedMotion.matches) {
      effects = [];
    } else {
      effects = effects.filter((effect) => {
        effect.age += elapsed;
        if (effect.age >= effect.duration) return false;
        const color = effect.type === 'repair' ? palette.repair : palette.teams[effect.owner].halo;
        drawEffect(ctx, effect, color);
        return true;
      });
    }
  }

  return {
    draw,
    clear: () => { effects = []; },
    hasEffects: () => effects.length > 0,
    addEvents(events) {
      if (reducedMotion.matches) return;
      for (const event of events) {
        switch (event.type) {
          case 'shot': effects.push({ ...event, age: 0, duration: rules.SHOT_COOLDOWN / 4, radius: 0.24 }); break;
          case 'bounce': effects.push({ ...event, age: 0, duration: 0.18, radius: 0.28 }); break;
          case 'hit': effects.push({ ...event, age: 0, duration: 0.38, radius: 1.05 }); break;
          case 'repair': effects.push({ ...event, age: 0, duration: 0.48, radius: 1.1 }); break;
        }
      }
    },
  };
}
