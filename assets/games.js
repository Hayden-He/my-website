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
      description: '考验反应速度与手感的街机挑战游戏',
      url: '/categories/arcade.html',
    },
    {
      id: 'puzzle',
      name: '益智休闲',
      description: '轻松动脑、随时来一局的经典数字与逻辑游戏',
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
      description: '点击屏幕让篮球跳跃投向左侧篮筐，支持空心入网与打板，进球重置倒计时！',
      url: '/games/basketball/',
      storageKey: 'game_best_basketball',
      tags: ['点击/空格', '限时挑战'],
    },
    {
      id: 'snake',
      title: '经典贪吃蛇',
      icon: '🐍',
      category: 'arcade',
      categoryName: '动作街机',
      description: '吃掉果子不断变长，支持键盘方向键与手机触屏操控。',
      url: '/games/snake/',
      storageKey: 'game_best_snake',
      tags: ['键盘/触屏', '经典'],
    },
    {
      id: '2048',
      title: '经典 2048',
      icon: '🔢',
      category: 'puzzle',
      categoryName: '益智休闲',
      description: '滑动合并相同数字方块，一步步合成 2048。',
      url: '/games/2048/',
      storageKey: 'game_best_2048',
      tags: ['滑动/方向键', '益智'],
    },
  ],
};
