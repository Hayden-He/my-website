/**
 * 游戏页公共工具
 * - 最高分读写（各游戏自己决定 key / 是否分模式）
 * - 音效按钮（全站音效开关的唯一入口）
 * - 键盘守卫（修饰键、焦点在表单/按钮上时不抢事件）
 * - 切后台回调
 * - 底部“换个游戏”交叉推荐
 * - 首次进入教学
 * 依赖：assets/site-data.js（SiteData）、assets/games.js（SITE_CONFIG，仅“换个游戏”需要）
 */
(function () {
  function t(key, params) {
    return window.I18N ? window.I18N.t(key, params) : key;
  }

  function createIcon(name, className, viewBox) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', className || 'icon');
    svg.setAttribute('viewBox', viewBox || '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + name);
    svg.appendChild(use);
    return svg;
  }

  function readBest(key) {
    try {
      const value = parseInt(localStorage.getItem(key) || '0', 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function writeBest(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  }

  function saveBestIfHigher(key, value) {
    if (value > readBest(key)) return writeBest(key, value);
    return false;
  }

  function bindSoundButton(button, initial, onChange) {
    if (!button) return { isEnabled: () => false, setEnabled: () => {} };
    let enabled = typeof initial === 'boolean'
      ? initial
      : (window.SiteData ? SiteData.getSound() : true);

    function renderLabel() {
      button.textContent = '';
      button.appendChild(createIcon(enabled ? 'sound-on' : 'sound-off', 'sound-ico', '0 0 24 24'));
      const label = document.createElement('span');
      label.className = 'sound-label';
      label.textContent = t(enabled ? '音效: 开' : '音效: 关');
      button.appendChild(label);
      button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      button.setAttribute('aria-label', t(enabled ? '关闭音效' : '开启音效'));
      button.title = t(enabled ? '关闭音效' : '开启音效');
    }

    function sync() {
      renderLabel();
      if (onChange) onChange(enabled);
    }

    button.addEventListener('click', () => {
      enabled = !enabled;
      if (window.SiteData) SiteData.setSound(enabled);
      sync();
    });

    document.addEventListener('i18n:change', renderLabel);
    sync();
    return {
      isEnabled: () => enabled,
      setEnabled(value) {
        enabled = !!value;
        sync();
      },
    };
  }

  function shouldIgnoreGameKey(event, options) {
    const opts = options || {};
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return true;
    if (!opts.ignoreOnControl) return false;
    if (event.code !== 'Space' && event.code !== 'Enter') return false;
    const target = event.target;
    return target instanceof Element &&
      !!target.closest('button, a, input, textarea, select, summary, [contenteditable="true"]');
  }

  function onHidden(callback) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) callback();
    });
  }

  function bindMobileLayout(gameId, button, onLayoutChange, {
    portraitOnly = false, landscapeOnly = false, defaultLandscape = true, onRender, onRotateHint,
  } = {}) {
    const mobile = matchMedia(landscapeOnly
      ? '(any-pointer: coarse) and (max-width: 1100px), (max-width: 1100px) and (max-height: 600px)'
      : '(any-pointer: coarse) and (max-width: 1100px)');
    const landscape = matchMedia('(orientation: landscape)');
    const portraitHint = onRotateHint
      ? matchMedia('(any-pointer: coarse) and (max-width: 1100px), (max-width: 690px)')
      : null;
    const storageKey = 'game_layout_' + gameId;
    const choices = { portrait: false, landscape: defaultLandscape };

    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      for (const direction of Object.keys(choices)) {
        if (typeof saved?.[direction] === 'boolean') choices[direction] = saved[direction];
      }
    } catch {}

    function isAvailable() {
      return mobile.matches && !(portraitOnly && landscape.matches) &&
        (!landscapeOnly || landscape.matches);
    }

    function render() {
      const available = isAvailable();
      const showHint = !landscape.matches && portraitHint?.matches;
      const immersive = available && choices[landscape.matches ? 'landscape' : 'portrait'];
      document.body.classList.toggle('mobile-game-immersive', immersive);
      button.hidden = !available && !showHint;
      const label = immersive ? '退出沉浸' : onRotateHint ? '横屏沉浸' : '沉浸模式';
      button.dataset.i18n = label;
      button.textContent = t(label);
      onRender?.(immersive);
    }

    button.addEventListener('click', () => {
      if (!isAvailable()) {
        if (portraitHint?.matches && !landscape.matches) onRotateHint();
        return;
      }
      const direction = landscape.matches ? 'landscape' : 'portrait';
      choices[direction] = !choices[direction];
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(choices));
      } catch {}
      onLayoutChange();
      render();
    });

    landscape.addEventListener('change', () => {
      if (mobile.matches || document.body.classList.contains('mobile-game-immersive')) onLayoutChange();
      render();
    });

    mobile.addEventListener('change', () => {
      if (document.body.classList.contains('mobile-game-immersive')) onLayoutChange();
      render();
    });
    portraitHint?.addEventListener('change', render);

    render();
  }

  function bindSwipe(element, {
    onDirection,
    onTap,
    getThreshold = (width) => Math.max(10, Math.min(18, width * 0.04)),
    axisRatio = 1.25,
    cancelOnMultiTouch = true,
  }) {
    let gesture = null;

    element.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) {
        if (cancelOnMultiTouch) gesture = null;
        return;
      }
      if (event.button !== 0 || event.target.closest('button, a')) return;
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        threshold: getThreshold(element.clientWidth),
        committed: false,
      };
      element.setPointerCapture(event.pointerId);
    });

    function update(event) {
      if (!gesture || gesture.id !== event.pointerId || gesture.committed) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      const x = Math.abs(dx);
      const y = Math.abs(dy);
      if (Math.max(x, y) < gesture.threshold || Math.max(x, y) < axisRatio * Math.min(x, y)) return;
      gesture.committed = true;
      onDirection(x > y ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }

    element.addEventListener('pointermove', update);
    element.addEventListener('pointerup', (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      update(event);
      const isTap = !gesture.committed && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 8;
      gesture = null;
      if (isTap && onTap) onTap();
    });

    function cancel(event) {
      if (gesture?.id === event.pointerId) gesture = null;
    }

    element.addEventListener('pointercancel', cancel);
    element.addEventListener('lostpointercapture', cancel);
  }

  function mountMoreGames(currentId, container) {
    if (!container || !window.SITE_CONFIG || !Array.isArray(window.SITE_CONFIG.games)) return;
    const catalog = window.SITE_CONFIG.games;
    const current = catalog.findIndex((game) => game.id === currentId);
    if (current >= 0 && window.SiteData) {
      // 刷新仍停留在同一游戏，也包含「清除本地数据」触发的自动刷新。
      if (performance.getEntriesByType?.('navigation')[0]?.type !== 'reload') {
        SiteData.recordRecentGame(currentId);
      }
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) SiteData.recordRecentGame(currentId);
      });
    }
    const games = catalog.slice(current + 1).concat(catalog.slice(0, Math.max(0, current))).slice(0, 4);
    if (games.length === 0) return;

    function render() {
      container.textContent = '';
      const heading = document.createElement('div');
      heading.className = 'more-games-heading';
      const title = document.createElement('div');
      title.className = 'more-games-title';
      title.textContent = t('换个游戏');
      heading.appendChild(title);
      if (current >= 0 && window.SiteData) {
        heading.appendChild(SiteData.createCopyLinkButton(catalog[current].url));
      }
      container.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'more-games-grid';
      games.forEach((game) => {
        const link = document.createElement('a');
        link.className = 'more-game-link';
        link.href = game.url;

        const icon = document.createElement('span');
        icon.className = 'more-game-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.appendChild(createIcon('game-' + (game.icon || 'basketball'), 'more-game-svg', '0 0 32 32'));

        const info = document.createElement('span');
        const name = document.createElement('span');
        name.className = 'more-game-name';
        name.textContent = t(game.title);
        const category = document.createElement('span');
        category.className = 'more-game-cat';
        category.textContent = t(game.categoryName || '');
        info.appendChild(name);
        info.appendChild(category);

        link.appendChild(icon);
        link.appendChild(info);
        grid.appendChild(link);
      });
      container.appendChild(grid);
    }

    render();
    document.addEventListener('i18n:change', render);
  }

  let tutorialOpen = false;

  function showTutorial(options) {
    const opts = options || {};
    const steps = Array.isArray(opts.steps) ? opts.steps : [];
    if (!opts.id || steps.length === 0) return false;

    const seenKey = 'game_tutorial_' + opts.id;
    if (!opts.force) {
      try {
        if (localStorage.getItem(seenKey)) return false;
      } catch {}
    }
    if (tutorialOpen) return false;

    tutorialOpen = true;
    document.dispatchEvent(new CustomEvent('site:dialogopen'));

    const prevOverflow = document.body.style.overflow;
    const lastFocus = document.activeElement;
    document.body.style.overflow = 'hidden';

    const mask = document.createElement('div');
    mask.className = 'gk-tutorial-mask';

    const card = document.createElement('div');
    card.className = 'gk-tutorial';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'gk-tutorial-title');
    card.setAttribute('aria-describedby', 'gk-tutorial-text');

    const icon = document.createElement('div');
    icon.className = 'gk-tutorial-icon';
    icon.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h2');
    title.className = 'gk-tutorial-title';
    title.id = 'gk-tutorial-title';

    const text = document.createElement('p');
    text.className = 'gk-tutorial-text';
    text.id = 'gk-tutorial-text';

    const dots = document.createElement('div');
    dots.className = 'gk-tutorial-dots';
    dots.setAttribute('aria-hidden', 'true');

    const actions = document.createElement('div');
    actions.className = 'gk-tutorial-actions';

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'gk-tutorial-btn secondary';
    skipBtn.textContent = t('跳过');

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'gk-tutorial-btn';

    actions.appendChild(skipBtn);
    actions.appendChild(nextBtn);
    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(dots);
    card.appendChild(actions);
    mask.appendChild(card);
    document.body.appendChild(mask);

    let index = 0;

    function render() {
      const step = steps[index] || {};
      icon.textContent = '';
      if (typeof step.icon === 'string' && step.icon.indexOf('-') !== -1) {
        icon.appendChild(createIcon(step.icon, 'gk-tutorial-svg', '0 0 32 32'));
      } else {
        icon.appendChild(createIcon('brand', 'gk-tutorial-svg', '0 0 40 40'));
      }
      title.textContent = step.title || '';
      text.textContent = step.text || '';
      dots.textContent = '';
      steps.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'gk-tutorial-dot' + (i === index ? ' active' : '');
        dots.appendChild(dot);
      });
      nextBtn.textContent = index === steps.length - 1 ? t('开始游戏') : t('下一步');
    }

    function close() {
      if (!tutorialOpen) return;
      tutorialOpen = false;
      document.body.style.overflow = prevOverflow;
      mask.remove();
      document.dispatchEvent(new CustomEvent('site:dialogclose'));
      try {
        localStorage.setItem(seenKey, '1');
      } catch {}
      if (lastFocus && typeof lastFocus.focus === 'function') {
        try { lastFocus.focus(); } catch {}
      }
    }

    nextBtn.addEventListener('click', () => {
      if (index >= steps.length - 1) {
        close();
        return;
      }
      index += 1;
      render();
      nextBtn.focus();
    });
    skipBtn.addEventListener('click', close);

    mask.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = [skipBtn, nextBtn];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    render();
    requestAnimationFrame(() => nextBtn.focus());
    return true;
  }

  window.GameKit = {
    readBest,
    writeBest,
    saveBestIfHigher,
    bindSoundButton,
    shouldIgnoreGameKey,
    onHidden,
    bindMobileLayout,
    bindSwipe,
    mountMoreGames,
    showTutorial,
    isTutorialOpen: () => tutorialOpen,
  };
})();
