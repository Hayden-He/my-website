# 游戏目录说明（新增游戏前先看这里）

## 目录结构

```
assets/
  style.css         站点外壳（导航、卡片、页脚、自定义弹窗/toast）
  game-shell.css    游戏页公共 UI（HUD、工具栏、按钮、结算遮罩、更多游戏、首次教学）
  game-kit.js       游戏页公共逻辑（最高分、音效按钮、键盘守卫、切后台、更多游戏、教学）
  games.js          分类与游戏清单（唯一数据源）
  app.js            首页/分类页渲染
  site-data.js      音效上下文、清除本地数据、自定义弹窗、toast
  i18n.js           中英文词典与切换逻辑（中文原文作为 key）
  icons.svg         自绘 SVG 图标 sprite（品牌/5 个游戏/分类/UI）
  icon.svg          站点图标源文件（favicon）
  icons/            PWA 192/512 与 apple-touch-icon 图标
  og-image.jpg      1200×630 分享图（JPEG，约 52KB，og:image）
games/
  _template/        可复制的新游戏模板
  <id>/index.html   每个游戏一个页面
sitemap.xml         8 个可索引页的 URL 清单
robots.txt          爬虫规则 + sitemap 指向
scripts/
  check-site.mjs    部署前结构校验
  check-i18n.mjs    中英文案覆盖校验
  og-image.html     OG 分享图源文件（1200×630）
  make-og-image.mjs 从源文件生成 assets/og-image.jpg
```

游戏页只保留**自己棋盘/球场/网格**的 CSS 和玩法 JS；HUD、按钮、遮罩、提示、更多游戏、音效按钮、最高分读写都用公共外壳。

## 新增一个游戏（7 步）

1. 复制 `games/_template/` 为 `games/<id>/`，把 `<id>` 换成小写字母/数字/短横线。
2. 在 `assets/games.js` 的 `games` 里加一条：
   ```js
   {
     id: '<id>',
     title: '游戏名',
     icon: 'basketball',           // 对应 assets/icons.svg 的 #game-basketball
     category: 'arcade',          // 必须是 categories 里已有的 id
     categoryName: '动作街机',    // 必须和分类 name 完全一致
     description: '一句话说清玩法与卖点。',
     url: '/games/<id>/',
     storageKey: 'game_best_<id>',
     bestPrefix: '最高分: ',
     tags: ['操作方式', '玩法标签'],
   }
   ```
   分类页会自动出卡，不需要改 HTML。
3. 改页面：`<title>`、`meta description`、顶栏 `<h1>`、分类链接、`--game-width`。
   同时补该页的 SEO（`canonical`、`og:*`、`twitter:*`）：
   - `og:title` 用“游戏名 · Little Playground”；
   - `og:description` 用该页 `meta description`，描述保持中文；
   - `og:image` 用共享的 `https://my-website-all.pages.dev/assets/og-image.jpg`；
   - 把 `/games/<id>/` 加进 `sitemap.xml`（`lastmod` 同步更新）；`check-site` 会拦漏。
   顶栏 h1 不再用 emoji，改为“自绘图标 + 可翻译文字”：
   ```html
   <h1 class="game-topbar-title">
     <svg class="title-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
       <use href="#game-<icon>"></use>
     </svg>
     <span data-i18n="游戏名">游戏名</span>
   </h1>
   ```
   新游戏先在 `assets/icons.svg` 里加一个 `game-<icon>` symbol；卡片、“换个游戏”和 h1 会自动用它。
4. 接公共能力（按需）：
   ```js
   const sound = GameKit.bindSoundButton(soundBtn, SiteData.getSound(), (on) => {
     soundEnabled = on;
   });
   const best = GameKit.readBest('game_best_<id>');
   GameKit.saveBestIfHigher('game_best_<id>', score);
   GameKit.onHidden(() => setPaused(true));
   document.addEventListener('site:dialogopen', () => setPaused(true));
   GameKit.mountMoreGames('<id>', document.getElementById('more-games'));
   GameKit.showTutorial({ id: '<id>', steps: [{ icon: '💡', title: '…', text: '…' }] });
   ```
   键盘事件统一用：
   ```js
   if (GameKit.shouldIgnoreGameKey(e, { ignoreOnControl: true })) return;
   if (SiteData.isDialogOpen && SiteData.isDialogOpen()) return;
   ```
5. 需要确认/提示时不要用原生 `confirm/alert`：
   ```js
   const ok = await SiteData.confirmDialog({
     title: '重开本局',
     message: '当前进度将被清除。',
     confirmText: '重开',
     cancelText: '继续',
     danger: true,
   });
   if (ok) restart();
   SiteData.toast('已保存');
   ```
