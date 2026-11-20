import { CanvasTexture, MeshStandardMaterial, NearestFilter, SRGBColorSpace } from './vendor/three.module.js';
import { MATERIALS } from './world.js';

const finishes = {
  grass: { marks: '#a4bd8b', audio: [148, 240, 'triangle'], metallic: 0, roughness: 1 },
  stone: { marks: '#333834', audio: [104, 310, 'triangle'], metallic: 0, roughness: 0.94 },
  wood: { marks: '#704725', audio: [205, 415, 'triangle'], metallic: 0, roughness: 0.78 },
  sand: { marks: '#fff1b8', audio: [86, 185, 'sine'], metallic: 0, roughness: 1 },
  iron: { marks: '#eef4fa', audio: [310, 740, 'sine'], metallic: 0.39, roughness: 0.48 },
  copper: { marks: '#e9a373', audio: [248, 610, 'sine'], metallic: 0.27, roughness: 0.49 },
  gold: { marks: '#ffe38b', audio: [418, 980, 'sine'], metallic: 0.31, roughness: 0.37 },
  diamond: { marks: '#a1f7ff', audio: [620, 1350, 'sine'], metallic: 0.16, roughness: 0.29 },
};

function polygon(ctx, color, vertices) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [index, [x, y]] of vertices.entries()) {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.fill();
}

function paintSurface(ctx, name) {
  switch (name) {
    case 'stone':
      polygon(ctx, '#444943', [[0, 7], [10, 3], [17, 11], [11, 17], [0, 14]]);
      polygon(ctx, '#777c73', [[20, 3], [31, 9], [26, 18], [18, 12]]);
      polygon(ctx, '#888d82', [[5, 23], [14, 18], [21, 24], [15, 29], [6, 29]]);
      break;
    case 'iron':
      ctx.fillStyle = '#718ca4';
      for (let y = 4; y < 31; y += 3) ctx.fillRect(y % 7, y, 26, 1);
      ctx.fillStyle = '#e5f2fa';
      ctx.fillRect(1, 1, 30, 2);
      ctx.fillRect(1, 1, 2, 30);
      break;
    case 'copper':
      polygon(ctx, '#d89164', [[0, 4], [32, 1], [32, 8], [0, 14]]);
      polygon(ctx, '#89452f', [[0, 23], [32, 13], [32, 21], [0, 31]]);
      polygon(ctx, '#507e69', [[1, 20], [6, 18], [9, 23], [5, 28], [1, 26]]);
      polygon(ctx, '#59886c', [[23, 26], [29, 24], [31, 29], [24, 30]]);
      break;
    case 'gold':
      polygon(ctx, '#bb7a17', [[0, 29], [29, 29], [29, 0], [32, 0], [32, 32], [0, 32]]);
      polygon(ctx, '#ffe169', [[0, 2], [31, 2], [20, 11], [0, 19]]);
      polygon(ctx, '#fff1b0', [[0, 7], [22, 2], [14, 8], [0, 14]]);
      break;
    case 'diamond':
      polygon(ctx, '#156d96', [[0, 32], [16, 16], [32, 32]]);
      polygon(ctx, '#1b96bd', [[32, 0], [16, 16], [32, 32]]);
      polygon(ctx, '#a1f4ef', [[0, 0], [16, 4], [16, 16], [0, 25]]);
      polygon(ctx, '#e1ffff', [[0, 0], [16, 4], [10, 10], [0, 16]]);
      polygon(ctx, '#58deeb', [[16, 16], [32, 0], [16, 4]]);
      break;
  }
}

function makeTexture(name, face, finish) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 32;
  const ctx = tile.getContext('2d');
  ctx.fillStyle = face === 'soil' ? '#796047' : MATERIALS[name];
  ctx.fillRect(0, 0, 32, 32);
  paintSurface(ctx, name);
  ctx.fillStyle = finish.marks;
  if (face === 'soil') {
    ctx.fillStyle = MATERIALS.grass;
    ctx.fillRect(0, 0, 32, 7);
    for (let x = 1; x < 32; x += 4) ctx.fillRect(x, 7, 2, 2 + (x * 3 % 5));
    ctx.fillStyle = '#b99469';
  }
  if (name === 'wood') {
    for (let y = 0; y < 32; y += 8) {
      ctx.fillRect(0, y, 32, 1);
      ctx.fillRect((5 + y * 3) % 32, y, 1, 8);
    }
  }
  ctx.globalAlpha = finish.metallic ? 0.18 : 0.36;
  for (let i = 0; i < 54; i += 1) {
    const x = (i * 61 + i * i * 7) % 32;
    const y = (i * 977 + Math.floor(i / 3) * 5) % 32;
    if (face !== 'soil' || y > 10) ctx.fillRect(x, y, name === 'wood' ? 4 : 2, 1);
  }
  const texture = new CanvasTexture(tile);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  return texture;
}

export function blockFinish(name) {
  const finish = finishes[name];
  const makeMaterial = (face) => new MeshStandardMaterial({
    map: makeTexture(name, face, finish),
    metalness: finish.metallic,
    roughness: finish.roughness,
    emissive: name === 'diamond' ? '#44c8d1' : '#000000',
    emissiveIntensity: 0.09,
  });
  const top = makeMaterial('top');
  if (name !== 'grass') return top;
  const side = makeMaterial('soil');
  return [side, side, top, side, side, side];
}

export function editFeedback(name, removing) {
  const audio = window.SiteData;
  if (!audio.getSound()) return;
  const [body, accent, shape] = finishes[name].audio;
  audio.withAudio((context) => {
    const start = context.currentTime;
    const duration = removing ? 0.105 : 0.075;
    const volume = context.createGain();
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.08, start + 0.007);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    volume.connect(context.destination);
    for (const [frequency, type] of [[body, shape], [accent, 'sine']]) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * (removing ? 0.55 : 0.82), start + duration);
      oscillator.connect(volume);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }
  });
}
