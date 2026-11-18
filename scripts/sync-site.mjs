import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root, siteUrl, readSiteConfig, sitePages, escapeHtml } from './site-config.mjs';

const config = readSiteConfig();
const pages = sitePages(config);
const ogImage = siteUrl + '/assets/og-image.jpg';
const ogAlt = '小游乐场 · Little Playground：' + config.games.length + ' 款即开即玩的小游戏';
const version = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/\/assets\/style\.css\?v=(\d{11})/)[1];
const output = new Map();

for (const { file, url, title } of pages) {
  if (!url) continue;
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const descriptionTag = /^([ \t]*<meta name="description" content="([^"]+)"[^>]*>)$/m;
  const description = source.match(descriptionTag)?.[2];
  if (!description) throw new Error(file + ' 缺少 meta description');

  const canonical = siteUrl + url;
  const ogTitle = escapeHtml(title + ' · Little Playground');
  const openGraph = {
    type: 'website', site_name: escapeHtml(config.siteTitle), locale: 'zh_CN', title: ogTitle,
    description, url: canonical, image: ogImage,
    'image:type': 'image/jpeg', 'image:width': '1200', 'image:height': '630', 'image:alt': ogAlt,
  };
  const twitter = {
    card: 'summary_large_image', title: ogTitle, description, image: ogImage, 'image:alt': ogAlt,
  };
  const tags = [
    '  <link rel="canonical" href="' + canonical + '" />',
    ...Object.entries(openGraph).map(([key, value]) => '  <meta property="og:' + key + '" content="' + value + '" />'),
    ...Object.entries(twitter).map(([key, value]) => '  <meta name="twitter:' + key + '" content="' + value + '" />'),
  ];

  const html = source
    .replace(/^[ \t]*<(?:link rel="canonical"|meta property="og:[^"]+"|meta name="twitter:[^"]+")[^\n]*\n/gm, '')
    .replace(descriptionTag, (tag) => [tag, ...tags].join('\n'))
    .replace(/(\/assets\/[^"?]+)\?v=\d{11}(?=")/g, '$1?v=' + version);
  output.set(file, html);
}

const sitemapFile = 'sitemap.xml';
const sitemap = fs.readFileSync(path.join(root, sitemapFile), 'utf8');
const lastmod = new Map([...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)]
  .map(([, loc, date]) => [loc, date]));
const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
const updateDates = new Set(process.argv.slice(2));
const entries = pages.filter(({ url }) => url).map(({ url }) => {
  const loc = siteUrl + url;
  const modified = updateDates.delete(url) ? date : lastmod.get(loc) || date;
  return '  <url><loc>' + loc + '</loc><lastmod>' + modified + '</lastmod></url>';
});
if (updateDates.size) throw new Error('未登记的页面：' + [...updateDates].join(', '));
output.set(sitemapFile, [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries, '</urlset>', '',
].join('\n'));

for (const [file, text] of output) {
  const target = path.join(root, file);
  if (fs.readFileSync(target, 'utf8') !== text) fs.writeFileSync(target, text);
}
execFileSync(process.execPath, [path.join(root, 'scripts/inline-icons.mjs')], { stdio: 'inherit' });
console.log('已同步 ' + entries.length + ' 个页面的 SEO、网站地图与图标');
