export const W = 460;
export const H = 560;
export const BOSS_WAVE_INTERVAL = 5;
export const BOSS_KINDS = ['crimson', 'prism', 'mothership'];
export const BOSS_HP_SCALE = 1.80;
export const BOSS_ENTRY_SPEED = 168;
export const BOSS_BEAM_LENGTH = H + 120;
export const BOSS_CAMP_SECONDS = 3;
export const BOSS_CAMP_RADIUS = 24;
export const BOSS_COUNTER_WARNING = 0.80;
export const MAX_WEAPON_LEVEL = 5;
export const BLAST_AMMO_PER_PICKUP = 3;
export const BLAST_INTERVAL = 1.20;
export const BLAST_SPEED = 820;
export const BLAST_RADIUS = 65;
export const BLAST_DAMAGE = 6;
export const MOTHERSHIP_DEPLOY_SECONDS = 0.48;
export const MOTHERSHIP_DODGE_SECONDS = 0.42;
export const MOTHERSHIP_LASER_LOCK_SECONDS = 0.43;
export const PRISM_BEAM_WIDTH = 13;
export const PRISM_MIRROR_BEAM_WIDTH = 9;
export const PRISM_REFLECT_WARNING = 0.62;
export const PRISM_REFLECT_RADIUS = 62;
export const PRISM_REFLECT_ASPECT = 0.84;
export const PRISM_REFLECT_PANELS = 6;
export const PRISM_REFLECT_INTERVAL = 0.22;
export const PRISM_REFLECT_MAX_BOLTS = 6;
export const PRISM_MIRROR_DEPLOY_SECONDS = 0.46;
export const PRISM_PHASE_TWO_ATTACKS = ['mirror', 'sweep', 'reflect', 'barrage'];
export const PRISM_MIRROR_ATTACKS = ['fan', 'sweep', 'barrage'];
export const CRIMSON_GUARD_OFFSET = 66;
export const CRIMSON_GUARD_HALF_WIDTH = 21;
export const CRIMSON_SCATTER_ANGLES = [0.04, 0.18, 0.32, 0.46];
export const MAX_PARTICLES = 160;
export const OVERDRIVE_SECONDS = 5.5;
export const OVERDRIVE_END_CUE = 1;
export const PICKUP_CUE_SECONDS = 0.48;

export const SKINS = {
  cobalt: {
    wing: '#0284c7',
    wingHi: '#38bdf8',
    body: '#f8fafc',
    cockpit: '#2563eb',
    bolt: '#7dd3fc',
    flame: '#38bdf8',
    boostColor: '#67e8f9',
    hull: [[0, -23], [6, -7], [21, 10], [15, 13], [7, 10], [0, 16], [-7, 10], [-15, 13], [-21, 10], [-6, -7]],
    engines: [[-6, 13, 2.8, 15], [6, 13, 2.8, 15]],
    shot: { wave: 'triangle', from: 810, to: 275, duration: 0.055, gain: 0.039 },
    heavy: {
      color: '#67e8f9', edge: '#dffbff', fade: 'rgba(14, 165, 233, 0)', reach: 38,
      hull: [[0, -18], [4, -6], [4, 6], [0, 15], [-4, 6], [-4, -6]],
      trails: [[[-3, 5], [3, 5], [1.5, 25], [0, 38], [-1.5, 25]]],
      heavyShot: { wave: 'triangle', from: 246, to: 92, duration: 0.12, gain: 0.14, interval: 195 },
      heavyHit: { wave: 'triangle', from: 520, to: 170, duration: 0.10, gain: 0.11, interval: 95 },
    },
  },
  crimson: {
    wing: '#be123c',
    wingHi: '#fb7185',
    body: '#fff1f2',
    cockpit: '#e11d48',
    bolt: '#fdba74',
    flame: '#fb923c',
    boostColor: '#fbbf24',
    hull: [[0, -20], [7, -9], [15, -7], [22, 6], [21, 16], [11, 11], [0, 17], [-11, 11], [-21, 16], [-22, 6], [-15, -7], [-7, -9]],
    engines: [[-10, 12, 4.2, 15], [10, 12, 4.2, 15]],
    shot: { wave: 'sawtooth', from: 520, to: 135, duration: 0.047, gain: 0.027 },
    heavy: {
      color: '#ffad48', edge: '#fff0b1', fade: 'rgba(249, 115, 22, 0)', reach: 29,
      hull: [[0, -15], [7, -7], [8, 4], [4, 11], [-4, 11], [-8, 4], [-7, -7]],
      trails: [[[-8, 4], [8, 4], [4, 19], [0, 29], [-4, 19]]],
      heavyShot: { wave: 'sawtooth', from: 190, to: 68, duration: 0.15, gain: 0.12, interval: 195 },
      heavyHit: { wave: 'triangle', from: 320, to: 100, duration: 0.13, gain: 0.13, interval: 95 },
    },
  },
  phantom: {
    wing: '#6d28d9',
    wingHi: '#c084fc',
    body: '#e2e8f0',
    cockpit: '#7c3aed',
    bolt: '#d8b4fe',
    flame: '#a78bfa',
    boostColor: '#e9a5ff',
    hull: [[0, -21], [8, -8], [19, -13], [22, 1], [17, 17], [11, 10], [5, 14], [0, 10], [-5, 14], [-11, 10], [-17, 17], [-22, 1], [-19, -13], [-8, -8]],
    engines: [[0, 12, 4.3, 19]],
    shot: { wave: 'sine', from: 1200, to: 510, duration: 0.077, gain: 0.044 },
    heavy: {
      color: '#c084fc', edge: '#f5e7ff', fade: 'rgba(168, 85, 247, 0)', reach: 41,
      hull: [[0, -16], [6, -3], [3, 5], [0, 13], [-3, 5], [-6, -3]],
      trails: [
        [[0, 10], [4, 16], [0, 23], [-4, 16]],
        [[0, 25], [3.2, 30], [0, 36], [-3.2, 30]],
        [[0, 37], [1.8, 39], [0, 41], [-1.8, 39]],
      ],
      heavyShot: { wave: 'sine', from: 410, to: 136, duration: 0.16, gain: 0.14, interval: 195 },
      heavyHit: { wave: 'sine', from: 690, to: 240, duration: 0.13, gain: 0.11, interval: 95 },
    },
  },
};

