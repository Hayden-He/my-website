export const W = 460;
export const H = 560;
export const WALL_SIDE = 8;
export const WALL_TOP = 10;
export const PADDLE_Y = 516;
export const PADDLE_HEIGHT = 14;
export const PADDLE_BASE_WIDTH = 86;
export const PADDLE_WIDE_WIDTH = 124;
export const PADDLE_SPEED = 450;
export const BALL_RADIUS = 7;
export const BASE_BALL_SPEED = 325;
export const MAX_BALL_SPEED = 510;
export const MAX_BALLS = 6;
export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const BRICK_COLS = 10;
export const BRICK_MARGIN_X = 22;
export const BRICK_GAP = 4;
export const BRICK_WIDTH = 38;
export const BRICK_HEIGHT = 18;
export const BRICK_TOP = 54;
export const BRICK_ROW_STEP = BRICK_HEIGHT + BRICK_GAP;
export const ENDLESS_DANGER_Y = 472;
export const ENDLESS_PUSH_INTERVAL = 10.5;
export const MAX_PARTICLES = 180;

export const EFFECT_DURATIONS = {
  expand: 11,
  fire: 8,
  laser: 8,
  magnet: 10,
};

export const SKINS = {
  neon: {
    id: 'neon',
    name: '霓虹电光',
    bgTop: '#060a1f',
    bgBottom: '#111936',
    bgSpot: 'rgba(56, 189, 248, 0.16)',
    grid: 'rgba(56, 189, 248, 0.07)',
    rail: '#1e293b',
    railGlow: '#38bdf8',
    paddleMain: '#0ea5e9',
    paddleDark: '#0369a1',
    paddleGlow: '#67e8f9',
    paddleCap: '#94a3b8',
    paddleAccent: '#e0f2fe',
    ballCore: '#ffffff',
    ballRim: '#38bdf8',
    fireCore: '#fef08a',
    fireRim: '#f97316',
    normalPalette: ['#f43f5e', '#fb923c', '#facc15', '#34d399', '#38bdf8'],
  },
  retro: {
    id: 'retro',
    name: '复古街机',
    bgTop: '#12121a',
    bgBottom: '#1b1b26',
    bgSpot: 'rgba(249, 115, 22, 0.15)',
    grid: 'rgba(255, 255, 255, 0.04)',
    rail: '#272738',
    railGlow: '#fb923c',
    paddleMain: '#f97316',
    paddleDark: '#c2410c',
    paddleGlow: '#fdba74',
    paddleCap: '#a1a1aa',
    paddleAccent: '#fff7ed',
    ballCore: '#fef9c3',
    ballRim: '#f59e0b',
    fireCore: '#fff',
    fireRim: '#ef4444',
    normalPalette: ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6'],
  },
  ocean: {
    id: 'ocean',
    name: '深海极光',
    bgTop: '#041c24',
    bgBottom: '#0a2f3c',
    bgSpot: 'rgba(45, 212, 191, 0.16)',
    grid: 'rgba(45, 212, 191, 0.07)',
    rail: '#133a47',
    railGlow: '#2dd4bf',
    paddleMain: '#14b8a6',
    paddleDark: '#0f766e',
    paddleGlow: '#5eead4',
    paddleCap: '#99f6e4',
    paddleAccent: '#f0fdfa',
    ballCore: '#f0fdfa',
    ballRim: '#2dd4bf',
    fireCore: '#fde68a',
    fireRim: '#fb7185',
    normalPalette: ['#fb7185', '#f472b6', '#a78bfa', '#2dd4bf', '#38bdf8'],
  },
};

export const POWERUP_META = {
  expand: { kind: 'expand', label: '宽板', badge: 'W', color: '#2563eb', text: '#dbeafe', weight: 22 },
  multi: { kind: 'multi', label: '三球分裂', badge: '×3', color: '#7c3aed', text: '#ede9fe', weight: 22 },
  fire: { kind: 'fire', label: '烈焰穿透', badge: '🔥', color: '#ea580c', text: '#ffedd5', weight: 16 },
  laser: { kind: 'laser', label: '双联激光', badge: '⚡', color: '#0891b2', text: '#cffafe', weight: 16 },
  magnet: { kind: 'magnet', label: '磁性吸板', badge: '🧲', color: '#0d9488', text: '#ccfbf1', weight: 15 },
  life: { kind: 'life', label: '生命 +1', badge: '+♥', color: '#16a34a', text: '#dcfce7', weight: 9 },
};

