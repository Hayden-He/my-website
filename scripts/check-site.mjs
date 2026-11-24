#!/usr/bin/env node
/**
 * 站点结构校验（零依赖）
 * 用法：node scripts/check-site.mjs
 *
 * 目标：在部署前拦住最常见的“加游戏加漏了”问题：
 * - games.js 里有一条，但 games/<id>/index.html 不存在（或反过来）
 * - categoryName 与 categories 里的名称不一致
 * - storageKey 重复 / 前缀不符
 * - 游戏页漏了公共外壳、h1、meta description、更多游戏入口
 * - 分类页漏了 initSitePage('<category>')
 * - 页面重新引入 user-scalable=no / maximum-scale=1
 */
import fs from 'node:fs';
import path from 'node:path';
import { root, siteUrl as SITE_URL, readSiteConfig, sitePages, escapeHtml } from './site-config.mjs';

const errors = [];
const warnings = [];
const checked = [];

function rel(...parts) {
  return path.join(root, ...parts);
}

function read(relativePath) {
  try {
    return fs.readFileSync(rel(relativePath), 'utf8');
  } catch {
    return null;
  }
}

function exists(relativePath) {
  try {
    return fs.statSync(rel(relativePath)).isFile();
  } catch {
    return false;
  }
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function checkFile(relativePath, label) {
  if (!exists(relativePath)) fail(`${label || relativePath} 不存在`);
  else checked.push(relativePath);
}

function checkContains(content, needle, label) {
  if (!content || !content.includes(needle)) fail(`${label} 缺少 ${needle}`);
}

const OG_IMAGE = SITE_URL + '/assets/og-image.jpg';

// 每个可索引页面：canonical + OG/Twitter 必须齐全，且 og:title 为“页面名 · Little Playground”
function checkSeoPage(page, { label, urlPath, ogTitle }) {
  if (!page) return;
  const descriptionMatch = page.match(/<meta name="description" content="([^"]+)"/);
  if (!descriptionMatch) {
    fail(`${label} 缺少 meta description`);
    return;
  }
  const description = descriptionMatch[1];
  const url = SITE_URL + urlPath;

  checkContains(page, `<link rel="canonical" href="${url}"`, label);
  checkContains(page, '<meta property="og:type" content="website"', label);
  checkContains(page, '<meta property="og:site_name" content="' + escapeHtml(config.siteTitle) + '"', label);
  checkContains(page, '<meta property="og:locale" content="zh_CN"', label);
  checkContains(page, '<meta property="og:title" content="' + escapeHtml(ogTitle) + '"', label);
  checkContains(page, `<meta property="og:description" content="${description}"`, label);
  checkContains(page, `<meta property="og:url" content="${url}"`, label);
  checkContains(page, `<meta property="og:image" content="${OG_IMAGE}"`, label);
  checkContains(page, '<meta property="og:image:type" content="image/jpeg"', label);
  checkContains(page, '<meta property="og:image:width" content="1200"', label);
  checkContains(page, '<meta property="og:image:height" content="630"', label);
  const ogAlt = '小游乐场 · Little Playground：' + config.games.length + ' 款即开即玩的小游戏';
  checkContains(page, '<meta property="og:image:alt" content="' + ogAlt + '"', label);
  checkContains(page, '<meta name="twitter:card" content="summary_large_image"', label);
  checkContains(page, '<meta name="twitter:title" content="' + escapeHtml(ogTitle) + '"', label);
  checkContains(page, `<meta name="twitter:description" content="${description}"`, label);
  checkContains(page, `<meta name="twitter:image" content="${OG_IMAGE}"`, label);
  checkContains(page, '<meta name="twitter:image:alt" content="' + ogAlt + '"', label);
}

// ---------- 站点配置 ----------
let config;
try {
  config = readSiteConfig();
} catch (error) {
  console.error('✗ assets/games.js 无法解析：' + error.message);
  process.exit(1);
}

if (!config || typeof config !== 'object') {
  console.error('✗ assets/games.js 没有导出 window.SITE_CONFIG');
  process.exit(1);
}

