#!/usr/bin/env node
/**
 * 零依赖无头 Chrome 全站冒烟校验（检查 dist/ 构建产物）
 * 用法：
 *   node scripts/smoke-browser.mjs
 *   CHROME_PATH="/path/to/chrome" node scripts/smoke-browser.mjs
 *
 * 校验内容：
 * - 启动临时本地静态服务挂载 dist/（兼容 /categories/<id> 无扩展名路由）
 * - 桌面端（1280×820）遍历首页、分类页及全部游戏页：
 *   1) 0 未捕获 JS 异常、0 console.error、0 HTTP>=400 / 失败资源请求
 *   2) 首页检验卡片数量、战绩总览弹窗开关/筛选、中英文切换按需加载词典
 *   3) 游戏页关闭首次教学后触发真实开局交互，并验证画布动画帧持续推进
 * - 移动端竖屏（390×844）与横屏（844×390，启用触控仿真）：
 *   4) 全部页面无横向溢出、核心画布/棋盘可见且尺寸正常
 *   5) 校验各游戏竖屏/横屏沉浸入口可见性与切换闭环
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

function readDistCsp() {
  try {
    const raw = fs.readFileSync(path.join(distDir, '_headers'), 'utf8');
    const match = raw.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function startStaticServer() {
  const notFound = [];
  const cspHeader = readDistCsp();
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
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
      if (ext === '.html' && cspHeader) headers['Content-Security-Policy'] = cspHeader;
      res.writeHead(200, headers);
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
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--password-store=basic',
    '--use-mock-keychain',
    '--mute-audio',
    '--hide-scrollbars',
    '--enable-unsafe-swiftshader',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profileDir,
  ];
  if (process.platform === 'linux') {
    args.push('--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader');
  }
  args.push('about:blank');

  const chrome = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderrTail = '';
  let wsFromStderr = '';
  chrome.stderr?.setEncoding('utf8');
  chrome.stderr?.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk).slice(-2000);
    if (!wsFromStderr) {
      const match = stderrTail.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) wsFromStderr = match[1];
    }
  });

  const killChrome = () => {
    if (chrome.exitCode === null) {
      try { chrome.kill('SIGKILL'); } catch {}
    }
  };

  let wsUrl = '';
  try {
    for (let i = 0; i < 500; i += 1) {
      if (wsFromStderr) {
        wsUrl = wsFromStderr;
        break;
      }
      if (chrome.exitCode !== null) {
        const detail = stderrTail.trim() ? `\n${stderrTail.trim()}` : '';
        throw new Error(`Chrome 意外退出（exit ${chrome.exitCode}）${detail}`);
      }
      const portFile = path.join(profileDir, 'DevToolsActivePort');
      if (fs.existsSync(portFile)) {
        const lines = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
        if (lines[0] && lines[1]) {
          wsUrl = `ws://127.0.0.1:${lines[0]}${lines[1]}`;
          break;
        }
      }
      await sleep(50);
    }
    if (!wsUrl) {
      const detail = stderrTail.trim() ? `\n${stderrTail.trim()}` : '';
      throw new Error(`Chrome 未暴露 DevTools 调试端口${detail}`);
    }

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
  } catch (error) {
    killChrome();
    throw error;
  }
}

const DESKTOP_VIEWPORT = {
  width: 1280,
  height: 820,
  deviceScaleFactor: 1,
  mobile: false,
};

const MOBILE_PORTRAIT_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
  screenOrientation: { type: 'portraitPrimary', angle: 0 },
};

const MOBILE_LANDSCAPE_VIEWPORT = {
  width: 844,
  height: 390,
  deviceScaleFactor: 2,
  mobile: true,
  screenOrientation: { type: 'landscapePrimary', angle: 90 },
};

async function createSession(cdp, viewport = DESKTOP_VIEWPORT) {
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
  await send('Emulation.setDeviceMetricsOverride', viewport);
  if (viewport.mobile) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }

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
  const deadline = Date.now() + 2200;
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
  } else if (gameId === 'breakout') {
    await session.evaluate('document.querySelector("#overlay.show #overlay-btn")?.click()');
    await session.waitUntil('!document.getElementById("overlay").classList.contains("show")', 3000, 'breakout overlay hidden');
    await assertCanvasAnimates(session, '#canvas');
    await session.evaluate(`(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i <= 4; i += 1) {
        const x = rect.left + rect.width * (0.2 + 0.15 * i);
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: rect.top + rect.height * 0.8, pointerType: 'mouse', bubbles: true }));
      }
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 900));
    await assertCanvasAnimates(session, '#canvas');
    await session.evaluate('document.querySelector(".skin-pill[data-skin=\\"retro\\"]")?.click()');
    await session.waitUntil('document.querySelector(".skin-pill[data-skin=\\"retro\\"]")?.classList.contains("active")', 2000, 'breakout skin switches');
    await session.evaluate('document.getElementById("pause-btn")?.click()');
    await session.waitUntil('document.getElementById("overlay")?.classList.contains("show")', 2000, 'breakout pauses cleanly');
  } else if (gameId === 'tetris') {
    await session.evaluate('document.querySelector("#overlay.show #overlay-primary-btn")?.click()');
    await session.waitUntil('!document.getElementById("overlay").classList.contains("show")', 3000, 'tetris overlay hidden');
    await assertCanvasAnimates(session, '#tetris-canvas');
  } else if (gameId === 'tank-maze') {
    await session.evaluate('document.getElementById("tank-start")?.click()');
    await session.waitUntil('document.querySelector(".tank-game")?.dataset.phase === "playing"', 3000, 'tank-maze enters playing phase');
    await session.evaluate(`(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", key: "e", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE", key: "e", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " ", bubbles: true }));
    })()`);
    await sleep(200);
    await session.evaluate('document.getElementById("tank-pause")?.click()');
    await session.waitUntil('document.querySelector(".tank-game")?.dataset.phase === "paused"', 3000, 'tank-maze pauses cleanly');
    const secondaryVisible = await session.evaluate('!document.getElementById("tank-secondary")?.hidden');
    if (!secondaryVisible) throw new Error('tank-maze 暂停弹窗缺少返回设置按钮');
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
    const hintReady = await session.evaluate('(() => { const b = document.getElementById("hint-btn"); return Boolean(b && !b.disabled); })()');
    if (!hintReady) throw new Error('minesweeper 安全提示按钮未启用');
    await session.evaluate('document.getElementById("hint-btn")?.click()');
    await session.waitUntil('document.getElementById("hint-btn")?.textContent.includes("(1)")', 3000, 'minesweeper safe hint decrements counter');
  } else if (gameId === 'memory') {
    await session.evaluate('document.getElementById("mode-6")?.click()');
    await session.waitUntil('document.querySelectorAll("#memory-board .memory-card").length === 24', 3000, 'memory 6x4 deck rendered');
    await session.evaluate('(() => { const c = document.querySelectorAll("#memory-board .memory-card"); c[0]?.click(); c[1]?.click(); })()');
    await session.waitUntil('document.querySelectorAll("#memory-board .flipped, #memory-board .matched").length > 0', 3000, 'memory cards flipped');
  } else if (gameId === '2048') {
    await session.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft", key: "ArrowLeft", bubbles: true }))');
    await session.waitUntil('document.querySelectorAll("#tile-layer .tile").length >= 2', 3000, '2048 tiles present');
    const undoLabel = await session.evaluate('document.getElementById("undo-btn")?.textContent.trim() || ""');
    if (!undoLabel) throw new Error('2048 撤回按钮缺少文案');
    await session.evaluate('document.getElementById("size-obstacle")?.click()');
    await session.waitUntil('document.querySelectorAll("#tile-layer .tile.obstacle").length === 1', 3000, '2048 obstacle mode renders stone obstacle');
  } else if (gameId === 'slide') {
    await session.evaluate('document.getElementById("mode-5")?.click()');
    await session.waitUntil('document.querySelectorAll("#slide-board .slide-tile:not(.blank)").length === 24', 3000, 'slide 5x5 board rendered');
    await session.evaluate('document.querySelector("#slide-board .slide-tile.movable")?.click()');
    await session.waitUntil('Number(document.getElementById("moves-el")?.textContent) >= 1 && Boolean(document.getElementById("slide-progress")?.textContent.trim())', 3000, 'slide move increments moves and updates progress');
  } else if (gameId === 'block-workshop') {
    await session.evaluate('document.getElementById("workshop-dismiss-tip")?.click()');
    await sleep(250);
    const uiCheck = await session.evaluate(`(() => {
      const world = document.getElementById("world");
      const fallback = document.getElementById("graphics-error");
      const webglActive = Boolean(world && !world.hidden);
      const fallbackActive = Boolean(fallback && !fallback.hidden && fallback.textContent.trim());
      const mats = document.querySelectorAll("[data-material]").length;
      const tools = Boolean(
        document.querySelector('[data-tool="pick"]') &&
        document.getElementById("workshop-undo") &&
        document.getElementById("workshop-redo") &&
        document.getElementById("workshop-symmetry") &&
        document.getElementById("workshop-export")
      );
      return { webglActive, fallbackActive, mats, tools };
    })()`);
    if (!uiCheck.webglActive && !uiCheck.fallbackActive) {
      throw new Error('block-workshop 既未显示 3D 画布也未显示降级提示');
    }
    if (uiCheck.mats !== 12) throw new Error('block-workshop 材质数量异常：' + uiCheck.mats);
    if (!uiCheck.tools) throw new Error('block-workshop 缺少吸管/撤销/重做/对称/导出控件');
    if (uiCheck.webglActive) {
      // Test theme toggle & starter template library modal when WebGL2 is active
      await session.evaluate('document.querySelector("[data-theme-toggle]")?.click()');
      await session.evaluate('document.getElementById("workshop-works")?.click()');
      await session.waitUntil('document.querySelectorAll("#workshop-templates .workshop-template").length === 3', 3000, 'block-workshop starter templates rendered');
      await session.evaluate('document.getElementById("workshop-close-library")?.click()');
    }
  }
}

const MOBILE_GAME_CONFIG = {
  basketball: { surface: '#court', isCanvas: true, immersiveBtn: '#immersive-btn', immersiveMode: 'both' },
  snake: { surface: '#board', isCanvas: true, immersiveBtn: '#immersive-btn', immersiveMode: 'both' },
  fruit: { surface: '#canvas', isCanvas: true, immersiveBtn: '#immersive-btn', immersiveMode: 'both' },
  space: { surface: '#canvas', isCanvas: true, immersiveBtn: '#immersive-btn', immersiveMode: 'portrait' },
  breakout: { surface: '#canvas', isCanvas: true, immersiveBtn: '#immersive-btn', immersiveMode: 'portrait' },
  'tank-maze': { surface: '#tank-board', isCanvas: true, immersiveBtn: '#tank-immersive', immersiveMode: 'landscape' },
  2048: { surface: '#tile-layer', isCanvas: false, immersiveMode: 'none' },
  minesweeper: { surface: '#mine-grid', isCanvas: false, immersiveMode: 'none' },
  slide: { surface: '#slide-board', isCanvas: false, immersiveMode: 'none' },
  memory: { surface: '#memory-board', isCanvas: false, immersiveMode: 'none' },
  'block-workshop': { surface: '#world', fallback: '#graphics-error', isCanvas: true, immersiveBtn: '#workshop-immersive', immersiveMode: 'portrait' },
  tetris: { surface: '#tetris-canvas', isCanvas: true, immersiveBtn: '#immersive-btn', immersiveMode: 'portrait' },
};

async function waitTwoFrames(session) {
  await session.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
}

async function assertNoHorizontalOverflow(session, label) {
  const metrics = await session.evaluate('({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })');
  if (metrics.scrollWidth > metrics.innerWidth + 1) {
    throw new Error(`${label} 存在横向溢出（scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}）`);
  }
}

async function assertVisibleSurface(session, cfg, label) {
  const state = await session.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(cfg.surface)});
    const fb = ${cfg.fallback ? `document.querySelector(${JSON.stringify(cfg.fallback)})` : 'null'};
    const fallbackActive = Boolean(fb && !fb.hidden && fb.textContent.trim());
    const rect = el && !el.hidden ? el.getBoundingClientRect() : null;
    return {
      fallbackActive,
      innerWidth: window.innerWidth,
      rect: rect ? { width: rect.width, height: rect.height, left: rect.left, right: rect.right } : null,
    };
  })()`);
  if (state.fallbackActive) return;
  if (!state.rect || state.rect.width <= 0 || state.rect.height <= 0) {
    throw new Error(`${label} 主画布/棋盘 ${cfg.surface} 未可见渲染`);
  }
  if (cfg.isCanvas && state.rect.right > state.innerWidth + 1.5) {
    throw new Error(`${label} 画布 ${cfg.surface} 右边界超出视口（right=${Math.round(state.rect.right)} > ${state.innerWidth}）`);
  }
}

async function assertButtonVisible(session, selector, label) {
  const info = await session.evaluate(`(() => {
    const btn = document.querySelector(${JSON.stringify(selector)});
    if (!btn || btn.hidden) return { visible: false };
    const r = btn.getBoundingClientRect();
    return { visible: r.width > 0 && r.height > 0 };
  })()`);
  if (!info.visible) throw new Error(`${label} 沉浸按钮 ${selector} 未显示`);
}

async function verifyMobilePortraitPage(session, config, entry) {
  if (entry.url === '/') {
    await session.waitUntil(
      `document.querySelectorAll('#games-grid .game-card').length === ${config.games.length}`,
      4000,
      'mobile lobby cards rendered'
    );
    await assertNoHorizontalOverflow(session, '首页竖屏');
    return;
  }
  if (entry.url.startsWith('/categories/')) {
    await verifyCategoryPage(session, config, entry.url);
    await assertNoHorizontalOverflow(session, `${entry.url} 竖屏`);
    return;
  }

  const gameId = entry.url.split('/').filter(Boolean).pop();
  const cfg = MOBILE_GAME_CONFIG[gameId];
  if (!cfg) throw new Error(`未登记移动端冒烟配置：${gameId}`);

  await dismissTutorialIfPresent(session);
  if (gameId === 'block-workshop') {
    await session.evaluate('document.getElementById("workshop-dismiss-tip")?.click()');
  }
  await waitTwoFrames(session);
  await assertNoHorizontalOverflow(session, `${gameId} 竖屏`);
  await assertVisibleSurface(session, cfg, `${gameId} 竖屏`);

  if (cfg.immersiveBtn) {
    await assertButtonVisible(session, cfg.immersiveBtn, `${gameId} 竖屏`);
    if (cfg.immersiveMode === 'portrait' || cfg.immersiveMode === 'both') {
      await session.evaluate(`document.querySelector(${JSON.stringify(cfg.immersiveBtn)})?.click()`);
      await session.waitUntil('document.body.classList.contains("mobile-game-immersive")', 3000, `${gameId} 竖屏进入沉浸模式`);
      await waitTwoFrames(session);
      await assertNoHorizontalOverflow(session, `${gameId} 竖屏沉浸`);
      await assertVisibleSurface(session, cfg, `${gameId} 竖屏沉浸`);
      await session.evaluate(`document.querySelector(${JSON.stringify(cfg.immersiveBtn)})?.click()`);
      await session.waitUntil('!document.body.classList.contains("mobile-game-immersive")', 3000, `${gameId} 竖屏退出沉浸模式`);
      await waitTwoFrames(session);
      await assertNoHorizontalOverflow(session, `${gameId} 竖屏退出沉浸`);
    }
  }
}

async function verifyMobileLandscapePage(session, config, entry) {
  if (entry.url === '/') {
    await session.waitUntil(
      `document.querySelectorAll('#games-grid .game-card').length === ${config.games.length}`,
      4000,
      'mobile landscape lobby cards rendered'
    );
    await assertNoHorizontalOverflow(session, '首页横屏');
    return;
  }

  const gameId = entry.url.split('/').filter(Boolean).pop();
  const cfg = MOBILE_GAME_CONFIG[gameId];
  await dismissTutorialIfPresent(session);
  if (gameId === 'block-workshop') {
    await session.evaluate('document.getElementById("workshop-dismiss-tip")?.click()');
  }
  await waitTwoFrames(session);
  await assertNoHorizontalOverflow(session, `${gameId} 横屏`);
  await assertVisibleSurface(session, cfg, `${gameId} 横屏`);

  if (cfg.immersiveMode === 'both') {
    await session.waitUntil('document.body.classList.contains("mobile-game-immersive")', 3000, `${gameId} 横屏默认沉浸`);
    await assertButtonVisible(session, cfg.immersiveBtn, `${gameId} 横屏`);
    await session.evaluate(`document.querySelector(${JSON.stringify(cfg.immersiveBtn)})?.click()`);
    await session.waitUntil('!document.body.classList.contains("mobile-game-immersive")', 3000, `${gameId} 横屏退出沉浸`);
    await waitTwoFrames(session);
    await assertNoHorizontalOverflow(session, `${gameId} 横屏退出沉浸`);
  } else if (cfg.immersiveMode === 'landscape') {
    await assertButtonVisible(session, cfg.immersiveBtn, `${gameId} 横屏`);
    await session.evaluate(`document.querySelector(${JSON.stringify(cfg.immersiveBtn)})?.click()`);
    await session.waitUntil('document.body.classList.contains("mobile-game-immersive")', 3000, `${gameId} 横屏进入沉浸`);
    await waitTwoFrames(session);
    await assertNoHorizontalOverflow(session, `${gameId} 横屏沉浸`);
    await assertVisibleSurface(session, cfg, `${gameId} 横屏沉浸`);
    await session.evaluate(`document.querySelector(${JSON.stringify(cfg.immersiveBtn)})?.click()`);
    await session.waitUntil('!document.body.classList.contains("mobile-game-immersive")', 3000, `${gameId} 横屏退出沉浸`);
  } else if (cfg.immersiveMode === 'portrait') {
    const stuck = await session.evaluate('document.body.classList.contains("mobile-game-immersive")');
    if (stuck) throw new Error(`${gameId} 仅支持竖屏沉浸，横屏不应处于 mobile-game-immersive`);
  }
}

async function runSingleCheck(cdp, { label, url, viewport, verify }) {
  const session = await createSession(cdp, viewport);
  const routeFailures = [];
  try {
    await session.navigateAndWait(url);
    await verify(session);
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
    console.error(`✗ ${label}\n  - ${routeFailures.join('\n  - ')}`);
    return false;
  }
  console.log(`✓ ${label}`);
  return true;
}

const config = readSiteConfig();
const pages = sitePages(config).filter((entry) => entry.url);
const landscapePages = pages.filter((entry) => {
  if (entry.url === '/') return true;
  if (!entry.url.startsWith('/games/')) return false;
  const gameId = entry.url.split('/').filter(Boolean).pop();
  return MOBILE_GAME_CONFIG[gameId]?.immersiveMode !== 'none';
});
const totalChecks = pages.length * 2 + landscapePages.length;
const chromePath = findChrome();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-smoke-'));
const { server, port, notFound } = await startStaticServer();
let cdp = null;

console.log(`浏览器冒烟校验（桌面 ${pages.length} + 移动竖屏 ${pages.length} + 移动横屏 ${landscapePages.length}，共 ${totalChecks} 项，Chrome: ${path.basename(chromePath)}）`);

let failures = 0;
try {
  cdp = await launchChrome(chromePath, profileDir);
  let baseOrigin = '';

  for (const entry of pages) {
    const url = `http://127.0.0.1:${port}${entry.url}`;
    if (!baseOrigin) baseOrigin = new URL(url).origin;
    const ok = await runSingleCheck(cdp, {
      label: `[desktop] ${entry.url}`,
      url,
      viewport: DESKTOP_VIEWPORT,
      verify: async (session) => {
        if (entry.url === '/') {
          await verifyLobbyPage(session, config);
        } else if (entry.url.startsWith('/categories/')) {
          await verifyCategoryPage(session, config, entry.url);
        } else if (entry.url.startsWith('/games/')) {
          const gameId = entry.url.split('/').filter(Boolean).pop();
          await verifyGamePage(session, gameId);
        }
      },
    });
    if (!ok) failures += 1;
  }

  for (const entry of pages) {
    const ok = await runSingleCheck(cdp, {
      label: `[mobile-portrait] ${entry.url}`,
      url: new URL(entry.url, baseOrigin).href,
      viewport: MOBILE_PORTRAIT_VIEWPORT,
      verify: (session) => verifyMobilePortraitPage(session, config, entry),
    });
    if (!ok) failures += 1;
  }

  for (const entry of landscapePages) {
    const ok = await runSingleCheck(cdp, {
      label: `[mobile-landscape] ${entry.url}`,
      url: new URL(entry.url, baseOrigin).href,
      viewport: MOBILE_LANDSCAPE_VIEWPORT,
      verify: (session) => verifyMobileLandscapePage(session, config, entry),
    });
    if (!ok) failures += 1;
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
    if (cdp.chrome.exitCode === null) {
      try { cdp.chrome.kill('SIGKILL'); } catch {}
      await sleep(100);
    }
  }
  server.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n✗ 浏览器冒烟校验未通过（失败页面/项：${failures}）`);
  process.exit(1);
}
console.log(`\n✓ 全部 ${totalChecks} 项桌面与移动端浏览器冒烟校验通过`);
