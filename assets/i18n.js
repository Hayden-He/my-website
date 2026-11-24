/**
 * 全站中英文切换（零依赖、同 URL 即时切换、英文词典按需加载）
 *
 * 设计：
 * - 中文原文本身就是 key，英文词典在 assets/i18n-en.js（window.I18N_EN）；
 * - 静态 DOM 用 data-i18n="中文原文" / data-i18n-attr="aria-label:中文原文"；
 * - 运行时动态文案用 I18N.t('中文原文 {param}', { param: ... })。
 * - 语言保存在 localStorage 的 site_lang，默认中文；仅在需要英文时按需加载词典。
 */
(function () {
  const STORAGE_KEY = 'site_lang';
  const currentScript = document.currentScript;
  const enSrc = (currentScript && currentScript.getAttribute('data-en-src')) || '/assets/i18n-en.js';

  let lang = 'zh';
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'en') lang = 'en';
  } catch {}

  let enDict = window.I18N_EN || null;
  let enPromise = null;
  let pendingEnglishApply = false;
  let originalTitle = '';
  let originalDescription = '';
  let metaDescriptionEl = null;

  function loadEnglish() {
    if (enDict || window.I18N_EN) {
      enDict = enDict || window.I18N_EN;
      return Promise.resolve(enDict);
    }
    if (enPromise) return enPromise;
    enPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = enSrc;
      script.async = true;
      script.addEventListener('load', () => {
        enDict = window.I18N_EN || {};
        resolve(enDict);
      });
      script.addEventListener('error', () => {
        enPromise = null;
        reject(new Error('Failed to load English dictionary'));
      });
      (document.head || document.documentElement).appendChild(script);
    });
    return enPromise;
  }

  function t(key, params) {
    if (key === undefined || key === null) return '';
    let value = key;
    if (lang === 'en') {
      const dict = enDict || window.I18N_EN;
      if (dict && Object.prototype.hasOwnProperty.call(dict, key)) value = dict[key];
    }
    if (params && typeof value === 'string') {
      value = value.replace(/\{(\w+)\}/g, (match, name) => (
        params[name] !== undefined ? params[name] : match
      ));
    }
    return value;
  }

  function langLabel() {
    return lang === 'zh' ? 'EN' : '中文';
  }

  function langAria() {
    return lang === 'zh' ? '切换到英文' : 'Switch to Chinese';
  }

  function refreshToggles() {
    document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
      btn.textContent = langLabel();
      btn.setAttribute('aria-label', langAria());
      btn.setAttribute('title', langAria());
    });
  }

  function apply(root) {
    const scope = root || document;

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const value = t(key);
      if (typeof value === 'string') el.textContent = value;
    });

    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(',').forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx < 0) return;
        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });

    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.setAttribute('data-lang', lang);

    if (originalTitle) document.title = t(originalTitle);
    if (metaDescriptionEl && originalDescription) {
      metaDescriptionEl.setAttribute('content', t(originalDescription));
    }

    refreshToggles();
  }

  function notifyLangChange() {
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
  }

  function ensureEnglishApplied() {
    if (enDict || window.I18N_EN) {
      enDict = enDict || window.I18N_EN;
      apply();
      notifyLangChange();
      return;
    }
    apply();
    if (pendingEnglishApply) return;
    pendingEnglishApply = true;
    loadEnglish().then(() => {
      pendingEnglishApply = false;
      if (lang === 'en') {
        apply();
        notifyLangChange();
      }
    }).catch(() => {
      pendingEnglishApply = false;
      if (lang === 'en') {
        lang = 'zh';
        try { localStorage.setItem(STORAGE_KEY, 'zh'); } catch {}
        apply();
        notifyLangChange();
      }
    });
  }

  function setLang(next) {
    if (next !== 'zh' && next !== 'en') return;
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    if (lang === 'zh') {
      apply();
      notifyLangChange();
      return;
    }
    ensureEnglishApplied();
  }

  function toggle() {
    setLang(lang === 'zh' ? 'en' : 'zh');
  }

  function init() {
    originalTitle = document.title;
    metaDescriptionEl = document.querySelector('meta[name="description"]');
    originalDescription = metaDescriptionEl ? metaDescriptionEl.getAttribute('content') : '';
    if (lang === 'en') {
      ensureEnglishApplied();
    } else {
      apply();
    }
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-lang-toggle]');
      if (!btn) return;
      event.preventDefault();
      toggle();
    });
  }

  if (lang === 'en' && !enDict && typeof document.createElement === 'function') {
    loadEnglish().catch(() => {});
  }

  window.I18N = {
    t,
    apply,
    setLang,
    toggle,
    getLang: () => lang,
    langLabel,
    langAria,
    init,
    loadEnglish,
    get en() { return enDict || window.I18N_EN || {}; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