export const PICKUP_THEMES = {
  weapon: { body: '#713b13', rim: '#fde047', wave: 'triangle', notes: [523, 659, 880] },
  shield: { body: '#11495d', rim: '#67e8f9', wave: 'sine', notes: [392, 784] },
  overdrive: { body: '#4c2679', rim: '#d8b4fe', wave: 'triangle', notes: [440, 784, 1175] },
  heal: { body: '#17533b', rim: '#86efac', wave: 'sine', notes: [587, 659, 784] },
  emp: { body: '#253c82', rim: '#a5b4fc', wave: 'triangle', notes: [880, 660, 990] },
  blast: { body: '#7c2d12', rim: '#fdba74', wave: 'triangle', notes: [392, 587, 880] },
};

export const SPACE_SCENES = [
  { top: '#060916', middle: '#0a172b', bottom: '#070b18', haze: 'rgba(65, 129, 196, 0.14)' },
  { top: '#080b1b', middle: '#14152d', bottom: '#0c0e22', haze: 'rgba(108, 98, 174, 0.19)' },
  { top: '#0e0b18', middle: '#20202b', bottom: '#101321', haze: 'rgba(158, 101, 86, 0.16)' },
];

const defaultTranslate = (key, params) => (params ? key.replace('{name}', params.name) : key);

export function getBossKind(tier) {
  return BOSS_KINDS[(tier - 1) % BOSS_KINDS.length];
}

export function getBossName(kind, showRole = true, t = defaultTranslate) {
  const name = kind === 'crimson' ? t('绯红裁决者')
    : kind === 'prism' ? t('苍蓝棱镜') : t('紫曜母舰');
  return showRole ? t('{name} BOSS', { name }) : name;
}

export function scoutFormation(positions) {
  return positions.map((x, index) => ({ kind: 'scout', x, y: -24 - index * 15 }));
}

export function openingWaveQueue(num, mode = 'standard') {
  const flight = (kind, lesson, x, y, side = 0) => ({ kind, lesson, x, y, side });
  let queue;
  if (num === 1) {
    queue = [
      { items: scoutFormation([W * 0.50, W * 0.34, W * 0.66]), delay: 1.38 },
      { items: scoutFormation([W * 0.23, W * 0.50, W * 0.77]), delay: 0 },
    ];
  } else if (num === 2) {
    queue = [
      { items: [flight('interceptor', 'aim', 138, -26), flight('interceptor', 'aim', 322, -82)], delay: 1.68 },
      { items: scoutFormation([95, 230, 365]), delay: 1.22 },
      { items: scoutFormation([155, 230, 305]), delay: 0 },
    ];
  } else if (num === 3) {
    queue = [
      { items: [flight('interceptor', 'flank', 54, -27, -1), flight('interceptor', 'flank', 406, -71, 1)], delay: 1.65 },
      { items: scoutFormation([145, 230, 315]), delay: 1.30 },
      {
        items: [
          flight('interceptor', 'flank', 406, -28, 1),
          flight('interceptor', 'flank', 54, -82, -1),
          ...scoutFormation([191, 269]),
        ],
        delay: 0,
      },
    ];
  } else {
    queue = [
      { items: [flight('gunship', 'spread', 230, -38), ...scoutFormation([77, 142, 383])], delay: 2.15 },
      {
        items: [
          flight('interceptor', 'aim', 108, -24),
          flight('interceptor', 'flank', 406, -65, 1),
          ...scoutFormation([171, 289]),
        ],
        delay: 1.63,
      },
      { items: [flight('gunship', 'spread', 178, -38), ...scoutFormation([88, 345])], delay: 0 },
    ];
  }
  if (mode === 'ace') {
    queue[queue.length - 1].delay = 0.82;
    queue.push({ items: scoutFormation([111, 349]), delay: 0 });
  }
  return queue;
}

