#!/usr/bin/env node
/**
 * 将 assets/icons.svg 的 symbols 内联进页面，避免跨文件 <use>（Safari/微信 X5 兼容与请求开销）。
 * 用法：node scripts/inline-icons.mjs
 * 源文件仍是 assets/icons.svg；改图标后运行一次，再按需 bump ?v= 版本号。
 */
import fs from 'node:fs';
import path from 'node:path';
import { root, readSiteConfig, sitePages } from './site-config.mjs';

const source = fs.readFileSync(path.join(root, 'assets', 'icons.svg'), 'utf8');
const inner = source.slice(source.indexOf('>') + 1, source.lastIndexOf('</svg>')).trim();
const sprite = [
  '<svg xmlns="http://www.w3.org/2000/svg" class="icon-sprite" aria-hidden="true" focusable="false">',
  inner,
  '</svg>',
].join('\n');

for (const { file: relative } of sitePages(readSiteConfig())) {
  const file = path.join(root, relative);
  const html = fs.readFileSync(file, 'utf8');
  const next = html.replace(
    /<!-- inline-icons:start -->[\s\S]*?<!-- inline-icons:end -->/,
    '<!-- inline-icons:start -->\n' + sprite + '\n<!-- inline-icons:end -->'
  );
  if (!html.includes('<!-- inline-icons:start -->') || !html.includes('<!-- inline-icons:end -->')) {
    console.error('✗ 未找到 inline-icons 标记：' + relative);
    process.exitCode = 1;
    continue;
  }
  if (next === html) continue;
  fs.writeFileSync(file, next);
  console.log('✓ ' + relative);
}
