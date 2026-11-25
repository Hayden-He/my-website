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

function createUpdateHarness({
  currentBuild = 'aaaa1111bbbb2222',
  isGame = false,
  hasSiteHeader = true,
  online = true,
  fetchImpl,
  nowStart = 1_000_000,
} = {}) {
  let now = nowStart;
  const session = new Map();
  const docListeners = new Map();
  const replacedUrls = [];
  const dialogEvents = [];

  function makeEl(tag) {
    const classes = new Set();
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      tagName: tag.toUpperCase(),
      children: [],
      style: {},
      hidden: false,
      disabled: false,
      textContent: '',
      title: '',
      id: '',
      get className() { return Array.from(classes).join(' '); },
      set className(val) {
        classes.clear();
        for (const c of String(val || '').split(/\s+/).filter(Boolean)) classes.add(c);
      },
      classList: {
        add(...cs) { cs.forEach((c) => classes.add(c)); },
        remove(...cs) { cs.forEach((c) => classes.delete(c)); },
        contains(c) { return classes.has(c); },
        toggle(c, force) {
          const next = force === undefined ? !classes.has(c) : Boolean(force);
          if (next) classes.add(c);
          else classes.delete(c);
          return next;
        },
      },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      remove() {
        const idx = body.children.indexOf(this);
        if (idx >= 0) body.children.splice(idx, 1);
      },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      click() {
        for (const fn of listeners.get('click') || []) fn({ target: this, preventDefault() {} });
      },
      focus() {},
      querySelector(sel) {
        return findFirst(this, sel);
      },
      querySelectorAll(sel) {
        const out = [];
        collectAll(this, sel, out);
        return out;
      },
    };
    return el;
  }

  function matchesSel(el, sel) {
    if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
    if (sel === 'button:not([disabled])') return el.tagName === 'BUTTON' && !el.disabled;
    return false;
  }

  function collectAll(node, sel, out) {
    for (const child of node.children || []) {
      if (matchesSel(child, sel)) out.push(child);
      collectAll(child, sel, out);
    }
  }

  function findFirst(node, sel) {
    for (const child of node.children || []) {
      if (matchesSel(child, sel)) return child;
      const found = findFirst(child, sel);
      if (found) return found;
    }
    return null;
  }

  const body = makeEl('body');
  const origin = 'https:' + '//example.test';

  const document = {
    readyState: 'complete',
    hidden: false,
    title: '小游乐场',
    currentScript: null,
    activeElement: null,
    body,
    documentElement: {
      lang: 'zh-CN',
      setAttribute() {},
      getAttribute() { return null; },
    },
    createElement: makeEl,
    getElementById(id) {
      if (id === 'site-header' && hasSiteHeader) return { id: 'site-header' };
      return null;
    },
    querySelector(sel) {
      if (sel === 'meta[name="site-build"]') {
        return currentBuild ? { content: currentBuild } : null;
      }
      if (sel === 'main.game-wrap, [data-site-footer-mount]') {
        return isGame ? { tagName: 'MAIN' } : null;
      }
      return findFirst(body, sel);
    },
    querySelectorAll(sel) {
      const out = [];
      collectAll(body, sel, out);
      return out;
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      if (event.type === 'site:dialogopen' || event.type === 'site:dialogclose') {
        dialogEvents.push(event.type);
      }
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

  class MockDOMParser {
    parseFromString(html) {
      const m = String(html || '').match(/<meta name="site-build" content="([^"]+)"/);
      return {
        querySelector(sel) {
          if (sel === 'meta[name="site-build"]' && m) return { content: m[1] };
          return null;
        },
      };
    }
  }

  const FakeDate = class extends Date {
    static now() { return now; }
  };

  const sandbox = {
    document,
    Date: FakeDate,
    URL,
    CustomEvent,
    DOMParser: MockDOMParser,
    fetch: fetchImpl,
    setTimeout(fn) {
      const id = { fn, unref() {} };
      return id;
    },
    clearTimeout() {},
    requestAnimationFrame(fn) { fn(); },
    location: {
      origin,
      href: origin + (isGame ? '/games/breakout/' : '/'),
      replace(u) { replacedUrls.push(String(u)); },
    },
    localStorage: {
      length: 0,
      key() { return null; },
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    sessionStorage: {
      getItem(k) { return session.has(k) ? session.get(k) : null; },
      setItem(k, v) { session.set(k, String(v)); },
    },
    navigator: { userAgent: '', onLine: online },
    performance: { now: () => 0 },
  };
  sandbox.window = sandbox;

  vm.runInNewContext(i18nEnSource, sandbox, { filename: 'assets/i18n-en.js' });
  vm.runInNewContext(i18nSource, sandbox, { filename: 'assets/i18n.js' });
  vm.runInNewContext(siteDataSource, sandbox, { filename: 'assets/site-data.js' });

  return {
    SiteData: sandbox.SiteData,
    body,
    session,
    replacedUrls,
    dialogEvents,
    advanceTime(ms) { now += ms; },
    getBanner() { return findFirst(body, '.site-update-banner'); },
    getToast() { return findFirst(body, '.site-toast'); },
    getDialog() { return findFirst(body, '.site-dialog'); },
  };
}

test('SiteData.checkForUpdate shows top banner on new version, throttles within 5m, and remembers dismissal with toast', async () => {
  let remoteBuild = 'aaaa1111bbbb2222';
  let fetchCount = 0;
  const h = createUpdateHarness({
    currentBuild: 'aaaa1111bbbb2222',
    isGame: false,
    hasSiteHeader: true,
    fetchImpl: async () => {
      fetchCount += 1;
      return { ok: true, json: async () => ({ build: remoteBuild }) };
    },
  });

  // Same build: no banner
  const r1 = await h.SiteData.checkForUpdate({ silent: true });
  assert.equal(r1.status, 'latest');
  assert.equal(h.getBanner(), null);
  assert.equal(fetchCount, 1);

  // Within 5-minute cooldown: skipped without fetch
  h.advanceTime(60_000);
  const r2 = await h.SiteData.checkForUpdate({ silent: true });
  assert.equal(r2.status, 'skipped');
  assert.equal(r2.reason, 'cooldown');
  assert.equal(fetchCount, 1);

  // After 5-minute cooldown with newer build: banner appears below site header
  remoteBuild = 'cccc3333dddd4444';
  h.advanceTime(h.SiteData.UPDATE_CHECK_COOLDOWN_MS);
  const r3 = await h.SiteData.checkForUpdate({ silent: true });
  assert.equal(r3.status, 'update');
  const banner = h.getBanner();
  assert.ok(banner && !banner.hidden);
  assert.equal(banner.classList.contains('has-site-header'), true);

  // Dismissing hides banner, records build, and shows toast hint
  banner.querySelector('.site-update-banner-close').click();
  assert.equal(banner.hidden, true);
  assert.equal(h.session.get('site_update_dismissed_build'), 'cccc3333dddd4444');
  assert.equal(h.getToast()?.textContent, '可随时在页面底部检查更新');

  // Same dismissed build does not re-show banner after next cooldown
  h.advanceTime(h.SiteData.UPDATE_CHECK_COOLDOWN_MS + 1000);
  const r4 = await h.SiteData.checkForUpdate({ silent: true });
  assert.equal(r4.status, 'update');
  assert.equal(banner.hidden, true);

  // An even newer build re-shows the banner
  remoteBuild = 'eeee5555ffff6666';
  h.advanceTime(h.SiteData.UPDATE_CHECK_COOLDOWN_MS + 1000);
  const r5 = await h.SiteData.checkForUpdate({ silent: true });
  assert.equal(r5.status, 'update');
  assert.equal(banner.hidden, false);

  // Lobby page refresh reloads directly without confirmDialog
  banner.querySelector('.site-update-banner-refresh').click();
  assert.equal(h.dialogEvents.length, 0);
  assert.equal(h.replacedUrls.length, 1);
  assert.match(h.replacedUrls[0], /\?fresh=\d+/);
});

test('SiteData update banner on game page opens confirmDialog (pausing game) and falls back to HTML when version.json fails', async () => {
  const h = createUpdateHarness({
    currentBuild: '1111222233334444',
    isGame: true,
    hasSiteHeader: false,
    fetchImpl: async (url) => {
      if (String(url).includes('/version.json')) {
        return { ok: false, status: 404 };
      }
      return {
        ok: true,
        status: 200,
        text: async () => '<html><head><meta name="site-build" content="9999888877776666" /></head></html>',
      };
    },
  });

  const res = await h.SiteData.checkForUpdate({ silent: true });
  assert.equal(res.status, 'update');
  assert.equal(res.next, '9999888877776666');

  const banner = h.getBanner();
  assert.ok(banner && !banner.hidden);
  assert.equal(banner.classList.contains('has-site-header'), false);

  // Clicking refresh on game page opens confirmDialog & dispatches site:dialogopen
  banner.querySelector('.site-update-banner-refresh').click();
  assert.deepEqual(h.dialogEvents, ['site:dialogopen']);
  assert.equal(h.replacedUrls.length, 0);

  const dialog = h.getDialog();
  assert.ok(dialog);
  dialog.querySelector('.primary').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(h.replacedUrls.length, 1);
  assert.match(h.replacedUrls[0], /\?fresh=\d+/);
});