export const LEVELS = [
  {
    name: '彩虹阶梯',
    rows: [
      '1111111111',
      '2222222222',
      '3333BB3333',
      '4444444444',
      '5555555555',
    ],
  },
  {
    name: '城墙要塞',
    rows: [
      '2222222222',
      '33B4444B33',
      '444HHHH444',
      '55SSSSSS55',
      '..11..11..',
    ],
  },
  {
    name: '双塔走廊',
    rows: [
      '111....111',
      '2S2.33.2S2',
      '3B3.44.3B3',
      '4H4.55.4H4',
      '555.SS.555',
      '111....111',
    ],
  },
  {
    name: '钻石矩阵',
    rows: [
      '....11....',
      '...2222...',
      '..33BB33..',
      '.44HHHH44.',
      '..55SS55..',
      '...1111...',
      '....22....',
    ],
  },
  {
    name: '迷宫通道',
    rows: [
      '1111111111',
      '22.3333.22',
      '3G.4BB4.G3',
      '44.5HH5.44',
      '5S.1111.S5',
      '..SSSSSS..',
    ],
  },
  {
    name: '十字堡垒',
    rows: [
      '11.2HH2.11',
      '22.3BB3.22',
      'SSSS44SSSS',
      '33.5BB5.33',
      '44.1SS1.44',
      '55......55',
    ],
  },
  {
    name: '蜂巢核心',
    rows: [
      'H.1.H.1.H.',
      '.2.B.2.B.2',
      '3.S.4.S.3.',
      '.4.H.B.H.4',
      '5.5.S.S.5.',
      '.1.2.3.2.1',
    ],
  },
  {
    name: '霓虹终局',
    rows: [
      'HHHHHHHHHH',
      '1B2S33S2B1',
      '2G3H44H3G2',
      '334B55B433',
      '4S551155S4',
      '.G.SSSS.G.',
    ],
  },
];

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function createBrick(col, row, code) {
  const x = BRICK_MARGIN_X + col * (BRICK_WIDTH + BRICK_GAP);
  const y = BRICK_TOP + row * BRICK_ROW_STEP;
  if (code === 'S') {
    return { col, row, x, y, w: BRICK_WIDTH, h: BRICK_HEIGHT, type: 'steel', hp: 2, maxHp: 2, points: 45, colorIdx: 0 };
  }
  if (code === 'H') {
    return { col, row, x, y, w: BRICK_WIDTH, h: BRICK_HEIGHT, type: 'heavy', hp: 3, maxHp: 3, points: 75, colorIdx: 0 };
  }
  if (code === 'B') {
    return { col, row, x, y, w: BRICK_WIDTH, h: BRICK_HEIGHT, type: 'bomb', hp: 1, maxHp: 1, points: 60, colorIdx: 0 };
  }
  if (code === 'G') {
    return { col, row, x, y, w: BRICK_WIDTH, h: BRICK_HEIGHT, type: 'gold', hp: 99, maxHp: 99, points: 50, colorIdx: 0 };
  }
  const idx = clamp((Number(code) || 1) - 1, 0, 4);
  const points = (5 - idx) * 5 + 5;
  return { col, row, x, y, w: BRICK_WIDTH, h: BRICK_HEIGHT, type: 'normal', hp: 1, maxHp: 1, points, colorIdx: idx };
}

export function buildClassicLevel(levelNum) {
  const safeLevel = Math.max(1, levelNum);
  const template = LEVELS[(safeLevel - 1) % LEVELS.length];
  const bricks = [];
  template.rows.forEach((line, row) => {
    for (let col = 0; col < BRICK_COLS && col < line.length; col += 1) {
      const ch = line[col];
      if (ch === '.' || ch === ' ') continue;
      bricks.push(createBrick(col, row, ch));
    }
  });
  const loop = Math.floor((safeLevel - 1) / LEVELS.length);
  const ballSpeed = Math.min(MAX_BALL_SPEED, BASE_BALL_SPEED + (safeLevel - 1) * 14 + loop * 18);
  return {
    name: template.name,
    bricks,
    ballSpeed,
  };
}

function makeEndlessRow(row, wave, random = Math.random) {
  const rowBricks = [];
  const gapCol = random() < 0.55 ? Math.floor(random() * BRICK_COLS) : -1;
  for (let col = 0; col < BRICK_COLS; col += 1) {
    if (col === gapCol) continue;
    const roll = random();
    let code = String(1 + ((row + wave) % 5));
    if (roll < Math.min(0.11, 0.04 + wave * 0.008)) code = 'B';
    else if (roll < Math.min(0.28, 0.08 + wave * 0.02)) code = 'H';
    else if (roll < Math.min(0.5, 0.18 + wave * 0.03)) code = 'S';
    rowBricks.push(createBrick(col, row, code));
  }
  return rowBricks;
}

export function buildEndlessInitialBricks(random = Math.random) {
  const bricks = [];
  for (let row = 0; row < 4; row += 1) {
    bricks.push(...makeEndlessRow(row, 1, random));
  }
  return bricks;
}

