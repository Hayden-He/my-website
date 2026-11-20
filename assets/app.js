/**
 * 公共页面渲染脚本：负责顶部导航、游戏卡片网格和页脚
 */
(function () {
  function t(key, params) {
    return window.I18N ? window.I18N.t(key, params) : key;
  }

  function getBestScore(storageKey) {
    if (!storageKey) return null;
    try {
      const val = localStorage.getItem(storageKey);
      if (val === null || val === '') return null;
      const num = Number(val);
      return Number.isFinite(num) && num > 0 ? val : null;
    } catch {
      return null;
    }
  }

  // 与 2048 游戏页的存档读取条件一致。
  function isValid2048Position(position, size) {
    return position && Number.isSafeInteger(position.score) && position.score >= 0 &&
      Array.isArray(position.board) && position.board.length === size &&
      position.board.every((row) => Array.isArray(row) && row.length === size && row.every((tile) =>
        tile === 0 || (Number.isSafeInteger(tile) && tile >= 2 && tile === 2 ** Math.floor(Math.log2(tile))))) &&
      position.board.some((row) => row.some((tile) => tile !== 0));
  }

  // 判断 2048 存档是否还有可续玩的棋局。
  function get2048Resume() {
    try {
      const mode = localStorage.getItem('game_save_2048_mode') === '5' ? 5 : 4;
      const raw = localStorage.getItem('game_save_2048_' + mode);
      if (!raw) return null;
      const save = JSON.parse(raw);
      if (!isValid2048Position(save, mode)) return null;

      const { board, score } = save;
      let tileCount = 0;
      let canMove = false;
      for (let r = 0; r < mode; r++) {
        for (let c = 0; c < mode; c++) {
          const v = board[r][c];
          if (v > 0) tileCount += 1;
          if (v === 0) canMove = true;
          if (c + 1 < mode && v !== 0 && v === board[r][c + 1]) canMove = true;
          if (r + 1 < mode && v !== 0 && v === board[r + 1][c]) canMove = true;
        }
      }
      // 旧存档没有 played，用得分、撤回快照与方块数识别已有进度。
      const played = typeof save.played === 'boolean'
        ? save.played
        : score > 0 || isValid2048Position(save.prevState, mode) || tileCount > 2;
      if (!canMove || !played) return null;
      return { size: mode, score };
    } catch {
      return null;
    }
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
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

  function renderHeader(activeKey) {
    const header = document.getElementById('site-header');
    if (!header || !window.SITE_CONFIG) return;

    const { siteTitle, categories } = window.SITE_CONFIG;
    const container = createEl('div', 'container header-inner');

    const brand = createEl('a', 'brand');
    brand.href = '/';
    const brandBadge = createEl('span', 'brand-badge');
    brandBadge.appendChild(createIcon('brand', 'brand-mark', '0 0 40 40'));
    brand.appendChild(brandBadge);
    brand.appendChild(createEl('span', 'brand-name', t(siteTitle)));

    const nav = createEl('nav', 'nav-links');
    nav.setAttribute('aria-label', t('主导航'));

    const allLink = createEl('a', 'nav-link' + (activeKey === 'all' ? ' active' : ''), t('全部游戏'));
    allLink.href = '/';
    if (activeKey === 'all') allLink.setAttribute('aria-current', 'page');
    nav.appendChild(allLink);

    categories.forEach((cat) => {
      const link = createEl(
        'a',
        'nav-link' + (activeKey === cat.id ? ' active' : ''),
        t(cat.name)
      );
      link.href = cat.url;
      if (activeKey === cat.id) link.setAttribute('aria-current', 'page');
      nav.appendChild(link);
    });

    if (window.SiteData) {
      const soundBtn = createEl('button', 'nav-sound-btn');
      soundBtn.type = 'button';
      const syncLabel = () => {
        const on = window.SiteData.getSound();
        soundBtn.textContent = '';
        soundBtn.appendChild(createIcon(on ? 'sound-on' : 'sound-off', 'sound-ico', '0 0 24 24'));
        soundBtn.appendChild(createEl('span', 'sound-label', t(on ? '音效开' : '音效关')));
        soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        soundBtn.setAttribute('aria-label', t(on ? '音效已开启，点击关闭' : '音效已关闭，点击开启'));
        soundBtn.title = t(on ? '关闭音效' : '开启音效');
      };
      syncLabel();
      soundBtn.addEventListener('click', () => {
        const next = !window.SiteData.getSound();
        window.SiteData.setSound(next);
        syncLabel();
      });
      nav.appendChild(soundBtn);
    }

    if (window.I18N) {
      const langBtn = createEl('button', 'nav-lang-btn', window.I18N.langLabel());
      langBtn.type = 'button';
      langBtn.setAttribute('data-lang-toggle', '');
      langBtn.setAttribute('aria-label', window.I18N.langAria());
      langBtn.title = window.I18N.langAria();
      nav.appendChild(langBtn);
    }

    container.appendChild(brand);
    container.appendChild(nav);
    header.innerHTML = '';
    header.appendChild(container);
  }

  function renderGameCard(game) {
    const card = createEl('article', 'game-card ' + game.category);
    card.appendChild(renderGamePreview(game));

    const top = createEl('div', 'game-card-top');
    top.appendChild(createEl('h3', 'game-title', t(game.title)));
    top.appendChild(
      createEl('span', 'game-category-pill ' + game.category, t(game.categoryName))
    );
    card.appendChild(top);

    card.appendChild(createEl('p', 'game-desc'));
    const btn = createEl('a', 'play-btn');
    btn.href = game.url;
    card.appendChild(btn);

    syncGameCard(card, game);
    return card;
  }

  // 把文案、最高分、续玩入口写入卡片。构建产物里已有静态卡片时就地更新，避免重建图片造成闪动。
  function syncGameCard(card, game) {
    card.querySelector('.game-title').textContent = t(game.title);
    card.querySelector('.game-category-pill').textContent = t(game.categoryName);
    card.querySelector('.game-desc').textContent = t(game.description);

    card.querySelector('.game-meta')?.remove();
    const btn = card.querySelector('.play-btn');
    const best = getBestScore(game.storageKey);
    if (best !== null) {
      const prefix = t(game.bestPrefix !== undefined ? game.bestPrefix : '最高分: ');
      const suffix = game.bestSuffix ? t(game.bestSuffix) : '';
      const meta = createEl('div', 'game-meta');
      meta.appendChild(createEl('span', 'best-score', prefix + best + suffix));
      card.insertBefore(meta, btn);
    }

    const resume = game.id === '2048' ? get2048Resume() : null;
    let btnLabel = t('开始游戏 →');
    if (resume) {
      const board = resume.size + '×' + resume.size;
      btnLabel = resume.score > 0
        ? t('继续上局 · {board} {score} 分 →', { board, score: resume.score })
        : t('继续上局 · {board} →', { board });
    }
    btn.textContent = btnLabel;
    btn.setAttribute('aria-label', t('{game}：{action}', { game: t(game.title), action: btnLabel }));
    if (resume) btn.title = t('继续上次未完成的棋局');
    else btn.removeAttribute('title');

    if (!card.dataset.bound) {
      card.dataset.bound = '1';
      card.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) return;
        location.href = game.url;
      });
    }
  }

  function renderGamePreview(game) {
    const preview = createEl('div', 'game-preview');
    preview.setAttribute('aria-hidden', 'true');
    if (game.preview) {
      const image = createEl('img', 'game-preview-image');
      image.src = game.preview;
      image.width = 720;
      image.height = 280;
      image.alt = '';
      image.decoding = 'async';
      image.loading = 'lazy';
      image.draggable = false;
      preview.appendChild(image);
    } else {
      preview.appendChild(createIcon('game-' + game.icon, 'preview-lead', '0 0 32 32'));
    }
    return preview;
  }

  function renderGamesGrid(filterCategory) {
    const grid = document.getElementById('games-grid');
    const countEl = document.getElementById('games-count');
    if (!grid || !window.SITE_CONFIG) return;

    const games = window.SITE_CONFIG.games.filter(
      (g) => filterCategory === 'all' || g.category === filterCategory
    );

    if (countEl) {
      const recorded = games.filter((g) => getBestScore(g.storageKey) !== null).length;
      countEl.textContent = recorded > 0
        ? t('共 {n} 款 · 已留纪录 {recorded} 款', { n: games.length, recorded })
        : t('共 {n} 款', { n: games.length });
    }

    grid.classList.toggle('cols-2', games.length === 2 || games.length === 4);
    grid.classList.toggle('cols-4', games.length === 8);
    // 已有与清单一致的静态卡片时就地更新；否则（如直接打开源码页面）整块重建
    const existing = Array.from(grid.children).filter((el) => el.classList.contains('game-card'));
    const reusable = existing.length === games.length && existing.every((card, i) =>
      card.querySelector('a.play-btn')?.getAttribute('href') === games[i].url);
    if (reusable) {
      games.forEach((game, i) => syncGameCard(existing[i], game));
    } else {
      grid.innerHTML = '';
      games.forEach((game) => {
        grid.appendChild(renderGameCard(game));
      });
    }
  }

  function renderRecentGame() {
    const shortcut = document.getElementById('recent-game');
    if (!shortcut) return;
    const id = window.SiteData?.getRecentGameId();
    const game = window.SITE_CONFIG?.games.find((entry) => entry.id === id);
    shortcut.hidden = !game;
    const link = document.getElementById('recent-game-link');
    if (!game) {
      link.removeAttribute('href');
      link.textContent = '';
      return;
    }
    const title = t(game.title);
    link.href = game.url;
    link.textContent = game.id === '2048' && get2048Resume()
      ? t('{game} · 继续上局 →', { game: title })
      : title + ' →';
  }

  function renderFooter(activeKey) {
    const footer = document.getElementById('site-footer');
    if (!footer || !window.SITE_CONFIG) return;
    const container = createEl('div', 'container');
    if (window.SiteData) {
      container.appendChild(window.SiteData.createCredit());
      container.appendChild(createEl('div', 'site-tagline', t('无需下载 · 电脑与手机均可畅玩')));
      if (activeKey === 'all') container.appendChild(window.SiteData.createCopyLinkButton('/'));
    } else {
      container.textContent =
        '© ' + new Date().getFullYear() + ' ' + t(window.SITE_CONFIG.siteTitle) +
        ' · ' + t('无需下载 · 电脑与手机均可畅玩');
    }
    footer.innerHTML = '';
    footer.appendChild(container);
    if (window.SiteData) {
      const wrap = createEl('div', 'container data-clear-wrap');
      wrap.appendChild(window.SiteData.createClearButton());
      wrap.appendChild(window.SiteData.createUpdateButton());
      footer.appendChild(wrap);
    }
  }

  let i18nBound = false;

  window.initSitePage = function (activeKey) {
    renderHeader(activeKey);
    renderGamesGrid(activeKey);
    renderRecentGame();
    renderFooter(activeKey);

    if (activeKey === 'all') window.addEventListener('storage', renderRecentGame);

    if (!i18nBound) {
      i18nBound = true;
      document.addEventListener('i18n:change', () => {
        const languageButtonFocused = document.activeElement?.matches('#site-header [data-lang-toggle]');
        renderHeader(activeKey);
        renderGamesGrid(activeKey);
        renderRecentGame();
        renderFooter(activeKey);
        if (languageButtonFocused) {
          document.querySelector('#site-header [data-lang-toggle]')?.focus({ preventScroll: true });
        }
      });
    }

    // 从游戏页后退（bfcache 恢复）时同步首页状态。
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        renderHeader(activeKey);
        renderGamesGrid(activeKey);
        renderRecentGame();
      }
    });
  };
})();
