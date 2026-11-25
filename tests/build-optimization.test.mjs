import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');

function readSymbolIds(html) {
  const spriteMatch = html.match(/<svg[^>]*class="icon-sprite"[\s\S]*?<\/svg>/);
  assert.ok(spriteMatch, 'built page should contain inline icon-sprite');
  return new Set([...spriteMatch[0].matchAll(/<symbol\s+id="([^"]+)"/g)].map((m) => m[1]));
}

function createI18nHarness({ initialLang = null, enSrc = '/assets/v/0123456789abcdef/i18n-en.js' } = {}) {
  const storage = new Map();
  if (initialLang !== null) storage.set('site_lang', initialLang);

  const appendedScripts = [];
  const docListeners = new Map();
  const attrs = new Map();
  const classes = new Set();

  const documentElement = {
    lang: 'zh-CN',
    setAttribute(k, v) { attrs.set(k, v); },
    getAttribute(k) { return attrs.get(k) ?? null; },
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); },
    },
  };

  const document = {
    readyState: 'complete',
    title: '小游乐场 - 在线小游戏合集',
    currentScript: {
      getAttribute(name) { return name === 'data-en-src' ? enSrc : null; },
    },
    documentElement,
    head: {
      appendChild(el) {
        appendedScripts.push(el);
        return el;
      },
    },
    createElement(tag) {
      const listeners = new Map();
      return {
        tagName: tag.toUpperCase(),
        src: '',
        async: false,
        addEventListener(type, fn) {
          if (!listeners.has(type)) listeners.set(type, []);
          listeners.get(type).push(fn);
        },
        dispatch(type) {
          for (const fn of listeners.get(type) || []) fn();
        },
      };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      for (const fn of docListeners.get(event.type) || []) fn(event);
      return true;
    },
  };

  class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  const sandbox = {
    document,
    localStorage: {
      getItem(k) { return storage.has(k) ? storage.get(k) : null; },
      setItem(k, v) { storage.set(k, String(v)); },
    },
    CustomEvent,
  };
  sandbox.window = sandbox;

  const runtimeSource = fs.readFileSync(path.join(root, 'assets/i18n.js'), 'utf8');
  const dictSource = fs.readFileSync(path.join(root, 'assets/i18n-en.js'), 'utf8');
  vm.runInNewContext(runtimeSource, sandbox, { filename: 'assets/i18n.js' });

  return {
    I18N: sandbox.window.I18N,
    appendedScripts,
    documentElement,
    storage,
    onLangChange(fn) {
      document.addEventListener('i18n:change', fn);
    },
    finishLoadLastScript() {
      const script = appendedScripts[appendedScripts.length - 1];
      assert.ok(script, 'expected a dynamically appended script');
      vm.runInNewContext(dictSource, sandbox, { filename: 'assets/i18n-en.js' });
      script.dispatch('load');
    },
  };
}

test('dist prunes inline icon sprites per page while preserving required icons', () => {
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const indexIcons = readSymbolIds(indexHtml);
  for (const id of ['brand', 'sound-on', 'sound-off', 'theme-system', 'theme-light', 'theme-dark']) {
    assert.equal(indexIcons.has(id), true, `index.html must include ${id}`);
  }
  for (const unused of ['mem-apple', 'game-tetris', 'art-explosion']) {
    assert.equal(indexIcons.has(unused), false, `index.html should prune unused ${unused}`);
  }

  const memoryHtml = fs.readFileSync(path.join(dist, 'games/memory/index.html'), 'utf8');
  const memoryIcons = readSymbolIds(memoryHtml);
  for (const fruit of [
    'mem-apple', 'mem-orange', 'mem-lemon', 'mem-grape', 'mem-watermelon',
    'mem-strawberry', 'mem-cherry', 'mem-kiwi', 'mem-peach', 'mem-coconut',
  ]) {
    assert.equal(memoryIcons.has(fruit), true, `memory page must include ${fruit}`);
  }
  for (const rec of ['game-memory', 'game-block-workshop', 'game-tetris', 'game-basketball', 'game-snake']) {
    assert.equal(memoryIcons.has(rec), true, `memory page must include ${rec}`);
  }

  const tankHtml = fs.readFileSync(path.join(dist, 'games/tank-maze/index.html'), 'utf8');
  const tankIcons = readSymbolIds(tankHtml);
  for (const id of [
    'brand', 'game-tank-maze', 'art-tap', 'art-target', 'art-star',
    'sound-on', 'sound-off', 'theme-system', 'theme-light', 'theme-dark',
    'game-2048', 'game-minesweeper', 'game-slide', 'game-memory',
  ]) {
    assert.equal(tankIcons.has(id), true, `tank-maze page must include ${id}`);
  }
  assert.equal(tankIcons.has('mem-apple'), false, 'tank-maze should exclude mem-apple');
});

