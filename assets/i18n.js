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
    '音效已开启（iPhone 静音模式下无声，请关闭手机静音）':
      'Sound on (muted if your iPhone Silent switch is on)',
    '开始游戏 →': 'Play →',
    '开始游戏': 'Start',
    '继续上局 · {board} →': 'Continue · {board} →',
    '继续上局 · {board} {score} 分 →': 'Continue · {board} {score} pts →',
    '共 {n} 款': '{n} games',
    '共 {n} 款 · 已留纪录 {recorded} 款': '{n} games · {recorded} with a record',
    '无需下载 · 电脑与手机均可畅玩': 'No downloads · Play on desktop and mobile',
    '清除本地数据': 'Clear local data',
    '检查更新': 'Check for updates',
    '复制网站链接': 'Copy website link',
    '复制游戏链接': 'Copy game link',
    '链接已复制': 'Link copied',
    '请长按或选中链接复制': 'Touch and hold or select the link to copy it',
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
    '个人纪录保存在当前浏览器。': 'Personal bests are saved in this browser.',
    '最近打开': 'Recently opened',
    '{game} · 继续上局 →': '{game} · Resume →',

    // ---- 分类页 ----
    '动作街机 🏀': 'Arcade 🏀',
    '考验反应与手感的街机挑战，投篮、贪吃蛇、切水果与太空战机各有玩法，随时刷新自己的纪录。':
      'Fast-paced arcade challenges—hoops, snake, fruit slicing and starfighter action to beat your personal best.',
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
    '小游乐场：打开即玩的在线轻游戏合集，包含街头投篮、经典贪吃蛇、极速切水果、太空战机、经典 2048、经典扫雷、记忆翻牌与数字华容道，支持电脑与手机。':
      'Little Playground: instant online mini games—Street Hoops, Classic Snake, Fruit Slicer, Space Shooter, 2048, Minesweeper, Memory Match and Sliding Puzzle. Play on desktop or mobile.',
    '动作街机 - 小游乐场': 'Arcade - Little Playground',
    '动作街机分类：街头投篮、经典贪吃蛇、极速切水果、太空战机等考验反应的小游戏。':
      'Arcade games: Street Hoops, Classic Snake, Fruit Slicer, Space Shooter and more reflex-based challenges.',
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
    '切换模式会结束当前飞行。': 'Switching modes will end your current flight.',
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
    '沉浸模式': 'Focus mode',
    '战机设置与图鉴': 'Flight settings & guide',
    '退出沉浸': 'Exit focus mode',
    '怎么横屏玩？': 'How do I play in landscape?',
    'iPhone：在控制中心关闭「竖排方向锁定」，再横握手机。全面屏机型从右上角下滑打开控制中心。':
      'iPhone: Turn off Portrait Orientation Lock in Control Center, then turn your phone sideways. On iPhones with Face ID, swipe down from the top-right corner to open Control Center.',
    'Android：开启自动旋转，再横握手机。': 'Android: Turn on Auto-rotate, then turn your phone sideways.',
    '微信里转不了？点右上角「…」，选「用默认浏览器打开」。':
      'Page stays upright in WeChat? Tap the top-right menu (…) and choose Open in Default Browser.',
    '找不到这个选项？复制游戏链接，用常用的手机浏览器打开。也可以用「沉浸模式」竖屏玩。':
      'No browser option? Copy the game link and open it in your usual mobile browser. You can also play in portrait using Focus mode.',
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
    '极光星刃': 'Aurora Star',
    '解锁极光星刃！': 'Aurora Star Unlocked!',
    '解锁限定刀锋：极光星刃！': 'Unlocked blade: Aurora Star!',
    '单局达 500 分或打出 6 连击解锁极光星刃': 'Reach 500 pts or a 6x combo in one run to unlock Aurora Star',
    '切中 {fruits} 颗 · 最高 {combo} 连击 · 暴走 {fever} 次': '{fruits} sliced · Max {combo}x combo · {fever}x Fever',
    '极速切水果画布': 'Fruit Slicer canvas',
    '移动鼠标或手指划屏切开水果，连续一刀多切触发连击，小心炸弹！':
      'Move your mouse or swipe to slice fruit. Chain multi-fruit cuts for combos and watch out for bombs!',
    '划屏或移动鼠标挥砍 · 关注底部炸弹预警与暴走能量槽':
      'Swipe or move your mouse to slice · Watch the bomb warning at the bottom and the Fever meter',
    '🔥 暴走能量': '🔥 Fever',
    '🔥 超级暴走 ×2': '🔥 FEVER ×2',
    '特殊果实与机制图鉴': 'Special fruits & mechanics guide',
    '特殊果实与机制说明': 'Special Fruits & Mechanics',
    '冰冻：减速并暂停60s计时': 'Freeze: slow motion & pause clock',
    '狂热：侧向连发水果潮': 'Frenzy: side fruit barrage',
    '双倍：6秒内全得分翻倍': 'Double: 2× score for 6s',
    '闪电：链式劈开全场水果': 'Bolt: chain-slice all fruits',
    '分裂：爆出4颗高分小果': 'Splitter: bursts into 4 bonus minis',
    '磁力：吸近水果并推开炸弹': 'Magnet: pulls fruits, pushes bombs',
    '护盾：抵消一次炸弹伤害': 'Shield: blocks one bomb hit',
    '石榴：慢动作连续狂切': 'Pomegranate: slow-mo multi-slice',
    '时钟：60s模式加3秒（限2次）': 'Clock: +3s in 60s mode (max 2)',
    '回血：经典模式恢复1命': 'Heal: +1 life in Classic',
    '暴走槽：连击攒满4.5s无雷×2': 'Fever: fill via combos for 4.5s 2× rush',
    '经典 3 命：漏掉常规水果扣 1 命，善用回血/护盾/分裂/磁力/冰冻/闪电果，切到炸弹立即结束！':
      'Classic 3 Lives: Missing regular fruits costs 1 life. Use Heal, Shield, Splitter, Magnet, Freeze & Bolt—avoid bombs!',
    '60 秒狂热：冰冻与石榴期间暂停倒计时，连击攒满触发无炸弹暴走，还有+3s时钟/护盾/分裂果！':
      '60s Frenzy: Freeze & Pomegranate pause the clock. Fill Fever for a bomb-free rush, plus +3s Clock, Shield & Splitter!',
    '已暂停': 'Paused',
    '当前得分：{score}': 'Current score: {score}',
    '切到炸弹！': 'Sliced a Bomb!',
    '生命耗尽！': 'Out of Lives!',
    '（新纪录！）': ' (New Record!)',
    '防爆护盾': 'Blast Shield',
    '超级暴走 {s}s': 'Fever {s}s',
    '冰冻减速 {s}s': 'Freeze {s}s',
    '水果狂热 {s}s': 'Frenzy {s}s',
    '双倍得分 {s}s': 'Double ×2 {s}s',
    '磁力聚拢 {s}s': 'Magnet {s}s',
    '狂切石榴！': 'Multi-Slice!',
    '冰冻减速!': 'Freeze!',
    '水果狂热!': 'Frenzy!',
    '双倍得分 ×2!': 'Double ×2!',
    '磁力聚拢!': 'Magnet!',
    '防爆护盾!': 'Shield Ready!',
    '护盾抵消!': 'Shield Blocked!',
    '分裂连爆!': 'Fruit Split!',
    '超级暴走 ×2！': 'FEVER ×2!',
    '闪电连劈 +{n}': 'Bolt Chain +{n}',
    '暴击 +{n}!': 'Critical +{n}!',
    '{c} 连击 +{n}': '{c}x Combo +{n}',
    '连切 ×{h} +{n}': 'Multi ×{h} +{n}',
    '划屏挥砍水果': 'Swipe to Slice',
    '手指划屏或移动鼠标挥砍飞起的水果，一次切中 3 个以上触发连击加分！':
      'Swipe or move your mouse to slice flying fruit. Slice 3+ in one stroke for a combo bonus!',
    '小心炸弹': 'Watch for Bombs',
    '炸弹发射前会在底部亮起红色 ! 预警并响起警示音。经典模式切到炸弹立即结束，60 秒狂热扣 10 分（有护盾可抵消一次）。':
      'A red ! alert and warning chirp appear at the bottom before bombs launch. Bombs end Classic or cost 10 pts in Frenzy (Shield blocks once).',
    '善用特殊水果与暴走': 'Special Fruits & Fever',
    '新增分裂果、磁力聚拢、防爆护盾、回血果与 +3s 时钟果；冰冻/石榴期间会暂停 60 秒倒计时，连击攒满能量槽还会触发无炸弹双倍暴走！':
      'Slice Splitter, Magnet, Shield, Heal (+1♥) & +3s Clock fruits. Freeze/Pomegranate pause the 60s clock; fill the Fever bar for a bomb-free 2× rush!',

    // ---- 太空战机 ----
    '太空战机': 'Space Shooter',
    '太空战机 - 小游乐场': 'Space Shooter - Little Playground',
    '操控战机躲避弹幕、升级主炮火力、释放清屏脉冲并挑战每 5 波的星际 Boss。':
      'Pilot your starfighter, dodge bullet waves, upgrade cannons, fire EMP blasts, and battle bosses every 5 waves.',
    '标准模式最高: ': 'Standard best: ',
    '拖动/键盘': 'Drag / Keys',
    '当前波次': 'Wave',
    'Boss 练习': 'Boss practice',
    '练习波次': 'Practice wave',
    '标准难度 · 3 点护甲 · Lv.4 主炮 · 2 次脉冲': 'Standard difficulty · 3 armor · Lv.4 cannon · 2 EMP charges',
    '{name} · 第 {wave} 波遇到后解锁': '{name} · Unlock at wave {wave}',
    '返回开局': 'Back to start',
    '返回结算': 'Back to results',
    '返回选择': 'Choose a boss',
    '练习成功': 'Practice cleared',
    '练习对象：{name} · 得分：{score}': '{name} · Score: {score}',
    '标准闯关': 'Standard',
    '王牌极速': 'Ace Rush',
    '护盾激活': 'Shield On',
    '太空战机画布': 'Space Shooter canvas',
    '拖动战机躲避弹幕、拾取火力升级，每 5 波迎战星际 Boss！':
      'Drag your starfighter, collect weapon upgrades, and defeat a Boss every 5 waves!',
    '⚡ 脉冲清屏': '⚡ EMP Pulse',
    '战机涂装': 'Fighter skin',
    '苍穹蓝翼': 'Cobalt Wing',
    '烈焰红隼': 'Crimson Hawk',
    '暗夜幽灵': 'Phantom',
    '触屏拖动 / 鼠标移动 / 方向键操控 · 空格释放清屏脉冲 · P 暂停':
      'Touch drag / mouse / arrows or WASD · Space for EMP pulse · P to pause',
    '战机道具与敌机图鉴': 'Power-ups & mechanics guide',
    '道具与机制说明': 'Power-ups & Mechanics',
    '火力升级：Lv.5 中央重弹可贯穿敌机': 'Weapon Up: Lv.5 center rounds pierce enemies',
    '能量护盾：抵消一次伤害': 'Shield: blocks one hit',
    '超载暴走：5.5 秒免伤，主炮射速翻倍': 'Overdrive: immune to damage and 2× cannon fire rate for 5.5s',
    '护甲修复：恢复1点护甲': 'Repair: restore +1 armor',
    '脉冲补给：清弹冲击波+1': 'EMP Supply: +1 blast charge',
    '爆破弹：对准敌机时自动发射，命中造成范围伤害': 'Blast Rounds: fire automatically when lined up with an enemy and deal area damage on impact',
    'Boss预警：离开激光或突进范围': 'Boss Warning: clear the laser or charge path',
    '裁决者与棱镜：趁反击窗口打出全额伤害': 'Arbiter & Prism: deal full damage during counterattack windows',
    '镜面护甲：侧移躲反弹，或用脉冲打断': 'Mirror Armor: dodge reflected shots or disrupt with EMP',
    '棱镜镜像：击破镜像可结束交错火力': 'Prism Mirror: destroy the mirror to end the crossfire',
    '剩余护甲：{hp}': 'Armor left: {hp}',
    '护甲 {hp}/{max}': 'Armor {hp}/{max}',
    '主炮 Lv.{lv}': 'Cannon Lv.{lv}',
    '爆破弹 ×{ammo}': 'Blast ×{ammo}',
    '爆破弹 +{count}': 'Blast Rounds +{count}',
    '标准闯关：3 点护甲起步，升级主炮、释放脉冲清弹，每 5 波迎战星际 Boss！':
      'Standard: 3 armor, upgrade cannons, clear bullets with EMP, and fight a Boss every 5 waves!',
    '王牌极速：初始 Lv.2 主炮、弹幕更密集、得分 1.5 倍加成，挑战极限操作！':
      'Ace Rush: start at Lv.2 cannon with denser waves and 1.5× score multiplier!',
    '战机坠毁': 'Ship Destroyed',
    '击毁 {kills} 架 · 抵达第 {wave} 波 · 最高 {combo} 连击':
      '{kills} destroyed · Wave {wave} · Max {combo}x combo',
    '本局击破 Boss：{names}': 'Bosses defeated: {names}',
    '本局尚未击破 Boss': 'No bosses defeated',
    '再过 {remaining} 波迎战{name}（第 {wave} 波）': 'Next target: {name} · Wave {wave} ({remaining} to go)',
    '下次目标：第 {wave} 波 · {name}': 'Next target: Wave {wave} · {name}',
    '绯红裁决者': 'Crimson Arbiter',
    '苍蓝棱镜': 'Azure Prism',
    '{name} BOSS': '{name} BOSS',
    '相位转换 · 无敌': 'Phase Shift · Invulnerable',
    '锁定预警 · 移动躲避': 'Target Locked · Move!',
    '核心暴露': 'Core Exposed',
    '镜面护甲展开中': 'Mirror Armor Charging',
    '镜面护甲 · 小心反弹': 'Mirror Armor · Reflecting',
    '镜像交错火力': 'Mirror Crossfire',
    '本体': 'Real',
    '镜像': 'Mirror',
    '{source} · {warning}': '{source} · {warning}',
    '扫射预警': 'Sweep Warning',
    '晶弹齐射预警': 'Crystal Volley Warning',
    '双轨激光 · 正在瞄准': 'Twin lasers · Tracking',
    '激光锁定 · 离开亮带': 'Lasers locked · Leave the lit lanes',
    '双轨激光 · 避开光束': 'Twin lasers · Stay clear',
    '折返预警': 'Return Sweep',
    '突进预警 · 横向躲避': 'Charge incoming · Dodge sideways',
    '折返突进 · 横向躲避': 'Return charge · Dodge sideways',
    '侧翼散射预警': 'Spread Warning',
    '部署供盾护卫': 'Deploying Escorts',
    '护卫供盾 {count}/2 · 先打护卫': 'Shields {count}/2 · Target escorts',
    '供盾中断 · 攻击母舰': 'Shields down · Attack mothership',
    '核心暴露 · 攻击母舰': 'Core exposed · Attack mothership',
    '护卫挡弹 · 脉冲可破': 'Guard blocking · Use EMP',
    '护卫挡弹 · 先击破护卫': 'Guard blocking · Hit the guard',
    '反击窗口 · 瞄准本体': 'Opening · Aim at the Boss',
    '留意突进预警，向两侧躲避': 'Watch for charges and dodge sideways',
    '阶段 {phase}/2': 'Phase {phase}/2',
    '紫曜母舰': 'Void Mothership',
    '⚠ 第 {w} 波 · {name}': '⚠ Wave {w} · {name}',
    '第 {w} 波': 'Wave {w}',
    '第 2 波 · 躲避瞄准弹': 'Wave 2 · Dodge aimed shots',
    '第 3 波 · 留意侧翼拦截': 'Wave 3 · Watch the flanks',
    '第 4 波 · 从散射间隙穿过': 'Wave 4 · Slip between volleys',
    '第 7 波 · 留意交叉夹击': 'Wave 7 · Watch for crossfire',
    '第 9 波 · 炮艇护送': 'Wave 9 · Gunship escort',
    '脉冲清屏！': 'EMP BLAST!',
    '护盾抵消！': 'Shield Blocked!',
    '火力 Lv.{lv}!': 'Cannon Lv.{lv}!',
    '能量护盾!': 'Shield Ready!',
    '超载暴走!': 'OVERDRIVE!',
    '免伤 {sec}s': 'Immune {sec}s',
    '护甲 +1': 'Armor +1',
    '+1 脉冲!': '+1 EMP!',
    '×{c} 连击！': '{c}× COMBO!',
    '拖动战机迎战': 'Pilot Your Fighter',
    '手机在画布内拖动、电脑移动鼠标或按方向键/WASD 控制战机走位，主炮会自动连射。':
      'Drag on touchscreens, move your mouse, or use arrow keys / WASD to steer. Cannons fire automatically.',
    '拾取强化与脉冲清屏': 'Power-ups & EMP Pulse',
    '击毁敌机掉落火力升级、护盾、超载与修甲道具；危机时按空格或点脉冲按钮消除全屏弹幕！':
      'Collect weapon, shield, overdrive & repair drops. Press Space or tap EMP Pulse to wipe enemy bullets!',
    '迎战星际 Boss': 'Boss Battles',
    '第 5 波遇到绯红裁决者。横向躲开突进，用脉冲清除护卫，趁反击窗口瞄准本体。':
      'Face the Crimson Arbiter in wave 5. Dodge charges sideways, use EMP to clear the guard, and aim at the Boss during openings.',

    // ---- 清数据 / 弹窗 ----
    '将清除本站在此浏览器保存的游戏纪录、存档、外观、模式偏好、音效设置、教学记录和最近打开记录，且无法恢复。语言设置会保留。':
      'This will permanently clear game records, saves, skins, mode preferences, sound settings, tutorial history and the recently opened game in this browser. Your language setting will be kept.',
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
