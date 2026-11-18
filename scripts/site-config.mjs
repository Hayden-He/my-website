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
