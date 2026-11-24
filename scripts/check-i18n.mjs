#!/usr/bin/env node
/**
 * 中英文案覆盖校验（零依赖）
 * 用法：node scripts/check-i18n.mjs
 *
 * 约定：中文原文就是 key，英文词典在 assets/i18n-en.js 的 window.I18N_EN 对象里。
 * 本脚本会检查：
 * - 页面静态 data-i18n / data-i18n-attr 的 key
 * - 页面 <title> / meta description（运行时按原文查词典）
 * - JS 里 I18N.t('...') / t('...') 的字面量 key
 * - games.js 里会渲染到卡片上的游戏名/简介/分类/最高分前后缀
 * - 以上 key 是否都在英文词典里
 *
 * 说明：通过变量或三元表达式传入的 key（如 t(step.title)）不会被静态扫描到，
 * 因此词典里“未被扫描到”的条目只作为提示，不算失败。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { root, readSiteConfig, sitePages, previewPages, pageModuleDirectory, pageModuleFiles } from './site-config.mjs';

function read(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    return '';
  }
}

function loadEnglishDictionary() {
  const source = read('assets/i18n-en.js');
  if (!source) {
    console.error('✗ assets/i18n-en.js 不存在');
    process.exit(1);
  }
  const sandbox = {
    window: {},
  };
  try {
    vm.runInNewContext(source, sandbox, { filename: 'assets/i18n-en.js' });
  } catch (error) {
    console.error('✗ assets/i18n-en.js 无法解析：' + error.message);
    process.exit(1);
  }
  const dictionary = sandbox.window.I18N_EN;
  if (!dictionary || typeof dictionary !== 'object') {
    console.error('✗ assets/i18n-en.js 没有导出 window.I18N_EN');
    process.exit(1);
  }
  return dictionary;
}

const config = readSiteConfig();
const pageFiles = [...sitePages(config), ...previewPages(process.argv.slice(2))].map(({ file }) => file);

const sharedScripts = fs.readdirSync(path.join(root, 'assets'))
  .filter((name) => name.endsWith('.js') && name !== 'i18n.js' && name !== 'i18n-en.js')
  .map((name) => 'assets/' + name);
const gameScripts = pageFiles.flatMap((file) => {
  const vendor = pageModuleDirectory(file) + '/vendor/';
  return pageModuleFiles(file).filter((module) => /\.m?js$/.test(module) && !module.startsWith(vendor));
});

const english = loadEnglishDictionary();
const englishKeys = new Set(Object.keys(english));

const used = [];
const seen = new Set();
function addKey(key) {
  if (!key || seen.has(key)) return;
  seen.add(key);
  used.push(key);
}

function addHtmlKey(key) {
  addKey(key.replace(/&(amp|quot|lt|gt);/g, (_, entity) =>
    ({ amp: '&', quot: '"', lt: '<', gt: '>' })[entity]));
}

for (const file of [...pageFiles, ...sharedScripts, ...gameScripts]) {
  const source = read(file);
  if (!source) continue;

  for (const match of source.matchAll(/data-i18n="([^"]+)"/g)) addHtmlKey(match[1]);

  for (const match of source.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    match[1].split(',').forEach((pair) => {
      const index = pair.indexOf(':');
      if (index >= 0) addHtmlKey(pair.slice(index + 1).trim());
    });
  }

  for (const match of source.matchAll(/<title>([^<]+)<\/title>/g)) addHtmlKey(match[1]);
  for (const match of source.matchAll(/<meta name="description" content="([^"]+)"/g)) addHtmlKey(match[1]);

  for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) addKey(match[1]);
}

// games.js 会通过 I18N.t(...) 渲染到卡片上的文案
addKey(config.siteTitle);
for (const category of config.categories || []) {
  addKey(category.name);
  if (category.description) addKey(category.description);
}
for (const game of config.games || []) {
  addKey(game.title);
  addKey(game.description);
  addKey(game.categoryName);
  if (game.bestPrefix) addKey(game.bestPrefix);
  if (game.bestSuffix) addKey(game.bestSuffix);
  for (const record of game.records || []) {
    if (record.prefix) addKey(record.prefix);
    if (record.suffix) addKey(record.suffix);
  }
}

const missing = used.filter((key) => !englishKeys.has(key));
const extra = [...englishKeys].filter((key) => !seen.has(key));

if (missing.length) {
  console.error(`✗ 有 ${missing.length} 条文案缺少英文：`);
  missing.forEach((key) => console.error('  - ' + JSON.stringify(key)));
  console.error('\n请在 assets/i18n-en.js 的 window.I18N_EN 对象里补上对应英文。');
  process.exit(1);
}

console.log(`✓ 英文覆盖完整：检查 ${pageFiles.length} 个页面、${used.length} 条文案`);
console.log(`  词典共 ${englishKeys.size} 条${extra.length ? `，另有 ${extra.length} 条通过变量/条件使用` : ''}`);