if (!config.siteTitle || typeof config.siteTitle !== 'string') fail('SITE_CONFIG.siteTitle 缺失');
if (!Array.isArray(config.categories) || config.categories.length === 0) fail('SITE_CONFIG.categories 为空');
if (!Array.isArray(config.games) || config.games.length === 0) fail('SITE_CONFIG.games 为空');

const categories = Array.isArray(config.categories) ? config.categories : [];
const games = Array.isArray(config.games) ? config.games : [];

const categoryIds = new Set();
const categoryById = new Map();
for (const category of categories) {
  if (!category || typeof category !== 'object') {
    fail('categories 中存在空项');
    continue;
  }
  if (!/^[a-z0-9-]+$/.test(category.id || '')) {
    fail('分类 id 不合法：' + (category.id || '(缺少 id)'));
    continue;
  }
  if (categoryIds.has(category.id)) fail(`分类 id 重复：${category.id}`);
  categoryIds.add(category.id);
  categoryById.set(category.id, category);
  if (!category.name) fail(`分类 ${category.id} 缺少 name`);
  const categoryPath = `categories/${category.id}`;
  if (category.url !== '/' + categoryPath) {
    fail(`分类 ${category.id} 的 url 应为 /${categoryPath}`);
  }
  checkFile(categoryPath + '.html', `分类页 ${category.url}`);
  const categoryPage = read(categoryPath + '.html');
  if (categoryPage) {
    checkContains(categoryPage, "initSitePage('" + category.id + "')", `分类页 ${category.url}`);
    checkContains(categoryPage, 'id="games-grid"', `分类页 ${category.url}`);
    checkContains(categoryPage, 'assets/theme.js', `分类页 ${category.url}`);
    checkContains(categoryPage, 'assets/i18n.js', `分类页 ${category.url}`);
    checkContains(categoryPage, '<!-- inline-icons:start -->', `分类页 ${category.url}`);
    checkContains(categoryPage, '<!-- inline-icons:end -->', `分类页 ${category.url}`);
    checkContains(categoryPage, 'assets/style.css', `分类页 ${category.url}`);
    checkContains(categoryPage, 'assets/theme.js', `分类页 ${category.url}`);
    checkContains(categoryPage, 'assets/i18n.js', `分类页 ${category.url}`);
    checkContains(categoryPage, 'site.webmanifest', `分类页 ${category.url}`);
    checkContains(categoryPage, 'assets/icon.svg', `分类页 ${category.url}`);
    checkContains(categoryPage, 'apple-touch-icon.png', `分类页 ${category.url}`);
    checkSeoPage(categoryPage, {
      label: `分类页 ${category.url}`,
      urlPath: category.url,
      ogTitle: category.name + ' · Little Playground',
    });
  }
}

const gameIds = new Set();
const storageKeys = new Set();

