import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root, readSiteConfig, sitePages, previewPages, assetFiles, pageModuleDirectory, pageModuleFiles } from './site-config.mjs';

const output = path.join(root, 'dist');
const args = process.argv.slice(2);
const previews = previewPages(args);

execFileSync(process.execPath, [path.join(root, 'scripts/check-site.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(root, 'scripts/check-i18n.mjs'), ...args], { stdio: 'inherit' });

const config = readSiteConfig();
const pages = [...sitePages(config), ...previews].map(({ file }) => file);

const UNVERSIONED_ROOT_FILES = new Set(['_headers', 'robots.txt', 'sitemap.xml', 'site.webmanifest']);
const FIXED_ASSET_FILES = new Set([
  'assets/og-image.jpg',
  'assets/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
]);
const files = [...UNVERSIONED_ROOT_FILES, ...assetFiles('assets').sort()];
const version = createHash('sha256');
// 构建脚本会改变产物（静态外壳），也要计入版本，否则「检查更新」发现不了。
version.update(fs.readFileSync(path.join(root, 'scripts/build-site.mjs'))).update('\0');
const sourceAssets = new Map();
const content = new Map();
for (const file of [...files, ...pages]) {
  const bytes = fs.readFileSync(path.join(root, file));
  if (file.startsWith('assets/')) sourceAssets.set(file, bytes);
  if (!file.startsWith('assets/') || FIXED_ASSET_FILES.has(file)) content.set(file, bytes);
  version.update(file).update('\0').update(bytes).update('\0');
}
const modulePaths = new Map();
const pageModuleTexts = new Map();
for (const page of pages) {
  const modules = pageModuleFiles(page).map((file) => [file, fs.readFileSync(path.join(root, file))]);
  if (!modules.length) continue;
  const moduleDir = pageModuleDirectory(page);
  const vendorPrefix = moduleDir + '/vendor/';
  const vendorFiles = [];
  const appFiles = [];
  for (const [file, bytes] of modules) {
    version.update(file).update('\0').update(bytes).update('\0');
    if (file.startsWith(vendorPrefix)) vendorFiles.push([file, bytes]);
    else appFiles.push([file, bytes]);
  }
  pageModuleTexts.set(
    page,
    appFiles.filter(([file]) => /\.(?:m?js|css|html)$/i.test(file)).map(([, bytes]) => bytes.toString('utf8'))
  );

  let vendorDir = null;
  let vendorHash = null;
  const vendorSet = new Set(vendorFiles.map(([file]) => file));
  if (vendorFiles.length) {
    const hash = createHash('sha256');
    for (const [file, bytes] of vendorFiles) hash.update(file).update('\0').update(bytes).update('\0');
    vendorHash = hash.digest('hex').slice(0, 16);
    const directory = 'assets/v/' + vendorHash;
    vendorDir = directory + '/' + moduleDir + '/vendor';
    for (const [file, bytes] of vendorFiles) content.set(directory + '/' + file, bytes);
  }

  let appDir = null;
  if (appFiles.length) {
    const rewritten = appFiles.map(([file, bytes]) => {
      if (!vendorHash || !/\.m?js$/.test(file)) return [file, bytes];
      const text = bytes.toString('utf8').replace(/(['"])((?:\.\.?\/)+vendor\/[^'"]+)\1/g, (match, quote, spec) => {
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
        if (!resolved.startsWith(vendorPrefix)) return match;
        if (!vendorSet.has(resolved)) throw new Error(file + '：第三方模块不存在 ' + spec);
        return quote + '/assets/v/' + vendorHash + '/' + resolved + quote;
      });
      return [file, Buffer.from(text, 'utf8')];
    });
    const hash = createHash('sha256');
    for (const [file, bytes] of rewritten) hash.update(file).update('\0').update(bytes).update('\0');
    // 相对 import 与 CSS 资源路径需保留在同一版本目录内；vendor 目录单独计算指纹。
    const directory = 'assets/v/' + hash.digest('hex').slice(0, 16);
    appDir = directory + '/' + moduleDir;
    for (const [file, bytes] of rewritten) content.set(directory + '/' + file, bytes);
  }

  modulePaths.set(page, { appDir, vendorDir });
}
const buildId = version.digest('hex').slice(0, 16);

function write(relative, bytes) {
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}

function versionedAsset(file) {
  const original = file.slice(1);
  const bytes = sourceAssets.get(original);
  if (!bytes) throw new Error('资源不存在：' + file);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const relative = path.posix.join('assets', 'v', hash, original.slice('assets/'.length));
  if (!content.has(relative)) content.set(relative, bytes);
  return '/' + relative;
}

const gamesConfigBytes = sourceAssets.get('assets/games.js');
if (gamesConfigBytes) {
  const rewrittenGamesConfig = gamesConfigBytes.toString('utf8').replace(
    /(['"])(\/assets\/previews\/[a-z0-9-]+\.webp)\1/g,
    (_, quote, assetPath) => quote + versionedAsset(assetPath) + quote
  );
  sourceAssets.set('assets/games.js', Buffer.from(rewrittenGamesConfig, 'utf8'));
}

// ---- 构建时静态输出顶栏、操作区、游戏卡片与页脚（仅写入 dist，源码保持不变） ----
// 结构须与 assets/app.js 在浏览器里生成的 DOM 一致；浏览器端只补充本地数据，不重建图片。
const esc = (value) => String(value).replace(/[&"<>]/g, (ch) =>
  ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[ch]);

const EAGER_PREVIEW_COUNT = 4;
const PLACEHOLDERS = {
  header: '<header id="site-header" class="site-header"></header>',
  heroActions: '<div id="hero-actions" class="hero-actions"></div>',
  footer: '<footer id="site-footer" class="site-footer"></footer>',
  count: '<span id="games-count" class="section-count"></span>',
  grid: '<div id="games-grid" class="games-grid"></div>',
};

function iconHtml(name, className, viewBox) {
  return '<svg class="' + className + '" viewBox="' + viewBox +
    '" aria-hidden="true" focusable="false"><use href="#' + name + '"></use></svg>';
}

function headerHtml(activeKey) {
  const { siteTitle, categories } = config;
  const links = [
    '<a class="nav-link' + (activeKey === 'all' ? ' active' : '') + '" href="/"' +
      (activeKey === 'all' ? ' aria-current="page"' : '') + '>全部游戏</a>',
    ...categories.map((cat) =>
      '<a class="nav-link' + (activeKey === cat.id ? ' active' : '') + '" href="' + esc(cat.url) + '"' +
      (activeKey === cat.id ? ' aria-current="page"' : '') + '>' + esc(cat.name) + '</a>'),
  ];
  return '<div class="container header-inner">' +
    '<a class="brand" href="/"><span class="brand-badge">' + iconHtml('brand', 'brand-mark', '0 0 40 40') +
    '</span><span class="brand-name">' + esc(siteTitle) + '</span></a>' +
    '<nav class="nav-links" aria-label="主导航">' + links.join('') +
    '<button class="nav-sound-btn" type="button" aria-pressed="true" aria-label="音效已开启，点击关闭" title="关闭音效">' +
    iconHtml('sound-on', 'sound-ico', '0 0 24 24') + '<span class="sound-label">音效开</span></button>' +
    '<button class="nav-theme-btn" type="button" data-theme-toggle aria-label="主题：跟随系统" title="主题：跟随系统">' +
    iconHtml('theme-system', 'theme-ico', '0 0 24 24') + '<span class="theme-label">自动</span></button>' +
    '<button class="nav-lang-btn" type="button" data-lang-toggle aria-label="切换到英文" title="切换到英文">EN</button>' +
    '</nav></div>';
}

function cardHtml(game, index) {
  const action = '开始游戏 →';
  let preview;
  if (game.preview) {
    preview = '<img class="game-preview-image" src="' + esc(game.preview) + '" width="720" height="280" alt="" decoding="async"' +
      (index < EAGER_PREVIEW_COUNT ? '' : ' loading="lazy"') +
      (index === 0 ? ' fetchpriority="high"' : '') + ' draggable="false">';
  } else {
    preview = iconHtml('game-' + game.icon, 'preview-lead', '0 0 32 32');
  }
  return '<article class="game-card ' + esc(game.category) + '">' +
    '<div class="game-preview" aria-hidden="true">' + preview + '</div>' +
    '<div class="game-card-top"><h3 class="game-title">' + esc(game.title) + '</h3>' +
    '<span class="game-category-pill ' + esc(game.category) + '">' + esc(game.categoryName) + '</span></div>' +
    '<p class="game-desc">' + esc(game.description) + '</p>' +
    '<a class="play-btn" href="' + esc(game.url) + '" aria-label="' + esc(game.title + '：' + action) + '">' + action + '</a>' +
    '</article>';
}

function heroActionsHtml() {
  return '<button class="hero-action-btn primary" type="button" id="random-game-btn" ' +
    'title="从当前列表中随机挑一款游戏开始" aria-label="从当前列表中随机挑一款游戏开始">随机来一局</button>' +
    '<button class="hero-action-btn" type="button" id="records-overview-btn">' +
    '<span>个人战绩</span><span class="hero-action-badge" hidden></span></button>';
}

function footerHtml(activeKey) {
  return '<div class="container"><div class="site-credit">© ' + new Date().getFullYear() +
    ' <span class="credit-site">' + esc(config.siteTitle) + '</span> · by ' +
    '<a href="https://github.com/Hayden-He/my-website" target="_blank" rel="noopener noreferrer">Hayden-He</a></div>' +
    '<div class="site-tagline">无需下载 · 电脑与手机均可畅玩</div>' +
    (activeKey === 'all'
      ? '<button type="button" class="copy-link-btn" data-copy-link="/" data-i18n="复制网站链接">复制网站链接</button>'
      : '') +
    '</div><div class="container data-clear-wrap">' +
    '<button type="button" class="data-backup-btn">备份 / 恢复</button>' +
    '<button type="button" class="data-clear-btn">清除本地数据</button>' +
    '<button type="button" class="update-check-btn">检查更新</button></div>';
}

function replaceOnce(file, html, placeholder, replacement) {
  if (!html.includes(placeholder)) throw new Error(file + '：缺少静态输出占位 ' + placeholder);
  return html.replace(placeholder, () => replacement);
}

function readSitePageKey(html) {
  const attr = html.match(/<body[^>]*\bdata-site-page="([^"]*)"/);
  if (attr) return attr[1];
  const call = html.match(/initSitePage\('([^']*)'\)/);
  return call ? call[1] : null;
}

function injectShell(file, html) {
  const activeKey = readSitePageKey(html);
  if (activeKey === null) return html; // 游戏页等不使用公共外壳渲染
  html = replaceOnce(file, html, PLACEHOLDERS.header, '<header id="site-header" class="site-header">' + headerHtml(activeKey) + '</header>');
  if (html.includes(PLACEHOLDERS.heroActions)) {
    html = replaceOnce(file, html, PLACEHOLDERS.heroActions,
      '<div id="hero-actions" class="hero-actions">' + heroActionsHtml() + '</div>');
  }
  html = replaceOnce(file, html, PLACEHOLDERS.footer, '<footer id="site-footer" class="site-footer">' + footerHtml(activeKey) + '</footer>');
  if (html.includes(PLACEHOLDERS.grid)) {
    const games = config.games.filter((g) => activeKey === 'all' || g.category === activeKey);
    const classes = ['games-grid'];
    if (games.length === 2 || games.length === 4) classes.push('cols-2');
    if (games.length === 8) classes.push('cols-4');
    html = replaceOnce(file, html, PLACEHOLDERS.count,
      '<span id="games-count" class="section-count">共 ' + games.length + ' 款</span>');
    html = replaceOnce(file, html, PLACEHOLDERS.grid,
      '<div id="games-grid" class="' + classes.join(' ') + '">' + games.map(cardHtml).join('') + '</div>');
  }
  return html;
}

// 构建后校验：静态卡片与 games.js 一致，且不存在遗留空占位。
function verifyShell(file, html) {
  const activeKey = readSitePageKey(html);
  if (activeKey === null) return;
  const problems = [];
  for (const placeholder of Object.values(PLACEHOLDERS)) {
    if (html.includes(placeholder)) problems.push('仍有空占位 ' + placeholder);
  }
  if (html.includes('id="games-grid"')) {
    const expected = config.games.filter((g) => activeKey === 'all' || g.category === activeKey);
    const grid = html.slice(html.indexOf('id="games-grid"'), html.indexOf('</section>', html.indexOf('id="games-grid"')));
    const hrefs = [...grid.matchAll(/<a class="play-btn" href="([^"]+)"/g)].map((m) => m[1]);
    if (hrefs.join('|') !== expected.map((g) => g.url).join('|')) problems.push('卡片链接与 games.js 不一致');
    if ((grid.match(/<article /g) || []).length !== expected.length) problems.push('卡片数量与 games.js 不一致');
    const shown = html.match(/id="games-count" class="section-count">共 (\d+) 款/)?.[1];
    if (Number(shown) !== expected.length) problems.push('游戏计数与 games.js 不一致');
  }
  const navLinks = (html.match(/<a class="nav-link/g) || []).length;
  if (navLinks !== config.categories.length + 1) problems.push('顶栏导航数量不一致');
  if (!html.includes('data-theme-toggle')) problems.push('缺少主题切换按钮');
  if (html.includes('id="hero-actions"')) {
    if (!html.includes('id="random-game-btn"') || !html.includes('id="records-overview-btn"')) {
      problems.push('缺少英雄区操作按钮静态输出');
    }
  }
  if (problems.length) throw new Error(file + '：静态外壳校验失败：' + problems.join('；'));
}

const iconSymbols = [...fs.readFileSync(path.join(root, 'assets/icons.svg'), 'utf8')
  .matchAll(/<symbol\s+id="([^"]+)"[\s\S]*?<\/symbol>/g)]
  .map((match) => ({ id: match[1], markup: match[0] }));
if (!iconSymbols.length) throw new Error('assets/icons.svg 中未找到 <symbol> 定义');

function collectPageIcons(html, moduleTexts) {
  const stripped = html.replace(/<!-- inline-icons:start -->[\s\S]*?<!-- inline-icons:end -->/, '');
  const haystack = stripped + '\n' + (moduleTexts || []).join('\n');
  const needed = new Set();

  if (stripped.includes('data-theme-toggle')) {
    needed.add('theme-system');
    needed.add('theme-light');
    needed.add('theme-dark');
  }
  if (stripped.includes('nav-sound-btn') || haystack.includes('bindSoundButton')) {
    needed.add('sound-on');
    needed.add('sound-off');
  }
  if (readSitePageKey(stripped) !== null || haystack.includes('showTutorial')) {
    needed.add('brand');
  }

  const moreMatch = haystack.match(/data-more-games="([a-z0-9-]+)"/) ||
    haystack.match(/GameKit\.mountMoreGames\(\s*['"]([a-z0-9-]+)['"]/);
  if (moreMatch) {
    const current = config.games.findIndex((g) => g.id === moreMatch[1]);
    if (current >= 0) {
      needed.add('game-' + config.games[current].icon);
      const recommended = config.games.slice(current + 1)
        .concat(config.games.slice(0, Math.max(0, current)))
        .slice(0, 4);
      for (const game of recommended) needed.add('game-' + game.icon);
    }
  }

  if (haystack.includes("'#mem-'") || haystack.includes('"#mem-"')) {
    for (const { id } of iconSymbols) {
      if (id.startsWith('mem-')) needed.add(id);
    }
  }

  for (const { id } of iconSymbols) {
    if (haystack.includes('#' + id) || haystack.includes("'" + id + "'") || haystack.includes('"' + id + '"')) {
      needed.add(id);
    }
  }

  return iconSymbols.filter(({ id }) => needed.has(id));
}

function injectIcons(file, html, moduleTexts) {
  if (!html.includes('<!-- inline-icons:start -->') || !html.includes('<!-- inline-icons:end -->')) {
    throw new Error(file + '：缺少 inline-icons 标记');
  }
  const symbols = collectPageIcons(html, moduleTexts);
  if (!symbols.length) throw new Error(file + '：裁剪后未匹配到任何图标');
  const sprite = [
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon-sprite" aria-hidden="true" focusable="false">',
    ...symbols.map(({ markup }) => '  ' + markup),
    '</svg>',
  ].join('\n');
  const next = html.replace(
    /<!-- inline-icons:start -->[\s\S]*?<!-- inline-icons:end -->/,
    () => '<!-- inline-icons:start -->\n' + sprite + '\n<!-- inline-icons:end -->'
  );
  if (!next.includes('class="icon-sprite"') || !next.includes('<symbol id=')) {
    throw new Error(file + '：图标内联校验失败');
  }
  return next;
}

for (const file of pages) {
  let html = content.get(file).toString();
  html = injectShell(file, html);
  html = injectIcons(file, html, pageModuleTexts.get(file));
  verifyShell(file, html);
  html = html.replace(/\b(src|href)="(\/assets\/[^"?]+)"(?=\s|>)/g,
    (_, attribute, asset) => attribute + '="' + versionedAsset(asset) + '"');
  const enAsset = versionedAsset('/assets/i18n-en.js');
  html = html.replace(
    /<script src="(\/assets\/v\/[0-9a-f]{16}\/(?:theme|i18n)\.js)"><\/script>/g,
    (_, src) => '<script src="' + src + '" data-en-src="' + enAsset + '"></script>'
  );
  html = html.replace(/\b(src|href)="\.\/modules\/([^"?#]+)([?#][^"]*)?"(?=\s|>)/g,
    (_, attribute, fileName, suffix = '') => {
      const entry = modulePaths.get(file);
      const isVendor = fileName.startsWith('vendor/');
      const dir = isVendor ? entry?.vendorDir : entry?.appDir;
      const target = isVendor ? fileName.slice('vendor/'.length) : fileName;
      const relative = dir && (dir + '/' + target);
      if (!relative || !content.has(relative)) throw new Error(file + '：模块资源不存在 ./modules/' + fileName);
      return attribute + '="/' + relative + suffix + '"';
    });
  html = html.replace('</head>', '  <meta name="site-build" content="' + buildId + '" />\n</head>');
  content.set(file, html);
}

content.set('version.json', Buffer.from(JSON.stringify({ build: buildId }) + '\n', 'utf8'));

fs.rmSync(output, { recursive: true, force: true });
for (const [file, bytes] of content) write(file, bytes);

console.log('已生成 dist（' + config.categories.length + ' 个分类、' + config.games.length + ' 个游戏，版本 ' + buildId + '）');
