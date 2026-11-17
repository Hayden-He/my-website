#!/usr/bin/env node
/**
 * 生成 assets/og-image.jpg（1200×630 分享图）
 *
 * 用法：
 *   node scripts/make-og-image.mjs
 *   CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/make-og-image.mjs
 *
 * 设计：
 * - 页面源文件是 scripts/og-image.html，使用站内 assets/icons.svg 的自绘图标；
 * - 脚本只依赖本机 Chrome/Chromium + Node 内置模块（无 npm 依赖）；
 * - 脚本临时启动本地静态服务（用于加载同源 SVG sprite），用 CDP 截图后退出；
 * - 生成结果写入 assets/og-image.jpg，供 og:image 使用（JPEG，质量 82，控制微信/QQ 预取体积）。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'assets', 'og-image.jpg');
const chromePath = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error('✗ ' + message);
  process.exit(1);
}

if (!fs.existsSync(chromePath)) {
  fail(`找不到 Chrome：${chromePath}\n请通过 CHROME_PATH 指定本机 Chrome/Chromium 路径。`);
}

const server = http.createServer((req, res) => {
  try {
    const requestPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const filePath = path.join(root, requestPath);
    if (!filePath.startsWith(root + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-chrome-'));
const chrome = spawn(
  chromePath,
  [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profileDir,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

let browserWsUrl = '';
for (let i = 0; i < 100; i += 1) {
  if (chrome.exitCode !== null) fail('Chrome 启动失败，请检查 CHROME_PATH。');
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  if (fs.existsSync(portFile)) {
    const lines = fs.readFileSync(portFile, 'utf8').trim().split('\n');
    if (lines[1]) {
      browserWsUrl = `ws://127.0.0.1:${lines[0]}${lines[1]}`;
      break;
    }
  }
  await sleep(50);
}
if (!browserWsUrl) fail('Chrome 没有暴露调试端口。');

async function connect() {
  const browserWs = new WebSocket(browserWsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  browserWs.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    } else if (message.method) {
      events.push(message);
    }
  };
  await new Promise((resolve, reject) => {
    browserWs.onopen = resolve;
    browserWs.onerror = reject;
  });
  const send = (method, params = {}, sessionId) => {
    const messageId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(messageId, { resolve, reject });
      browserWs.send(JSON.stringify({ id: messageId, method, params, sessionId }));
    });
  };
  return { browserWs, send, events };
}

let browser;
try {
  browser = await connect();
  const target = await browser.send('Target.createTarget', { url: 'about:blank' });
  const attached = await browser.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sessionId = attached.sessionId;

  const send = (method, params = {}) => browser.send(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 630,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/scripts/og-image.html` });
  for (let i = 0; i < 120; i += 1) {
    if (browser.events.some((event) => event.method === 'Page.loadEventFired')) break;
    await sleep(50);
  }
  await sleep(900);
  await send('Runtime.evaluate', { expression: 'document.fonts && document.fonts.ready', awaitPromise: true });
  const screenshot = await send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 82,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 },
  });
  fs.writeFileSync(outputPath, Buffer.from(screenshot.data, 'base64'));
  const size = fs.statSync(outputPath).size;
  console.log(`✓ 已生成 ${path.relative(root, outputPath)}（1200×630，${Math.round(size / 1024)} KB）`);
  browser.browserWs.close();
} catch (error) {
  fail(error.message);
} finally {
  server.close();
  chrome.kill('SIGTERM');
  await sleep(200);
  fs.rmSync(profileDir, { recursive: true, force: true });
}
