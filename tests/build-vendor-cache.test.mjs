import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');

test('dist splits block-workshop vendor hash from app module hash and syncs consistency updates', () => {
  const html = fs.readFileSync(path.join(dist, 'games/block-workshop/index.html'), 'utf8');

  assert.match(html, /<title>方块工坊 - 小游乐场<\/title>/);
  assert.match(html, /href="\/"[^>]*data-i18n="← 返回大厅"/);
  assert.match(html, /data-site-footer-mount/);

  const mainSrcMatch = html.match(/<script type="module" src="(\/assets\/v\/([0-9a-f]{16})\/games\/block-workshop\/modules\/main\.js)"><\/script>/);
  assert.ok(mainSrcMatch, 'main.js module script tag should be versioned');
  const [, mainUrl, appHash] = mainSrcMatch;

  const mainJs = fs.readFileSync(path.join(dist, mainUrl.slice(1)), 'utf8');
  const finishesJs = fs.readFileSync(
    path.join(dist, 'assets/v', appHash, 'games/block-workshop/modules/finishes.js'),
    'utf8'
  );

  const vendorMatchMain = mainJs.match(/['"](\/assets\/v\/([0-9a-f]{16})\/games\/block-workshop\/modules\/vendor\/three\.min\.js)['"]/);
  const vendorMatchFinishes = finishesJs.match(/['"](\/assets\/v\/([0-9a-f]{16})\/games\/block-workshop\/modules\/vendor\/three\.min\.js)['"]/);
  assert.ok(vendorMatchMain, 'main.js should import versioned vendor three.min.js');
  assert.ok(vendorMatchFinishes, 'finishes.js should import versioned vendor three.min.js');
  assert.equal(vendorMatchMain[2], vendorMatchFinishes[2]);

  const vendorHash = vendorMatchMain[2];
  assert.notEqual(vendorHash, appHash, 'vendor hash must differ from app module hash');

  assert.equal(
    fs.existsSync(path.join(dist, 'assets/v', vendorHash, 'games/block-workshop/modules/vendor/three.min.js')),
    true
  );
  assert.equal(
    fs.existsSync(path.join(dist, 'assets/v', appHash, 'games/block-workshop/modules/vendor/three.min.js')),
    false
  );

  const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
  assert.ok(headers.startsWith('# Cloudflare Pages 响应头'), '_headers line 1 should have no leading spaces');
});
