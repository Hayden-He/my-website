import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function makeEmptyTetrisBoard() {
  return Array.from({ length: 22 }, () => Array(10).fill(null));
}

function makeTetrisMarathonSave(overrides = {}) {
  return JSON.stringify({
    version: 1,
    mode: 'marathon',
    board: makeEmptyTetrisBoard(),
    active: { type: 'T', rot: 0, x: 3, y: 2 },
    hold: null,
    holdUsed: false,
    queue: ['I', 'O', 'L'],
    bag: ['S', 'Z', 'J'],
    score: 480,
    lines: 3,
    level: 1,
    combo: 0,
    maxCombo: 1,
    backToBack: false,
    tetrises: 0,
    tSpins: 0,
    allClears: 0,
    piecesPlaced: 4,
    elapsedMs: 12000,
    ...overrides,
  });
}

function createLobbyHarness({ lang = 'zh', initialStorage = {} } = {}) {
  const storage = new Map(Object.entries(initialStorage));
  if (lang === 'en') storage.set('site_lang', 'en');

  const localStorage = {
    get length() { return storage.size; },
    key(index) { return Array.from(storage.keys())[index] ?? null; },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };

  const recentShortcut = { hidden: true };
  const recentLink = {
    href: '',
    textContent: '',
    removeAttribute(name) { if (name === 'href') this.href = ''; },
  };

  const docListeners = new Map();
  const winListeners = new Map();
  const attrs = new Map();

  const document = {
    readyState: 'complete',
    title: '小游乐场 - 在线小游戏合集',
    currentScript: null,
    documentElement: {
      lang: 'zh-CN',
      setAttribute(k, v) { attrs.set(k, v); },
      getAttribute(k) { return attrs.get(k) ?? null; },
    },
    getElementById(id) {
      if (id === 'recent-game') return recentShortcut;
      if (id === 'recent-game-link') return recentLink;
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      for (const fn of docListeners.get(event.type) || []) fn(event);
      return true;
    },
  };

  class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  const sandbox = {
    document,
    localStorage,
    CustomEvent,
    SiteData: {
      getRecentGameId() { return localStorage.getItem('site_recent_game'); },
    },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
  };
  sandbox.window = sandbox;

  for (const rel of ['assets/i18n-en.js', 'assets/i18n.js', 'assets/games.js', 'assets/app.js']) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    vm.runInNewContext(src, sandbox, { filename: rel });
  }

  const clone = (val) => (val && typeof val === 'object' ? { ...val } : val);

  return {
    SiteLobby: {
      getResumeInfo: (g) => clone(sandbox.window.SiteLobby.getResumeInfo(g)),
      getCardMetaText: (g) => sandbox.window.SiteLobby.getCardMetaText(g),
      get2048Resume: () => clone(sandbox.window.SiteLobby.get2048Resume()),
      getTetrisResume: () => clone(sandbox.window.SiteLobby.getTetrisResume()),
      getBlockWorkshopProjectCount: () => sandbox.window.SiteLobby.getBlockWorkshopProjectCount(),
    },
    SITE_CONFIG: sandbox.window.SITE_CONFIG,
    I18N: sandbox.window.I18N,
    initSitePage: sandbox.window.initSitePage,
    localStorage,
    recentShortcut,
    recentLink,
  };
}

test('getTetrisResume and getResumeInfo handle valid, zero-score, mode-mismatch, and corrupt saves', () => {
  const harness = createLobbyHarness({
    initialStorage: {
      game_save_tetris_marathon: makeTetrisMarathonSave({ score: 650, lines: 5 }),
    },
  });
  const tetris = harness.SITE_CONFIG.games.find((g) => g.id === 'tetris');

  assert.deepEqual(harness.SiteLobby.getTetrisResume(), { score: 650, lines: 5 });
  assert.deepEqual(harness.SiteLobby.getResumeInfo(tetris), {
    label: '继续上局 · 马拉松 650 分 →',
    title: '继续上次未完成的棋局',
  });

  // English localization
  harness.I18N.setLang('en');
  assert.deepEqual(harness.SiteLobby.getResumeInfo(tetris), {
    label: 'Continue · Marathon 650 pts →',
    title: 'Continue your previous game',
  });
  harness.I18N.setLang('zh');

  // Valid save with 0 score but piecesPlaced > 0
  harness.localStorage.setItem('game_save_tetris_marathon', makeTetrisMarathonSave({ score: 0, lines: 0, piecesPlaced: 2 }));
  assert.deepEqual(harness.SiteLobby.getResumeInfo(tetris), {
    label: '继续上局 · 马拉松 →',
    title: '继续上次未完成的棋局',
  });

  // If saved mode is sprint/party, lobby should not offer Marathon resume
  harness.localStorage.setItem('game_mode_tetris', 'sprint');
  assert.equal(harness.SiteLobby.getTetrisResume(), null);
  assert.equal(harness.SiteLobby.getResumeInfo(tetris), null);

  // Corrupt or empty progress save
  harness.localStorage.setItem('game_mode_tetris', 'marathon');
  harness.localStorage.setItem('game_save_tetris_marathon', '{bad json');
  assert.equal(harness.SiteLobby.getTetrisResume(), null);
  harness.localStorage.setItem('game_save_tetris_marathon', makeTetrisMarathonSave({ score: 0, lines: 0, piecesPlaced: 0 }));
  assert.equal(harness.SiteLobby.getTetrisResume(), null);
});

