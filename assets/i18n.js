/**
 * 全站中英文切换（零依赖、同 URL 即时切换）
 *
 * 设计：
 * - 中文原文本身就是 key，英文词典是“中文原文 -> English”的平铺表；
 *   这样不用给每条文案另起 key，也不会出现“词典里有、页面里没用到”的重复维护。
 * - 静态 DOM 用 data-i18n="中文原文" / data-i18n-attr="aria-label:中文原文"；
 * - 运行时动态文案用 I18N.t('中文原文 {param}', { param: ... })。
 * - 语言保存在 localStorage 的 site_lang，默认中文。
 */
(function () {
  const STORAGE_KEY = 'site_lang';
  const EN = {
    // ---- 站点 / 导航 / 通用 ----
    '小游乐场': 'Little Playground',
    '全部游戏': 'All Games',
    '动作街机': 'Arcade',
    '考验反应与手感的街机挑战，随时刷新个人纪录':
      'Fast-paced challenges that test your reflexes and feel—set a new personal best.',
    '轻松动脑、节奏自在的经典数字、逻辑与记忆小游戏':
      'Relaxed number, logic and memory games—perfect for a quick break.',
    '益智休闲': 'Puzzle',
    '主导航': 'Main navigation',
    '音效: 开': 'Sound: On',
    '音效: 关': 'Sound: Off',
    '音效开': 'Sound on',
    '音效关': 'Sound off',
    '继续上次未完成的棋局': 'Continue your previous game',
    '音效已开启，点击关闭': 'Sound is on. Click to mute.',
    '音效已关闭，点击开启': 'Sound is off. Click to unmute.',
    '关闭音效': 'Mute',
    '开启音效': 'Unmute',
    '开始游戏 →': 'Play →',
    '开始游戏': 'Start',
    '继续上局 · {board} →': 'Continue · {board} →',
    '继续上局 · {board} {score} 分 →': 'Continue · {board} {score} pts →',
    '共 {n} 款': '{n} games',
    '共 {n} 款 · 已留纪录 {recorded} 款': '{n} games · {recorded} with a record',
    '无需下载 · 电脑与手机均可畅玩': 'No downloads · Play on desktop and mobile',
    '清除本地数据': 'Clear local data',
    '换个游戏': 'More games',
    '玩法': 'How to play',
    '查看玩法': 'View how to play',
    '跳过': 'Skip',
    '下一步': 'Next',
    '取消': 'Cancel',
    '清除': 'Clear',
    '重开': 'Restart',
    '继续本局': 'Keep playing',
    '暂停': 'Pause',
    '继续': 'Resume',
    '知道了': 'OK',
    '确定': 'OK',
    '提示': 'Notice',
    '再来一局': 'Play again',
    '继续挑战': 'Keep playing',
    '查看棋盘': 'View board',
    '撤回': 'Undo',
    '← 返回大厅': '← Lobby',
    '返回全部游戏': 'Back to all games',
    '来一局投篮': 'Play some hoops',

    // ---- 首页 ----
    '随时随地，轻松开局': 'Pick up and play, anytime',
    '零下载、打开即玩，键盘鼠标与手机触屏都能上手；每款游戏的最高纪录会自动保存在本机，2048 棋局还能随时续玩。':
      'No downloads, instant play with keyboard, mouse or touch. Your best scores are saved on this device, and your 2048 game can be resumed anytime.',

    // ---- 分类页 ----
    '动作街机 🏀': 'Arcade 🏀',
    '考验反应与手感的街机挑战，投篮、贪吃蛇各有玩法，随时刷新自己的纪录。':
      'Fast-paced arcade challenges—shoot hoops or grow the snake and chase a new personal best.',
    '动作街机游戏': 'Arcade games',
    '益智休闲 🧩': 'Puzzle 🧩',
    '轻松动脑、节奏自在的经典数字、逻辑与记忆游戏，适合碎片时间放松一下。':
      'Relaxed brain-teasers—numbers, logic and memory for a quick break.',
    '益智休闲游戏': 'Puzzle games',

    // ---- 404 ----
    '页面未找到 - 小游乐场': 'Page not found - Little Playground',
    '这关还没解锁': "This level isn't unlocked",
    '你似乎走到了地图边缘，不如回到大厅挑一局新游戏。':
      "You've reached the edge of the map. How about a new game from the lobby?",

    // ---- 游戏卡片 / 游戏元数据 ----
    '街头投篮 🏀': 'Street Hoops 🏀',
    '经典贪吃蛇 🐍': 'Classic Snake 🐍',
    '经典 2048 🔢': '2048 🔢',
    '经典扫雷 💣': 'Minesweeper 💣',
    '记忆翻牌 🃏': 'Memory Match 🃏',
    '街头投篮': 'Street Hoops',
    '经典贪吃蛇': 'Classic Snake',
    '经典 2048': '2048',
    '经典扫雷': 'Minesweeper',
    '记忆翻牌': 'Memory Match',
    '连点升空，把握落点让球空心入网；打板、火焰连击与金球加倍，挑战高分极限。':
      'Tap to rise and time your drop for a swish; bank shots, fire combos and gold balls double the score.',
    '吃掉果子与限时金星不断成长，还有冰果减速；支持经典撞墙与自由穿墙双模式。':
      'Eat fruit and timed stars to grow; ice fruit slows you down. Play with walls or wrap-around.',
    '滑动合并相同数字，支持 4×4 与 5×5 棋盘、自动存档与单步撤回。':
      'Slide and merge matching numbers on 4×4 or 5×5 boards, with autosave and one-step undo.',
    '首击必安全、点击数字即可快捷排雷，三档难度，用最稳的推理清空雷区。':
      'Your first click is always safe; click a number to chord. Three difficulties—clear the field with solid deduction.',
    '翻开两张相同图案配对，记住位置，用更少步数清空牌桌。':
      'Flip two matching tiles and remember their spots; clear the board in as few moves as possible.',
    '连击挑战': 'Combo challenge',
    '键盘/划屏': 'Keys / swipe',
    '双模式': 'Two modes',
    '滑动/方向键': 'Swipe / arrows',
    '可撤回': 'Undo',
    '推理排雷': 'Deduction',
    '三档难度': '3 difficulties',
    '记忆配对': 'Memory match',
    '双尺寸': 'Two sizes',
    '最高分: ': 'Best: ',
    '经典模式最高: ': 'Classic best: ',
    '4×4 最高: ': '4×4 best: ',
    '任意难度最快: ': 'Fastest (any): ',
    '4×4 最少步: ': '4×4 fewest: ',
    ' 步': ' moves',
    's': 's',

    // ---- 页面标题 / 描述 ----
    '小游乐场 - 在线小游戏合集': 'Little Playground - Free Online Mini Games',
    '小游乐场：打开即玩的在线轻游戏合集，包含街头投篮、经典贪吃蛇、经典 2048、经典扫雷与记忆翻牌，支持电脑与手机。':
      'Little Playground: instant online mini games—Street Hoops, Classic Snake, 2048, Minesweeper and Memory Match. Play on desktop or mobile.',
    '动作街机 - 小游乐场': 'Arcade - Little Playground',
    '动作街机分类：街头投篮、经典贪吃蛇等考验反应的小游戏。':
      'Arcade games: Street Hoops, Classic Snake and more reflex-based challenges.',
    '益智休闲 - 小游乐场': 'Puzzle - Little Playground',
    '益智休闲分类：经典 2048、经典扫雷、记忆翻牌等轻松动脑的小游戏。':
      'Puzzle games: 2048, Minesweeper, Memory Match and more relaxed brain-teasers.',
    '街头投篮 - 小游乐场': 'Street Hoops - Little Playground',
    '街头投篮：点击或按空格起跳，空心入网、打板进球，挑战你的最高分。':
      'Street Hoops: tap or press Space to rise, sink swishes and bank shots, and chase your best score.',
    '经典贪吃蛇 - 小游乐场': 'Classic Snake - Little Playground',
    '经典贪吃蛇：支持键盘与连续划屏，含经典撞墙与自由穿墙双模式。':
      'Classic Snake: keyboard and swipe controls, with walls or wrap-around modes.',
    '经典 2048 - 小游乐场': '2048 - Little Playground',
    '经典 2048：丝滑滑动合并方块，支持 4×4 与 5×5 棋盘、自动存档与单步撤回。':
      '2048: slide and merge tiles on 4×4 or 5×5 boards, with autosave and one-step undo.',
    '经典扫雷 - 小游乐场': 'Minesweeper - Little Playground',
    '经典扫雷：首击必安全、支持数字快捷排雷与三档难度，支持电脑与手机。':
      'Minesweeper: a safe first click, number chords and three difficulties, on desktop and mobile.',
    '记忆翻牌 - 小游乐场': 'Memory Match - Little Playground',
    '记忆翻牌：翻开两张相同图案配对，支持 4×4 与 5×4 牌桌，步数越少越好。':
      'Memory Match: flip two matching tiles on 4×4 or 5×4 boards. Fewer moves is better.',

    // ---- 2048 ----
    '玩法：': 'How to play: ',
    '相同数字相撞合并翻倍，目标合成': 'Merge matching tiles to reach',
    '当前得分': 'Score',
    '最大方块': 'Max',
    '模式最高': 'Best',
    '4×4 经典': '4×4 Classic',
    '5×5 轻松': '5×5 Relaxed',
    '没有可移动的方块了': 'No moves left',
    '电脑按 ↑ ↓ ← → 或 WASD 移动，手机在棋盘上滑动；新手推荐先试 5×5':
      'Use the arrow keys or WASD; swipe on mobile. New here? Try 5×5 first.',
    '恭喜合成 2048！🎉': 'You made 2048! 🎉',
    '当前得分：{score}，你可以继续挑战更高数字！': 'Score: {score}. Keep going for higher tiles!',
    '🎉 新纪录！': '🎉 New record! ',
    '本局得分：{score} · 最大方块：{tile}（本模式最高：{best}）':
      'Score: {score} · Best tile: {tile} (mode best: {best})',
    '重开棋局': 'Restart game',
    '重开 {size}×{size} 棋局？当前进度将被清除。':
      'Restart the {size}×{size} board? Current progress will be lost.',
    '棋盘尺寸': 'Board size',

    // ---- 贪吃蛇 ----
    '经典撞墙': 'Walls',
    '自由穿墙': 'Wrap',
    '游戏结束': 'Game over',
    '得分：0': 'Score: 0',
    '🍎+10 · ⭐金星+30（限时）· ❄️冰果减速 · 方向键/WASD/划屏 · 空格/P 暂停':
      '🍎+10 · ⭐Star+30 (timed) · ❄️Ice slows you · Arrows/WASD/swipe · Space/P pause',
    '按方向键 / WASD 或点击画面开始 🐍': 'Press an arrow key / WASD or tap to start 🐍',
    '已暂停（点击或按空格继续）': 'Paused (tap or press Space to resume)',
    '❄️ 减速中': '❄️ Slowed',
    '+15 ❄️减速': '+15 ❄️Slow',
    '本局得分：{score}（本模式最高：{best}）': 'Score: {score} (mode best: {best})',
    '通关！🎉': 'Cleared! 🎉',
    '★ 消失了': '★ expired',
    '❄️ 消失了': '❄️ expired',
    '方向控制': 'Direction controls',
    '游戏模式': 'Game mode',

    // ---- 扫雷 ----
    '剩余地雷': 'Mines',
    '当前用时': 'Time',
    '最佳用时': 'Best',
    '9×9': '9×9',
    '12×12': '12×12',
    '16×16': '16×16',
    '模式: 翻开': 'Mode: Reveal',
    '模式: 🚩插旗': 'Mode: 🚩Flag',
    '12×12 / 16×16 建议在平板或桌面挑战': '12×12 / 16×16: play on a tablet or desktop',
    '排雷成功！🎉': 'Cleared! 🎉',
    '用时：0s': 'Time: 0s',
    '电脑左键翻开、右键插旗；手机长按或切换「插旗模式」标记；点击已翻开数字可快捷排雷':
      'Left-click/tap to reveal; right-click or long-press to flag; click a revealed number to chord.',
    '9×9 轻松': '9×9 Easy',
    '12×12 标准': '12×12 Standard',
    '16×16 挑战': '16×16 Hard',
    '踩到地雷了 💥': 'Boom! 💥',
    '坚持了 {elapsed} 秒，再试一次吧！': 'You lasted {elapsed}s. Try again!',
    '{label} · 用时 {sec} 秒（最佳 {best} 秒）': '{label} · Time {sec}s (best {best}s)',
    '目标：翻开所有安全格': 'Goal: reveal every safe tile',
    '把所有不是雷的格子翻开就赢；不需要去点雷。':
      'Open every tile that is not a mine to win; you never need to click a mine.',
    '数字 = 周围 8 格雷数': 'Numbers = adjacent mines',
    '数字表示它周围 8 格里有几颗雷，不是全盘剩余的雷数。':
      'A number shows how many mines are in its 8 neighbors, not the total left.',
    '翻开与插旗': 'Reveal & flag',
    '点击或左键翻开；右键或手机长按插旗。第一下一定安全，会先翻出一片空白。':
      'Click/tap or left-click to reveal; right-click or long-press to flag. The first click is always safe and opens a blank area.',
    '快捷排雷': 'Quick clear',
    '当一个数字周围的旗子数等于它时，点击这个数字可一次翻开其余相邻格。':
      'When a number has exactly that many flags around it, click the number to open all remaining neighbors at once.',
    '第 {row} 行第 {col} 列，{state}': 'Row {row}, column {col}, {state}',
    '踩中的地雷': 'the mine you hit',
    '地雷': 'mine',
    '插错的旗子': 'wrong flag',
    '已插旗': 'flagged',
    '已翻开，周围 {adj} 颗雷': 'revealed, {adj} mines nearby',
    '已翻开，周围 1 颗雷': 'revealed, 1 mine nearby',
    '已翻开，空白': 'revealed, blank',
    '未翻开': 'hidden',
    '难度选择': 'Difficulty',

    // ---- 投篮 ----
    '总得分': 'Score',
    '进球倒计时': 'Clock',
    '空心入网': 'Swish',
    '打板进球': 'Bank',
    '最高分': 'Best',
    '+4 · 火焰+5': '+4 · Fire +5',
    '+3': '+3',
    '当前场景': 'Court',
    '下一场景 15 分': 'Next: 15 pts',
    '下一场景 30 分': 'Next: 30 pts',
    '下一场景 60 分': 'Next: 60 pts',
    '下一场景 100 分': 'Next: 100 pts',
    '已解锁全部场景': 'All scenes unlocked',
    '时间到！🏀': "Time's up! 🏀",
    '本局得分：0': 'Score: 0',
    '按空格或回车也可重开': 'Space or Enter to restart',
    '操作：连续点击球场 / 连按空格升空，停手后下落；': 'Tap the court / press Space to rise; stop to drop. ',
    'P 暂停': 'P pause',
    '机制：进球重置倒计时 · 连续空心触发火焰连击 · 每 5 球金球 ×2 · 25/50/80 分护盾进阶':
      'Goals reset the clock · back-to-back swishes ignite fire · every 5th goal is a gold ×2 ball · shields at 25/50/80',
    '用球: {name}': 'Ball: {name}',
    '经典篮球': 'Classic',
    '蔚蓝星球': 'Blue Planet',
    '寒冰晶球': 'Ice Crystal',
    '深海气泡': 'Deep Sea',
    '黑金夜影': 'Black Gold',
    '黄昏街头': 'Sunset',
    '暮色球场': 'Dusk',
    '夜场灯光': 'Night',
    '极光球场': 'Aurora',
    '星河球场': 'Starry',
    '本局总分：{score} 分（最高纪录：{best} 分）': 'Final score: {score} (best: {best})',
    '空心入网 {swish} 次 · 打板进球 {bank} 次 · 普通命中 {normal} 次':
      'Swishes {swish} · Bank shots {bank} · Regular {normal}',
    '连续点击升空 · 停手落网 🏀': 'Tap to rise · Release to drop 🏀',
    '已暂停（P / 点击继续）': 'Paused (P / tap to resume)',
    '⭐ 金球回合 ×2': '⭐ Gold round ×2',
    '🔥 火焰连击 ×{combo}': '🔥 Fire combo ×{combo}',
    '×2 金球': '×2 Gold',
    '命中': 'Score',
    '🔥 火焰空心×{combo}': '🔥 Fire swish ×{combo}',
    '⭐金球×2 ': '⭐Gold ×2 ',
    '连点升空': 'Tap to rise',
    '连续点击球场，或连按空格键，让球持续升高。':
      'Tap the court repeatedly, or press Space, to keep the ball rising.',
    '停手落网': 'Release to drop',
    '在篮筐上方停止点击，让球自然下落；空心入网得分最高。':
      'Stop tapping above the rim and let the ball fall through. Swishes score the most.',
    '球款': 'Ball',

    // ---- 记忆翻牌 ----
    '步数': 'Moves',
    '用时': 'Time',
    '最少步数': 'Best',
    '4×4 轻松': '4×4 Easy',
    '5×4 标准': '5×4 Standard',
    '全部配对！🎉': 'All matched! 🎉',
    '步数：0 · 用时：0s': 'Moves: 0 · Time: 0s',
    '翻开两张相同图案配对；全部配对即通关，步数越少越好':
      'Flip two matching tiles; clear the board in as few moves as possible',
    '步数 {moves} · 用时 {elapsed}s · 新纪录！': 'Moves {moves} · Time {elapsed}s · New record!',
    '步数 {moves} · 用时 {elapsed}s · 最少 {best} 步': 'Moves {moves} · Time {elapsed}s · Best {best} moves',
    '未翻开的牌': 'Hidden card',
    '已翻开，{icon}': 'Revealed, {icon}',
    '已配对，{icon}': 'Matched, {icon}',
    '牌桌尺寸': 'Board size',
    '记忆翻牌牌桌': 'Memory board',

    // ---- 清数据 / 弹窗 ----
    '将清除本站保存在此浏览器中的最高纪录、游戏存档、球色、音效设置与教学提示，且无法恢复。':
      'This will remove the best scores, saved games, ball skins, sound settings and tutorial flags stored in this browser. This cannot be undone.',
    '本地数据已清除': 'Local data cleared',
    '清除失败': "Couldn't clear local data",
    '浏览器禁止访问本地存储，请检查浏览器的隐私设置后重试。':
      'Your browser is blocking local storage. Check its privacy settings and try again.',
  };

  let lang = 'zh';
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'en') lang = 'en';
  } catch {}

  let originalTitle = '';
  let originalDescription = '';
  let metaDescriptionEl = null;

  function t(key, params) {
    if (key === undefined || key === null) return '';
    let value = key;
    if (lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key)) value = EN[key];
    if (params && typeof value === 'string') {
      value = value.replace(/\{(\w+)\}/g, (match, name) => (
        params[name] !== undefined ? params[name] : match
      ));
    }
    return value;
  }

  function langLabel() {
    return lang === 'zh' ? 'EN' : '中文';
  }

  function langAria() {
    return lang === 'zh' ? '切换到英文' : 'Switch to Chinese';
  }

  function refreshToggles() {
    document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
      btn.textContent = langLabel();
      btn.setAttribute('aria-label', langAria());
      btn.setAttribute('title', langAria());
    });
  }

  function apply(root) {
    const scope = root || document;

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const value = t(key);
      if (typeof value === 'string') el.textContent = value;
    });

    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(',').forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx < 0) return;
        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });

    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.setAttribute('data-lang', lang);

    if (originalTitle) document.title = t(originalTitle);
    if (metaDescriptionEl && originalDescription) {
      metaDescriptionEl.setAttribute('content', t(originalDescription));
    }

    refreshToggles();
  }

  function setLang(next) {
    if (next !== 'zh' && next !== 'en') return;
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    apply();
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
  }

  function toggle() {
    setLang(lang === 'zh' ? 'en' : 'zh');
  }

  function init() {
    originalTitle = document.title;
    metaDescriptionEl = document.querySelector('meta[name="description"]');
    originalDescription = metaDescriptionEl ? metaDescriptionEl.getAttribute('content') : '';
    apply();
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-lang-toggle]');
      if (!btn) return;
      event.preventDefault();
      toggle();
    });
  }

  window.I18N = {
    t,
    apply,
    setLang,
    toggle,
    getLang: () => lang,
    langLabel,
    langAria,
    init,
    en: EN,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
