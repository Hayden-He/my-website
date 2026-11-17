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

  // 2048 是唯一会保存“进行中棋局”的游戏：首页卡片给出继续入口
  function get2048Resume() {
    try {
      const mode = localStorage.getItem('game_save_2048_mode') === '5' ? 5 : 4;
      const raw = localStorage.getItem('game_save_2048_' + mode);
      if (!raw) return null;
      const save = JSON.parse(raw);
      if (!save || !Array.isArray(save.board) || save.board.length !== mode) return null;
      const score = Number(save.score);
      if (!Number.isFinite(score) || score < 0) return null;

      const board = save.board;
      let hasTile = false;
      let canMove = false;
      for (let r = 0; r < mode; r++) {
        if (!Array.isArray(board[r]) || board[r].length !== mode) return null;
        for (let c = 0; c < mode; c++) {
          const v = board[r][c];
          if (!Number.isSafeInteger(v) || v < 0) return null;
          if (v > 0) hasTile = true;
          if (v === 0) canMove = true;
          if (c + 1 < mode && v !== 0 && v === board[r][c + 1]) canMove = true;
          if (r + 1 < mode && v !== 0 && v === board[r + 1][c]) canMove = true;
        }
      }
      if (!hasTile || !canMove) return null;
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
    nav.appendChild(allLink);

    categories.forEach((cat) => {
      const link = createEl(
        'a',
        'nav-link' + (activeKey === cat.id ? ' active' : ''),
        t(cat.name)
      );
      link.href = cat.url;
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

    const top = createEl('div', 'game-card-top');
    const gameIcon = createEl('div', 'game-icon ' + game.category);
    gameIcon.appendChild(createIcon('game-' + game.icon, 'game-icon-svg', '0 0 32 32'));
    top.appendChild(gameIcon);
    top.appendChild(
      createEl('span', 'game-category-pill ' + game.category, t(game.categoryName))
    );
    card.appendChild(top);

    card.appendChild(createEl('h3', 'game-title', t(game.title)));
    card.appendChild(createEl('p', 'game-desc', t(game.description)));

    const meta = createEl('div', 'game-meta');
    const tagsWrap = createEl('div', 'game-tags');
    (game.tags || []).forEach((tag) => {
      tagsWrap.appendChild(createEl('span', 'game-tag', t(tag)));
    });
    meta.appendChild(tagsWrap);

    const best = getBestScore(game.storageKey);
    if (best !== null) {
      const prefix = t(game.bestPrefix !== undefined ? game.bestPrefix : '最高分: ');
      const suffix = game.bestSuffix ? t(game.bestSuffix) : '';
      meta.appendChild(createEl('span', 'best-score', prefix + best + suffix));
    }
    card.appendChild(meta);

    const resume = game.id === '2048' ? get2048Resume() : null;
    let btnLabel = t('开始游戏 →');
    if (resume) {
      const board = resume.size + '×' + resume.size;
      btnLabel = resume.score > 0
        ? t('继续上局 · {board} {score} 分 →', { board, score: resume.score })
        : t('继续上局 · {board} →', { board });
    }
    const btn = createEl('a', 'play-btn', btnLabel);
    btn.href = game.url;
    if (resume) btn.title = t('继续上次未完成的棋局');
    card.appendChild(btn);

    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      location.href = game.url;
    });

    return card;
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
    grid.innerHTML = '';
    games.forEach((game) => {
      grid.appendChild(renderGameCard(game));
    });
  }

  function renderFooter() {
    const footer = document.getElementById('site-footer');
    if (!footer || !window.SITE_CONFIG) return;
    const container = createEl('div', 'container');
    if (window.SiteData) {
      container.appendChild(window.SiteData.createCredit());
      container.appendChild(createEl('div', 'site-tagline', t('无需下载 · 电脑与手机均可畅玩')));
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
    renderFooter();

    if (!i18nBound) {
      i18nBound = true;
      document.addEventListener('i18n:change', () => {
        renderHeader(activeKey);
        renderGamesGrid(activeKey);
        renderFooter();
      });
    }

    // 从游戏页后退（bfcache 恢复）时，同步音效按钮与卡片上的最高分
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        renderHeader(activeKey);
        renderGamesGrid(activeKey);
      }
    });
  };
})();