test('get2048Resume and getResumeInfo detect playable vs deadlocked or unplayed saves', () => {
  const harness = createLobbyHarness();
  const game2048 = harness.SITE_CONFIG.games.find((g) => g.id === '2048');

  harness.localStorage.setItem('game_save_2048_4', JSON.stringify({
    score: 120,
    board: [
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    played: true,
  }));
  assert.deepEqual(harness.SiteLobby.getResumeInfo(game2048), {
    label: '继续上局 · 4×4 120 分 →',
    title: '继续上次未完成的棋局',
  });

  // Deadlocked board without moves should not show resume
  harness.localStorage.setItem('game_save_2048_4', JSON.stringify({
    score: 500,
    board: [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ],
    played: true,
  }));
  assert.equal(harness.SiteLobby.get2048Resume(), null);
  assert.equal(harness.SiteLobby.getResumeInfo(game2048), null);
});

test('getCardMetaText renders block-workshop saved count without turning play button into resume', () => {
  const harness = createLobbyHarness({
    initialStorage: {
      'game_save_block-workshop_p1': JSON.stringify({ version: 2, name: 'Castle', cells: [{ x: 1, y: 0, z: 1, material: 'stone' }] }),
      'game_save_block-workshop_p2': JSON.stringify({ version: 1, name: 'Bridge', cells: [] }),
      'game_save_block-workshop_bad': '{corrupt',
      'game_save_block-workshop_wrong': JSON.stringify({ version: 99, name: 'Bad', cells: [] }),
    },
  });
  const workshop = harness.SITE_CONFIG.games.find((g) => g.id === 'block-workshop');

  assert.equal(harness.SiteLobby.getBlockWorkshopProjectCount(), 2);
  assert.equal(harness.SiteLobby.getResumeInfo(workshop), null);
  assert.equal(harness.SiteLobby.getCardMetaText(workshop), '已保存 2 个作品');

  harness.I18N.setLang('en');
  assert.equal(harness.SiteLobby.getCardMetaText(workshop), 'Saved projects: 2');
});

test('getCardMetaText renders Tank Maze cumulative win count in zh and en', () => {
  const harness = createLobbyHarness({
    initialStorage: {
      'game_best_tank-maze_wins': '3',
    },
  });
  const tankMaze = harness.SITE_CONFIG.games.find((g) => g.id === 'tank-maze');

  assert.equal(harness.SiteLobby.getCardMetaText(tankMaze), '胜场: 3 局');
  harness.I18N.setLang('en');
  assert.equal(harness.SiteLobby.getCardMetaText(tankMaze), 'Wins: 3');
});

test('initSitePage recent game shortcut supports unified resume prompt for tetris', () => {
  const harness = createLobbyHarness({
    initialStorage: {
      site_recent_game: 'tetris',
      game_save_tetris_marathon: makeTetrisMarathonSave({ score: 300, lines: 2 }),
    },
  });

  harness.initSitePage('all');
  assert.equal(harness.recentShortcut.hidden, false);
  assert.equal(harness.recentLink.href, '/games/tetris/');
  assert.equal(harness.recentLink.textContent, '俄罗斯方块 · 继续上局 →');

  harness.I18N.setLang('en');
  assert.equal(harness.recentLink.textContent, 'Tetris · Resume →');

  // Removing save falls back to plain title link
  harness.localStorage.removeItem('game_save_tetris_marathon');
  harness.I18N.setLang('zh');
  assert.equal(harness.recentLink.textContent, '俄罗斯方块 →');
});
