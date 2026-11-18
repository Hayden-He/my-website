(function () {
  function merge2048Line(line) {
    const nonZero = line.filter((item) => item.val !== 0);
    const result = [];
    const origins = [];
    const mergedIdx = [];
    let gained = 0;
    let highestMerged = 0;

    for (let i = 0; i < nonZero.length; i++) {
      const current = nonZero[i];
      const next = nonZero[i + 1];
      if (next && current.val === next.val) {
        const merged = current.val * 2;
        mergedIdx.push(result.length);
        origins.push([current.idx, next.idx]);
        result.push(merged);
        gained += merged;
        highestMerged = Math.max(highestMerged, merged);
        i++;
      } else {
        origins.push([current.idx]);
        result.push(current.val);
      }
    }
    while (result.length < line.length) {
      result.push(0);
      origins.push([]);
    }
    return { result, origins, gained, mergedIdx, highestMerged };
  }

  function canMove2048(board) {
    const size = board.length;
    return board.some((row, r) => row.some((value, c) =>
      value === 0 || (r + 1 < size && value === board[r + 1][c]) ||
      (c + 1 < size && value === row[c + 1])));
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

  window.GameRules = {
    merge2048Line, canMove2048,
    solvedSlideBoard, slideNeighbors, shuffleSlideBoard,
    scoreHoop, hoopBounce,
  };
})();
