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
      getBestRecord: (g) => clone(sandbox.window.SiteLobby.getBestRecord(g)),
      getAllGameRecords: (g) => Array.from(sandbox.window.SiteLobby.getAllGameRecords(g)),
      getOverviewStats: (games) => {
        const stats = sandbox.window.SiteLobby.getOverviewStats(games);
        return {
          totalGames: stats.totalGames,
          recordedGames: stats.recordedGames,
          totalRecords: stats.totalRecords,
          resumeCount: stats.resumeCount,
          items: stats.items.map((item) => ({
            game: item.game,
            records: Array.from(item.records),
            resume: clone(item.resume),
            hasProgress: item.hasProgress,
          })),
        };
      },
      pickRandomGame: (games, excludeId, rng) => clone(sandbox.window.SiteLobby.pickRandomGame(games, excludeId, rng)),
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

test('Tank Maze prefers active difficulty wins from JSON modeKey and exposes difficulty/streak records', () => {
  const harness = createLobbyHarness({
    initialStorage: {
      'game_mode_tank-maze': JSON.stringify({ map: 'lanes', difficulty: 'hard', skin: 'wedge' }),
      'game_best_tank-maze_wins': '5',
      'game_best_tank-maze_wins_easy': '2',
      'game_best_tank-maze_wins_hard': '3',
      'game_best_tank-maze_streak': '4',
    },
  });
  const tankMaze = harness.SITE_CONFIG.games.find((g) => g.id === 'tank-maze');

  assert.equal(harness.SiteLobby.getCardMetaText(tankMaze), '困难胜场: 3 局');
  assert.deepEqual(harness.SiteLobby.getAllGameRecords(tankMaze), [
    '胜场: 5 局',
    '简单胜场: 2 局',
    '困难胜场: 3 局',
    '最高连胜: 4 连胜',
  ]);

  harness.I18N.setLang('en');
  assert.equal(harness.SiteLobby.getCardMetaText(tankMaze), 'Hard wins: 3');
  assert.deepEqual(harness.SiteLobby.getAllGameRecords(tankMaze), [
    'Wins: 5',
    'Easy wins: 2',
    'Hard wins: 3',
    'Best streak: 4',
  ]);
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

test('getCardMetaText prefers active mode record and falls back to other modes across games', () => {
  const harness = createLobbyHarness({
    initialStorage: {
      game_save_2048_mode: '5',
      game_best_2048_4: '1024',
      game_best_2048_5: '4096',
      game_mode_tetris: 'sprint',
      game_best_tetris_marathon: '8800',
      game_best_tetris_sprint: '42500',
      game_mode_minesweeper: 'hard',
      game_best_minesweeper_hard: '95',
      game_mode_memory: '5',
      game_best_memory_5_preview: '14',
      game_mode_slide: 'beginner',
      game_best_slide_beginner: '12',
      game_mode_snake: 'wrap',
      game_best_snake_classic: '320',
    },
  });

  const byId = (id) => harness.SITE_CONFIG.games.find((g) => g.id === id);

  assert.equal(harness.SiteLobby.getCardMetaText(byId('2048')), '5×5 最高: 4096');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('tetris')), '40 行最快: 42.5s');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('minesweeper')), '16×16 最快: 95s');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('memory')), '5×4 预览最少: 14 次');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('slide')), '3×3 入门最少步: 12 步');
  // Current mode (wrap) has no record, falls back to classic
  assert.equal(harness.SiteLobby.getCardMetaText(byId('snake')), '经典模式最高: 320');

  // Duration >= 60s formats as m:ss.t
  harness.localStorage.setItem('game_best_tetris_sprint', '65400');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('tetris')), '40 行最快: 1:05.4');

  // English localization
  harness.I18N.setLang('en');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('2048')), '5×5 best: 4096');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('tetris')), '40-Line fastest: 1:05.4');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('minesweeper')), '16×16 fastest: 95s');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('memory')), '5×4 preview fewest: 14 attempts');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('slide')), '3×3 Intro fewest: 12 moves');
  assert.equal(harness.SiteLobby.getCardMetaText(byId('snake')), 'Classic best: 320');
});

