import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root, readSiteConfig, escapeHtml } from './site-config.mjs';

const [id] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(id || '')) throw new Error('用法：node scripts/new-game.mjs <id>');
const config = readSiteConfig();
const game = config.games.find((item) => item.id === id);
const category = config.categories.find((item) => item.id === game?.category);
if (!game || !category) throw new Error('请先在 assets/games.js 中登记游戏和所属分类');
if (!game.title || !game.description || !/^[a-z0-9-]+$/.test(game.icon || '') ||
  !/^game_best_[a-z0-9_-]+$/.test(game.storageKey || '')) {
  throw new Error('请检查新游戏的标题、简介、图标和纪录键');
}

const directory = path.join(root, 'games', id);
const modulesDir = path.join(directory, 'modules');
const target = path.join(directory, 'index.html');
const template = fs.readFileSync(path.join(root, 'games/_template/index.html'), 'utf8');
const templateCss = fs.readFileSync(path.join(root, 'games/_template/modules/template.css'), 'utf8');
const templateJs = fs.readFileSync(path.join(root, 'games/_template/modules/main.js'), 'utf8');

const html = template
  .replaceAll('示例小游戏', () => escapeHtml(game.title))
  .replace('新增游戏模板：包含公共游戏外壳、HUD、音效、最高分、更多游戏与自定义确认弹窗。',
    () => escapeHtml(game.description))
  .replace('#game-template', () => '#game-' + game.icon)
  .replace('./modules/template.css', () => './modules/' + id + '.css')
  .replace('href="/categories/puzzle" data-i18n="益智休闲">益智休闲',
    () => 'href="' + escapeHtml(category.url) + '" data-i18n="' + escapeHtml(category.name) + '">' + escapeHtml(category.name))
  .replace('data-more-games="template"', () => 'data-more-games="' + id + '"');

const mainJs = templateJs.replace("'game_best_template'", () => JSON.stringify(game.storageKey));

fs.mkdirSync(modulesDir, { recursive: true });
fs.writeFileSync(target, html, { flag: 'wx' });
fs.writeFileSync(path.join(modulesDir, id + '.css'), templateCss, { flag: 'wx' });
fs.writeFileSync(path.join(modulesDir, 'main.js'), mainJs, { flag: 'wx' });
execFileSync(process.execPath, [path.join(root, 'scripts/sync-site.mjs'), game.url], { stdio: 'inherit' });
console.log('已创建 games/' + id + '/（含 modules/' + id + '.css 与 modules/main.js）；补齐玩法、图标和英文文案后运行构建。');
