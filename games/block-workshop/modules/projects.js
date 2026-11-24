import { SIZE, placeBlock } from './world.js';

const prefix = 'game_save_block-workshop_';
const sessionKey = prefix + 'session';
const oldSize = 20;

function decode(raw) {
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    if (![1, 2].includes(record.version) || !Array.isArray(record.cells) || typeof record.name !== 'string') return null;
    // 第一版存档以 20 格边界为原点。平移到新场地中央，保持作品相对平台中心的位置。
    const offset = record.version === 1 ? (SIZE - oldSize) / 2 : 0;
    const blocks = new Map();
    for (const cell of record.cells) {
      if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.z)) return null;
      if (offset && (cell.x < 0 || cell.x >= oldSize || cell.z < 0 || cell.z >= oldSize)) return null;
      if (!placeBlock(blocks, { x: cell.x + offset, y: cell.y, z: cell.z + offset }, cell.material)) return null;
    }
    const updatedAt = typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt) ? record.updatedAt : 0;
    return { name: record.name, blocks, raw, updatedAt, count: blocks.size };
  } catch {
    return null;
  }
}

function encode(name, blocks, updatedAt = Date.now()) {
  return JSON.stringify({ version: 2, name, updatedAt, cells: [...blocks.values()] });
}

export function readProject(id) {
  return decode(localStorage.getItem(prefix + id));
}

export function listProjects() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .flatMap((key) => {
      const id = key.slice(prefix.length);
      const project = readProject(id);
      return project ? [{ id, name: project.name, count: project.blocks.size, updatedAt: project.updatedAt }] : [];
    })
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name, 'zh-CN'));
}

export function saveProject(id, name, blocks, previous) {
  const key = prefix + id;
  if (localStorage.getItem(key) !== previous) throw new Error('Project changed');
  const raw = encode(name, blocks);
  localStorage.setItem(key, raw);
  return raw;
}

export function renameProject(id, name, previous) {
  const key = prefix + id;
  if (localStorage.getItem(key) !== previous) throw new Error('Project changed');
  const project = decode(previous);
  if (!project) throw new Error('Project unavailable');
  const raw = encode(name, project.blocks);
  localStorage.setItem(key, raw);
  return raw;
}

export function deleteProject(id, previous) {
  const key = prefix + id;
  if (localStorage.getItem(key) !== previous) throw new Error('Project changed');
  localStorage.removeItem(key);
}

export function readSession() {
  try {
    const state = JSON.parse(sessionStorage.getItem(sessionKey));
    if (state?.id) {
      const record = readProject(state.id);
      if (record) return { id: state.id, ...record };
    }
    const draft = decode(state?.draft);
    if (draft) return { id: null, ...draft };
  } catch {}
  return null;
}

export function rememberSession(id, blocks) {
  sessionStorage.setItem(sessionKey, JSON.stringify(id ? { id } : { draft: encode('', blocks) }));
}
