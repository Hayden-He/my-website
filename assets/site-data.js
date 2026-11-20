/**
 * 管理本地游戏数据、共用音效、对话框和页面操作。
 */
(function () {
  function t(key, params) {
    return window.I18N ? window.I18N.t(key, params) : key;
  }

  const SOUND_KEY = 'site_sound';
  const SILENT_HINT_KEY = 'site_ios_silent_hint_shown';
  const RECENT_GAME_KEY = 'site_recent_game';
  const PREFIXES = ['game_best_', 'game_skin_', 'game_save_', 'game_mode_', 'game_tutorial_'];
  const EXACT_KEYS = [SOUND_KEY, RECENT_GAME_KEY];

  function isAppleMobile() {
    try {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/i.test(ua)) return true;
      return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    } catch {
      return false;
    }
  }

  function maybeHintSilentMode() {
    if (!isAppleMobile()) return;
    try {
      if (sessionStorage.getItem(SILENT_HINT_KEY)) return;
      sessionStorage.setItem(SILENT_HINT_KEY, '1');
    } catch {}
    toast(t('音效已开启（iPhone 静音模式下无声，请关闭手机静音）'), { duration: 3200 });
  }

  function getSound() {
    try {
      return localStorage.getItem(SOUND_KEY) !== '0';
    } catch {
      return true;
    }
  }

  function setSound(on) {
    try {
      localStorage.setItem(SOUND_KEY, on ? '1' : '0');
    } catch {}
    if (on) maybeHintSilentMode();
  }

  // ---- 共用音频：解决 iOS Safari 等浏览器的自动播放限制 ----
  // 音频上下文全站唯一；在页面第一次触摸/点击/按键时创建并解锁，而不是等到第一次发声时才创建。
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        audioCtx = new Ctx();
      } catch {
        return null;
      }
    }
    return audioCtx;
  }

  function unlockAudio() {
    const ac = getAudioContext();
    if (!ac || ac.state === 'running') return;
    try {
      const p = ac.resume();
      if (p && p.catch) p.catch(() => {});
      // iOS 需要在手势内真正播放一段（静音）内容才算解锁
      const src = ac.createBufferSource();
      src.buffer = ac.createBuffer(1, 1, 22050);
      src.connect(ac.destination);
      src.start(0);
    } catch {}
  }

  // 在任意常见的用户手势上尝试解锁；已运行时 unlockAudio 会直接返回，开销很小
  ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, unlockAudio, { capture: true, passive: true });
  });
  // 页面从后台恢复或被系统中断后，下一次手势会再次尝试恢复
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audioCtx && audioCtx.state !== 'running') {
      try { audioCtx.resume().catch(() => {}); } catch {}
    }
  });

  // 在音频可用时执行 fn(ac)。若上下文尚未运行，则尝试恢复并等待；
  // 超过 300ms 仍未就绪则放弃该次发声，避免解锁后一次性冲出一堆过期音效。
  function withAudio(fn) {
    const ac = getAudioContext();
    if (!ac) return;
    if (ac.state === 'running') {
      fn(ac);
      return;
    }
    const t0 = performance.now();
    try {
      ac.resume().then(() => {
        if (ac.state === 'running' && performance.now() - t0 < 300) fn(ac);
      }).catch(() => {});
    } catch {}
  }

  function getRecentGameId() {
    try {
      return localStorage.getItem(RECENT_GAME_KEY);
    } catch {
      return null;
    }
  }

  function recordRecentGame(id) {
    try {
      if (getRecentGameId() !== id) localStorage.setItem(RECENT_GAME_KEY, id);
    } catch {}
  }

  function clearAll() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (EXACT_KEYS.includes(k) || PREFIXES.some((p) => k.startsWith(p)))) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      return true;
    } catch {
      return false;
    }
  }


  // ---- 自定义确认/提示弹窗：替换原生 confirm/alert ----
  let activeDialog = null;

  function isDialogOpen() {
    return !!activeDialog;
  }

  function openDialog(options) {
    const opts = options || {};
    if (activeDialog) return Promise.resolve(false);

    return new Promise((resolve) => {
      const lastFocus = document.activeElement;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const mask = document.createElement('div');
      mask.className = 'site-dialog-mask';

      const dialog = document.createElement('div');
      dialog.className = 'site-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'site-dialog-title');
      dialog.setAttribute('aria-describedby', 'site-dialog-message');

      const title = document.createElement('h2');
      title.className = 'site-dialog-title';
      title.id = 'site-dialog-title';
      title.textContent = opts.title || t('提示');

      const message = document.createElement('p');
      message.className = 'site-dialog-message';
      message.id = 'site-dialog-message';
      message.textContent = opts.message || '';

      const actions = document.createElement('div');
      actions.className = 'site-dialog-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'site-dialog-btn';
      cancelBtn.textContent = opts.cancelText || t('取消');

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'site-dialog-btn ' + (opts.danger ? 'danger' : 'primary');
      confirmBtn.textContent = opts.confirmText || t('确定');

      const hasCancel = opts.cancelText !== null;
      if (hasCancel) actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);

      dialog.appendChild(title);
      dialog.appendChild(message);
      dialog.appendChild(actions);
      mask.appendChild(dialog);
      document.body.appendChild(mask);

      const focusTargets = (hasCancel ? [cancelBtn, confirmBtn] : [confirmBtn]);
      const first = focusTargets[0];
      const last = focusTargets[focusTargets.length - 1];

      activeDialog = { mask };

      function close(result) {
        if (!activeDialog) return;
        activeDialog = null;
        document.body.style.overflow = prevOverflow;
        mask.remove();
        document.dispatchEvent(new CustomEvent('site:dialogclose'));
        if (lastFocus && typeof lastFocus.focus === 'function') {
          try { lastFocus.focus(); } catch {}
        }
        resolve(result);
      }

      mask.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          close(false);
          return;
        }
        if (e.key !== 'Tab') return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });

      mask.addEventListener('click', (e) => {
        if (e.target === mask) close(false);
      });
      if (hasCancel) cancelBtn.addEventListener('click', () => close(false));
      confirmBtn.addEventListener('click', () => close(true));

      document.dispatchEvent(new CustomEvent('site:dialogopen'));
      requestAnimationFrame(() => (opts.danger ? (hasCancel ? cancelBtn : confirmBtn) : confirmBtn).focus());
    });
  }

  function confirmDialog(options) {
    return openDialog(options);
  }

  function alertDialog(options) {
    return openDialog(Object.assign({}, options, { cancelText: null }));
  }

  // ---- 轻量 toast ----
  let toastEl = null;
  let toastTimer = null;

  function toast(message, options) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'site-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), (options && options.duration) || 2200);
  }

  function createCopyLinkButton(path) {
    const button = document.createElement('button');
    const label = path === '/' ? '复制网站链接' : '复制游戏链接';
    button.type = 'button';
    button.className = 'copy-link-btn';
    button.dataset.copyLink = path;
    button.dataset.i18n = label;
    button.textContent = t(label);
    return button;
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-copy-link]');
    if (!button) return;
    const url = new URL(button.dataset.copyLink, location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      toast(t('链接已复制'));
    } catch {
      alertDialog({
        title: t('请长按或选中链接复制'),
        message: url,
        confirmText: t('知道了'),
      });
    }
  });

  function createClearButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'data-clear-btn';
    btn.textContent = t('清除本地数据');
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: t('清除本地数据'),
        message: t('将清除本站在此浏览器保存的游戏纪录、存档、外观、模式偏好、音效设置、教学记录和最近打开记录，且无法恢复。语言设置会保留。'),
        confirmText: t('清除'),
        cancelText: t('取消'),
        danger: true,
      });
      if (!ok) return;

      if (clearAll()) {
        toast(t('本地数据已清除'));
        setTimeout(() => location.reload(), 500);
      } else {
        alertDialog({
          title: t('清除失败'),
          message: t('浏览器禁止访问本地存储，请检查浏览器的隐私设置后重试。'),
          confirmText: t('知道了'),
        });
      }
    });
    return btn;
  }

  function createUpdateButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'update-check-btn';
    btn.textContent = t('检查更新');
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = t('检查中…');
      try {
        const url = new URL(location.href);
        url.searchParams.set('check', Date.now());
        const response = await fetch(url, { cache: 'no-store' });
        const isNotFoundPage = document.querySelector('meta[name="robots"][content="noindex"]');
        if (!response.ok && (response.status !== 404 || !isNotFoundPage)) throw new Error('Update check failed');
        const html = await response.text();
        const nextPage = new DOMParser().parseFromString(html, 'text/html');
        const current = readBuildVersion(document);
        const next = readBuildVersion(nextPage);
        if (current && next && current !== next) {
          const confirmed = await confirmDialog({
            title: t('发现新版本'),
            message: t('刷新将加载新版本，未保存的进度会丢失。'),
            confirmText: t('立即刷新'),
            cancelText: t('稍后'),
          });
          if (confirmed) {
            url.searchParams.delete('check');
            url.searchParams.set('fresh', Date.now());
            location.replace(url);
          }
        } else if (current && next) {
          toast(t('已是最新版本'));
        } else {
          toast(t('检查失败，请稍后重试'));
        }
      } catch {
        toast(t('检查失败，请稍后重试'));
      } finally {
        btn.disabled = false;
        btn.textContent = t('检查更新');
      }
    });
    return btn;
  }

  function readBuildVersion(page) {
    return page.querySelector('meta[name="site-build"]')?.content ||
      page.querySelector('link[href*="/assets/style.css?v="]')?.getAttribute('href')?.match(/[?&]v=(\d{11})/)?.[1];
  }

  // 作者标识：© 年份 站点名 · by Hayden-He（链接至作者仓库）
  const AUTHOR = { name: 'Hayden-He', url: 'https://github.com/Hayden-He/my-website' };

  function createCredit() {
    const title = (window.SITE_CONFIG && window.SITE_CONFIG.siteTitle) || '小游乐场';
    const el = document.createElement('div');
    el.className = 'site-credit';
    el.appendChild(document.createTextNode('© ' + new Date().getFullYear() + ' '));
    const site = document.createElement('span');
    site.className = 'credit-site';
    site.textContent = t(title);
    el.appendChild(site);
    el.appendChild(document.createTextNode(' · by '));
    const a = document.createElement('a');
    a.href = AUTHOR.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = AUTHOR.name;
    el.appendChild(a);
    return el;
  }

  window.SiteData = {
    getSound, setSound, clearAll, createClearButton, createUpdateButton, createCopyLinkButton, createCredit,
    getRecentGameId, recordRecentGame,
    getAudioContext, unlockAudio, withAudio,
    isDialogOpen, confirmDialog, alertDialog, toast,
  };

  // 语言切换时更新游戏页上已追加的作者标识与清除入口
  document.addEventListener('i18n:change', () => {
    const title = (window.SITE_CONFIG && window.SITE_CONFIG.siteTitle) || '小游乐场';
    document.querySelectorAll('.credit-site').forEach((el) => {
      el.textContent = t(title);
    });
    document.querySelectorAll('.data-clear-btn').forEach((el) => {
      el.textContent = t('清除本地数据');
    });
    document.querySelectorAll('.update-check-btn').forEach((el) => {
      if (!el.disabled) el.textContent = t('检查更新');
    });
  });

  // 游戏页：自动在页面底部追加入口（列表页由 app.js 在页脚渲染）
  document.addEventListener('DOMContentLoaded', () => {
    const wrap = document.querySelector('main.game-wrap');
    if (!wrap) return;
    const box = document.createElement('div');
    box.className = 'data-clear-wrap';
    box.appendChild(createCredit());
    box.appendChild(createClearButton());
    box.appendChild(createUpdateButton());
    wrap.appendChild(box);
  });
})();
