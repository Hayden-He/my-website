#!/usr/bin/env node
/**
 * 递增 HTML 里的资源版本号（?v=YYYYMMDDNNN），避免同一天多次部署命中旧缓存。
 * 用法：node scripts/bump-assets.mjs
 * 规则：日期变化 -> YYYYMMDD001；同一天 -> 序号 + 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  'index.html',
  'categories/arcade.html',
  'categories/puzzle.html',
  '404.html',
  'games/basketball/index.html',
  'games/snake/index.html',
  'games/2048/index.html',
  'games/minesweeper/index.html',
  'games/memory/index.html',
  'games/slide/index.html',
];

const versions = new Set();
for (const relative of pages) {
  const html = fs.readFileSync(path.join(root, relative), 'utf8');
  for (const match of html.matchAll(/\?v=(\d{11})/g)) versions.add(match[1]);
}
if (versions.size === 0) {
  console.error('✗ 没有找到 ?v=YYYYMMDDNNN');
  process.exit(1);
}
if (versions.size > 1) {
  console.error('✗ 各页面版本号不一致：' + [...versions].join(', '));
  process.exit(1);
}

const current = [...versions][0];
const now = new Date();
const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const next = current.slice(0, 8) === today
  ? today + String(Number(current.slice(8)) + 1).padStart(3, '0')
  : today + '001';

for (const relative of pages) {
  const file = path.join(root, relative);
  const html = fs.readFileSync(file, 'utf8').replaceAll('?v=' + current, '?v=' + next);
  fs.writeFileSync(file, html);
}
console.log(`✓ ${current} -> ${next}（${pages.length} 个页面）`);
