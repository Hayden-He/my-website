import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const siteUrl = 'https://my-website-all.pages.dev';

export function escapeHtml(value) {
  return value.replace(/[&"<>]/g, (character) =>
    ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[character]);
}

export function readSiteConfig() {
  const configPath = path.join(root, 'assets/games.js');
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(configPath, 'utf8'), sandbox, { filename: configPath });
  return sandbox.window.SITE_CONFIG;
}

export function sitePages(config) {
  const { siteTitle, categories, games } = config;
  return [
    { file: 'index.html', url: '/', title: siteTitle },
    { file: '404.html' },
    ...categories.map(({ id, url, name }) => ({ file: 'categories/' + id + '.html', url, title: name })),
    ...games.map(({ id, url, title }) => ({ file: 'games/' + id + '/index.html', url, title })),
  ];
}

export function previewPages(args) {
  if (args.length === 0) return [];
  const [flag, id] = args;
  if (args.length !== 2 || flag !== '--preview-game' || !/^[a-z0-9-]+$/.test(id || '')) {
    throw new Error('用法：node scripts/build-site.mjs [--preview-game <id>]');
  }
  const file = `prototypes/${id}/index.html`;
  if (!fs.existsSync(path.join(root, file))) throw new Error('原型页面不存在：' + file);
  return [{ file }];
}

export function assetFiles(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) return assetFiles(relative);
    return entry.isFile() ? [relative] : [];
  });
}

export function pageModuleDirectory(file) {
  return path.posix.join(path.posix.dirname(file), 'modules');
}

export function pageModuleFiles(file) {
  const directory = pageModuleDirectory(file);
  return fs.existsSync(path.join(root, directory)) ? assetFiles(directory).sort() : [];
}
