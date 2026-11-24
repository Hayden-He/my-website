export const W = 640;
export const H = 420;
export const FLOOR_Y = 354;
export const GRAVITY = 1080;
export const JUMP_VY = -425;
export const BASE_VX = -170;
export const BALL_R = 19;

export const BOARD_X = 76;
export const RIM_LEFT_X = 90;
export const RIM_RIGHT_X = 152;
export const RIM_CENTER_X = (RIM_LEFT_X + RIM_RIGHT_X) / 2;

export const BALL_SKINS = [
  { id: 'classic', name: '经典篮球', c0: '#fdba74', c1: '#f97316', c2: '#9a3412', seam: '#431407' },
  { id: 'planet', name: '蔚蓝星球', c0: '#7dd3fc', c1: '#0284c7', c2: '#1e3a8a', seam: '#4ade80' },
  { id: 'ice', name: '寒冰晶球', c0: '#f0f9ff', c1: '#38bdf8', c2: '#0369a1', seam: '#e0f2fe' },
  { id: 'water', name: '深海气泡', c0: '#67e8f9', c1: '#0891b2', c2: '#164e63', seam: '#cffafe' },
  { id: 'darkgold', name: '黑金夜影', c0: '#64748b', c1: '#1e293b', c2: '#020617', seam: '#facc15' },
];

export const SKYLINE = [
  { x: 0, w: 58, h: 120 },
  { x: 54, w: 46, h: 165 },
  { x: 96, w: 62, h: 95 },
  { x: 155, w: 50, h: 145 },
  { x: 202, w: 72, h: 110 },
  { x: 270, w: 55, h: 178 },
  { x: 322, w: 68, h: 125 },
  { x: 386, w: 48, h: 155 },
  { x: 430, w: 74, h: 102 },
  { x: 500, w: 58, h: 160 },
  { x: 554, w: 86, h: 130 },
];

export function getShotTimeLimit(score) {
  return Math.max(7.0, 10.0 - Math.floor(score / 6) * 0.6);
}

export function getSceneInfo(score, t = (key) => key) {
  if (score >= 100) return { name: t('星河球场'), next: t('已解锁全部场景') };
  if (score >= 60) return { name: t('极光球场'), next: t('下一场景 100 分') };
  if (score >= 30) return { name: t('夜场灯光'), next: t('下一场景 60 分') };
  if (score >= 15) return { name: t('暮色球场'), next: t('下一场景 30 分') };
  return { name: t('黄昏街头'), next: t('下一场景 15 分') };
}

export function getBlockers(state, practice = false) {
  if (practice || state.score < 25) return [];
  if (state.score >= 80) {
    return [
      { x: 225, y: state.blockerY, h: 38, flash: state.blockerFlash },
      { x: 305, y: 334 - state.blockerY, h: 38, flash: state.blockerFlash2 },
    ];
  }
  return [
    { x: state.score >= 50 ? state.blockerX : 250, y: state.blockerY, h: 56, flash: state.blockerFlash },
  ];
}

export function collidePoint(ball, x, y, radius, hoopBounce = globalThis.GameRules?.hoopBounce) {
  if (typeof hoopBounce !== 'function') return false;
  const bounce = hoopBounce(ball, x, y, BALL_R + radius);
  if (!bounce) return false;
  Object.assign(ball, bounce);
  return true;
}