test('getAllGameRecords lists all populated mode records and block-workshop projects in zh and en', () => {
  const harness = createLobbyHarness({
    initialStorage: {
      game_best_tetris_marathon: '9200',
      game_best_tetris_sprint: '41200',
      game_best_tetris_party: '6400',
      'game_save_block-workshop_p1': JSON.stringify({ version: 2, name: 'Tower', cells: [{ x: 0, y: 0, z: 0, material: 'stone' }] }),
    },
  });
  const tetris = harness.SITE_CONFIG.games.find((g) => g.id === 'tetris');
  const workshop = harness.SITE_CONFIG.games.find((g) => g.id === 'block-workshop');
  const basketball = harness.SITE_CONFIG.games.find((g) => g.id === 'basketball');

  assert.deepEqual(harness.SiteLobby.getAllGameRecords(tetris), [
    '马拉松最高: 9200',
    '40 行最快: 41.2s',
    '道具狂热最高: 6400',
  ]);
  assert.deepEqual(harness.SiteLobby.getAllGameRecords(workshop), ['已保存 1 个作品']);
  assert.deepEqual(harness.SiteLobby.getAllGameRecords(basketball), []);

  harness.I18N.setLang('en');
  assert.deepEqual(harness.SiteLobby.getAllGameRecords(tetris), [
    'Marathon best: 9200',
    '40-Line fastest: 41.2s',
    'Party Mode best: 6400',
  ]);
  assert.deepEqual(harness.SiteLobby.getAllGameRecords(workshop), ['Saved projects: 1']);
});

test('getOverviewStats aggregates recorded games, total mode records, and active resume saves', () => {
  const harness = createLobbyHarness({
    initialStorage: {
      game_best_snake_classic: '150',
      game_best_snake_wrap: '240',
      game_best_basketball: '42',
      game_save_tetris_marathon: makeTetrisMarathonSave({ score: 300, lines: 2 }),
      game_save_2048_4: JSON.stringify({
        score: 64,
        board: [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
        played: true,
      }),
    },
  });

  const stats = harness.SiteLobby.getOverviewStats();
  assert.equal(stats.totalGames, 11);
  assert.equal(stats.recordedGames, 2);
  assert.equal(stats.totalRecords, 3);
  assert.equal(stats.resumeCount, 2);

  const snakeItem = stats.items.find((item) => item.game.id === 'snake');
  const tetrisItem = stats.items.find((item) => item.game.id === 'tetris');
  const slideItem = stats.items.find((item) => item.game.id === 'slide');

  assert.equal(snakeItem.records.length, 2);
  assert.equal(snakeItem.resume, null);
  assert.equal(snakeItem.hasProgress, true);

  assert.equal(tetrisItem.records.length, 0);
  assert.ok(tetrisItem.resume);
  assert.equal(tetrisItem.hasProgress, true);

  assert.equal(slideItem.records.length, 0);
  assert.equal(slideItem.resume, null);
  assert.equal(slideItem.hasProgress, false);
});

test('pickRandomGame avoids excluded recent game, handles single/empty pools, and supports deterministic rng', () => {
  const harness = createLobbyHarness();
  const games = harness.SITE_CONFIG.games.slice(0, 3);

  assert.equal(harness.SiteLobby.pickRandomGame([], 'basketball'), null);
  assert.equal(harness.SiteLobby.pickRandomGame([games[0]], 'basketball').id, games[0].id);

  assert.equal(harness.SiteLobby.pickRandomGame(games, games[0].id, () => 0).id, games[1].id);
  assert.equal(harness.SiteLobby.pickRandomGame(games, games[0].id, () => 0.99).id, games[2].id);
  assert.equal(harness.SiteLobby.pickRandomGame(games, 'missing-id', () => 0).id, games[0].id);
});
