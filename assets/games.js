/**
 * 全站分类与游戏清单配置
 * 新增分类或游戏时，只需在此文件中维护数据，首页与分类页会自动同步渲染。
 */
window.SITE_CONFIG = {
  siteTitle: '小游乐场',
  categories: [
    {
      id: 'arcade',
      name: '动作街机',
      description: '考验反应与手感的街机挑战，随时刷新个人纪录',
      url: '/categories/arcade.html',
    },
    {
      id: 'puzzle',
      name: '益智休闲',
      description: '轻松动脑、节奏自在的经典数字与逻辑小游戏',
      url: '/categories/puzzle.html',
    },
  ],
  games: [
    {
      id: 'basketball',
      title: '街头投篮',
      icon: '🏀',
      category: 'arcade',
      categoryName: '动作街机',
      description: '把握节奏起跳投篮，打出空心连击、火焰球与打板绝杀，挑战高分极限。',
      url: '/games/basketball/',
      storageKey: 'game_best_basketball',
      bestPrefix: '最高分: ',
      tags: ['点击/空格', '连击挑战'],
    },
    {
      id: 'snake',
      title: '经典贪吃蛇',
      icon: '🐍',
      category: 'arcade',
      categoryName: '动作街机',
      description: '吃掉果子与限时金星不断成长，支持经典撞墙与自由穿墙双模式。',
      url: '/games/snake/',
      storageKey: 'game_best_snake',
      bestPrefix: '最高分: ',
      tags: ['键盘/划屏', '双模式'],
    },
    {
      id: '2048',
      title: '经典 2048',
      icon: '🔢',
      category: 'puzzle',
      categoryName: '益智休闲',
      description: '丝滑滑动合并相同数字，支持 4×4 与 5×5 棋盘、自动存档与单步撤回。',
      url: '/games/2048/',
      storageKey: 'game_best_2048',
      bestPrefix: '最高分: ',
      tags: ['滑动/方向键', '可撤回'],
    },
    {
      id: 'minesweeper',
      title: '经典扫雷',
      icon: '💣',
      category: 'puzzle',
      categoryName: '益智休闲',
      description: '首击必安全、支持数字双击快开与三档难度，用最稳的推理清空雷区。',
      url: '/games/minesweeper/',
      storageKey: 'game_best_minesweeper',
      bestPrefix: '最快: ',
      bestSuffix: 's',
      tags: ['推理排雷', '三档难度'],
    },
  ],
};
