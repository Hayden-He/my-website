export const W = 640;
export const H = 460;
export const GRAVITY = 900;
export const ARCADE_SECONDS = 60;
export const MAX_PARTICLES = 140;
export const MAX_SPLATTERS = 18;

export const SKINS = {
  silver: { core: '#ffffff', glow: '#94a3b8', accent: '#e2e8f0', width: 9 },
  flame: { core: '#fef08a', glow: '#f97316', accent: '#ef4444', width: 11 },
  ice: { core: '#ecfeff', glow: '#0ea5e9', accent: '#67e8f9', width: 10 },
  neon: { core: '#fdf4ff', glow: '#d946ef', accent: '#38bdf8', width: 10 },
  sakura: { core: '#fff1f2', glow: '#fb7185', accent: '#fda4af', width: 10 },
  aurora: { core: '#ecfeff', glow: '#2dd4bf', accent: '#a855f7', width: 11 },
};

export const FRUITS = [
  { id: 'watermelon', r: 34, juice: '#ef4444', rind: '#15803d', pts: 1 },
  { id: 'pineapple', r: 33, juice: '#facc15', rind: '#b45309', pts: 2 },
  { id: 'coconut', r: 30, juice: '#f8fafc', rind: '#78350f', pts: 1 },
  { id: 'orange', r: 28, juice: '#f97316', rind: '#ea580c', pts: 1 },
  { id: 'apple', r: 28, juice: '#fca5a5', rind: '#dc2626', pts: 1 },
  { id: 'dragonfruit', r: 30, juice: '#ec4899', rind: '#be185d', pts: 2 },
  { id: 'kiwi', r: 26, juice: '#84cc16', rind: '#78350f', pts: 1 },
  { id: 'banana', r: 34, juice: '#fde047', rind: '#eab308', pts: 1 },
  { id: 'lemon', r: 26, juice: '#fef08a', rind: '#eab308', pts: 1 },
  { id: 'strawberry', r: 23, juice: '#fb7185', rind: '#dc2626', pts: 1 },
  { id: 'grapes', r: 29, juice: '#9333ea', rind: '#581c87', pts: 2 },
  { id: 'cherry', r: 28, juice: '#ef4444', rind: '#b91c1c', pts: 2 },
  { id: 'avocado', r: 29, juice: '#a3e635', rind: '#14532d', pts: 1 },
  { id: 'pear', r: 28, juice: '#fef08a', rind: '#84cc16', pts: 1 },
];

export const SPECIAL_FRUIT_MAP = {
  freeze: FRUITS[7],
  double: FRUITS[4],
  frenzy: FRUITS[5],
  lightning: FRUITS[8],
  splitter: FRUITS[0],
  magnet: FRUITS[10],
  shield: FRUITS[12],
  clock: FRUITS[3],
  heal: FRUITS[4],
  pomegranate: FRUITS[0],
};

export function segCircleHit(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let tProj = 0;
  if (lenSq > 0.0001) {
    tProj = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lenSq));
  }
  const px = ax + tProj * dx;
  const py = ay + tProj * dy;
  const distSq = (cx - px) * (cx - px) + (cy - py) * (cy - py);
  return distSq <= r * r;
}

export function calcComboBonus(comboCount) {
  return comboCount >= 3 ? comboCount : 0;
}

export function calcComboFeverEnergy(comboEnergyCount) {
  if (comboEnergyCount >= 5) return 25;
  if (comboEnergyCount === 4) return 18;
  if (comboEnergyCount === 3) return 12;
  return 0;
}
