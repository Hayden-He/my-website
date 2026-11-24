#!/usr/bin/env node
/**
 * 零依赖无头 Chrome 全站冒烟校验（检查 dist/ 构建产物）
 * 用法：
 *   node scripts/smoke-browser.mjs
 *   CHROME_PATH="/path/to/chrome" node scripts/smoke-browser.mjs
 *
 * 校验内容：
 * - 启动临时本地静态服务挂载 dist/（兼容 /categories/<id> 无扩展名路由）
 * - 遍历首页、分类页及全部游戏页：
 *   1) 0 未捕获 JS 异常、0 console.error、0 HTTP>=400 / 失败资源请求
 *   2) 首页检验卡片数量、战绩总览弹窗开关/筛选、中英文切换按需加载词典
 *   3) 游戏页关闭首次教学后触发真实开局交互，并验证画布动画帧持续推进
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readSiteConfig, root, sitePages } from './site-config.mjs';

const distDir = path.join(root, 'dist');
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('✗ 缺少 dist/ 构建产物，请先运行 node scripts/build-site.mjs');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  if (process.env.CHROME_PATH) {
    if (!fs.existsSync(process.env.CHROME_PATH)) {
      throw new Error(`CHROME_PATH 不存在：${process.env.CHROME_PATH}`);
    }
    return process.env.CHROME_PATH;
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      const full = path.join(dir, bin);
      if (fs.existsSync(full)) return full;
    }
  }
  throw new Error('未找到可用的 Chrome/Chromium，可通过 CHROME_PATH 环境变量指定路径。');
}

function resolveDistFile(requestPath) {
  const safeRelative = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const base = path.join(distDir, safeRelative);
  if (base !== distDir && !base.startsWith(distDir + path.sep)) return null;

  const probes = [];
  if (safeRelative === '' || requestPath.endsWith('/')) {
    probes.push(path.join(base, 'index.html'));
  } else {
    probes.push(base, base + '.html', path.join(base, 'index.html'));
  }
  for (const candidate of probes) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

function startStaticServer() {
  const notFound = [];
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      const filePath = resolveDistFile(pathname);
      if (!filePath) {
        notFound.push(pathname);
        res.writeHead(404).end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(filePath));
    } catch {
      res.writeHead(500).end('Server error');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port, notFound });
    });
  });
}

async function launchChrome(chromePath, profileDir) {
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--mute-audio',
      '--hide-scrollbars',
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=0',
      '--user-data-dir=' + profileDir,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let wsUrl = '';
  for (let i = 0; i < 120; i += 1) {
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome 意外退出（exit ${chrome.exitCode}）`);
    }
    const portFile = path.join(profileDir, 'DevToolsActivePort');
    if (fs.existsSync(portFile)) {
      const lines = fs.readFileSync(portFile, 'utf8').trim().split('\n');
      if (lines[1]) {
        wsUrl = `ws://127.0.0.1:${lines[0]}${lines[1]}`;
        break;
      }
    }
    await sleep(50);
  }
  if (!wsUrl) throw new Error('Chrome 未暴露 DevTools 调试端口');

  const ws = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const send = (method, params = {}, sessionId) => {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  };

  return { chrome, ws, send, onEvent: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
}

async function createSession(cdp) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext');
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params = {}) => cdp.send(method, params, sessionId);

  const exceptions = [];
  const consoleErrors = [];
  const httpErrors = [];
  const failedRequests = [];
  const events = [];

  const off = cdp.onEvent((msg) => {
    if (msg.sessionId !== sessionId) return;
    events.push(msg);
    if (msg.method === 'Runtime.exceptionThrown') {
      const ex = msg.params.exceptionDetails;
      exceptions.push(ex?.exception?.description || ex?.text || 'Uncaught exception');
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
      httpErrors.push(`${msg.params.response.status} ${msg.params.response.url}`);
    } else if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) {
      failedRequests.push(msg.params.errorText || 'Network load failed');
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 820,
    deviceScaleFactor: 1,
    mobile: false,
  });

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      const desc = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(`Evaluate failed: ${desc}`);
    }
    return result.result?.value;
  }

  async function waitUntil(expr, timeoutMs = 6000, label = expr) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await evaluate(`Boolean(${expr})`)) return true;
      await sleep(50);
    }
    throw new Error(`等待超时：${label}`);
  }

  async function navigateAndWait(url) {
    events.length = 0;
    await send('Page.navigate', { url });
    const start = Date.now();
    while (Date.now() - start < 10000) {
      if (events.some((e) => e.method === 'Page.loadEventFired')) break;
      await sleep(40);
    }
    await waitUntil('document.readyState === "complete"', 5000, 'document.readyState complete');
    // 让 type="module" 脚本和首批 rAF 初始化跑完
    await evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  }

  async function clickPointerAtSelector(selector) {
    const pt = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!pt) throw new Error(`找不到元素：${selector}`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  }

  async function dispose() {
    off();
    try { await cdp.send('Target.closeTarget', { targetId }); } catch {}
    try { await cdp.send('Target.disposeBrowserContext', { browserContextId }); } catch {}
  }

  return {
    send,
    evaluate,
    waitUntil,
    navigateAndWait,
    clickPointerAtSelector,
    errors: () => ({ exceptions, consoleErrors, httpErrors, failedRequests }),
    dispose,
  };
}

async function dismissTutorialIfPresent(session) {
  const shown = await session.evaluate('Boolean(document.querySelector(".gk-tutorial-mask"))');
  if (!shown) return;
  await session.evaluate('document.querySelector(".gk-tutorial-mask .gk-tutorial-btn.secondary")?.click()');
  await session.waitUntil('!document.querySelector(".gk-tutorial-mask")', 3000, 'tutorial closed');
}

async function assertCanvasAnimates(session, selector) {
  await sleep(450);
  const f1 = await session.evaluate(`document.querySelector(${JSON.stringify(selector)})?.toDataURL() || ""`);
  const deadline = Date.now() + 1400;
  let changed = false;
  while (Date.now() < deadline) {
    await sleep(250);
    const f2 = await session.evaluate(`document.querySelector(${JSON.stringify(selector)})?.toDataURL() || ""`);
    if (f2 && f2 !== f1) {
      changed = true;
      break;
    }
  }
  if (!changed) throw new Error(`画布 ${selector} 连续采样未发生任何像素变化，主循环可能已中断`);
}

async function verifyLobbyPage(session, config) {
  await session.waitUntil(
    `document.querySelectorAll('#games-grid .game-card').length === ${config.games.length}`,
    4000,
    'lobby game cards rendered'
  );
  await session.waitUntil('Boolean(document.getElementById("random-game-btn") && document.getElementById("records-overview-btn"))', 3000, 'hero action buttons');
  await session.evaluate('document.getElementById("records-overview-btn").click()');
  await session.waitUntil('Boolean(document.querySelector(".records-dialog"))', 3000, 'records modal opened');
  await session.evaluate('document.querySelector(".records-filter-btn[data-filter=\\"unplayed\\"]").click()');
  await session.waitUntil(
    'document.querySelector(".records-filter-btn[data-filter=\\"unplayed\\"]")?.getAttribute("aria-pressed") === "true"',
    3000,
    'records filter toggled'
  );
  await session.evaluate('document.querySelector(".records-close-btn").click()');
  await session.waitUntil('!document.querySelector(".records-dialog")', 3000, 'records modal closed');

  await session.evaluate('document.querySelector("#site-header [data-lang-toggle]").click()');
  await session.waitUntil('document.documentElement.lang === "en"', 5000, 'English dictionary loaded');
  await session.evaluate('document.querySelector("#site-header [data-lang-toggle]").click()');
  await session.waitUntil('document.documentElement.lang === "zh-CN"', 3000, 'Restored zh-CN');
}

async function verifyCategoryPage(session, config, categoryUrl) {
  const catId = categoryUrl.split('/').filter(Boolean).pop();
  const expected = config.games.filter((g) => g.category === catId).length;
  await session.waitUntil(
    `document.querySelectorAll('#games-grid .game-card').length === ${expected}`,
    4000,
    `category ${catId} cards rendered`
  );
  await session.waitUntil('Boolean(document.getElementById("random-game-btn") && document.getElementById("records-overview-btn"))', 3000, 'category hero actions');
}

async function verifyGamePage(session, gameId) {
  await dismissTutorialIfPresent(session);

  if (gameId === 'fruit') {
    await session.evaluate('document.querySelector("#overlay.show #overlay-btn")?.click()');
    await session.waitUntil('!document.getElementById("overlay").classList.contains("show")', 3000, 'fruit overlay hidden');
    await assertCanvasAnimates(session, '#canvas');
  } else if (gameId === 'basketball') {
    await session.clickPointerAtSelector('#court');
    await sleep(160);
    await session.clickPointerAtSelector('#court');
    await assertCanvasAnimates(session, '#court');
  } else if (gameId === 'space') {
    await session.evaluate('document.querySelector("#overlay.show #overlay-btn")?.click()');
    await session.waitUntil('!document.getElementById("overlay").classList.contains("show")', 3000, 'space overlay hidden');
    await assertCanvasAnimates(session, '#canvas');
  } else if (gameId === 'tetris') {
    await session.evaluate('document.querySelector("#overlay.show #overlay-primary-btn")?.click()');
    await session.waitUntil('!document.getElementById("overlay").classList.contains("show")', 3000, 'tetris overlay hidden');
    await assertCanvasAnimates(session, '#tetris-canvas');
  } else if (gameId === 'tank-maze') {
    const hasOverlay = await session.evaluate('!document.getElementById("tank-overlay")?.hidden');
    if (hasOverlay) await session.evaluate('document.getElementById("tank-primary")?.click()');
    await sleep(300);
    const hasCanvas = await session.evaluate('Boolean(document.getElementById("tank-board"))');
    if (!hasCanvas) throw new Error('tank-maze 棋盘未渲染');
  } else if (gameId === 'snake') {
    await session.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight", key: "ArrowRight", bubbles: true }))');
    await sleep(300);
    const hasCanvas = await session.evaluate('Boolean(document.getElementById("board"))');
    if (!hasCanvas) throw new Error('snake 棋盘未渲染');
  } else if (gameId === 'minesweeper') {
    await session.evaluate('document.querySelector("#mine-grid button")?.click()');
    await session.waitUntil('document.querySelectorAll("#mine-grid button.open").length > 0', 3000, 'minesweeper first click opens cells');
  } else if (gameId === 'memory') {
    await session.evaluate('(() => { const c = document.querySelectorAll("#memory-board .memory-card"); c[0]?.click(); c[1]?.click(); })()');
    await session.waitUntil('document.querySelectorAll("#memory-board .flipped, #memory-board .matched").length > 0', 3000, 'memory cards flipped');
  } else if (gameId === '2048') {
    await session.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft", key: "ArrowLeft", bubbles: true }))');
    await session.waitUntil('document.querySelectorAll("#tile-layer .tile").length >= 2', 3000, '2048 tiles present');
  } else if (gameId === 'slide') {
    await session.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft", key: "ArrowLeft", bubbles: true }))');
    await session.waitUntil('document.querySelectorAll("#slide-board .slide-tile").length >= 8', 3000, 'slide tiles present');
  } else if (gameId === 'block-workshop') {
    await session.evaluate('document.getElementById("workshop-dismiss-tip")?.click()');
    await sleep(250);
    const uiCheck = await session.evaluate(`(() => {
      const ready = Boolean(document.getElementById("world") || document.getElementById("graphics-error"));
      const mats = document.querySelectorAll("[data-material]").length;
      const tools = Boolean(
        document.querySelector('[data-tool="pick"]') &&
        document.getElementById("workshop-undo") &&
        document.getElementById("workshop-redo") &&
        document.getElementById("workshop-symmetry") &&
        document.getElementById("workshop-export")
      );
      return { ready, mats, tools };
    })()`);
    if (!uiCheck.ready) throw new Error('block-workshop 页面容器缺失');
    if (uiCheck.mats !== 12) throw new Error('block-workshop 材质数量异常：' + uiCheck.mats);
    if (!uiCheck.tools) throw new Error('block-workshop 缺少吸管/撤销/重做/对称/导出控件');
    // Test theme toggle & starter template library modal
    await session.evaluate('document.querySelector("[data-theme-toggle]")?.click()');
    await session.evaluate('document.getElementById("workshop-works")?.click()');
    await session.waitUntil('document.querySelectorAll("#workshop-templates .workshop-template").length === 3', 3000, 'block-workshop starter templates rendered');
    await session.evaluate('document.getElementById("workshop-close-library")?.click()');
  }
}

const config = readSiteConfig();
const pages = sitePages(config).filter((entry) => entry.url);
const chromePath = findChrome();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-smoke-'));
const { server, port, notFound } = await startStaticServer();
let cdp = null;

console.log(`浏览器冒烟校验（${pages.length} 个页面，Chrome: ${path.basename(chromePath)}）`);

let failures = 0;
try {
  cdp = await launchChrome(chromePath, profileDir);

  for (const entry of pages) {
    const session = await createSession(cdp);
    const url = `http://127.0.0.1:${port}${entry.url}`;
    const routeFailures = [];

    try {
      await session.navigateAndWait(url);
      if (entry.url === '/') {
        await verifyLobbyPage(session, config);
      } else if (entry.url.startsWith('/categories/')) {
        await verifyCategoryPage(session, config, entry.url);
      } else if (entry.url.startsWith('/games/')) {
        const gameId = entry.url.split('/').filter(Boolean).pop();
        await verifyGamePage(session, gameId);
      }
    } catch (error) {
      routeFailures.push(error.message);
    }

    const { exceptions, consoleErrors, httpErrors, failedRequests } = session.errors();
    if (exceptions.length) routeFailures.push(`未捕获异常: ${exceptions.join(' | ')}`);
    if (consoleErrors.length) routeFailures.push(`console.error: ${consoleErrors.join(' | ')}`);
    if (httpErrors.length) routeFailures.push(`HTTP 错误: ${httpErrors.join(' | ')}`);
    if (failedRequests.length) routeFailures.push(`请求失败: ${failedRequests.join(' | ')}`);

    await session.dispose();

    if (routeFailures.length > 0) {
      failures += 1;
      console.error(`✗ ${entry.url}\n  - ${routeFailures.join('\n  - ')}`);
    } else {
      console.log(`✓ ${entry.url}`);
    }
  }

  if (notFound.length > 0) {
    failures += 1;
    console.error(`✗ 静态服务收到 404 请求：${[...new Set(notFound)].join(', ')}`);
  }
} finally {
  if (cdp) {
    try { cdp.ws.close(); } catch {}
    cdp.chrome.kill('SIGTERM');
    await sleep(200);
  }
  server.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n✗ 浏览器冒烟校验未通过（失败页面/项：${failures}）`);
  process.exit(1);
}
console.log(`\n✓ 全部 ${pages.length} 个页面通过真实浏览器冒烟校验`);