test('dist attaches versioned data-en-src for theme.js and i18n.js and emits hashed asset', () => {
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const i18nMatch = indexHtml.match(/<script src="(\/assets\/v\/[0-9a-f]{16}\/i18n\.js)" data-en-src="(\/assets\/v\/[0-9a-f]{16}\/i18n-en\.js)"><\/script>/);
  const themeMatch = indexHtml.match(/<script src="(\/assets\/v\/[0-9a-f]{16}\/theme\.js)" data-en-src="(\/assets\/v\/[0-9a-f]{16}\/i18n-en\.js)"><\/script>/);
  assert.ok(i18nMatch, 'i18n.js script tag should carry hashed data-en-src');
  assert.ok(themeMatch, 'theme.js script tag should carry hashed data-en-src');
  assert.equal(themeMatch[2], i18nMatch[2]);
  assert.equal(fs.existsSync(path.join(dist, themeMatch[1].slice(1))), true);
  assert.equal(fs.existsSync(path.join(dist, i18nMatch[1].slice(1))), true);
  assert.equal(fs.existsSync(path.join(dist, i18nMatch[2].slice(1))), true);
});

test('dist preserves tutorial icon symbols for updated classic games', () => {
  const expectedIcons = {
    'games/2048/index.html': ['game-2048', 'icon-undo'],
    'games/snake/index.html': ['game-snake', 'art-star'],
    'games/slide/index.html': ['game-slide', 'art-grid'],
    'games/memory/index.html': ['game-memory', 'mem-apple'],
    'games/basketball/index.html': ['art-tap', 'game-basketball'],
  };
  for (const [rel, icons] of Object.entries(expectedIcons)) {
    const html = fs.readFileSync(path.join(dist, rel), 'utf8');
    const sprite = readSymbolIds(html);
    for (const id of icons) {
      assert.equal(sprite.has(id), true, `${rel} must retain tutorial icon ${id}`);
    }
  }
});

test('i18n runtime skips English dictionary in zh mode and loads it on demand for en mode', async () => {
  const zhHarness = createI18nHarness();
  assert.equal(zhHarness.appendedScripts.length, 0, 'zh default must not load English dictionary');
  assert.equal(zhHarness.I18N.t('全部游戏'), '全部游戏');

  const events = [];
  zhHarness.onLangChange((e) => events.push(e.detail.lang));

  zhHarness.I18N.setLang('en');
  assert.equal(zhHarness.appendedScripts.length, 1);
  assert.equal(zhHarness.appendedScripts[0].src, '/assets/v/0123456789abcdef/i18n-en.js');

  zhHarness.finishLoadLastScript();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(zhHarness.I18N.getLang(), 'en');
  assert.equal(zhHarness.I18N.t('全部游戏'), 'All Games');
  assert.equal(zhHarness.documentElement.lang, 'en');
  assert.deepEqual(events, ['en']);

  zhHarness.I18N.setLang('zh');
  assert.equal(zhHarness.I18N.t('全部游戏'), '全部游戏');
  assert.equal(zhHarness.appendedScripts.length, 1);
  assert.deepEqual(events, ['en', 'zh']);

  // Booting directly in en mode starts dictionary fetch immediately and clears i18n-pending after load
  const enBoot = createI18nHarness({ initialLang: 'en' });
  enBoot.documentElement.classList.add('i18n-pending');
  enBoot.I18N.init();
  assert.equal(enBoot.documentElement.classList.contains('i18n-pending'), true);
  assert.equal(enBoot.appendedScripts.length, 1);
  const bootEvents = [];
  enBoot.onLangChange((e) => bootEvents.push(e.detail.lang));
  enBoot.finishLoadLastScript();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(enBoot.documentElement.classList.contains('i18n-pending'), false);
  assert.equal(enBoot.I18N.t('全部游戏'), 'All Games');
  assert.deepEqual(bootEvents, ['en']);
});

