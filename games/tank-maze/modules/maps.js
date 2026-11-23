// Original Tank Maze arenas. Coordinates are map units. The physics boundary
// is supplied by the engine, so these walls are only the deliberate interior
// cover and route-shaping pieces.
export const MAPS = Object.freeze([
  Object.freeze({
    id: 'lanes', width: 23, height: 15,
    walls: Object.freeze([
      { x: 2, y: 3, w: 8, h: 0.55 }, { x: 13, y: 3, w: 8, h: 0.55 },
      { x: 2, y: 11.45, w: 8, h: 0.55 }, { x: 13, y: 11.45, w: 8, h: 0.55 },
      // Staggered short fins leave wide north/south bypasses instead of
      // sealing the long left/right firing lanes into dead compartments.
      { x: 4, y: 4.25, w: 0.55, h: 1.85 }, { x: 18.45, y: 4.25, w: 0.55, h: 1.85 },
      { x: 4, y: 8.9, w: 0.55, h: 1.7 }, { x: 18.45, y: 8.9, w: 0.55, h: 1.7 },
      { x: 11.2, y: 2, w: 0.6, h: 3.8 }, { x: 11.2, y: 9.2, w: 0.6, h: 3.8 },
      // A protected service gap in the middle keeps the repair pickup reachable
      // from either side while the two flanking bars still break direct fire.
      { x: 7.2, y: 7.15, w: 3, h: 0.7 }, { x: 12.8, y: 7.15, w: 3, h: 0.7 },
    ]),
    spawns: Object.freeze([
      { x: 1.8, y: 7.5, angle: 0 },
      { x: 21.2, y: 7.5, angle: Math.PI },
    ]),
    patrol: Object.freeze([
      { x: 2, y: 1.8 }, { x: 10, y: 1.8 }, { x: 13, y: 1.8 }, { x: 21, y: 1.8 },
      { x: 21, y: 13.2 }, { x: 13, y: 13.2 }, { x: 10, y: 13.2 }, { x: 2, y: 13.2 },
    ]),
    repair: Object.freeze({ x: 11.5, y: 7.5 }),
  }),

  Object.freeze({
    id: 'corners', width: 23, height: 15,
    walls: Object.freeze([
      // Two mirrored hook-shaped corners at the top and bottom.
      { x: 2.5, y: 2.3, w: 5.5, h: 0.6 }, { x: 7.4, y: 2.3, w: 0.6, h: 3.25 },
      { x: 15, y: 2.3, w: 5.5, h: 0.6 }, { x: 15, y: 2.3, w: 0.6, h: 3.25 },
      { x: 2.5, y: 12.1, w: 5.5, h: 0.6 }, { x: 7.4, y: 9.45, w: 0.6, h: 3.25 },
      { x: 15, y: 12.1, w: 5.5, h: 0.6 }, { x: 15, y: 9.45, w: 0.6, h: 3.25 },
      // Offset zig-zag cover creates several approaches to the crossing.
      { x: 8.5, y: 6.25, w: 3.3, h: 0.6 }, { x: 8.5, y: 6.85, w: 0.6, h: 2.6 },
      { x: 11.1, y: 8.05, w: 3.4, h: 0.6 }, { x: 13.9, y: 5.45, w: 0.6, h: 2.6 },
      { x: 3, y: 6.55, w: 3.4, h: 0.6 }, { x: 16.6, y: 7.85, w: 3.4, h: 0.6 },
    ]),
    spawns: Object.freeze([
      { x: 1.8, y: 7.5, angle: 0 },
      { x: 21.2, y: 7.5, angle: Math.PI },
    ]),
    patrol: Object.freeze([
      { x: 2, y: 3.7 }, { x: 6, y: 5.2 }, { x: 11.2, y: 3.8 },
      { x: 17, y: 5.2 }, { x: 21, y: 3.7 }, { x: 21, y: 11.3 },
      { x: 17, y: 9.8 }, { x: 11.2, y: 11.2 }, { x: 6, y: 9.8 }, { x: 2, y: 11.3 },
    ]),
    repair: Object.freeze({ x: 11.5, y: 7.45 }),
  }),

  Object.freeze({
    id: 'loop', width: 23, height: 15,
    walls: Object.freeze([
      // Left and right rings have openings on the north and south approaches.
      { x: 3, y: 2.7, w: 7, h: 0.6 }, { x: 3, y: 11.7, w: 7, h: 0.6 },
      { x: 3, y: 3.3, w: 0.6, h: 2.35 }, { x: 3, y: 8.95, w: 0.6, h: 2.75 },
      { x: 9.4, y: 3.3, w: 0.6, h: 2.35 }, { x: 9.4, y: 8.95, w: 0.6, h: 2.75 },
      { x: 13, y: 2.7, w: 7, h: 0.6 }, { x: 13, y: 11.7, w: 7, h: 0.6 },
      { x: 13, y: 3.3, w: 0.6, h: 2.35 }, { x: 13, y: 8.95, w: 0.6, h: 2.75 },
      { x: 19.4, y: 3.3, w: 0.6, h: 2.35 }, { x: 19.4, y: 8.95, w: 0.6, h: 2.75 },
      // Internal spines split each ring without sealing either loop.
      { x: 6.2, y: 4.35, w: 0.6, h: 4.8 }, { x: 16.2, y: 4.35, w: 0.6, h: 4.8 },
      // Staggered center connectors create two useful crossovers.
      { x: 10.55, y: 3.7, w: 0.6, h: 2.75 }, { x: 11.85, y: 8.55, w: 0.6, h: 2.75 },
      { x: 10.55, y: 6.85, w: 1.9, h: 0.5 },
    ]),
    spawns: Object.freeze([
      { x: 1.8, y: 7.5, angle: 0 },
      { x: 21.2, y: 7.5, angle: Math.PI },
    ]),
    patrol: Object.freeze([
      { x: 2, y: 1.7 }, { x: 6.5, y: 1.7 }, { x: 11.2, y: 1.7 },
      { x: 16.5, y: 1.7 }, { x: 21, y: 1.7 }, { x: 21, y: 13.3 },
      { x: 16.5, y: 13.3 }, { x: 11.2, y: 13.3 }, { x: 6.5, y: 13.3 }, { x: 2, y: 13.3 },
    ]),
    repair: Object.freeze({ x: 11.5, y: 7.8 }),
  }),

  Object.freeze({
    id: 'garden', theme: 'garden', width: 23, height: 15,
    walls: Object.freeze([
      // Four open stone beds leave a continuous outer walkway around the garden.
      { x: 3, y: 2.3, w: 6, h: 0.65 }, { x: 8.35, y: 2.3, w: 0.65, h: 3.15 },
      { x: 14, y: 2.3, w: 6, h: 0.65 }, { x: 14, y: 2.3, w: 0.65, h: 3.15 },
      { x: 3, y: 12.05, w: 6, h: 0.65 }, { x: 3, y: 9.55, w: 0.65, h: 3.15 },
      { x: 14, y: 12.05, w: 6, h: 0.65 }, { x: 19.35, y: 9.55, w: 0.65, h: 3.15 },
      // Offset centre hedges create two readable bank-shot lanes without a
      // sealed middle: the service crossing remains open around the repair tile.
      { x: 9.4, y: 5.25, w: 3.5, h: 0.6 }, { x: 10.1, y: 9.15, w: 3.5, h: 0.6 },
      { x: 6.2, y: 6.1, w: 0.6, h: 2.75 }, { x: 16.2, y: 6.15, w: 0.6, h: 2.7 },
    ]),
    spawns: Object.freeze([
      { x: 1.8, y: 7.5, angle: 0 },
      { x: 21.2, y: 7.5, angle: Math.PI },
    ]),
    patrol: Object.freeze([
      { x: 2, y: 1.65 }, { x: 6, y: 1.65 }, { x: 11.5, y: 1.65 },
      { x: 17, y: 1.65 }, { x: 21, y: 1.65 }, { x: 21, y: 13.35 },
      { x: 17, y: 13.35 }, { x: 11.5, y: 13.35 }, { x: 6, y: 13.35 }, { x: 2, y: 13.35 },
    ]),
    repair: Object.freeze({ x: 11.5, y: 7.5 }),
  }),

  Object.freeze({
    id: 'outpost', theme: 'outpost', width: 27, height: 17,
    walls: Object.freeze([
      // Staggered bunkers leave a broad upper and lower flank from either base.
      { x: 5, y: 7.4, w: 3.4, h: 2.2 },
      { x: 10.2, y: 10.8, w: 3.8, h: 2.0 },
      { x: 13, y: 4.2, w: 3.8, h: 2.0 },
      { x: 18.6, y: 7.4, w: 3.4, h: 2.2 },
      // Low barriers give both flank routes intermediate cover. The outer
      // track still runs past all four without narrowing into a choke point.
      { x: 4.8, y: 3.25, w: 2.7, h: 0.75 },
      { x: 19.5, y: 3.25, w: 2.7, h: 0.75 },
      { x: 4.8, y: 13, w: 2.7, h: 0.75 },
      { x: 19.5, y: 13, w: 2.7, h: 0.75 },
    ]),
    spawns: Object.freeze([
      { x: 1.8, y: 8.5, angle: 0 },
      { x: 25.2, y: 8.5, angle: Math.PI },
    ]),
    patrol: Object.freeze([
      { x: 2, y: 1.8 }, { x: 7, y: 1.8 }, { x: 13.5, y: 1.8 },
      { x: 20, y: 1.8 }, { x: 25, y: 1.8 }, { x: 25, y: 15.2 },
      { x: 20, y: 15.2 }, { x: 13.5, y: 15.2 }, { x: 7, y: 15.2 }, { x: 2, y: 15.2 },
    ]),
    repair: Object.freeze({ x: 13.5, y: 8.5 }),
  }),
]);
