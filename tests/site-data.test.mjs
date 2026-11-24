import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const siteDataSource = fs.readFileSync(path.join(root, 'assets/site-data.js'), 'utf8');
const i18nEnSource = fs.readFileSync(path.join(root, 'assets/i18n-en.js'), 'utf8');
const i18nSource = fs.readFileSync(path.join(root, 'assets/i18n.js'), 'utf8');

function createSiteDataHarness({ initialStorage = {}, failSetKey = null, lang = 'zh' } = {}) {
  const storage = new Map(Object.entries(initialStorage));
  if (lang === 'en') storage.set('site_lang', 'en');

  const localStorage = {
    get length() { return storage.size; },
    key(index) { return Array.from(storage.keys())[index] ?? null; },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) {
      if (failSetKey && key === failSetKey) throw new Error('QuotaExceededError');
      storage.set(key, String(value));
    },
    removeItem(key) { storage.delete(key); },
  };

  const docListeners = new Map();
  const attrs = new Map();

  const document = {
    readyState: 'complete',
    title: '小游乐场',
    currentScript: null,
    documentElement: {
      lang: 'zh-CN',
      setAttribute(k, v) { attrs.set(k, v); },
      getAttribute(k) { return attrs.get(k) ?? null; },
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
    sessionStorage: { getItem() { return null; }, setItem() {} },
    navigator: { userAgent: '' },
    performance: { now: () => 0 },
  };
  sandbox.window = sandbox;

  vm.runInNewContext(i18nEnSource, sandbox, { filename: 'assets/i18n-en.js' });
  vm.runInNewContext(i18nSource, sandbox, { filename: 'assets/i18n.js' });
  vm.runInNewContext(siteDataSource, sandbox, { filename: 'assets/site-data.js' });

  return {
    SiteData: sandbox.SiteData,
    I18N: sandbox.I18N,
    localStorage,
    storage,
  };
}

test('SiteData.isManagedKey matches only managed game and site preference keys', () => {
  const { SiteData } = createSiteDataHarness();
  assert.equal(SiteData.isManagedKey('game_best_2048_4'), true);
  assert.equal(SiteData.isManagedKey('game_skin_space'), true);
  assert.equal(SiteData.isManagedKey('game_save_block-workshop_p1'), true);
  assert.equal(SiteData.isManagedKey('game_mode_tetris'), true);
  assert.equal(SiteData.isManagedKey('game_tutorial_fruit'), true);
  assert.equal(SiteData.isManagedKey('site_sound'), true);
  assert.equal(SiteData.isManagedKey('site_recent_game'), true);

  assert.equal(SiteData.isManagedKey('site_lang'), false);
  assert.equal(SiteData.isManagedKey('site_theme'), false);
  assert.equal(SiteData.isManagedKey('other_key'), false);
  assert.equal(SiteData.isManagedKey(null), false);
});

test('SiteData.exportData exports sorted managed keys and excludes language/theme', () => {
  const { SiteData } = createSiteDataHarness({
    initialStorage: {
      site_lang: 'en',
      site_theme: 'dark',
      other_external: 'ignored',
      game_best_snake_wrap: '180',
      site_sound: '0',
      'game_save_block-workshop_p1': '{"version":2,"name":"Tower","cells":[]}',
    },
  });

  const exported = SiteData.exportData();
  assert.equal(exported.count, 3);
  assert.equal(exported.payload.app, 'little-playground');
  assert.equal(exported.payload.version, 1);
  assert.deepEqual(Object.keys(exported.payload.data), [
    'game_best_snake_wrap',
    'game_save_block-workshop_p1',
    'site_sound',
  ]);
  assert.equal(exported.payload.data.site_lang, undefined);
  assert.equal(exported.payload.data.site_theme, undefined);
});

test('SiteData.parseBackup rejects invalid payloads and filters unmanaged keys', () => {
  const { SiteData } = createSiteDataHarness();

  assert.equal(SiteData.parseBackup('').ok, false);
  assert.equal(SiteData.parseBackup('{bad').ok, false);
  assert.equal(SiteData.parseBackup(JSON.stringify({ app: 'other', version: 1, data: { game_best_2048_4: '16' } })).ok, false);
  assert.equal(SiteData.parseBackup(JSON.stringify({ app: 'little-playground', version: 2, data: { game_best_2048_4: '16' } })).ok, false);
  assert.equal(SiteData.parseBackup(JSON.stringify({ app: 'little-playground', version: 1, data: { site_lang: 'en', non_string: 123 } })).ok, false);

  const valid = SiteData.parseBackup(JSON.stringify({
    app: 'little-playground',
    version: 1,
    data: {
      site_lang: 'en',
      evil_key: 'hack',
      game_best_2048_5: '2048',
      game_best_bad_type: 999,
      site_recent_game: '2048',
    },
  }));
  assert.equal(valid.ok, true);
  assert.equal(valid.count, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(valid.entries)), [
    ['game_best_2048_5', '2048'],
    ['site_recent_game', '2048'],
  ]);
});

test('SiteData.importData replaces managed keys while preserving language and theme', () => {
  const { SiteData, storage } = createSiteDataHarness({
    initialStorage: {
      site_lang: 'en',
      site_theme: 'dark',
      game_best_basketball: '42',
      site_sound: '0',
    },
  });

  const backupJson = JSON.stringify({
    app: 'little-playground',
    version: 1,
    data: {
      game_best_2048_4: '1024',
      game_mode_tetris: 'sprint',
      site_lang: 'zh',
    },
  });

  const res = SiteData.importData(backupJson);
  assert.equal(res.ok, true);
  assert.equal(res.count, 2);
  assert.equal(storage.get('game_best_basketball'), undefined);
  assert.equal(storage.get('site_sound'), undefined);
  assert.equal(storage.get('game_best_2048_4'), '1024');
  assert.equal(storage.get('game_mode_tetris'), 'sprint');
  assert.equal(storage.get('site_lang'), 'en');
  assert.equal(storage.get('site_theme'), 'dark');
});

test('SiteData.importData rolls back existing managed keys if storage write fails', () => {
  const { SiteData, storage } = createSiteDataHarness({
    initialStorage: {
      site_theme: 'light',
      game_best_basketball: '42',
      site_sound: '1',
    },
    failSetKey: 'game_mode_tetris',
  });

  const backupJson = JSON.stringify({
    app: 'little-playground',
    version: 1,
    data: {
      game_best_2048_4: '1024',
      game_mode_tetris: 'sprint',
    },
  });

  const res = SiteData.importData(backupJson);
  assert.equal(res.ok, false);
  assert.equal(storage.get('game_best_basketball'), '42');
  assert.equal(storage.get('site_sound'), '1');
  assert.equal(storage.get('game_best_2048_4'), undefined);
  assert.equal(storage.get('site_theme'), 'light');
});