test('dist rewrites ./modules/ assets and emits all module files for basketball, fruit, space, and breakout', () => {
  for (const id of ['basketball', 'fruit', 'space', 'breakout']) {
    const html = fs.readFileSync(path.join(dist, 'games', id, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /['"]\.\/modules\//, `${id} built HTML must not leave unrewritten ./modules/ paths`);

    const cssMatch = html.match(new RegExp(`/assets/v/([0-9a-f]+)/games/${id}/modules/${id}\\.css`));
    const mainMatch = html.match(new RegExp(`/assets/v/([0-9a-f]+)/games/${id}/modules/main\\.js`));
    assert.ok(cssMatch, `${id} built HTML should reference versioned ${id}.css`);
    assert.ok(mainMatch, `${id} built HTML should reference versioned main.js`);

    assert.equal(
      fs.existsSync(path.join(dist, 'assets', 'v', cssMatch[1], 'games', id, 'modules', `${id}.css`)),
      true,
      `${id}.css should exist in dist`
    );
    for (const file of ['rules.js', 'audio.js', 'renderer.js', 'main.js']) {
      assert.equal(
        fs.existsSync(path.join(dist, 'assets', 'v', mainMatch[1], 'games', id, 'modules', file)),
        true,
        `${id}/modules/${file} should exist in dist`
      );
    }
  }
});

test('every game module referencing ./rules.js exports imports or declares them cleanly', () => {
  const gamesDir = path.join(root, 'games');
  for (const gameId of fs.readdirSync(gamesDir)) {
    const modDir = path.join(gamesDir, gameId, 'modules');
    const rulesPath = path.join(modDir, 'rules.js');
    if (!fs.existsSync(rulesPath)) continue;

    const rulesSource = fs.readFileSync(rulesPath, 'utf8');
    const rulesExports = new Set();
    for (const m of rulesSource.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) {
      rulesExports.add(m[1]);
    }
    for (const m of rulesSource.matchAll(/export\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(',')) {
        const alias = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (alias) rulesExports.add(alias);
      }
    }

    for (const fileName of fs.readdirSync(modDir)) {
      if (!fileName.endsWith('.js') || fileName === 'rules.js') continue;
      const src = fs.readFileSync(path.join(modDir, fileName), 'utf8');

      const importedFromRules = new Set();
      for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/rules\.js['"]/g)) {
        for (const spec of m[1].split(',')) {
          const [orig, alias] = spec.trim().split(/\s+as\s+/).map((s) => s.trim());
          if (orig) importedFromRules.add(orig);
          if (alias) importedFromRules.add(alias);
        }
      }

      // Strip comments, string/template literals, import statements, member accesses, and object keys
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/import\s+[\s\S]*?from\s*['"][^'"]+['"]\s*;?/g, ' ')
        .replace(/`(?:\\[\s\S]|[^`\\])*`/g, ' ')
        .replace(/'(?:\\.|[^'\\])*'/g, ' ')
        .replace(/"(?:\\.|[^"\\])*"/g, ' ')
        .replace(/\.[A-Za-z_$][\w$]*/g, ' ')
        .replace(/([A-Za-z_$][\w$]*)\s*:/g, ' ');

      const localDecls = new Set();
      for (const m of stripped.matchAll(/(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
        localDecls.add(m[1]);
      }

      for (const expName of rulesExports) {
        if (importedFromRules.has(expName) || localDecls.has(expName)) continue;
        const usedRe = new RegExp(`\\b${expName}\\b`);
        assert.equal(
          usedRe.test(stripped),
          false,
          `games/${gameId}/modules/${fileName} references ${expName} from ./rules.js without importing it`
        );
      }
    }
  }
});

test('dist emits version.json matching meta site-build in built HTML pages', () => {
  const versionPath = path.join(dist, 'version.json');
  assert.equal(fs.existsSync(versionPath), true, 'dist/version.json should exist');
  const payload = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  assert.match(payload.build, /^[0-9a-f]{16}$/);

  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const metaMatch = indexHtml.match(/<meta name="site-build" content="([0-9a-f]{16})" \/>/);
  assert.ok(metaMatch, 'dist/index.html should include meta site-build');
  assert.equal(payload.build, metaMatch[1]);
});

test('dist rewrites ./modules/ assets for migrated classic games (slide, memory, 2048, minesweeper)', () => {
  for (const id of ['slide', 'memory', '2048', 'minesweeper']) {
    const html = fs.readFileSync(path.join(dist, 'games', id, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /['"]\.\/modules\//, `${id} built HTML must not leave unrewritten ./modules/ paths`);

    const cssMatch = html.match(new RegExp(`/assets/v/([0-9a-f]+)/games/${id}/modules/${id}\\.css`));
    const mainMatch = html.match(new RegExp(`/assets/v/([0-9a-f]+)/games/${id}/modules/main\\.js`));
    assert.ok(cssMatch, `${id} built HTML should reference versioned ${id}.css`);
    assert.ok(mainMatch, `${id} built HTML should reference versioned main.js`);

    assert.equal(
      fs.existsSync(path.join(dist, 'assets', 'v', cssMatch[1], 'games', id, 'modules', `${id}.css`)),
      true,
      `${id}.css should exist in dist`
    );
    assert.equal(
      fs.existsSync(path.join(dist, 'assets', 'v', mainMatch[1], 'games', id, 'modules', 'main.js')),
      true,
      `${id}/modules/main.js should exist in dist`
    );
  }
});