6. **国际化（必须）**：
   - 所有上屏文案都要中英双语。静态文案加 `data-i18n="中文原文"`，属性加 `data-i18n-attr="aria-label:中文原文"`；动态文案用 `I18N.t('中文原文 {param}', { param })`。
   - 页面 `<head>` 里在 `site-data.js` 之后加载 `<script src="/assets/i18n.js"></script>`；顶栏右侧加语言按钮：
     ```html
     <div class="game-topbar-actions">
       <a class="game-topbar-cat" href="/categories/puzzle.html" data-i18n="益智休闲">益智休闲</a>
       <button class="lang-btn" type="button" data-lang-toggle>EN</button>
     </div>
     ```
   - 给 `assets/i18n.js` 的 `EN` 词典补：页面 title/meta description、h1、返回/分类、HUD 标签、按钮、提示、遮罩、教学、画布文案、aria，以及游戏卡片的 title/description/tags/bestPrefix/bestSuffix。
   - **不要**给 JS 会动态改写的元素（结算标题/说明、计时、最高分、场景名、暂停按钮等）加 `data-i18n`，否则页面初始化时 `I18N.apply` 会把动态值覆盖掉；这些元素在展示时用 `I18N.t(...)` 设置，并监听 `i18n:change` 重设。静态文案由 `I18N.apply` 自动处理。
   - 游戏页默认中文；语言选择记在 `site_lang`，同 URL 即时切换，不需要 `/en/` 路由。
   - 通过变量/条件传入 `I18N.t` 的文案（如 `t(step.title)`）不会被静态扫描到，记得一并补词典。
7. 跑校验：`node scripts/check-site.mjs && node scripts/check-i18n.mjs`。

## SEO / 分享（8 个可索引页）

- 可索引页：首页 + 2 分类 + 5 游戏 = **8 个**；`404.html` 有 `noindex`，不进 sitemap。
- 每页必须有：`canonical`、`og:type/site_name/locale/title/description/url/image`、`og:image:type/width/height/alt`、`twitter:card/title/description/image/alt`。
- 共享分享图：`assets/og-image.jpg`（1200×630，中英双语品牌卡）。源文件 `scripts/og-image.html`；改品牌或游戏列表后运行 `node scripts/make-og-image.mjs` 重新生成（需要本机 Chrome，可用 `CHROME_PATH` 指定；无 npm 依赖）。
- `sitemap.xml`：8 个 URL；页面内容更新时同步改 `lastmod`。
- `robots.txt`：允许抓取并指向 sitemap。
- 域名默认 `https://my-website-all.pages.dev`；换自定义域名时，同步改 8 个页面的 canonical/og:url/og:image、`sitemap.xml`、`robots.txt`、`check-site` 的 `SITE_URL`。
- 社交爬虫不执行 JS：页面静态文案是中文，所以分享卡面是中文标题 + 中英双语图片；如需静态英文 SEO，需要另开 `/en/` 路由，属于更大改动。

## 移动端与可访问性底线

- 320px 宽必须无横向溢出；HUD/按钮不能把文字挤成竖排。
- 手机触屏与桌面键盘都要能完整玩；按钮聚焦时空格/回车不能被游戏快捷键抢走。
- 不要重新加 `user-scalable=no` 或 `maximum-scale=1`（校验脚本会报错）。
- 游戏页必须有且只有一个 `<h1>`；遮罩出现时棋盘不能继续接收操作。
- 扫雷的 12×12/16×16 在 ≤600px 会被隐藏（格子小于 25px，误触严重）；新游戏如有类似精度问题，优先限制入口而不是硬塞。

## 存储键约定

`site-data.js` 的“清除本地数据”按前缀清理，新增键请沿用：

- `game_best_<id>` / `game_best_<id>_<mode>`：最高分、最快用时
- `game_mode_<id>`：难度/模式偏好
- `game_save_<id>_...`：进行中的存档
- `game_skin_<id>`：外观
- `game_tutorial_<id>`：首次教学是否看过
- `site_lang`：站点语言偏好（zh/en），清除本地数据不会重置它

## 进行中存档 / 首页“继续上局”

目前只有 2048 在首页卡片显示“继续上局”，逻辑在 `assets/app.js` 的 `get2048Resume()`。触发条件是：存档存在、棋盘非空、且还有可走步（0 分也会显示；死局不显示）。新游戏如果有可恢复存档，需要：

1. 用 `game_save_<id>_...` 保存；
2. 在 `app.js` 里扩展 resume 检测，并把按钮文案改成“继续上局 · …”；
3. 游戏页启动时自动读取存档。

## 模板与校验

- 模板：`games/_template/index.html`，包含 HUD、音效、最高分、重开确认、更多游戏、自定义弹窗的完整示例；复制后按第 3 步补自绘 h1 图标。
- 图标：`assets/icons.svg` 是站内自绘 SVG sprite（由 `node scripts/inline-icons.mjs` 内联到页面）；品牌/游戏/分类/音效/暂停/重开/撤回/旗帜都在这里，不依赖系统 emoji，也不引外部 CDN。
- 扫雷是“首次教学 + 工具栏常驻玩法按钮”的现成例子：首次自动展示，之后可用 `GameKit.showTutorial({ ..., force: true })` 重看。
- 结构校验：`node scripts/check-site.mjs`，会检查配置文件、页面存在性、分类名一致、storageKey 唯一、公共外壳与 i18n/图标引用、语言按钮、h1/meta、更多游戏入口、PWA manifest/图标、SEO（canonical/OG/Twitter）、sitemap/robots/OG 图、禁止缩放等。
- 英文覆盖：`node scripts/check-i18n.mjs`，检查页面、脚本、游戏元数据里的中文 key 是否都在 `assets/i18n.js` 的 EN 词典里。
- 建议在部署前（或 CI）执行；两个校验都通过再 push。
