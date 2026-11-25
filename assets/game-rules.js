(function () {
  function merge2048Line(line) {
    const result = Array(line.length).fill(0);
    const origins = Array.from({ length: line.length }, () => []);
    const mergedIdx = [];
    let gained = 0;
    let highestMerged = 0;
    let segStart = 0;

    function flushSegment(end) {
      const nonZero = [];
      for (let k = segStart; k < end; k += 1) {
        if (line[k].val > 0) nonZero.push(line[k]);
      }
      let write = segStart;
      for (let i = 0; i < nonZero.length; i += 1) {
        const current = nonZero[i];
        const next = nonZero[i + 1];
        if (next && current.val === next.val) {
          const merged = current.val * 2;
          mergedIdx.push(write);
          origins[write] = [current.idx, next.idx];
          result[write] = merged;
          gained += merged;
          highestMerged = Math.max(highestMerged, merged);
          write += 1;
          i += 1;
        } else {
          origins[write] = [current.idx];
          result[write] = current.val;
          write += 1;
        }
      }
    }

    for (let k = 0; k < line.length; k += 1) {
      if (line[k].val === -1) {
        flushSegment(k);
        result[k] = -1;
        origins[k] = [line[k].idx];
        segStart = k + 1;
      }
    }
    flushSegment(line.length);
    return { result, origins, gained, mergedIdx, highestMerged };
  }

  function canMove2048(board) {
    const size = board.length;
    return board.some((row, r) => row.some((value, c) =>
      value === 0 || (value > 0 && (
        (r + 1 < size && value === board[r + 1][c]) ||
        (c + 1 < size && value === row[c + 1])
      ))));
  }

  function solvedSlideBoard(size) {
    return Array.from({ length: size * size }, (_, index) => (index + 1) % (size * size));
  }

  function slideNeighbors(size, index) {
    const row = Math.floor(index / size);
    const col = index % size;
    const result = [];
    if (row > 0) result.push(index - size);
    if (row < size - 1) result.push(index + size);
    if (col > 0) result.push(index - 1);
    if (col < size - 1) result.push(index + 1);
    return result;
  }

  function slideDistance(size, board) {
    return board.reduce((distance, value, index) => {
      if (value === 0) return distance;
      const target = value - 1;
      return distance + Math.abs(Math.floor(index / size) - Math.floor(target / size))
        + Math.abs(index % size - target % size);
    }, 0);
  }

  function shuffleSlideBoard(size, beginner, random = Math.random) {
    for (;;) {
      const board = solvedSlideBoard(size);
      let blank = board.length - 1;
      let last = -1;
      const steps = (beginner ? 10 : size === 3 ? 180 : 360) + Math.floor(random() * 2);
      for (let i = 0; i < steps; i++) {
        const options = slideNeighbors(size, blank).filter((index) => index !== last);
        const pick = options[Math.floor(random() * options.length)];
        [board[blank], board[pick]] = [board[pick], board[blank]];
        last = blank;
        blank = pick;
      }
      // 可逆的随机走步保证有解。入门盘需要至少六步，且最多十一手可解。
      if (slideDistance(size, board) >= (beginner ? 6 : 1)) return board;
    }
  }

  function scoreHoop({ hitBoard, hitRim, isGold }, previousCombo) {
    let kind = 'normal';
    let combo = 0;
    let points = 2;
    if (!hitBoard && !hitRim) {
      kind = 'swish';
      combo = previousCombo + 1;
      points = combo >= 2 ? 5 : 4;
    } else if (hitBoard) {
      kind = 'bank';
      points = 3;
    }
    return { kind, combo, gained: isGold ? points * 2 : points };
  }

  function hoopBounce(ball, px, py, radius) {
    const dx = ball.x - px;
    const dy = ball.y - py;
    const distance = Math.hypot(dx, dy);
    if (distance >= radius || distance <= 0.001) return null;
    const nx = dx / distance;
    const ny = dy / distance;
    const dot = ball.vx * nx + ball.vy * ny;
    const x = px + nx * radius;
    const y = py + ny * radius;
    if (dot >= 0) return { x, y, vx: ball.vx, vy: ball.vy };
    const impulse = (1 + 0.68) * dot;
    return { x, y, vx: Math.min(65, ball.vx - impulse * nx), vy: ball.vy - impulse * ny };
  }

  function mineNeighbors(size, r, c) {
    const res = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) res.push([nr, nc]);
      }
    }
    return res;
  }

  function createMineBoard(size) {
    return Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        mine: false,
        open: false,
        flag: false,
        question: false,
        adj: 0,
      }))
    );
  }

  function placeMinesOnBoard(board, totalMines, safeR, safeC, random = Math.random) {
    const size = board.length;
    const candidates = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
        candidates.push([r, c]);
      }
    }
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const count = Math.min(totalMines, candidates.length);
    for (let i = 0; i < count; i += 1) {
      const [mr, mc] = candidates[i];
      board[mr][mc].mine = true;
    }
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (board[r][c].mine) continue;
        board[r][c].adj = mineNeighbors(size, r, c).filter(([nr, nc]) => board[nr][nc].mine).length;
      }
    }
    return board;
  }

  function revealMineSafeArea(board, startR, startC) {
    const size = board.length;
    const queue = [[startR, startC]];
    let opened = 0;
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      const cell = board[r][c];
      if (cell.open || cell.flag || cell.mine) continue;
      cell.open = true;
      cell.question = false;
      opened += 1;
      if (cell.adj === 0) {
        mineNeighbors(size, r, c).forEach(([nr, nc]) => {
          if (!board[nr][nc].open && !board[nr][nc].flag) queue.push([nr, nc]);
        });
      }
    }
    return opened;
  }

  function findSafeMineCell(board, random = Math.random) {
    const size = board.length;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const cell = board[r][c];
        if (!cell.open || cell.adj <= 0) continue;
        const adj = mineNeighbors(size, r, c);
        const flags = adj.filter(([nr, nc]) => board[nr][nc].flag).length;
        if (flags !== cell.adj) continue;
        const deduced = adj.find(([nr, nc]) => !board[nr][nc].open && !board[nr][nc].flag && !board[nr][nc].mine);
        if (deduced) return deduced;
      }
    }
    const frontier = [];
    const safe = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const cell = board[r][c];
        if (cell.open || cell.flag || cell.mine) continue;
        safe.push([r, c]);
        if (mineNeighbors(size, r, c).some(([nr, nc]) => board[nr][nc].open)) frontier.push([r, c]);
      }
    }
    const pool = frontier.length ? frontier : safe;
    return pool.length ? pool[Math.floor(random() * pool.length)] : null;
  }

  function snakeRandomEmptyCell(gridSize, snake, food, bonusItem, options, random = Math.random) {
    const preferInterior = !!(options && options.preferInterior);
    const empty = [];
    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const onSnake = snake.some((s) => s.x === x && s.y === y);
        const onFood = food && food.x === x && food.y === y;
        const onBonus = bonusItem && bonusItem.x === x && bonusItem.y === y;
        if (!onSnake && !onFood && !onBonus) empty.push({ x, y });
      }
    }
    const interior = preferInterior
      ? empty.filter(({ x, y }) => x > 0 && x < gridSize - 1 && y > 0 && y < gridSize - 1)
      : empty;
    const pool = interior.length ? interior : empty;
    return pool.length ? pool[Math.floor(random() * pool.length)] : null;
  }

  function snakeNextStep(gridSize, snake, dir, wrapMode, food, bonusItem) {
    let nx = snake[0].x + dir.x;
    let ny = snake[0].y + dir.y;
    if (wrapMode) {
      nx = (nx + gridSize) % gridSize;
      ny = (ny + gridSize) % gridSize;
    } else if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) {
      return { collision: 'wall', head: { x: nx, y: ny }, ateFood: false, ateBonus: false, willGrow: false };
    }

    const ateFood = !!(food && nx === food.x && ny === food.y);
    const ateBonus = !!(bonusItem && nx === bonusItem.x && ny === bonusItem.y);
    const willGrow = ateFood || ateBonus;
    const bodyToCheck = willGrow ? snake : snake.slice(0, -1);
    if (bodyToCheck.some((s) => s.x === nx && s.y === ny)) {
      return { collision: 'self', head: { x: nx, y: ny }, ateFood, ateBonus, willGrow };
    }
    return { collision: null, head: { x: nx, y: ny }, ateFood, ateBonus, willGrow };
  }

  function snakeTickDelay(score, speedOffset) {
    return Math.max(82, 185 - Math.floor(score / 25) * 6) + speedOffset;
  }

  function buildMemoryDeck(icons, pairs, random = Math.random) {
    const items = [];
    for (let i = 0; i < pairs; i += 1) {
      items.push({ icon: icons[i].id, name: icons[i].name });
      items.push({ icon: icons[i].id, name: icons[i].name });
    }
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function isMemoryPairMatch(firstIcon, secondIcon) {
    return !!firstIcon && firstIcon === secondIcon;
  }

  window.GameRules = {
    merge2048Line, canMove2048,
    solvedSlideBoard, slideNeighbors, shuffleSlideBoard,
    scoreHoop, hoopBounce,
    mineNeighbors, createMineBoard, placeMinesOnBoard, revealMineSafeArea, findSafeMineCell,
    snakeRandomEmptyCell, snakeNextStep, snakeTickDelay,
    buildMemoryDeck, isMemoryPairMatch,
  };
})();
