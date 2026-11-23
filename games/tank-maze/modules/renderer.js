import { SHELL_RADIUS, TANK_RADIUS, rules } from './engine.js';

const PALETTES = {
  light: {
    edge: '#c1ccd8', floor: '#eef3f7', grid: '#cbd7e2', wall: '#667a91',
    wallTop: '#93a7bb', wallBottom: '#465b72', shadow: '#3b52622f', rim: '#f4f8fa',
    teams: [
      { body: '#087866', edge: '#064637', light: '#8fffe0', shell: '#046653', halo: '#21aa92' },
      { body: '#b34335', edge: '#722a24', light: '#ffe2bf', shell: '#aa3426', halo: '#e57c55' },
    ],
  },
  dark: {
    edge: '#111c2c', floor: '#1b293a', grid: '#304155', wall: '#53677f',
    wallTop: '#8598ae', wallBottom: '#2f3e51', shadow: '#02081383', rim: '#27394d',
    teams: [
      { body: '#13a68b', edge: '#073d37', light: '#b7ffed', shell: '#8dffe2', halo: '#31d5ac' },
      { body: '#e27055', edge: '#5d2724', light: '#ffe1b3', shell: '#ffc28e', halo: '#ff9a64' },
    ],
  },
};

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

function drawMaze(ctx, map, palette) {
  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, 0, map.width, map.height);
  for (let x = 0.5; x < map.width; x += 1) {
    for (let y = 0.5; y < map.height; y += 1) {
      circle(ctx, x, y, 0.025, palette.grid);
    }
  }

  ctx.lineWidth = 0.13;
  ctx.strokeStyle = palette.edge;
  ctx.strokeRect(0.065, 0.065, map.width - 0.13, map.height - 0.13);
  ctx.lineWidth = 0.045;
  ctx.strokeStyle = palette.rim;
  ctx.strokeRect(0.16, 0.16, map.width - 0.32, map.height - 0.32);

  for (const { x, y, w, h } of map.walls) {
    rounded(ctx, x + 0.055, y + 0.1, w, h, 0.07, palette.shadow);
  }
  for (const { x, y, w, h } of map.walls) {
    rounded(ctx, x, y, w, h, 0.065, palette.wallBottom);
    rounded(ctx, x + 0.035, y + 0.035, w - 0.07, h - 0.12, 0.04, palette.wall);
    ctx.fillStyle = palette.wallTop;
    ctx.fillRect(x + 0.09, y + 0.09, w - 0.18, 0.045);
    ctx.fillRect(x + 0.09, y + 0.09, 0.045, h - 0.23);
    circle(ctx, x + w - 0.18, y + 0.18, 0.035, palette.wallBottom);
    circle(ctx, x + 0.18, y + h - 0.22, 0.035, palette.wallBottom);
  }
}

function drawTank(ctx, tank, team, eliminated) {
  ctx.save();
  ctx.translate(tank.x, tank.y);
  if (eliminated) ctx.globalAlpha = 0.33;
  ctx.rotate(tank.angle);
  ctx.scale(TANK_RADIUS, TANK_RADIUS);
  rounded(ctx, -1.01, -0.93, 2.14, 0.56, 0.16, team.edge);
  rounded(ctx, -1.01, 0.37, 2.14, 0.56, 0.16, team.edge);
  for (const x of [-0.72, -0.28, 0.16, 0.60]) {
    ctx.fillStyle = team.body;
    ctx.fillRect(x, -0.82, 0.10, 0.28);
    ctx.fillRect(x, 0.54, 0.10, 0.28);
  }
  rounded(ctx, -0.87, -0.64, 1.81, 1.28, 0.23, team.body);
  circle(ctx, 0, 0, 0.45, team.edge);
  rounded(ctx, -0.1, -0.19, 1.58, 0.38, 0.1, team.edge);
  rounded(ctx, 0.22, -0.105, 1.33, 0.21, 0.055, team.light);
  circle(ctx, -0.10, 0, 0.21, team.light);
  if (tank.id === 1) {
    ctx.fillStyle = team.edge;
    ctx.fillRect(-0.18, -0.09, 0.16, 0.18);
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let effects = [];

  function draw(match, elapsed = 0) {
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
    const palette = PALETTES[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];
    ctx.setTransform(width / map.width, 0, 0, height / map.height, 0, 0);
    drawMaze(ctx, map, palette);

    for (const tank of match.tanks) {
      drawTank(ctx, tank, palette.teams[tank.id], match.result?.hits.includes(tank.id));
    }
    for (const shell of match.shells) {
      const team = palette.teams[shell.owner];
      ctx.globalAlpha = Math.min(0.78, shell.life * 4);
      ctx.strokeStyle = team.halo;
      ctx.lineWidth = SHELL_RADIUS * 1.25;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(shell.x - shell.vx * 0.028, shell.y - shell.vy * 0.028);
      ctx.lineTo(shell.x, shell.y);
      ctx.stroke();
      ctx.globalAlpha = Math.min(1, shell.life * 5);
      circle(ctx, shell.x, shell.y, SHELL_RADIUS * 1.12, team.shell);
      ctx.globalAlpha = 1;
    }

    if (reducedMotion.matches) {
      effects = [];
    } else {
      effects = effects.filter((effect) => {
        effect.age += elapsed;
        if (effect.age >= effect.duration) return false;
        const progress = effect.age / effect.duration;
        const team = palette.teams[effect.owner];
        ctx.globalAlpha = (1 - progress) * 0.84;
        ctx.strokeStyle = team.halo;
        ctx.lineWidth = effect.type === 'hit' ? 0.072 : 0.038;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 0.07 + progress * effect.radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
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
          case 'shot': effects.push({ ...event, age: 0, duration: rules.SHOT_COOLDOWN / 4, radius: 0.22 }); break;
          case 'bounce': effects.push({ ...event, age: 0, duration: 0.16, radius: 0.20 }); break;
          case 'hit': effects.push({ ...event, age: 0, duration: 0.43, radius: 1.05 }); break;
        }
      }
    },
  };
}
