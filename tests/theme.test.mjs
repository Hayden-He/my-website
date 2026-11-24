import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const themeSource = fs.readFileSync(path.join(root, 'assets/theme.js'), 'utf8');
const siteDataSource = fs.readFileSync(path.join(root, 'assets/site-data.js'), 'utf8');

function createHarness({ initialPref = null, systemDark = false, themeColor = '#2563eb', legacyMql = false } = {}) {
  const storage = new Map();
  if (initialPref !== null) storage.set('site_theme', initialPref);

  const localStorage = {
    get length() { return storage.size; },
    key(index) { return Array.from(storage.keys())[index] ?? null; },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };

  let matches = systemDark;
  const mqlListeners = new Set();
  const mql = {
    media: '(prefers-color-scheme: dark)',
    get matches() { return matches; },
    ...(legacyMql
      ? {
          addListener(fn) { mqlListeners.add(fn); },
          removeListener(fn) { mqlListeners.delete(fn); },
        }
      : {
          addEventListener(type, fn) { if (type === 'change') mqlListeners.add(fn); },
          removeEventListener(type, fn) { if (type === 'change') mqlListeners.delete(fn); },
        }),
  };

  let metaColor = themeColor;
  const metaEl = themeColor === null ? null : {
    getAttribute(name) { return name === 'content' ? metaColor : null; },
    setAttribute(name, val) { if (name === 'content') metaColor = val; },
  };

  const docListeners = new Map();
  const winListeners = new Map();
  const classSet = new Set();
  const documentElement = {
    dataset: {},
    classList: {
      add(name) { classSet.add(name); },
      remove(name) { classSet.delete(name); },
      contains(name) { return classSet.has(name); },
    },
  };

  const document = {
    readyState: 'complete',
    documentElement,
    querySelector(selector) {
      return selector === 'meta[name="theme-color"]' ? metaEl : null;
    },
    querySelectorAll() { return []; },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
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
    setTimeout,
    clearTimeout,
    matchMedia(query) {
      return query === '(prefers-color-scheme: dark)' ? mql : null;
    },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    dispatchWindowEvent(event) {
      for (const fn of winListeners.get(event.type) || []) fn(event);
    },
  };
  sandbox.window = sandbox;

  vm.runInNewContext(themeSource, sandbox, { filename: 'assets/theme.js' });

  return {
    SiteTheme: sandbox.SiteTheme,
    documentElement,
    localStorage,
    storage,
    getMetaColor: () => metaColor,
    setSystemDark(nextDark) {
      matches = nextDark;
      for (const fn of mqlListeners) fn({ matches: nextDark, media: mql.media });
    },
    onThemeChange(fn) {
      document.addEventListener('theme:change', (event) => {
        fn({
          type: event.type,
          detail: event.detail
            ? { preference: event.detail.preference, resolved: event.detail.resolved }
            : undefined,
        });
      });
    },
    sandbox,
  };
}

test('system preference resolves from prefers-color-scheme and reacts to media change', () => {
  const hLight = createHarness({ systemDark: false });
  assert.equal(hLight.SiteTheme.getPreference(), 'system');
  assert.equal(hLight.SiteTheme.getResolved(), 'light');
  assert.equal(hLight.documentElement.dataset.theme, 'light');
  assert.equal(hLight.documentElement.dataset.themePref, 'system');

  const events = [];
  hLight.onThemeChange((e) => events.push(e.detail));

  hLight.setSystemDark(true);
  assert.equal(hLight.SiteTheme.getResolved(), 'dark');
  assert.equal(hLight.documentElement.dataset.theme, 'dark');
  assert.deepEqual(events, [{ preference: 'system', resolved: 'dark' }]);

  hLight.setSystemDark(false);
  assert.equal(hLight.SiteTheme.getResolved(), 'light');
  assert.equal(hLight.documentElement.dataset.theme, 'light');
  assert.deepEqual(events, [
    { preference: 'system', resolved: 'dark' },
    { preference: 'system', resolved: 'light' },
  ]);

  const hLegacy = createHarness({ initialPref: 'invalid', systemDark: true, legacyMql: true });
  assert.equal(hLegacy.SiteTheme.getPreference(), 'system');
  assert.equal(hLegacy.SiteTheme.getResolved(), 'dark');
  hLegacy.setSystemDark(false);
  assert.equal(hLegacy.SiteTheme.getResolved(), 'light');
});