for (const game of games) {
  if (!game || typeof game !== 'object') {
    fail('games 中存在空项');
    continue;
  }
  const label = game.id || '(缺少 id)';
  if (!game.id || !/^[a-z0-9-]+$/.test(game.id)) fail(`游戏 id 不合法：${label}`);
  if (gameIds.has(game.id)) fail(`游戏 id 重复：${game.id}`);
  gameIds.add(game.id);

  if (!game.title) fail(`游戏 ${label} 缺少 title`);
  if (!game.icon) fail(`游戏 ${label} 缺少 icon`);
  if (game.preview !== undefined) {
    if (typeof game.preview !== 'string' || !/^\/assets\/previews\/[a-z0-9-]+\.webp$/.test(game.preview)) {
      fail(`游戏 ${label} 的预览图应位于 /assets/previews/，格式为 WebP`);
    } else {
      checkFile(game.preview.slice(1), `游戏 ${label} 的预览图`);
    }
  }
  if (!game.description || game.description.length < 8) fail(`游戏 ${label} 的 description 太短`);

  const category = categoryById.get(game.category);
  if (!category) fail(`游戏 ${label} 的 category 不存在：${game.category}`);
  else if (game.categoryName !== category.name) {
    fail(`游戏 ${label} 的 categoryName（${game.categoryName}）与分类名（${category.name}）不一致`);
  }

  const expectedUrl = `/games/${game.id}/`;
  if (game.url !== expectedUrl) fail(`游戏 ${label} 的 url 应为 ${expectedUrl}，实际为 ${game.url}`);

  const gameBestKeys = new Set();
  if (game.storageKey !== undefined) {
    if (typeof game.storageKey !== 'string' || !game.storageKey.startsWith('game_best_')) {
      fail(`游戏 ${label} 的 storageKey 应以 game_best_ 开头`);
    } else {
      if (storageKeys.has(game.storageKey)) fail(`storageKey 重复：${game.storageKey}`);
      storageKeys.add(game.storageKey);
      gameBestKeys.add(game.storageKey);
    }
  }

  if (game.modeKey !== undefined) {
    if (typeof game.modeKey !== 'string' || !/^game_(mode|save)_/.test(game.modeKey)) {
      fail(`游戏 ${label} 的 modeKey 格式不合法：${game.modeKey}`);
    }
  }

  if (game.records !== undefined) {
    if (!Array.isArray(game.records) || game.records.length === 0) {
      fail(`游戏 ${label} 的 records 应为非空数组`);
    } else {
      const seenRecordKeys = new Set();
      for (const record of game.records) {
        if (!record || typeof record !== 'object') {
          fail(`游戏 ${label} 的 records 存在空项`);
          continue;
        }
        if (!record.mode || typeof record.mode !== 'string') fail(`游戏 ${label} 的 records 项缺少 mode`);
        if (typeof record.key !== 'string' || !record.key.startsWith('game_best_')) {
          fail(`游戏 ${label} 的 records key 应以 game_best_ 开头：${record.key}`);
        } else {
          if (seenRecordKeys.has(record.key)) fail(`游戏 ${label} 的 records key 重复：${record.key}`);
          seenRecordKeys.add(record.key);
          if (!gameBestKeys.has(record.key) && storageKeys.has(record.key)) {
            fail(`游戏 ${label} 的 records key 与其他游戏冲突：${record.key}`);
          }
          storageKeys.add(record.key);
        }
        if (typeof record.prefix !== 'string' || !record.prefix) {
          fail(`游戏 ${label} 的 records 项缺少 prefix`);
        }
        if (record.format !== undefined && record.format !== 'durationMs') {
          fail(`游戏 ${label} 的 records format 不支持：${record.format}`);
        }
      }
    }
  }

  const pagePath = `games/${game.id}/index.html`;
  if (!exists(pagePath)) {
    fail(`游戏页不存在：${pagePath}`);
    continue;
  }

  const page = read(pagePath);
  if (!page) {
    fail(`游戏页无法读取：${pagePath}`);
    continue;
  }
  checked.push(pagePath);

  checkContains(page, '<html lang="zh-CN">', pagePath);
  checkContains(page, 'name="viewport"', pagePath);
  checkContains(page, '<meta name="description"', pagePath);
  checkContains(page, '<h1', pagePath);
  checkContains(page, 'assets/style.css', pagePath);
  checkContains(page, 'assets/game-shell.css', pagePath);
  checkContains(page, 'assets/site-data.js', pagePath);
  checkContains(page, 'assets/theme.js', pagePath);
  checkContains(page, 'assets/i18n.js', pagePath);
  checkContains(page, '<!-- inline-icons:start -->', pagePath);
  checkContains(page, '<!-- inline-icons:end -->', pagePath);
  checkContains(page, 'assets/style.css', pagePath);
  checkContains(page, 'assets/theme.js', pagePath);
  checkContains(page, 'assets/i18n.js', pagePath);
  checkContains(page, '<meta name="theme-color"', pagePath);
  const headEnd = page.indexOf('</head>');
  const headHtml = headEnd >= 0 ? page.slice(0, headEnd) : '';
  for (const blocked of [
    'assets/site-data.js',
    'assets/i18n.js',
    'assets/games.js',
    'assets/game-kit.js',
    'assets/game-rules.js',
    'assets/game-art.js',
  ]) {
    if (headHtml.includes(blocked)) fail(`${pagePath} 的 <head> 不应同步加载 ${blocked}，请放到 <body> 底部`);
  }
  checkContains(page, 'game-' + game.icon, pagePath);
  if (game.id === 'snake' || game.id === 'basketball') {
    checkContains(page, 'role="img"', pagePath);
    checkContains(page, 'assets/game-art.js', pagePath);
  }
  checkSeoPage(page, {
    label: pagePath,
    urlPath: game.url,
    ogTitle: game.title + ' · Little Playground',
  });
  checkContains(page, 'site.webmanifest', pagePath);
  checkContains(page, 'assets/icon.svg', pagePath);
  checkContains(page, 'apple-touch-icon.png', pagePath);
  checkContains(page, 'data-theme-toggle', pagePath);
  checkContains(page, 'data-lang-toggle', pagePath);
  if (category) checkContains(page, `href="${category.url}"`, pagePath);
  checkContains(page, 'role="status"', pagePath);
  checkContains(page, 'aria-live="polite"', pagePath);
  checkContains(page, 'assets/games.js', pagePath);
  checkContains(page, 'assets/game-kit.js', pagePath);
  checkContains(page, 'id="more-games"', pagePath);
  checkContains(page, 'GameKit.mountMoreGames(', pagePath);
  if (game.title) checkContains(page, escapeHtml(game.title), pagePath);
  if (page.includes('user-scalable=no') || page.includes('maximum-scale=1')) {
    fail(`${pagePath} 重新引入了禁止缩放的 viewport 设置`);
  }
}

