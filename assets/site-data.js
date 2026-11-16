/**
 * 本站本地数据管理：音效开关（全站共用）与“清除本地数据”入口。
 * 处理本站保存的最高分、球色、2048 棋局与音效设置。
 */
(function () {
  const SOUND_KEY = 'site_sound';
  const PREFIXES = ['game_best_', 'game_skin_', 'game_save_2048_'];
  const EXACT_KEYS = [SOUND_KEY];

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

  function createClearButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'data-clear-btn';
    btn.textContent = '清除本地数据';
    btn.addEventListener('click', () => {
      if (!confirm('将清除本站保存在此浏览器中的最高分、2048 棋局进度、球色和音效设置。此操作无法恢复，确定清除吗？')) return;
      const ok = clearAll();
      alert(ok ? '已清除' : '清除失败：浏览器禁止访问本地存储');
      if (ok) location.reload();
    });
    return btn;
  }

  // 作者标识：© 年份 站点名 · by Hayden-He（链接至作者仓库）
  const AUTHOR = { name: 'Hayden-He', url: 'https://github.com/Hayden-He/my-website' };

  function createCredit() {
    const title = (window.SITE_CONFIG && window.SITE_CONFIG.siteTitle) || '小游乐场';
    const el = document.createElement('div');
    el.className = 'site-credit';
    el.appendChild(document.createTextNode('© ' + new Date().getFullYear() + ' ' + title + ' · by '));
    const a = document.createElement('a');
    a.href = AUTHOR.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = AUTHOR.name;
    el.appendChild(a);
    return el;
  }

  window.SiteData = { getSound, setSound, clearAll, createClearButton, createCredit, getAudioContext, unlockAudio, withAudio };

  // 游戏页：自动在页面底部追加入口（列表页由 app.js 在页脚渲染）
  document.addEventListener('DOMContentLoaded', () => {
    const wrap = document.querySelector('main.game-wrap');
    if (!wrap) return;
    const box = document.createElement('div');
    box.className = 'data-clear-wrap';
    box.appendChild(createCredit());
    box.appendChild(createClearButton());
    wrap.appendChild(box);
  });
})();