test('explicit light or dark preference ignores system media changes', () => {
  const h = createHarness({ initialPref: 'light', systemDark: false });
  const events = [];
  h.onThemeChange((e) => events.push(e.detail));

  h.setSystemDark(true);
  assert.equal(h.SiteTheme.getPreference(), 'light');
  assert.equal(h.SiteTheme.getResolved(), 'light');
  assert.equal(h.documentElement.dataset.theme, 'light');
  assert.equal(events.length, 0);

  h.SiteTheme.setPreference('dark');
  assert.equal(h.SiteTheme.getResolved(), 'dark');
  assert.equal(events.length, 1);

  h.setSystemDark(false);
  assert.equal(h.SiteTheme.getPreference(), 'dark');
  assert.equal(h.SiteTheme.getResolved(), 'dark');
  assert.equal(events.length, 1);
});

test('cycle rotates system -> light -> dark -> system and persists site_theme', () => {
  const h = createHarness({ systemDark: false });
  const history = [];
  h.onThemeChange((e) => history.push(e.detail));

  assert.equal(h.SiteTheme.getPreference(), 'system');

  h.SiteTheme.cycle();
  assert.equal(h.SiteTheme.getPreference(), 'light');
  assert.equal(h.localStorage.getItem('site_theme'), 'light');

  h.SiteTheme.cycle();
  assert.equal(h.SiteTheme.getPreference(), 'dark');
  assert.equal(h.SiteTheme.getResolved(), 'dark');
  assert.equal(h.localStorage.getItem('site_theme'), 'dark');

  h.SiteTheme.cycle();
  assert.equal(h.SiteTheme.getPreference(), 'system');
  assert.equal(h.SiteTheme.getResolved(), 'light');
  assert.equal(h.localStorage.getItem('site_theme'), 'system');

  h.SiteTheme.setPreference('bogus');
  assert.equal(h.SiteTheme.getPreference(), 'system');

  assert.deepEqual(history, [
    { preference: 'light', resolved: 'light' },
    { preference: 'dark', resolved: 'dark' },
    { preference: 'system', resolved: 'light' },
  ]);
});

test('meta theme-color switches to #0b1120 in dark mode and restores original light color', () => {
  const defaultPage = createHarness({ systemDark: false, themeColor: '#2563eb' });
  assert.equal(defaultPage.getMetaColor(), '#2563eb');
  defaultPage.SiteTheme.setPreference('dark');
  assert.equal(defaultPage.getMetaColor(), '#0b1120');
  defaultPage.SiteTheme.setPreference('light');
  assert.equal(defaultPage.getMetaColor(), '#2563eb');

  const customPage = createHarness({ initialPref: 'dark', systemDark: false, themeColor: '#1e1b4b' });
  assert.equal(customPage.getMetaColor(), '#0b1120');
  customPage.SiteTheme.setPreference('light');
  assert.equal(customPage.getMetaColor(), '#1e1b4b');
});

test('SiteData.clearAll preserves site_theme while clearing game keys', () => {
  const h = createHarness({ initialPref: 'dark' });
  h.localStorage.setItem('game_best_tetris_marathon', '1234');
  h.localStorage.setItem('site_sound', '0');
  h.localStorage.setItem('site_lang', 'en');

  vm.runInNewContext(siteDataSource, h.sandbox, { filename: 'assets/site-data.js' });
  assert.equal(h.sandbox.SiteData.clearAll(), true);
  assert.equal(h.localStorage.getItem('game_best_tetris_marathon'), null);
  assert.equal(h.localStorage.getItem('site_sound'), null);
  assert.equal(h.localStorage.getItem('site_lang'), 'en');
  assert.equal(h.localStorage.getItem('site_theme'), 'dark');
});

