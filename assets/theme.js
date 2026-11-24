/**
 * 主题管理：支持跟随系统（system）/ 浅色（light）/ 深色（dark）三态切换。
 * 在 <head> 中同步执行，避免页面首帧闪白。
 */
(function () {
  const STORAGE_KEY = 'site_theme';
  const ORDER = ['system', 'light', 'dark'];
  const DARK_THEME_COLOR = '#0b1120';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const root = document.documentElement;
  const mql = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  let lightThemeColor = null;
  let switchToken = 0;

  function normalizePref(value) {
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  }

  function readPref() {
    try {
      return normalizePref(localStorage.getItem(STORAGE_KEY));
    } catch {
      return 'system';
    }
  }

  let pref = readPref();

  function getResolved() {
    if (pref === 'light' || pref === 'dark') return pref;
    return mql && mql.matches ? 'dark' : 'light';
  }

  function syncThemeMeta(resolved) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    if (lightThemeColor === null) {
      lightThemeColor = meta.getAttribute('content') || '#2563eb';
    }
    meta.setAttribute('content', resolved === 'dark' ? DARK_THEME_COLOR : lightThemeColor);
  }

  function apply() {
    const resolved = getResolved();
    root.dataset.theme = resolved;
    root.dataset.themePref = pref;
    syncThemeMeta(resolved);
    return resolved;
  }

  function beginSwitchTransition() {
    root.classList.add('theme-switching');
    const token = ++switchToken;
    const clear = () => {
      if (token === switchToken) root.classList.remove('theme-switching');
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(clear);
      });
    } else {
      setTimeout(clear, 32);
    }
  }

  function t(key, params) {
    if (window.I18N) return window.I18N.t(key, params);
    if (!params) return key;
    return key.replace(/\{(\w+)\}/g, (match, name) => (
      params[name] !== undefined ? params[name] : match
    ));
  }

  function nextOf(current) {
    const index = ORDER.indexOf(current);
    return ORDER[(index + 1) % ORDER.length];
  }

  function prefName(value) {
    if (value === 'light') return t('浅色');
    if (value === 'dark') return t('深色');
    return t('跟随系统');
  }

  function shortLabel(value) {
    if (value === 'light') return t('浅色');
    if (value === 'dark') return t('深色');
    return t('自动');
  }

  function toggleAria(current) {
    const next = prefName(nextOf(current));
    if (current === 'light') return t('主题：浅色（点击切换为{next}）', { next });
    if (current === 'dark') return t('主题：深色（点击切换为{next}）', { next });
    return t('主题：跟随系统（点击切换为{next}）', { next });
  }

  function createThemeIcon(current) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'theme-ico');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#theme-' + current);
    svg.appendChild(use);
    return svg;
  }

  function refreshToggles() {
    const label = toggleAria(pref);
    const shortText = shortLabel(pref);
    const expected = '#theme-' + pref;
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      const wantsLabel = btn.classList?.contains('nav-theme-btn') || !!btn.querySelector('.theme-label');
      const use = btn.querySelector('use');
      let labelEl = btn.querySelector('.theme-label');
      if (!use || use.getAttribute('href') !== expected) {
        btn.textContent = '';
        btn.appendChild(createThemeIcon(pref));
        labelEl = null;
      }
      if (wantsLabel) {
        if (!labelEl) {
          labelEl = document.createElement('span');
          labelEl.className = 'theme-label';
          btn.appendChild(labelEl);
        }
        labelEl.textContent = shortText;
      }
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('data-theme-state', pref);
    });
  }

  function notifyChange() {
    document.dispatchEvent(new CustomEvent('theme:change', {
      detail: { preference: pref, resolved: getResolved() },
    }));
  }

  function setPreference(next) {
    const normalized = normalizePref(next);
    if (next !== normalized) return;
    const prevPref = pref;
    const prevResolved = getResolved();
    pref = normalized;
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {}
    const nextResolved = getResolved();
    if (nextResolved !== prevResolved) beginSwitchTransition();
    apply();
    refreshToggles();
    if (pref !== prevPref || nextResolved !== prevResolved) {
      notifyChange();
    }
  }

  function cycle() {
    setPreference(nextOf(pref));
  }

  function handleSystemChange() {
    if (pref !== 'system') return;
    beginSwitchTransition();
    apply();
    refreshToggles();
    notifyChange();
  }

  if (mql) {
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleSystemChange);
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(handleSystemChange);
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    const nextPref = readPref();
    const prevResolved = getResolved();
    if (nextPref === pref && getResolved() === prevResolved) return;
    pref = nextPref;
    if (getResolved() !== prevResolved) beginSwitchTransition();
    apply();
    refreshToggles();
    notifyChange();
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    const nextPref = readPref();
    const prevResolved = getResolved();
    pref = nextPref;
    const nextResolved = apply();
    refreshToggles();
    if (nextResolved !== prevResolved) notifyChange();
  });

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-theme-toggle]');
    if (!btn) return;
    event.preventDefault();
    cycle();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshToggles);
  } else {
    refreshToggles();
  }
  document.addEventListener('i18n:change', refreshToggles);

  function prepareEnglishBoot() {
    let savedLang = null;
    try {
      savedLang = localStorage.getItem('site_lang');
    } catch {}
    if (savedLang !== 'en') return;

    root.lang = 'en';
    root.dataset.lang = 'en';
    root.classList?.add('i18n-pending');

    const script = document.currentScript;
    const enSrc = (script && typeof script.getAttribute === 'function' && script.getAttribute('data-en-src')) || '/assets/i18n-en.js';
    if (typeof document.createElement === 'function' && document.head?.appendChild) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = enSrc;
      document.head.appendChild(link);
    }
    if (typeof setTimeout === 'function') {
      const timer = setTimeout(() => root.classList?.remove('i18n-pending'), 600);
      if (timer && typeof timer.unref === 'function') timer.unref();
    }
  }

  prepareEnglishBoot();
  apply();

  window.SiteTheme = {
    getPreference: () => pref,
    getResolved,
    setPreference,
    cycle,
    refreshToggles,
  };
})();
