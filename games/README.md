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
games/
  _template/        可复制的新游戏模板
  <id>/index.html   每个游戏一个页面
scripts/
  check-site.mjs    部署前结构校验
```

游戏页只保留**自己棋盘/球场/网格**的 CSS 和玩法 JS；HUD、按钮、遮罩、提示、更多游戏、音效按钮、最高分读写都用公共外壳。

## 新增一个游戏（6 步）

1. 复制 `games/_template/` 为 `games/<id>/`，把 `<id>` 换成小写字母/数字/短横线。
2. 在 `assets/games.js` 的 `games` 里加一条：
   ```js
   {
     id: '<id>',
     title: '游戏名',
     icon: '🎮',
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
6. 跑校验：`node scripts/check-site.mjs`。

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

## 进行中存档 / 首页“继续上局”

目前只有 2048 在首页卡片显示“继续上局”，逻辑在 `assets/app.js` 的 `get2048Resume()`。触发条件是：存档存在、棋盘非空、且还有可走步（0 分也会显示；死局不显示）。新游戏如果有可恢复存档，需要：

1. 用 `game_save_<id>_...` 保存；
2. 在 `app.js` 里扩展 resume 检测，并把按钮文案改成“继续上局 · …”；
3. 游戏页启动时自动读取存档。

## 模板与校验

- 模板：`games/_template/index.html`，包含 HUD、音效、最高分、重开确认、更多游戏、自定义弹窗的完整示例。
- 扫雷是“首次教学 + 工具栏常驻玩法按钮”的现成例子：首次自动展示，之后可用 `GameKit.showTutorial({ ..., force: true })` 重看。
- 校验：`node scripts/check-site.mjs`，会检查配置文件、页面存在性、分类名一致、storageKey 唯一、公共外壳引用、h1/meta、更多游戏入口、禁止缩放等。
- 建议在部署前（或 CI）执行一次；校验通过再 push。