export function crossfireWaveQueue() {
  return [-1, 1, -1].flatMap((side, index) => {
    const fromFlank = (x) => (side === -1 ? x : W - x);
    return [
      {
        items: [
          { kind: 'interceptor', lesson: 'aim', x: fromFlank(184), y: -26 },
          ...scoutFormation([fromFlank(112), fromFlank(66)]),
        ],
        delay: 1.45,
      },
      {
        items: [
          { kind: 'interceptor', lesson: 'flank', x: fromFlank(50), y: -28, side },
          ...scoutFormation([fromFlank(146)]),
        ],
        delay: index === 2 ? 0 : 1.62,
      },
    ];
  });
}

export function gunshipEscortWaveQueue() {
  return [false, true].flatMap((mirrored) => {
    const lane = (x) => (mirrored ? W - x : x);
    return [
      {
        items: [
          { kind: 'scout', x: lane(158), y: -48 },
          { kind: 'scout', x: lane(230), y: -82 },
        ],
        delay: 0.48,
      },
      {
        items: [{ kind: 'gunship', lesson: 'spread', x: lane(194), y: -38 }],
        delay: 1.2,
      },
      {
        items: [
          ...scoutFormation([52, 113, 313, 370, 414].map(lane)),
          { kind: 'interceptor', x: lane(274), y: -84 },
        ],
        delay: mirrored ? 0 : 2.05,
      },
    ];
  });
}

export function buildWaveQueue(num, mode = 'standard', rng = Math.random) {
  if (num <= 4) return openingWaveQueue(num, mode);
  if (mode === 'standard' && num === 7) return crossfireWaveQueue();
  if (mode === 'standard' && num === 9) return gunshipEscortWaveQueue();
  const queue = [];
  const baseCount = mode === 'ace' ? 7 : 5;
  let remaining = baseCount + Math.floor(num * 1.5);

  // 编队优先：双翼 V 字 / 横排 / 侧翼狙击 / 陨石带
  while (remaining > 0) {
    const r = rng();
    if (remaining >= 5 && r < 0.34) {
      // 5 架 V 字编队
      const cx = 92 + rng() * (W - 184);
      const kind = num >= 3 && rng() < 0.45 ? 'interceptor' : 'scout';
      const batch = [];
      for (let k = -2; k <= 2; k += 1) {
        batch.push({
          kind,
          x: cx + k * 34,
          y: -26 - Math.abs(k) * 20,
        });
      }
      queue.push({ items: batch, delay: Math.max(0.75, 1.45 - num * 0.03) });
      remaining -= 5;
    } else if (remaining >= 3 && r < 0.62) {
      // 3 架横排/狙击编队
      const kind = num >= 4 && rng() < 0.48 ? 'drone' : 'interceptor';
      const cx = 96 + rng() * (W - 192);
      const batch = [
        { kind, x: cx - 54, y: -26 },
        { kind: num >= 3 && rng() < 0.35 ? 'gunship' : kind, x: cx, y: -38 },
        { kind, x: cx + 54, y: -26 },
      ];
      queue.push({ items: batch, delay: Math.max(0.8, 1.55 - num * 0.03) });
      remaining -= 3;
    } else if (remaining >= 3 && num >= 2 && r < 0.78) {
      // 陨石群穿插
      const batch = [];
      const rockStyles = ['boulder', 'shard'];
      for (let k = 0; k < 3; k += 1) {
        batch.push({
          kind: 'asteroid',
          rockStyle: rockStyles[k],
          x: 52 + ((W - 104) * (k + 0.2 + rng() * 0.6)) / 3,
          y: -24 - rng() * 34,
        });
      }
      queue.push({ items: batch, delay: 1.1 });
      remaining -= 3;
    } else {
      // 散兵/重型护卫组合
      let kind = 'scout';
      const roll = rng();
      if (num >= 4 && roll > 0.78) kind = 'drone';
      else if (num >= 3 && roll > 0.56) kind = 'gunship';
      else if (num >= 2 && roll > 0.38) kind = 'asteroid';
      else if (roll > 0.2) kind = 'interceptor';
      queue.push({
        items: [{ kind, x: null, y: null }],
        delay: Math.max(0.28, (mode === 'ace' ? 0.55 : 0.75) - num * 0.022),
      });
      remaining -= 1;
    }
  }
  return queue;
}