test('refreshToggles updates .theme-label on .nav-theme-btn and keeps .theme-btn icon-only', () => {
  function makeButton(classes) {
    const attrs = new Map();
    const children = [];
    const el = {
      classList: { contains: (c) => classes.includes(c) },
      children,
      set textContent(v) { if (v === '') children.length = 0; },
      appendChild(child) { children.push(child); return child; },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.get(k) ?? null; },
      querySelector(sel) {
        if (sel === 'use') {
          for (const c of children) {
            if (c.tagName === 'svg') {
              const u = c.children.find((n) => n.tagName === 'use');
              if (u) return u;
            }
          }
          return null;
        }
        if (sel === '.theme-label') {
          return children.find((c) => c.className === 'theme-label') || null;
        }
        return null;
      },
    };
    return el;
  }

  const navBtn = makeButton(['nav-theme-btn']);
  const gameBtn = makeButton(['lang-btn', 'theme-btn']);
  const docListeners = new Map();
  const storage = new Map();
  const document = {
    readyState: 'complete',
    documentElement: { dataset: {}, classList: { add() {}, remove() {} } },
    querySelector() { return null; },
    querySelectorAll(sel) { return sel === '[data-theme-toggle]' ? [navBtn, gameBtn] : []; },
    createElement(tag) {
      const node = { tagName: tag, className: '', textContent: '' };
      return node;
    },
    createElementNS(_ns, tag) {
      const attrs = new Map();
      const children = [];
      return {
        tagName: tag,
        children,
        setAttribute(k, v) { attrs.set(k, String(v)); },
        getAttribute(k) { return attrs.get(k) ?? null; },
        appendChild(c) { children.push(c); return c; },
      };
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
    },
    dispatchEvent() { return true; },
  };

  const sandbox = {
    document,
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
    },
    CustomEvent: class { constructor(t, i = {}) { this.type = t; this.detail = i.detail; } },
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
  };
  sandbox.window = sandbox;

  vm.runInNewContext(themeSource, sandbox, { filename: 'assets/theme.js' });

  assert.equal(navBtn.querySelector('use')?.getAttribute('href'), '#theme-system');
  assert.equal(navBtn.querySelector('.theme-label')?.textContent, '自动');
  assert.equal(gameBtn.querySelector('use')?.getAttribute('href'), '#theme-system');
  assert.equal(gameBtn.querySelector('.theme-label'), null);

  sandbox.SiteTheme.cycle();
  assert.equal(navBtn.querySelector('use')?.getAttribute('href'), '#theme-light');
  assert.equal(navBtn.querySelector('.theme-label')?.textContent, '浅色');
  assert.equal(gameBtn.querySelector('.theme-label'), null);

  sandbox.SiteTheme.cycle();
  assert.equal(navBtn.querySelector('use')?.getAttribute('href'), '#theme-dark');
  assert.equal(navBtn.querySelector('.theme-label')?.textContent, '深色');
  assert.equal(gameBtn.querySelector('.theme-label'), null);
});

test('prepareEnglishBoot marks i18n-pending and preloads dictionary only when site_lang is en', () => {
  function runWithLang(lang) {
    const storage = new Map();
    if (lang) storage.set('site_lang', lang);
    const classes = new Set();
    const headChildren = [];
    const documentElement = {
      lang: 'zh-CN',
      dataset: {},
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); },
      },
    };
    const document = {
      readyState: 'complete',
      documentElement,
      currentScript: { getAttribute: (name) => (name === 'data-en-src' ? '/assets/v/abc123/i18n-en.js' : null) },
      head: { appendChild(el) { headChildren.push(el); return el; } },
      createElement(tag) { return { tagName: tag.toUpperCase(), rel: '', as: '', href: '' }; },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    };
    const sandbox = {
      document,
      localStorage: {
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => storage.set(k, String(v)),
      },
      CustomEvent: class {},
      setTimeout,
      clearTimeout,
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      addEventListener() {},
    };
    sandbox.window = sandbox;
    vm.runInNewContext(themeSource, sandbox, { filename: 'assets/theme.js' });
    return { documentElement, headChildren };
  }

  const zh = runWithLang(null);
  assert.equal(zh.documentElement.classList.contains('i18n-pending'), false);
  assert.equal(zh.headChildren.length, 0);

  const en = runWithLang('en');
  assert.equal(en.documentElement.classList.contains('i18n-pending'), true);
  assert.equal(en.documentElement.lang, 'en');
  assert.equal(en.documentElement.dataset.lang, 'en');
  assert.equal(en.headChildren.length, 1);
  assert.equal(en.headChildren[0].rel, 'preload');
  assert.equal(en.headChildren[0].as, 'script');
  assert.equal(en.headChildren[0].href, '/assets/v/abc123/i18n-en.js');
});
