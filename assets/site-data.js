/**
 * 本站本地数据管理：音效开关（全站共用）与“清除本地数据”入口。
 * 仅处理本站使用的 localStorage 键：game_best_*（最高分）、game_skin_*（球色）、site_sound（音效）。
 */
(function () {
  const SOUND_KEY = 'site_sound';
  const PREFIXES = ['game_best_', 'game_skin_'];
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
      if (!confirm('将清除本站保存在此浏览器中的全部最高分、球色与音效设置，且无法恢复。确定继续吗？')) return;
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

  window.SiteData = { getSound, setSound, clearAll, createClearButton, createCredit };

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
