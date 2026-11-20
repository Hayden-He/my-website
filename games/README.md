# 游戏开发与发布

## 新增游戏

1. 在 `assets/games.js` 登记游戏。沿用现有条目的字段，给出小写短横线 `id`、标题、图标、分类、简介和 `/games/<id>/` 地址。有最高分的游戏填写独立的 `storageKey`。分类名称须与分类定义一致。大厅、分类页与游戏间推荐会使用这份清单。
2. 计分游戏可运行 `node scripts/new-game.mjs <id>`。脚本复制 `games/_template/index.html`，填入游戏资料、分类链接和纪录键，再同步站点元数据。已有同名页面时会拒绝覆盖。
3. 在新页面实现棋盘、规则和操作，补齐 `assets/icons.svg` 中的 `game-<icon>` 图标，以及 `assets/i18n.js` 中的英文。新增游戏后，按需更新 `scripts/og-image.html` 并用 `node scripts/make-og-image.mjs` 导出共享分享图，该脚本需要本机 Chrome。
4. 运行 `node scripts/sync-site.mjs /games/<id>/` 更新该页修改日期、SEO、站点地图和内联图标。运行 `node scripts/build-site.mjs`，在 320px 窄屏、键盘和触屏上试玩。

## 共用能力

- `assets/style.css` 管理大厅、导航、卡片、页脚和通用弹窗。游戏页共用 `assets/game-shell.css` 提供的 HUD、工具栏、结算遮罩和教学。
- `GameKit` 提供纪录、音效按钮、滑动识别、键盘守卫、切后台处理及推荐。使用 `GameKit.bindSwipe()` 时，将 `touch-action: none` 限定在滑动游戏的操作区域。
- `assets/game-rules.js` 提供投篮计分与碰撞、2048 合并和数字华容道洗牌。规则可用固定输入单独校验。
- 重开等会丢失进度的操作使用 `SiteData.confirmDialog`。结算应停止棋盘输入，键盘操作时保留可见焦点，切到后台应暂停实时游戏。
- 静态双语文案用 `data-i18n`，属性用 `data-i18n-attr`。动态文案用 `I18N.t()`，并在 `i18n:change` 时重绘。通过变量传入的词条需要额外核对。
- 游戏应支持触屏和键盘完整游玩。极速切水果使用触屏或鼠标绘制挥砍轨迹，键盘可用于操作按钮。保留浏览器缩放。扫雷窄屏新开局为 9×9，缩窗前已有进度的棋局原样保留。

## 存储

- `game_best_<id>[_<mode>]` 保存纪录，使用不同规则的模式应分开计。
- `game_mode_<id>` 保存模式偏好，`game_save_<id>_...` 保存进行中的棋局，`game_skin_<id>` 保存外观，`game_tutorial_<id>` 标记已看过的教学。
- `site_lang` 保存语言选择，清除本地数据时保留。
- 2048 仅在存档有效、已有操作且棋盘仍可走时显示「继续上局」。有效移动后即使是 0 分也会续玩。

## 游戏模块与本地原型

- 游戏页可通过 `./modules/` 引用同目录下的脚本、样式或资源。构建为整个模块目录生成同一个指纹，并保留目录结构。双语校验会扫描模块内的 JS 和 MJS，第三方代码放在 `modules/vendor/`。
- 原型可运行 `node scripts/build-site.mjs --preview-game <id>` 本地构建，再通过静态 HTTP 服务访问输出中的 `/prototypes/<id>/`。
- 方块工坊使用 npm 的 `three@0.187.0`，页面载入官方 WebGL 模块及其 core 模块。第三方许可放在 `games/block-workshop/modules/vendor/LICENSE`。

## Cloudflare Pages

- 构建命令为 `node scripts/build-site.mjs`，输出目录为 `dist`。构建先执行结构和双语校验，产物只包含正式页面、站点资源和响应头配置。
- 分类链接与 canonical 使用 `/categories/<id>`。构建保留 `categories/<id>.html` 文件，由 Pages 处理无扩展名路由。首页、两个分类与九款游戏共十二个可索引页面，404 和模板不进站点地图。
- 用 `node scripts/sync-site.mjs [已更新页面的 URL 路径…]` 从游戏清单同步 canonical、分享标签、站点地图及内联图标。参数仅用于更新指定页面的 `lastmod`。
- 构建按资源内容生成带指纹的 URL，并写入供「检查更新」使用的构建编号。固定 URL 的分享图可重新验证。`node scripts/bump-assets.mjs` 保留给仍依赖旧版查询参数的页面兼容使用。