export function pushEndlessRow(bricks, wave, random = Math.random) {
  const shifted = bricks
    .filter((b) => b.hp > 0)
    .map((b) => ({
      ...b,
      row: b.row + 1,
      y: b.y + BRICK_ROW_STEP,
    }));
  const fresh = makeEndlessRow(0, wave, random);
  const nextBricks = [...fresh, ...shifted];
  const dangerReached = nextBricks.some((b) => b.y + b.h >= ENDLESS_DANGER_Y);
  return { bricks: nextBricks, dangerReached };
}

export function countClearableBricks(bricks) {
  return bricks.reduce((count, b) => (b.hp > 0 && b.type !== 'gold' ? count + 1 : count), 0);
}

export function enforceVerticalComponent(ball, minRatio = 0.24) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed <= 0.001) return ball;
  const minVy = speed * minRatio;
  if (Math.abs(ball.vy) < minVy) {
    const signY = ball.vy >= 0 ? 1 : -1;
    const signX = ball.vx >= 0 ? 1 : -1;
    ball.vy = signY * minVy;
    ball.vx = signX * Math.sqrt(Math.max(1, speed * speed - ball.vy * ball.vy));
  }
  return ball;
}

export function createBall(x, y, speed = BASE_BALL_SPEED, angleOffsetRad = -0.35) {
  const clampedAngle = clamp(angleOffsetRad, -1.08, 1.08);
  return {
    x,
    y,
    vx: Math.sin(clampedAngle) * speed,
    vy: -Math.cos(clampedAngle) * speed,
    r: BALL_RADIUS,
    stuck: false,
    dockOffset: 0,
    launchAngle: clampedAngle,
    trail: [],
  };
}

export function reflectFromPaddle(ball, paddle) {
  const speed = Math.hypot(ball.vx, ball.vy) || BASE_BALL_SPEED;
  const half = Math.max(12, paddle.w / 2);
  const norm = clamp((ball.x - paddle.x) / half, -1, 1);
  const maxAngle = (62 * Math.PI) / 180;
  const angle = norm * maxAngle;
  ball.vx = Math.sin(angle) * speed;
  ball.vy = -Math.cos(angle) * speed;
  ball.launchAngle = angle;
  return enforceVerticalComponent(ball);
}

export function collideBallWithBrick(ball, brick) {
  const nearestX = clamp(ball.x, brick.x, brick.x + brick.w);
  const nearestY = clamp(ball.y, brick.y, brick.y + brick.h);
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq > ball.r * ball.r) return { hit: false, axis: null };

  const overlapLeft = ball.x + ball.r - brick.x;
  const overlapRight = brick.x + brick.w - (ball.x - ball.r);
  const overlapTop = ball.y + ball.r - brick.y;
  const overlapBottom = brick.y + brick.h - (ball.y - ball.r);
  const minX = Math.min(overlapLeft, overlapRight);
  const minY = Math.min(overlapTop, overlapBottom);

  const axis = minX < minY ? 'x' : 'y';
  return { hit: true, axis };
}

export function detonateBombBrick(bricks, origin) {
  const destroyed = [];
  const queue = [origin];
  const queued = new Set([origin]);

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const other of bricks) {
      if (other.hp <= 0 || other === cur) continue;
      if (Math.abs(other.row - cur.row) <= 1 && Math.abs(other.col - cur.col) <= 1) {
        if (other.type === 'bomb' && !queued.has(other)) {
          queued.add(other);
          queue.push(other);
        }
        other.hp = 0;
        destroyed.push(other);
      }
    }
  }
  return destroyed;
}

export function rollPowerupDrop(brick, random = Math.random) {
  if (!brick || brick.type === 'gold') return null;
  const baseChance = brick.type === 'heavy' ? 0.34 : brick.type === 'steel' ? 0.24 : brick.type === 'bomb' ? 0.28 : 0.16;
  if (random() >= baseChance) return null;

  const entries = Object.values(POWERUP_META);
  const totalWeight = entries.reduce((sum, item) => sum + item.weight, 0);
  let pick = random() * totalWeight;
  for (const item of entries) {
    pick -= item.weight;
    if (pick <= 0) return item.kind;
  }
  return entries[0].kind;
}

