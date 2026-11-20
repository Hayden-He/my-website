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

const files = ['_headers', 'robots.txt', 'sitemap.xml', 'site.webmanifest', ...assetFiles('assets').sort()];
const version = createHash('sha256');
// 构建脚本会改变产物（静态外壳），也要计入版本，否则「检查更新」发现不了。
version.update(fs.readFileSync(path.join(root, 'scripts/build-site.mjs'))).update('\0');
const content = new Map();
for (const file of [...files, ...pages]) {
  const bytes = fs.readFileSync(path.join(root, file));
  content.set(file, bytes);
  version.update(file).update('\0').update(bytes).update('\0');
}
const modulePaths = new Map();
for (const page of pages) {
  const modules = pageModuleFiles(page).map((file) => [file, fs.readFileSync(path.join(root, file))]);
  if (!modules.length) continue;
  const hash = createHash('sha256');
  for (const [file, bytes] of modules) {
    hash.update(file).update('\0').update(bytes).update('\0');
    version.update(file).update('\0').update(bytes).update('\0');
  }
  // 相对 import 与 CSS 资源路径需保留在同一版本目录内。
  const directory = 'assets/v/' + hash.digest('hex').slice(0, 16);
  modulePaths.set(page, directory + '/' + pageModuleDirectory(page));
  for (const [file, bytes] of modules) content.set(directory + '/' + file, bytes);
}
const buildId = version.digest('hex').slice(0, 16);

function write(relative, bytes) {
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}

function versionedAsset(file) {
  const original = file.slice(1);
  const bytes = content.get(original);
  if (!bytes) throw new Error('资源不存在：' + file);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const relative = path.posix.join('assets', 'v', hash, original.slice('assets/'.length));
  if (!content.has(relative)) content.set(relative, bytes);
  return '/' + relative;
}

// ---- 构建时静态输出顶栏、游戏卡片与页脚（仅写入 dist，源码保持不变） ----
// 结构须与 assets/app.js 在浏览器里生成的 DOM 一致；浏览器端只补充本地数据，不重建图片。
const esc = (value) => String(value).replace(/[&"<>]/g, (ch) =>
  ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[ch]);

const EAGER_PREVIEW_COUNT = 4;
const PLACEHOLDERS = {
  header: '<header id="site-header" class="site-header"></header>',
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

function footerHtml(activeKey) {
  return '<div class="container"><div class="site-credit">© ' + new Date().getFullYear() +
    ' <span class="credit-site">' + esc(config.siteTitle) + '</span> · by ' +
    '<a href="https://github.com/Hayden-He/my-website" target="_blank" rel="noopener noreferrer">Hayden-He</a></div>' +
    '<div class="site-tagline">无需下载 · 电脑与手机均可畅玩</div>' +
    (activeKey === 'all'
      ? '<button type="button" class="copy-link-btn" data-copy-link="/" data-i18n="复制网站链接">复制网站链接</button>'
      : '') +
    '</div><div class="container data-clear-wrap">' +
    '<button type="button" class="data-clear-btn">清除本地数据</button>' +
    '<button type="button" class="update-check-btn">检查更新</button></div>';
}

function replaceOnce(file, html, placeholder, replacement) {
  if (!html.includes(placeholder)) throw new Error(file + '：缺少静态输出占位 ' + placeholder);
  return html.replace(placeholder, () => replacement);
}

function injectShell(file, html) {
  const call = html.match(/initSitePage\('([^']*)'\)/);
  if (!call) return html; // 游戏页等不使用公共外壳渲染
  const activeKey = call[1];
  html = replaceOnce(file, html, PLACEHOLDERS.header, '<header id="site-header" class="site-header">' + headerHtml(activeKey) + '</header>');
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
  const call = html.match(/initSitePage\('([^']*)'\)/);
  if (!call) return;
  const activeKey = call[1];
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
  if (problems.length) throw new Error(file + '：静态外壳校验失败：' + problems.join('；'));
}

for (const file of pages) {
  let html = content.get(file).toString();
  html = injectShell(file, html);
  verifyShell(file, html);
  const legacyVersion = html.match(/\/assets\/style\.css\?v=(\d{11})/)?.[1];
  html = html.replace(/\b(src|href)="(\/assets\/[^"?]+)(?:\?v=\d+)?"(?=\s|>)/g,
    (_, attribute, asset) => attribute + '="' + versionedAsset(asset) + '"');
  html = html.replace(/\b(src|href)="\.\/modules\/([^"?#]+)([?#][^"]*)?"(?=\s|>)/g,
    (_, attribute, fileName, suffix = '') => {
      const relative = modulePaths.get(file) + '/' + fileName;
      if (!content.has(relative)) throw new Error(file + '：模块资源不存在 ./modules/' + fileName);
      return attribute + '="/' + relative + suffix + '"';
    });
  html = html.replace('</head>', [
    '  <meta name="site-build" content="' + buildId + '" />',
    '  <!-- 旧版检查更新脚本兼容：/assets/style.css?v=' + legacyVersion + ' -->',
    '</head>',
  ].join('\n'));
  content.set(file, html);
}

fs.rmSync(output, { recursive: true, force: true });
for (const [file, bytes] of content) write(file, bytes);

console.log('已生成 dist（' + config.categories.length + ' 个分类、' + config.games.length + ' 个游戏，版本 ' + buildId + '）');
