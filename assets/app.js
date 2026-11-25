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

  function formatDurationMs(ms) {
    const tenths = Math.floor(Math.max(0, ms) / 100);
    const sec = Math.floor(tenths / 10);
    const min = Math.floor(sec / 60);
    const remSec = String(sec % 60).padStart(2, '0');
    const remTenth = tenths % 10;
    return min > 0 ? `${min}:${remSec}.${remTenth}` : `${sec}.${remTenth}s`;
  }

  function getGameRecords(game) {
    if (!game) return [];
    if (Array.isArray(game.records) && game.records.length > 0) return game.records;
    if (!game.storageKey) return [];
    return [{
      key: game.storageKey,
      prefix: game.bestPrefix !== undefined ? game.bestPrefix : '最高分: ',
      suffix: game.bestSuffix,
    }];
  }

  function getBestRecord(game) {
    const records = getGameRecords(game);
    if (records.length === 0) return null;

    let preferredMode = null;
    if (game.modeKey) {
      try {
        const rawMode = localStorage.getItem(game.modeKey);
        if (rawMode && rawMode.startsWith('{')) {
          const parsed = JSON.parse(rawMode);
          const field = game.modeField || 'mode';
          if (parsed && typeof parsed[field] === 'string') preferredMode = parsed[field];
        } else {
          preferredMode = rawMode;
        }
      } catch {}
    }

    const ordered = preferredMode
      ? [
          ...records.filter((r) => r.mode === preferredMode),
          ...records.filter((r) => r.mode !== preferredMode),
        ]
      : records;

    for (const record of ordered) {
      const val = getBestScore(record.key);
      if (val === null) continue;
      return {
        mode: record.mode || null,
        key: record.key,
        value: val,
        formatted: formatRecordValue(record, val),
        prefix: record.prefix !== undefined ? record.prefix : '最高分: ',
        suffix: record.suffix || '',
      };
    }
    return null;
  }

  function formatRecordValue(record, val) {
    return record.format === 'durationMs'
      ? formatDurationMs(Number(val))
      : val;
  }

  function formatRecordText(record, val) {
    const prefix = t(record.prefix !== undefined ? record.prefix : '最高分: ');
    const suffix = record.suffix ? t(record.suffix) : '';
    return prefix + formatRecordValue(record, val) + suffix;
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

  function getTetrisResume() {
    try {
      const savedMode = localStorage.getItem('game_mode_tetris');
      if (savedMode === 'sprint' || savedMode === 'party') return null;
      const raw = localStorage.getItem('game_save_tetris_marathon');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || data.mode !== 'marathon') return null;
      if (!Array.isArray(data.board) || data.board.length !== 22 ||
        !data.board.every((row) => Array.isArray(row) && row.length === 10)) return null;
      if (!data.active || typeof data.active.type !== 'string' ||
        !Number.isInteger(data.active.rot) || data.active.rot < 0 || data.active.rot > 3 ||
        !Number.isInteger(data.active.x) || !Number.isInteger(data.active.y)) return null;
      if (!Array.isArray(data.queue) || data.queue.length < 3) return null;
      if (!Number.isSafeInteger(data.score) || data.score < 0 ||
        !Number.isSafeInteger(data.lines) || data.lines < 0) return null;
      if (!((Number.isSafeInteger(data.piecesPlaced) && data.piecesPlaced > 0) ||
        data.score > 0 || data.lines > 0)) return null;
      return { score: data.score, lines: data.lines };
    } catch {
      return null;
    }
  }

  function getBlockWorkshopProjectCount() {
    let count = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('game_save_block-workshop_')) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const record = JSON.parse(raw);
          if (record && (record.version === 1 || record.version === 2) &&
            Array.isArray(record.cells) && typeof record.name === 'string') {
            count += 1;
          }
        } catch {}
      }
    } catch {
      return 0;
    }
    return count;
  }

  const RESUME_READERS = {
    2048: () => {
      const resume = get2048Resume();
      if (!resume) return null;
      const board = resume.size + '×' + resume.size;
      return {
        label: resume.score > 0
          ? t('继续上局 · {board} {score} 分 →', { board, score: resume.score })
          : t('继续上局 · {board} →', { board }),
        title: t('继续上次未完成的棋局'),
      };
    },
    tetris: () => {
      const resume = getTetrisResume();
      if (!resume) return null;
      return {
        label: resume.score > 0
          ? t('继续上局 · 马拉松 {score} 分 →', { score: resume.score })
          : t('继续上局 · 马拉松 →'),
        title: t('继续上次未完成的棋局'),
      };
    },
  };

  const CUSTOM_META_READERS = {
    'block-workshop': () => {
      const count = getBlockWorkshopProjectCount();
      return count > 0 ? t('已保存 {n} 个作品', { n: count }) : null;
    },
  };

  function getResumeInfo(game) {
    if (!game) return null;
    const reader = RESUME_READERS[game.id];
    return reader ? reader(game) : null;
  }

  function getCardMetaText(game) {
    if (!game) return null;
    const record = getBestRecord(game);
    if (record !== null) {
      const prefix = t(record.prefix);
      const suffix = record.suffix ? t(record.suffix) : '';
      return prefix + record.formatted + suffix;
    }
    const customReader = CUSTOM_META_READERS[game.id];
    return customReader ? customReader(game) : null;
  }

  function getAllGameRecords(game) {
    if (!game) return [];
    const items = [];
    for (const record of getGameRecords(game)) {
      const val = getBestScore(record.key);
      if (val !== null) items.push(formatRecordText(record, val));
    }
    const customReader = CUSTOM_META_READERS[game.id];
    const customText = customReader ? customReader(game) : null;
    if (customText !== null) items.push(customText);
    return items;
  }

  function getOverviewStats(games) {
    const list = Array.isArray(games) ? games : (window.SITE_CONFIG?.games || []);
    let recordedGames = 0;
    let totalRecords = 0;
    let resumeCount = 0;
    const items = list.map((game) => {
      const records = getAllGameRecords(game);
      const resume = getResumeInfo(game);
      if (records.length > 0) recordedGames += 1;
      totalRecords += records.length;
      if (resume) resumeCount += 1;
      return {
        game,
        records,
        resume,
        hasProgress: records.length > 0 || resume !== null,
      };
    });
    return {
      totalGames: list.length,
      recordedGames,
      totalRecords,
      resumeCount,
      items,
    };
  }

  function pickRandomGame(games, excludeId, rng = Math.random) {
    if (!Array.isArray(games) || games.length === 0) return null;
    if (games.length === 1) return games[0];
    const filtered = excludeId ? games.filter((g) => g.id !== excludeId) : games;
    const pool = filtered.length > 0 ? filtered : games;
    const index = Math.min(pool.length - 1, Math.floor(Math.max(0, rng()) * pool.length));
    return pool[index];
  }

  function getPageGames(activeKey) {
    if (!window.SITE_CONFIG) return [];
    return window.SITE_CONFIG.games.filter(
      (g) => !activeKey || activeKey === 'all' || g.category === activeKey
    );
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
      const themeBtn = createEl('button', 'nav-theme-btn');
      themeBtn.type = 'button';
      themeBtn.setAttribute('data-theme-toggle', '');
      themeBtn.setAttribute('aria-label', t('主题：跟随系统'));
      themeBtn.title = t('主题：跟随系统');
      themeBtn.appendChild(createIcon('theme-system', 'theme-ico', '0 0 24 24'));
      themeBtn.appendChild(createEl('span', 'theme-label', t('自动')));
      nav.appendChild(themeBtn);

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
    window.SiteTheme?.refreshToggles();
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
    const metaText = getCardMetaText(game);
    if (metaText !== null) {
      const meta = createEl('div', 'game-meta');
      meta.appendChild(createEl('span', 'best-score', metaText));
      card.insertBefore(meta, btn);
    }

    const resume = getResumeInfo(game);
    const btnLabel = resume ? resume.label : t('开始游戏 →');
    btn.textContent = btnLabel;
    btn.setAttribute('aria-label', t('{game}：{action}', { game: t(game.title), action: btnLabel }));
    if (resume) btn.title = resume.title;
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
      const recorded = games.filter((g) => getCardMetaText(g) !== null).length;
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
    link.textContent = getResumeInfo(game)
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
      wrap.appendChild(window.SiteData.createBackupButton());
      wrap.appendChild(window.SiteData.createClearButton());
      wrap.appendChild(window.SiteData.createUpdateButton());
      footer.appendChild(wrap);
    }
  }

  let activeRecordsModal = null;

  function launchRandomGame(games) {
    const picked = pickRandomGame(games, window.SiteData?.getRecentGameId?.());
    if (picked) location.href = picked.url;
  }

  function renderHeroActions(activeKey) {
    const container = document.getElementById('hero-actions');
    if (!container || !window.SITE_CONFIG) return;

    const pageGames = getPageGames(activeKey);
    const stats = getOverviewStats(window.SITE_CONFIG.games);

    container.textContent = '';

    const randomBtn = createEl('button', 'hero-action-btn primary', t('随机来一局'));
    randomBtn.type = 'button';
    randomBtn.id = 'random-game-btn';
    randomBtn.title = t('从当前列表中随机挑一款游戏开始');
    randomBtn.setAttribute('aria-label', t('从当前列表中随机挑一款游戏开始'));
    randomBtn.addEventListener('click', () => launchRandomGame(pageGames));
    container.appendChild(randomBtn);

    const overviewBtn = createEl('button', 'hero-action-btn');
    overviewBtn.type = 'button';
    overviewBtn.id = 'records-overview-btn';
    overviewBtn.appendChild(createEl('span', '', t('个人战绩')));
    const badge = createEl(
      'span',
      'hero-action-badge',
      `${stats.recordedGames}/${stats.totalGames}`
    );
    badge.hidden = stats.recordedGames === 0;
    overviewBtn.appendChild(badge);
    overviewBtn.addEventListener('click', () => openRecordsOverview(activeKey));
    container.appendChild(overviewBtn);
  }

  function openRecordsOverview(activeKey) {
    if (activeRecordsModal || window.SiteData?.isDialogOpen?.() || !window.SITE_CONFIG) return;

    const lastFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const mask = createEl('div', 'site-dialog-mask');
    const dialog = createEl('div', 'site-dialog records-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'records-dialog-title');

    let filter = 'all';

    const close = () => {
      if (!activeRecordsModal) return;
      activeRecordsModal = null;
      document.body.style.overflow = prevOverflow;
      mask.remove();
      document.dispatchEvent(new CustomEvent('site:dialogclose'));
      if (lastFocus && typeof lastFocus.focus === 'function') {
        try { lastFocus.focus({ preventScroll: true }); } catch {}
      }
    };

    const render = (focusFilterBtn = false) => {
      const stats = getOverviewStats(window.SITE_CONFIG.games);
      const recordedItems = stats.items.filter((item) => item.records.length > 0);
      const unplayedItems = stats.items.filter((item) => item.records.length === 0);
      const visibleItems = filter === 'recorded'
        ? recordedItems
        : (filter === 'unplayed' ? unplayedItems : stats.items);

      dialog.textContent = '';

      const head = createEl('div', 'records-dialog-head');
      const title = createEl('h2', 'site-dialog-title', t('个人战绩总览'));
      title.id = 'records-dialog-title';
      head.appendChild(title);

      const closeIconBtn = createEl('button', 'records-close-btn', '×');
      closeIconBtn.type = 'button';
      closeIconBtn.setAttribute('aria-label', t('关闭'));
      closeIconBtn.title = t('关闭');
      closeIconBtn.addEventListener('click', close);
      head.appendChild(closeIconBtn);
      dialog.appendChild(head);

      const summaryGrid = createEl('div', 'records-summary-grid');
      const summaryData = [
        { val: `${stats.recordedGames}/${stats.totalGames}`, label: t('已留纪录') },
        { val: String(stats.totalRecords), label: t('模式纪录') },
        { val: String(stats.resumeCount), label: t('进行中存档') },
      ];
      for (const boxData of summaryData) {
        const box = createEl('div', 'records-summary-box');
        box.appendChild(createEl('div', 'records-summary-val', boxData.val));
        box.appendChild(createEl('div', 'records-summary-lbl', boxData.label));
        summaryGrid.appendChild(box);
      }
      dialog.appendChild(summaryGrid);

      const filtersEl = createEl('div', 'records-filters');
      const filterDefs = [
        { id: 'all', label: t('全部'), count: stats.totalGames },
        { id: 'recorded', label: t('已留纪录'), count: recordedItems.length },
        { id: 'unplayed', label: t('待探索'), count: unplayedItems.length },
      ];
      for (const def of filterDefs) {
        const btn = createEl(
          'button',
          'records-filter-btn' + (filter === def.id ? ' active' : ''),
          `${def.label} (${def.count})`
        );
        btn.type = 'button';
        btn.dataset.filter = def.id;
        btn.setAttribute('aria-pressed', filter === def.id ? 'true' : 'false');
        btn.addEventListener('click', () => {
          filter = def.id;
          render(true);
        });
        filtersEl.appendChild(btn);
      }
      dialog.appendChild(filtersEl);

      const listEl = createEl('div', 'records-list');
      if (visibleItems.length === 0) {
        const emptyMsg = filter === 'recorded'
          ? t('还没有留下任何纪录，挑一款开始玩吧！')
          : t('全部游戏都已留下纪录，继续刷新更高成绩吧！');
        listEl.appendChild(createEl('div', 'records-empty', emptyMsg));
      } else {
        for (const item of visibleItems) {
          const row = createEl('div', 'records-row');
          const rowHead = createEl('div', 'records-row-head');
          const gameLink = createEl('a', 'records-game-link', t(item.game.title));
          gameLink.href = item.game.url;
          rowHead.appendChild(gameLink);
          rowHead.appendChild(createEl(
            'span',
            'game-category-pill ' + item.game.category,
            t(item.game.categoryName)
          ));
          if (item.resume) {
            const resumeLink = createEl('a', 'records-resume-link', t('继续上局 →'));
            resumeLink.href = item.game.url;
            resumeLink.title = item.resume.title;
            rowHead.appendChild(resumeLink);
          }
          row.appendChild(rowHead);

          const tagsEl = createEl('div', 'records-tags');
          if (item.records.length > 0) {
            for (const rec of item.records) {
              tagsEl.appendChild(createEl('span', 'records-tag', rec));
            }
          } else {
            tagsEl.appendChild(createEl('span', 'records-empty-note', t('暂无纪录')));
          }
          row.appendChild(tagsEl);
          listEl.appendChild(row);
        }
      }
      dialog.appendChild(listEl);

      const footer = createEl('div', 'site-dialog-actions');
      const randomFooterBtn = createEl('button', 'site-dialog-btn', t('随机来一局'));
      randomFooterBtn.type = 'button';
      randomFooterBtn.addEventListener('click', () => {
        const pool = filter === 'unplayed' && unplayedItems.length > 0
          ? unplayedItems.map((item) => item.game)
          : getPageGames(activeKey);
        launchRandomGame(pool);
      });
      footer.appendChild(randomFooterBtn);

      const closeFooterBtn = createEl('button', 'site-dialog-btn primary', t('关闭'));
      closeFooterBtn.type = 'button';
      closeFooterBtn.addEventListener('click', close);
      footer.appendChild(closeFooterBtn);
      dialog.appendChild(footer);

      if (focusFilterBtn) {
        dialog.querySelector(`.records-filter-btn[data-filter="${filter}"]`)?.focus({ preventScroll: true });
      }
    };

    mask.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        dialog.querySelectorAll('a[href], button:not([disabled])')
      );
      if (focusables.length === 0) return;
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

    mask.addEventListener('click', (e) => {
      if (e.target === mask) close();
    });

    activeRecordsModal = { render: () => render(false) };
    render(false);
    mask.appendChild(dialog);
    document.body.appendChild(mask);
    document.dispatchEvent(new CustomEvent('site:dialogopen'));
    requestAnimationFrame(() => dialog.querySelector('.records-close-btn')?.focus());
  }

  let currentActiveKey = 'all';
  let listenersBound = false;

  function refreshLobby(includeChrome) {
    if (includeChrome) {
      renderHeader(currentActiveKey);
      renderFooter(currentActiveKey);
    }
    renderHeroActions(currentActiveKey);
    renderGamesGrid(currentActiveKey);
    renderRecentGame();
    if (activeRecordsModal) activeRecordsModal.render();
  }

  window.initSitePage = function (activeKey) {
    currentActiveKey = activeKey;
    refreshLobby(true);

    if (!listenersBound) {
      listenersBound = true;
      window.addEventListener('storage', () => refreshLobby(false));

      document.addEventListener('i18n:change', () => {
        const languageButtonFocused = document.activeElement?.matches('#site-header [data-lang-toggle]');
        refreshLobby(true);
        if (languageButtonFocused) {
          document.querySelector('#site-header [data-lang-toggle]')?.focus({ preventScroll: true });
        }
      });

      // 从游戏页后退（bfcache 恢复）时同步首页状态。
      window.addEventListener('pageshow', (e) => {
        if (e.persisted) refreshLobby(true);
      });
    }
  };

  window.SiteLobby = {
    getResumeInfo,
    getCardMetaText,
    getBestRecord,
    getAllGameRecords,
    getOverviewStats,
    pickRandomGame,
    get2048Resume,
    getTetrisResume,
    getBlockWorkshopProjectCount,
  };
})();