export function stepBallSubstepped(ball, paddle, bricks, effects, dt, state = {}) {
  const result = {
    wallHit: false,
    paddleHit: false,
    magnetCatch: false,
    brickEvents: [],
    missed: false,
  };
  if (ball.stuck) return result;

  const speed = Math.hypot(ball.vx, ball.vy);
  const steps = Math.max(1, Math.ceil((speed * dt) / (ball.r * 0.65)));
  const stepDt = dt / steps;
  const fireball = (effects?.fire || 0) > 0;

  for (let s = 0; s < steps; s += 1) {
    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;

    if (ball.x - ball.r <= WALL_SIDE) {
      ball.x = WALL_SIDE + ball.r;
      ball.vx = Math.abs(ball.vx);
      enforceVerticalComponent(ball);
      result.wallHit = true;
    } else if (ball.x + ball.r >= W - WALL_SIDE) {
      ball.x = W - WALL_SIDE - ball.r;
      ball.vx = -Math.abs(ball.vx);
      enforceVerticalComponent(ball);
      result.wallHit = true;
    }

    if (ball.y - ball.r <= WALL_TOP) {
      ball.y = WALL_TOP + ball.r;
      ball.vy = Math.abs(ball.vy);
      enforceVerticalComponent(ball);
      result.wallHit = true;
    }

    if (
      ball.vy > 0 &&
      ball.y + ball.r >= PADDLE_Y &&
      ball.y - ball.r <= PADDLE_Y + PADDLE_HEIGHT &&
      ball.x + ball.r >= paddle.x - paddle.w / 2 &&
      ball.x - ball.r <= paddle.x + paddle.w / 2
    ) {
      ball.y = PADDLE_Y - ball.r - 0.5;
      if ((effects?.magnet || 0) > 0) {
        ball.stuck = true;
        ball.dockOffset = clamp(ball.x - paddle.x, -(paddle.w / 2 - ball.r), paddle.w / 2 - ball.r);
        reflectFromPaddle(ball, paddle);
        result.magnetCatch = true;
        return result;
      }
      reflectFromPaddle(ball, paddle);
      if (state) state.combo = 0;
      result.paddleHit = true;
    }

    for (let i = 0; i < bricks.length; i += 1) {
      const brick = bricks[i];
      if (brick.hp <= 0) continue;
      const collision = collideBallWithBrick(ball, brick);
      if (!collision.hit) continue;

      if (fireball) {
        brick.hp = 0;
        const chained = brick.type === 'bomb' ? detonateBombBrick(bricks, brick) : [];
        result.brickEvents.push({ brick, destroyed: true, chained });
        continue;
      }

      if (collision.axis === 'x') {
        ball.x = ball.vx > 0 ? brick.x - ball.r - 0.2 : brick.x + brick.w + ball.r + 0.2;
        ball.vx = -ball.vx;
      } else {
        ball.y = ball.vy > 0 ? brick.y - ball.r - 0.2 : brick.y + brick.h + ball.r + 0.2;
        ball.vy = -ball.vy;
      }
      enforceVerticalComponent(ball);

      if (brick.type === 'gold') {
        result.brickEvents.push({ brick, destroyed: false, indestructible: true, chained: [] });
        break;
      }

      brick.hp -= 1;
      const destroyed = brick.hp <= 0;
      const chained = destroyed && brick.type === 'bomb' ? detonateBombBrick(bricks, brick) : [];
      result.brickEvents.push({ brick, destroyed, chained });
      break;
    }

    if (ball.y - ball.r > H + 12) {
      result.missed = true;
      return result;
    }
  }

  return result;
}

export function stepLasers(lasers, bricks, dt) {
  const brickEvents = [];
  const active = [];
  for (const shot of lasers) {
    const ny = shot.y - 560 * dt;
    if (ny < WALL_TOP) continue;
    let hitBrick = null;
    for (const brick of bricks) {
      if (brick.hp <= 0) continue;
      if (shot.x >= brick.x - 2 && shot.x <= brick.x + brick.w + 2 && ny <= brick.y + brick.h && ny + 12 >= brick.y) {
        if (!hitBrick || brick.y > hitBrick.y) hitBrick = brick;
      }
    }
    if (!hitBrick) {
      active.push({ x: shot.x, y: ny });
      continue;
    }
    if (hitBrick.type === 'gold') {
      brickEvents.push({ brick: hitBrick, destroyed: false, indestructible: true, chained: [] });
      continue;
    }
    hitBrick.hp -= 1;
    const destroyed = hitBrick.hp <= 0;
    const chained = destroyed && hitBrick.type === 'bomb' ? detonateBombBrick(bricks, hitBrick) : [];
    brickEvents.push({ brick: hitBrick, destroyed, chained });
  }
  return { lasers: active, brickEvents };
}

export function stepCapsules(capsules, paddle, dt) {
  const remaining = [];
  const caught = [];
  const paddleLeft = paddle.x - paddle.w / 2;
  const paddleRight = paddle.x + paddle.w / 2;
  for (const cap of capsules) {
    const ny = cap.y + cap.vy * dt;
    if (
      ny + 9 >= PADDLE_Y &&
      ny - 9 <= PADDLE_Y + PADDLE_HEIGHT &&
      cap.x + 15 >= paddleLeft &&
      cap.x - 15 <= paddleRight
    ) {
      caught.push({ ...cap, y: ny });
      continue;
    }
    if (ny - 12 <= H) {
      remaining.push({ ...cap, y: ny });
    }
  }
  return { capsules: remaining, caught };
}
