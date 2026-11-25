# 小游乐场 · Little Playground

打开即玩的纯静态在线小游戏合集，零第三方运行时依赖（除方块工坊离线内置 `three.min.js` 外），支持电脑与手机游玩、中英文切换、深浅色三态主题与本地数据备份恢复。

- 在线地址：`my-website-all.pages.dev`
- 部署方式：Cloudflare Pages（构建命令 `node scripts/build-site.mjs`，输出目录 `dist`）

## 收录游戏（12 款）

- **动作街机**：街头投篮、经典贪吃蛇、极速切水果、太空战机、经典打砖块、坦克迷宫
- **益智休闲**：经典 2048、经典扫雷、数字华容道、记忆翻牌、方块工坊（3D）、俄罗斯方块

## 常用命令

```bash
# 1. 结构与双语校验
node scripts/check-site.mjs
node scripts/check-i18n.mjs

# 2. 构建产物（输出到 dist/）
node scripts/build-site.mjs

# 3. 本地预览（需通过 HTTP 服务访问，勿直接 file:// 打开）
python3 -m http.server 8000 -d dist

# 4. 单元测试与无头 Chrome 全站冒烟
node --test tests/*.test.mjs
node scripts/smoke-browser.mjs
```

## 目录说明

- `index.html` / `404.html` / `categories/`：大厅、404 与分类页源码
- `games/`：12 款游戏与新增模板（开发规范见 [`games/README.md`](./games/README.md)）
- `assets/`：全站样式、脚本、双语词典、SVG 图标与 WebP 预览图
- `scripts/`：构建、结构校验、双语校验、分享图导出与无头浏览器冒烟脚本
- `tests/`：核心规则、大厅纪录、数据备份、主题与构建单测
