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
    '检查更新': 'Check for updates',
    '检查中…': 'Checking…',
    '已是最新版本': 'You are up to date.',
    '检查失败，请稍后重试': "Couldn't check. Try again.",
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
    '选个小游戏，打开就玩': 'Pick a game and play',
    '{game}：{action}': '{game}: {action}',
    '纪录保存在当前浏览器，2048 支持续玩。': 'Records are saved in this browser. You can resume your 2048 game.',

    // ---- 分类页 ----
    '动作街机 🏀': 'Arcade 🏀',
    '考验反应与手感的街机挑战，投篮、贪吃蛇与切水果各有玩法，随时刷新自己的纪录。':
      'Fast-paced arcade challenges—shoot hoops, grow the snake or slice fruit and chase a new personal best.',
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
    '数字华容道': 'Sliding Puzzle',
    '数字华容道 - 小游乐场': 'Sliding Puzzle - Little Playground',
    '数字华容道：滑动数字方块，把 1–8 / 1–15 按顺序排好；支持 3×3 与 4×4 棋盘，步数越少越好。':
      'Sliding Puzzle: slide the numbered tiles back into order (1–8 or 1–15); 3×3 and 4×4 boards, fewer moves is better.',
    '连点让球升空，停手让球落入篮筐。连续空心有加分。':
      'Tap to lift the ball, then let it drop through the hoop. Chain swishes for bonus points.',
    '吃掉果子与限时金星不断成长，还有冰果减速；支持经典撞墙与自由穿墙双模式。':
      'Eat fruit and timed stars to grow; ice fruit slows you down. Play with walls or wrap-around.',
    '滑动合并相同数字，支持 4×4 与 5×5 棋盘、自动存档与单步撤回。':
      'Slide and merge matching numbers on 4×4 or 5×5 boards, with autosave and one-step undo.',
    '首击安全。根据数字找出地雷，翻开所有安全格。':
      'Your first move is safe. Use the numbers to spot mines and reveal every safe tile.',
    '翻开两张牌找相同图案。试试用更少次数配完全部。':
      'Flip two cards to find a match. Try to clear the board in fewer attempts.',
    '滑动数字方块，把 1–8 / 1–15 按顺序排好；支持 3×3 与 4×4 棋盘，步数越少越好。':
      'Slide the numbered tiles back into order (1–8 or 1–15); 3×3 and 4×4 boards, fewer moves is better.',
    '连击挑战': 'Combo challenge',
    '键盘/划屏': 'Keys / swipe',
    '双模式': 'Two modes',
    '9×9 最快: ': '9×9 fastest: ',
    '4×4 最少尝试: ': '4×4 fewest attempts: ',
    '滑动/方向键': 'Swipe / arrows',
    '可撤回': 'Undo',
    '推理排雷': 'Deduction',
    '三档难度': '3 difficulties',
    '记忆配对': 'Memory match',
    '双尺寸': 'Two sizes',
    '滑动拼图': 'Slide puzzle',
    '3×3 最少步: ': '3×3 fewest: ',
    '最高分: ': 'Best: ',
    '经典模式最高: ': 'Classic best: ',
    '4×4 最高: ': '4×4 best: ',
    '任意难度最快: ': 'Fastest (any): ',
    '4×4 最少步: ': '4×4 fewest: ',
    ' 步': ' moves',
    's': 's',

    // ---- 页面标题 / 描述 ----
    '小游乐场 - 在线小游戏合集': 'Little Playground - Free Online Mini Games',
    '小游乐场：打开即玩的在线轻游戏合集，包含街头投篮、经典贪吃蛇、极速切水果、经典 2048、经典扫雷、记忆翻牌与数字华容道，支持电脑与手机。':
      'Little Playground: instant online mini games—Street Hoops, Classic Snake, Fruit Slicer, 2048, Minesweeper, Memory Match and Sliding Puzzle. Play on desktop or mobile.',
    '动作街机 - 小游乐场': 'Arcade - Little Playground',
    '动作街机分类：街头投篮、经典贪吃蛇、极速切水果等考验反应的小游戏。':
      'Arcade games: Street Hoops, Classic Snake, Fruit Slicer and more reflex-based challenges.',
    '益智休闲 - 小游乐场': 'Puzzle - Little Playground',
    '益智休闲分类：经典 2048、经典扫雷、记忆翻牌与数字华容道等轻松动脑的小游戏。':
      'Puzzle games: 2048, Minesweeper, Memory Match, Sliding Puzzle and more relaxed brain-teasers.',
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
    '合并相同数字，目标 2048。': 'Merge matching tiles to reach 2048.',
    '发现新版本': 'Update available',
    '刷新将加载新版本，未保存的进度会丢失。': 'Reload to update. Any unsaved progress will be lost.',
    '立即刷新': 'Reload now',
    '稍后': 'Later',
    '当前得分': 'Score',
    '最大方块': 'Max',
    '模式最高': 'Best',
    '4×4 经典': '4×4 Classic',
    '5×5 轻松': '5×5 Relaxed',
    '没有可移动的方块了': 'No moves left',
    '滑动或拖动棋盘，键盘可用方向键或 WASD。初次玩可试 5×5。':
      'Swipe or drag the board, or use arrows or WASD. Try 5×5 if you are new.',
    '恭喜合成 2048！🎉': 'You made 2048! 🎉',
    '当前得分：{score}，你可以继续挑战更高数字！': 'Score: {score}. Keep going for higher tiles!',
    '🎉 新纪录！': '🎉 New record! ',
    '新纪录！': 'New record! ',
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
    '+10 · ': '+10 · ',
    '金星+30（限时）· ': 'Star+30 (timed) · ',
    '冰果减速 · 方向键/WASD/划屏 · 空格/P 暂停': 'Ice slows you · Arrows/WASD/swipe · Space/P pause',
    '按方向键 / WASD 或点击画面开始 🐍': 'Press an arrow key / WASD or tap to start 🐍',
    '已暂停（点击或按空格继续）': 'Paused (tap or press Space to resume)',
    '减速中': 'Slowed',
    '向上': 'Up',
    '向下': 'Down',
    '向左': 'Left',
    '向右': 'Right',
    '+15 减速': '+15 Slow',
    '本局得分：{score}（本模式最高：{best}）': 'Score: {score} (mode best: {best})',
    '通关！🎉': 'Cleared! 🎉',
    '星星消失了': 'Star expired',
    '冰果消失了': 'Ice expired',
    '方向控制': 'Direction controls',
    '贪吃蛇游戏棋盘': 'Snake game board',
    '游戏模式': 'Game mode',

    // ---- 扫雷 ----
    '剩余地雷': 'Mines',
    '当前用时': 'Time',
    '最佳用时': 'Best',
    '9×9': '9×9',
    '12×12': '12×12',
    '16×16': '16×16',
    '模式: 翻开': 'Mode: Reveal',
    '模式: 插旗': 'Mode: Flag',
    '模式: 🚩插旗': 'Mode: 🚩Flag',
    '窄屏新局 9×9，当前棋局保留。': 'New games use 9×9 here. Keep playing your current board.',
    '排雷成功！🎉': 'Cleared! 🎉',
    '用时：0s': 'Time: 0s',
    '点格子翻开。长按、右键或切换到插旗模式可标记。':
      'Tap a tile to reveal it. Long-press, right-click, or switch to Flag mode to mark it.',
    '9×9 轻松': '9×9 Easy',
    '12×12 标准': '12×12 Standard',
    '16×16 挑战': '16×16 Hard',
    '踩到地雷了': 'Boom!',
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
    '周围旗数等于数字时，再点数字可翻开其余邻格。插错旗可能踩雷。':
      'When the number matches the adjacent flag count, tap it again to uncover the remaining neighbors. A misplaced flag can reveal a mine.',
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
    '时间到！': "Time's up!",
    '本局得分：0': 'Score: 0',
    '按空格或回车也可重开': 'Space or Enter to restart',
    '操作：连续点击球场 / 连按空格升空，停手后下落；': 'Tap the court / press Space to rise; stop to drop. ',
    'P 暂停': 'P pause',
    '连点球场让球升空，停手让球落入篮筐。': 'Tap repeatedly to lift the ball. Stop tapping to let it drop through the hoop.',
    '键盘：空格升空 · P 暂停': 'Keyboard: Space to rise · P to pause',
    '挑战': 'Challenge',
    '练习': 'Practice',
    '切换到练习': 'Switch to practice',
    '当前挑战进度将清除。': 'Your current challenge progress will be lost.',
    '金球 ×2': 'Gold ball ×2',
    '再进 {n} 球出金球': 'Gold ball in {n}',
    '固定篮筐 · 不计纪录': 'Fixed hoop · Unranked',
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
    '连续点击升空 · 停手落网': 'Tap to rise · Release to drop',
    '已暂停（P / 点击继续）': 'Paused (P / tap to resume)',
    '金球回合 ×2': 'Gold round ×2',
    '火焰连击 ×{combo}': 'Fire combo ×{combo}',
    '×2 金球': '×2 Gold',
    '命中': 'Score',
    '火焰空心×{combo}': 'Fire swish ×{combo}',
    '金球×2 ': 'Gold ×2 ',
    '连点升空': 'Tap to rise',
    '连续点击球场，或连按空格键，让球持续升高。':
      'Tap the court repeatedly, or press Space, to keep the ball rising.',
    '停手落网': 'Release to drop',
    '在篮筐上方停止点击，让球自然下落；空心入网得分最高。':
      'Stop tapping above the rim and let the ball fall through. Swishes score the most.',
    '街头投篮球场': 'Street Hoops court',
    '球款': 'Ball',

    // ---- 记忆翻牌 ----
    '步数': 'Moves',
    '用时': 'Time',
    '最少步数': 'Best',
    '4×4 轻松': '4×4 Easy',
    '5×4 标准': '5×4 Standard',
    '3×3 入门': '3×3 Intro',
    '3×3 经典': '3×3 Classic',
    '4×4 标准': '4×4 Standard',
    '完成！': 'Solved!',
    '步数：0 · 用时：0s': 'Moves: 0 · Time: 0s',
    '同盘重试': 'Retry board',
    '点空位旁的方块，按顺序排好数字。空位留在右下角。':
      'Tap a tile beside the gap. Order the numbers, leaving the gap at bottom right.',
    '键盘也可用方向键移动。初次玩可选 3×3 入门。': 'Arrow keys also work. New to the game? Try 3×3 Intro.',
    '重开本局': 'Restart this game',
    '切换模式': 'Switch mode',
    '切换模式会清除当前棋局进度。': 'Switching modes will reset the current board.',
    '切换': 'Switch',
    '重试': 'Retry',
    '当前进度将被清除，确定重开吗？': 'Current progress will be lost. Restart?',
    '空格': 'Blank',
    '第 {row} 行第 {col} 列，数字 {n}': 'Row {row}, column {col}, number {n}',
    '步数：{moves} · 用时：{elapsed}s · 最少 {best} 步': 'Moves: {moves} · Time: {elapsed}s · Best: {best} moves',
    '数字华容道棋盘': 'Sliding puzzle board',
    '全部配对！🎉': 'All matched! 🎉',
    '尝试次数': 'Attempts',
    '最少尝试': 'Fewest attempts',
    '预览牌面': 'Preview cards',
    '翻两张算一次尝试。找齐所有相同图案即可通关。': 'Each pair you flip counts as one attempt. Match every card to win.',
    ' 次': ' attempts',
    '记住牌面，预览即将结束。': 'Memorize the cards before they turn over.',
    '这两张牌不同。': 'These cards do not match.',
    '本局使用了预览，纪录单独计算。': 'Rounds with a preview have their own record.',
    '尝试 {moves} 次 · 用时 {elapsed}s · 新纪录！': '{moves} attempts · {elapsed}s · New record!',
    '尝试 {moves} 次 · 用时 {elapsed}s · 最少 {best} 次': '{moves} attempts · {elapsed}s · Best: {best}',
    '未翻开的牌': 'Hidden card',
    '已翻开，{icon}': 'Revealed, {icon}',
    '已配对，{icon}': 'Matched, {icon}',
    '牌桌尺寸': 'Board size',
    '苹果': 'Apple',
    '橙子': 'Orange',
    '柠檬': 'Lemon',
    '葡萄': 'Grapes',
    '西瓜': 'Watermelon',
    '草莓': 'Strawberry',
    '樱桃': 'Cherry',
    '猕猴桃': 'Kiwi',
    '桃子': 'Peach',
    '椰子': 'Coconut',
    '记忆翻牌牌桌': 'Memory board',

    // ---- 极速切水果 ----
    '极速切水果': 'Fruit Slicer',
    '极速切水果 - 小游乐场': 'Fruit Slicer - Little Playground',
    '剩余时间': 'Time',
    '继续游戏': 'Resume',
    '划屏或移动鼠标切开飞起的水果，连击爆汁、躲避炸弹，支持经典与 60 秒狂热双模式。':
      'Swipe or move your mouse to slice flying fruit, chain combos, dodge bombs, and play Classic or 60s Frenzy.',
    '划屏/鼠标': 'Swipe / Mouse',
    '剩余生命': 'Lives',
    '{n} 条命': '{n} lives',
    '经典 3 命': 'Classic 3 Lives',
    '60秒狂热': '60s Frenzy',
    '刀锋外观': 'Blade skin',
    '经典银刃': 'Silver Blade',
    '烈焰之刃': 'Flame Blade',
    '寒冰之刃': 'Frost Blade',
    '霓虹电刃': 'Neon Volt',
    '落樱之刃': 'Sakura Blade',
    '极速切水果画布': 'Fruit Slicer canvas',
    '移动鼠标或手指划屏切开水果，连续一刀多切触发连击，小心炸弹！':
      'Move your mouse or swipe to slice fruit. Chain multi-fruit cuts for combos and watch out for bombs!',
    '划屏或移动鼠标挥砍 · 空格/回车开始或暂停 · 14 种水果与 5 款特效刀锋':
      'Swipe or move mouse to slice · Space/Enter to start or pause · 14 fruits & 5 FX blades',
    '经典 3 命：漏掉完整水果扣 1 命，每满 100 分回 1 命，切到炸弹立即结束！':
      'Classic 3 Lives: Missing a whole fruit costs 1 life (+1 life every 100 pts). Slicing a bomb ends the run!',
    '60 秒狂热：尽情连击拿高分，切到炸弹扣 10 分，善用冰冻/狂热/双倍/石榴/闪电果！':
      '60s Frenzy: Chain combos for high scores. Bombs cost 10 pts. Use Freeze, Frenzy, Double, Pomegranate & Bolt!',
    '已暂停': 'Paused',
    '当前得分：{score}': 'Current score: {score}',
    '切到炸弹！': 'Sliced a Bomb!',
    '生命耗尽！': 'Out of Lives!',
    '（新纪录！）': ' (New Record!)',
    '冰冻减速 {s}s': 'Freeze {s}s',
    '水果狂热 {s}s': 'Frenzy {s}s',
    '双倍得分 {s}s': 'Double ×2 {s}s',
    '狂切石榴！': 'Multi-Slice!',
    '冰冻减速!': 'Freeze!',
    '水果狂热!': 'Frenzy!',
    '双倍得分 ×2!': 'Double ×2!',
    '闪电连劈 +{n}': 'Bolt Chain +{n}',
    '暴击 +{n}!': 'Critical +{n}!',
    '{c} 连击 +{n}': '{c}x Combo +{n}',
    '连切 ×{h} +{n}': 'Multi ×{h} +{n}',
    '划屏挥砍水果': 'Swipe to Slice',
    '手指划屏或移动鼠标挥砍飞起的水果，一次切中 3 个以上触发连击加分！':
      'Swipe or move your mouse to slice flying fruit. Slice 3+ in one stroke for a combo bonus!',
    '小心炸弹': 'Watch for Bombs',
    '经典模式下切到炸弹会直接结束，漏掉完整水果扣 1 命；60 秒狂热模式切到炸弹扣 10 分。':
      'In Classic mode, bombs end the game and missed fruits cost 1 life. In 60s Frenzy, bombs deduct 10 points.',
    '善用特殊水果': 'Special Fruits',
    '冰冻减速、水果狂热、双倍得分、连续狂切石榴与全屏闪电果，帮你轻松冲刺新高！':
      'Use Freeze, Frenzy, Double Score, Multi-Slice Pomegranate, and Lightning fruits to boost your score!',

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
