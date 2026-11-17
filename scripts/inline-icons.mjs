#!/usr/bin/env node
/**
 * 将 assets/icons.svg 的 symbols 内联进页面，避免跨文件 <use>（Safari/微信 X5 兼容与请求开销）。
 * 用法：node scripts/inline-icons.mjs
 * 源文件仍是 assets/icons.svg；改图标后运行一次，再按需 bump ?v= 版本号。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'assets', 'icons.svg'), 'utf8');
const inner = source.slice(source.indexOf('>') + 1, source.lastIndexOf('</svg>')).trim();
const sprite = [
  '<svg xmlns="http://www.w3.org/2000/svg" class="icon-sprite" aria-hidden="true" focusable="false">',
  inner,
  '</svg>',
].join('\n');

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
for (const relative of pages) {
  const file = path.join(root, relative);
  const html = fs.readFileSync(file, 'utf8');
  const next = html.replace(
    /<!-- inline-icons:start -->[\s\S]*?<!-- inline-icons:end -->/,
    '<!-- inline-icons:start -->\n' + sprite + '\n<!-- inline-icons:end -->'
  );
  if (next === html) {
    console.error('✗ 未找到 inline-icons 标记：' + relative);
    process.exitCode = 1;
    continue;
  }
  fs.writeFileSync(file, next);
  console.log('✓ ' + relative);
}
