import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root, readSiteConfig, sitePages } from './site-config.mjs';

const output = path.join(root, 'dist');

for (const script of ['check-site.mjs', 'check-i18n.mjs']) {
  execFileSync(process.execPath, [path.join(root, 'scripts', script)], { stdio: 'inherit' });
}

const config = readSiteConfig();
const pages = sitePages(config).map(({ file }) => file);

function assetFiles(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) return assetFiles(relative);
    return entry.isFile() ? [relative] : [];
  });
}

const files = ['_headers', 'robots.txt', 'sitemap.xml', 'site.webmanifest', ...assetFiles('assets').sort()];
const version = createHash('sha256');
const content = new Map();
for (const file of [...files, ...pages]) {
  const bytes = fs.readFileSync(path.join(root, file));
  content.set(file, bytes);
  version.update(file).update('\0').update(bytes).update('\0');
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

for (const file of pages) {
  let html = content.get(file).toString();
  const legacyVersion = html.match(/\/assets\/style\.css\?v=(\d{11})/)?.[1];
  html = html.replace(/\b(src|href)="(\/assets\/[^"?]+)(?:\?v=\d+)?"(?=\s|>)/g,
    (_, attribute, asset) => attribute + '="' + versionedAsset(asset) + '"');
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
