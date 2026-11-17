/**
 * 公共页面渲染脚本：负责顶部导航、游戏卡片网格和页脚
 */
(function () {
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

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function renderHeader(activeKey) {
    const header = document.getElementById('site-header');
    if (!header || !window.SITE_CONFIG) return;

    const { siteTitle, categories } = window.SITE_CONFIG;
    const container = createEl('div', 'container header-inner');

    const brand = createEl('a', 'brand');
    brand.href = '/';
    brand.appendChild(createEl('span', 'brand-badge', '🎮'));
    brand.appendChild(createEl('span', '', siteTitle));

    const nav = createEl('nav', 'nav-links');
    nav.setAttribute('aria-label', '主导航');

    const allLink = createEl('a', 'nav-link' + (activeKey === 'all' ? ' active' : ''), '全部游戏');
    allLink.href = '/';
    nav.appendChild(allLink);

    categories.forEach((cat) => {
      const link = createEl(
        'a',
        'nav-link' + (activeKey === cat.id ? ' active' : ''),
        cat.name
      );
      link.href = cat.url;
      nav.appendChild(link);
    });

    if (window.SiteData) {
      const soundBtn = createEl('button', 'nav-sound-btn');
      soundBtn.type = 'button';
      const syncLabel = () => {
        const on = window.SiteData.getSound();
        soundBtn.textContent = on ? '🔊 音效开' : '🔇 音效关';
        soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      };
      syncLabel();
      soundBtn.addEventListener('click', () => {
        const next = !window.SiteData.getSound();
        window.SiteData.setSound(next);
        syncLabel();
      });
      nav.appendChild(soundBtn);
    }

    container.appendChild(brand);
    container.appendChild(nav);
    header.innerHTML = '';
    header.appendChild(container);
  }

  function renderGameCard(game) {
    const card = createEl('article', 'game-card ' + game.category);

    const top = createEl('div', 'game-card-top');
    top.appendChild(createEl('div', 'game-icon ' + game.category, game.icon));
    top.appendChild(
      createEl('span', 'game-category-pill ' + game.category, game.categoryName)
    );
    card.appendChild(top);

    card.appendChild(createEl('h3', 'game-title', game.title));
    card.appendChild(createEl('p', 'game-desc', game.description));

    const meta = createEl('div', 'game-meta');
    const tagsWrap = createEl('div', 'game-tags');
    (game.tags || []).forEach((t) => {
      tagsWrap.appendChild(createEl('span', 'game-tag', t));
    });
    meta.appendChild(tagsWrap);

    const best = getBestScore(game.storageKey);
    if (best !== null) {
      const prefix = game.bestPrefix !== undefined ? game.bestPrefix : '最高分: ';
      const suffix = game.bestSuffix || '';
      meta.appendChild(createEl('span', 'best-score', prefix + best + suffix));
    }
    card.appendChild(meta);

    const btn = createEl('a', 'play-btn', '开始游戏 →');
    btn.href = game.url;
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
        ? '共 ' + games.length + ' 款 · 已留纪录 ' + recorded + ' 款'
        : '共 ' + games.length + ' 款';
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
      container.appendChild(createEl('div', 'site-tagline', '无需下载 · 电脑与手机均可畅玩'));
    } else {
      container.textContent =
        '© ' + new Date().getFullYear() + ' ' + window.SITE_CONFIG.siteTitle + ' · 无需下载，电脑与手机均可畅玩';
    }
    footer.innerHTML = '';
    footer.appendChild(container);
    if (window.SiteData) {
      const wrap = createEl('div', 'container data-clear-wrap');
      wrap.appendChild(window.SiteData.createClearButton());
      footer.appendChild(wrap);
    }
  }

  window.initSitePage = function (activeKey) {
    renderHeader(activeKey);
    renderGamesGrid(activeKey);
    renderFooter();
    // 从游戏页后退（bfcache 恢复）时，同步音效按钮与卡片上的最高分
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        renderHeader(activeKey);
        renderGamesGrid(activeKey);
      }
    });
  };
})();