export function computeBossLasers(b) {
  const down = Math.PI * 0.5;
  return [
    { x: b.x - 46, y: b.y + 20, angle: down },
    { x: b.x + 46, y: b.y + 20, angle: down },
  ];
}

export function mothershipShieldLinks(b) {
  return b?.supports && b.supportJam === 0
    ? b.supports.filter((craft) => craft.age >= MOTHERSHIP_DEPLOY_SECONDS).length
    : 0;
}

export function crimsonDashEnd(b) {
  return b.phase === 2 ? H - 82 : H - 108;
}

export function openingEnemyShots(enemy, mode = 'standard') {
  const down = Math.PI * 0.5;
  if (enemy.lesson === 'aim') return [{ x: 0, y: 12, angle: enemy.lockAngle }];
  if (enemy.lesson === 'flank') return [-7, 7].map((x) => ({ x, y: 13, angle: down }));
  const spreads = mode === 'ace' ? [-0.40, -0.20, 0, 0.20, 0.40] : [-0.30, 0, 0.30];
  return spreads.map((spread) => ({ x: 0, y: 18, angle: down + spread }));
}

export function prismBeam(attack, source) {
  const { from, to, duration } = attack.sweep;
  const progress = attack.step === 'sweep-fire' ? 1 - attack.remaining / duration : 0;
  return { x: source.x, y: source.y + 6, angle: from + (to - from) * progress };
}

export function bulletCrossesCircle(bullet, previousX, previousY, x, y, radius) {
  const dx = bullet.x - previousX;
  const dy = bullet.y - previousY;
  const lengthSquared = dx * dx + dy * dy;
  const along = lengthSquared > 0 ? ((x - previousX) * dx + (y - previousY) * dy) / lengthSquared : 0;
  const at = Math.max(0, Math.min(1, along));
  return (x - previousX - dx * at) ** 2 + (y - previousY - dy * at) ** 2 <= radius ** 2;
}

export function ellipseImpactTime(x, y, previousX, previousY, centerX, centerY, rx, ry) {
  // Normalize the hitbox to a unit circle and solve for the first point of contact.
  const startX = (previousX - centerX) / rx;
  const startY = (previousY - centerY) / ry;
  const outside = startX * startX + startY * startY - 1;
  if (outside <= 0) return 0;
  const dx = (x - previousX) / rx;
  const dy = (y - previousY) / ry;
  const lengthSquared = dx * dx + dy * dy;
  const dot = startX * dx + startY * dy;
  const discriminant = dot * dot - lengthSquared * outside;
  if (dot >= 0 || discriminant < 0) return null;
  const impact = (-dot - Math.sqrt(discriminant)) / lengthSquared;
  return impact <= 1 ? impact : null;
}

export function fastRockOverlaps(rock, fromX, fromY, toX, toY, padding, dt = 0) {
  const angle = rock.rot + rock.vRot * dt * 0.5;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = rock.r * 0.72 + padding;
  const ry = rock.r + padding;
  const margin = rock.r + 10;
  const nextX = Math.max(margin, Math.min(W - margin, rock.x + rock.vx * dt));
  const x1 = fromX - rock.x;
  const y1 = fromY - rock.y;
  const x2 = toX - nextX;
  const y2 = toY - rock.y - rock.vy * dt;
  const x = (x1 * cos + y1 * sin) / rx;
  const y = (-x1 * sin + y1 * cos) / ry;
  const dx = (x2 * cos + y2 * sin) / rx - x;
  const dy = (-x2 * sin + y2 * cos) / ry - y;
  const lengthSquared = dx * dx + dy * dy;
  const at = lengthSquared ? Math.max(0, Math.min(1, -(x * dx + y * dy) / lengthSquared)) : 0;
  return (x + dx * at) ** 2 + (y + dy * at) ** 2 <= 1;
}

export function beamHitsPlayer(beam, width, player) {
  const dx = Math.cos(beam.angle);
  const dy = Math.sin(beam.angle);
  const px = player.x - beam.x;
  const py = player.y - beam.y;
  const along = px * dx + py * dy;
  return along > 0 && along < BOSS_BEAM_LENGTH && Math.abs(px * dy - py * dx) <= width;
}

export function bossHullImpactTime(b, x, y, padding, previousX = x, previousY = y) {
  const carrier = b.kind === 'mothership';
  const width = carrier ? (b.phase === 2 ? 69 : 61) : b.r;
  const height = carrier ? 42 : b.r;
  return ellipseImpactTime(x, y, previousX, previousY, b.x, b.y, width + padding, height + padding);
}