// 反向检查：games/ 下除 _template 之外，每个目录都应该在配置里
try {
  const dirs = fs.readdirSync(rel('games'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_template');
  for (const dir of dirs) {
    if (!gameIds.has(dir.name)) warn(`games/${dir.name}/ 存在，但 SITE_CONFIG.games 里没有对应条目`);
  }
} catch {
  fail('games/ 目录不存在');
}

// ---------- 首页 / 404 / 公共资源 ----------
checkContains(read('index.html'), "initSitePage('all')", 'index.html');
checkContains(read('index.html'), 'id="games-grid"', 'index.html');
checkContains(read('index.html'), 'assets/theme.js', 'index.html');
checkContains(read('index.html'), 'assets/i18n.js', 'index.html');
checkContains(read('index.html'), '<!-- inline-icons:start -->', 'index.html');
checkContains(read('index.html'), '<!-- inline-icons:end -->', 'index.html');
checkSeoPage(read('index.html'), {
  label: 'index.html',
  urlPath: '/',
  ogTitle: config.siteTitle + ' · Little Playground',
});
checkContains(read('index.html'), 'site.webmanifest', 'index.html');
checkContains(read('index.html'), 'assets/icon.svg', 'index.html');
checkContains(read('index.html'), 'apple-touch-icon.png', 'index.html');
checkContains(read('404.html'), 'assets/theme.js', '404.html');
checkContains(read('404.html'), 'assets/i18n.js', '404.html');
checkContains(read('404.html'), '<!-- inline-icons:start -->', '404.html');
checkContains(read('404.html'), '<!-- inline-icons:end -->', '404.html');
checkContains(read('404.html'), 'site.webmanifest', '404.html');
checkContains(read('404.html'), 'assets/icon.svg', '404.html');
checkContains(read('404.html'), 'apple-touch-icon.png', '404.html');
checkFile('404.html', '404.html');
const notFoundPage = read('404.html');
checkContains(notFoundPage, 'name="robots" content="noindex"', '404.html');
if (notFoundPage && notFoundPage.includes('rel="canonical"')) {
  fail('404.html 不应有 canonical（noindex 页面）');
}
if (notFoundPage && notFoundPage.includes('property="og:url"')) {
  fail('404.html 不应有 OG meta（noindex 页面）');
}

// ---------- SEO：sitemap / robots / OG image ----------
checkFile('assets/og-image.jpg', 'assets/og-image.jpg');
checkFile('sitemap.xml', 'sitemap.xml');
checkFile('robots.txt', 'robots.txt');
checkContains(read('_headers'), '/assets/v/*', '_headers');
checkContains(read('_headers'), 'max-age=31536000, immutable', '_headers');
const sitemap = read('sitemap.xml') || '';
const robots = read('robots.txt') || '';
const indexablePaths = [
  '/',
  ...categories.map((category) => category.url).filter(Boolean),
  ...games.map((game) => game.url).filter(Boolean),
];
for (const urlPath of indexablePaths) {
  checkContains(sitemap, `<loc>${SITE_URL}${urlPath}</loc>`, 'sitemap.xml');
}
const sitemapLocs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (sitemapLocs.length !== indexablePaths.length) {
  fail(`sitemap.xml 的 URL 数量应为 ${indexablePaths.length}，实际为 ${sitemapLocs.length}`);
}
if (sitemapLocs.includes(SITE_URL + '/404.html')) fail('sitemap.xml 不应包含 noindex 的 404 页面');
for (const loc of sitemapLocs) {
  if (!/^https:\/\/my-website-all\.pages\.dev\//.test(loc)) fail(`sitemap.xml 使用了非约定域名：${loc}`);
}
if (!/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap)) {
  fail('sitemap.xml 缺少 YYYY-MM-DD 格式的 lastmod');
}
checkContains(robots, 'Allow: /', 'robots.txt');
checkContains(robots, `Sitemap: ${SITE_URL}/sitemap.xml`, 'robots.txt');

for (const asset of [
  'assets/style.css',
  'assets/game-shell.css',
  'assets/site-data.js',
  'assets/theme.js',
  'assets/i18n.js',
  'assets/i18n-en.js',
  'assets/games.js',
  'assets/app.js',
  'assets/game-kit.js',
  'assets/canvas-polyfill.js',
  'assets/icons.svg',
  'assets/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'site.webmanifest',
]) {
  checkFile(asset, asset);
}

// ---------- 旧版 ?v= 参数清理与模板基线校验 ----------
for (const { file: relative } of sitePages({ ...config, games, categories })) {
  const html = read(relative) || '';
  if (/\?v=\d+/.test(html)) {
    fail(`${relative} 仍残留 ?v= 旧版资源查询参数`);
  }
}

// ---------- 图标与 manifest ----------
const iconSprite = read('assets/icons.svg') || '';
for (const game of games) {
  checkContains(iconSprite, 'id="game-' + game.icon + '"', 'assets/icons.svg');
}
const manifestSource = read('site.webmanifest');
if (manifestSource) {
  try {
    const manifest = JSON.parse(manifestSource);
    if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) fail('site.webmanifest 缺少 192/512 图标');
    if (manifest.display !== 'standalone') fail('site.webmanifest display 不是 standalone');
    if (!manifest.start_url) fail('site.webmanifest 缺少 start_url');
  } catch (error) {
    fail('site.webmanifest 不是合法 JSON：' + error.message);
  }
}

// ---------- 模板 ----------
const templatePath = 'games/_template/index.html';
if (!exists(templatePath)) {
  warn('games/_template/index.html 不存在，后续新增游戏没有模板可复制');
} else {
  const template = read(templatePath);
  checkContains(template, '<meta name="theme-color"', templatePath);
  checkContains(template, 'assets/game-shell.css', templatePath);
  checkContains(template, 'assets/theme.js', templatePath);
  checkContains(template, 'data-theme-toggle', templatePath);
  checkContains(template, 'assets/game-kit.js', templatePath);
  checkContains(template, 'id="more-games"', templatePath);
  checkContains(template, '<h1', templatePath);
  if (/\?v=\d+/.test(template || '')) fail(`${templatePath} 仍残留 ?v= 旧版资源查询参数`);
  const tplHead = template ? template.slice(0, template.indexOf('</head>')) : '';
  for (const blocked of ['assets/site-data.js', 'assets/i18n.js', 'assets/games.js', 'assets/game-kit.js']) {
    if (tplHead.includes(blocked)) fail(`${templatePath} 的 <head> 不应同步加载 ${blocked}，请放到 <body> 底部`);
  }
}

// ---------- 输出 ----------
const summary = [
  `站点：${config.siteTitle || '(未命名)'}`,
  `分类：${categories.length} 个`,
  `游戏：${games.length} 个`,
  `已检查文件：${checked.length} 个`,
];

console.log('站点结构校验');
for (const line of summary) console.log('  ' + line);
for (const line of warnings) console.log('  ! ' + line);

if (errors.length > 0) {
  console.error(`\n✗ 发现 ${errors.length} 个问题：`);
  for (const line of errors) console.error('  - ' + line);
  process.exit(1);
}

console.log('\n✓ 全部通过');
