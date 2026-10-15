import { describe, expect, it } from 'vitest';
import { cellNeighbors } from './map';
import { newGame } from './newGame';

const base = { playerCount: 7, humanColor: 0, gameCode: 12345 };

describe('newGame', () => {
  it('builds the same game from the same Game Code', () => {
    expect(newGame(base)).toEqual(newGame(base));
  });

  it('creates one Human with the chosen Color and Computers with the other Colors', () => {
    const game = newGame({ ...base, playerCount: 4, humanColor: 5 });

    expect(game.players.map((p) => p.kind)).toEqual(['human', 'computer', 'computer', 'computer']);
    expect(game.players[0]?.color).toBe(5);
    expect(game.players.map((p) => p.color)).toEqual([5, 0, 1, 2]);
    expect(game.players.every((p) => p.stock === 0)).toBe(true);
  });
});

const codes = Array.from({ length: 50 }, (_, i) => i + 1);

describe('newGame map', () => {
  it.each(codes)('has between 16 and 31 Territories (code %i)', (gameCode) => {
    const { territories } = newGame({ ...base, gameCode });
    expect(territories.length).toBeGreaterThanOrEqual(16);
    expect(territories.length).toBeLessThanOrEqual(31);
  });

  it.each(codes)('assigns every Territory cell on the Map to that Territory (code %i)', (gameCode) => {
    const { map, territories } = newGame({ ...base, gameCode });
    expect(map.cells.length).toBe(map.width * map.height);
    for (const t of territories) {
      expect(t.cells.length).toBeGreaterThan(0);
      for (const cell of t.cells) expect(map.cells[cell]).toBe(t.id);
    }
    const owned = map.cells.filter((c) => c >= 0).length;
    expect(owned).toBe(territories.reduce((n, t) => n + t.cells.length, 0));
  });

  it.each(codes)('has symmetric adjacency and every Territory reachable (code %i)', (gameCode) => {
    const { territories } = newGame({ ...base, gameCode });
    for (const t of territories) {
      for (const a of t.adjacent) expect(territories[a]?.adjacent).toContain(t.id);
      expect(t.adjacent).not.toContain(t.id);
    }
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      for (const a of territories[queue.shift()!]!.adjacent) {
        if (!seen.has(a)) { seen.add(a); queue.push(a); }
      }
    }
    expect(seen.size).toBe(territories.length);
  });
});

describe('newGame map shapes', () => {
  it.each(codes)('has no enclosed lake of 3 cells or fewer (code %i)', (gameCode) => {
    const { map } = newGame({ ...base, gameCode });
    const seen = new Set<number>();
    map.cells.forEach((owner, start) => {
      if (owner >= 0 || seen.has(start)) return;
      // Flood the sea region; it is a lake if it never reaches the edge of the grid.
      const region = [start];
      seen.add(start);
      let touchesEdge = false;
      for (let i = 0; i < region.length; i++) {
        const cell = region[i]!;
        const neighbors = cellNeighbors(cell, map.width, map.height);
        if (neighbors.length < 6) touchesEdge = true;
        for (const n of neighbors) {
          if (map.cells[n]! < 0 && !seen.has(n)) {
            seen.add(n);
            region.push(n);
          }
        }
      }
      if (!touchesEdge) expect(region.length).toBeGreaterThan(3);
    });
  });

  it.each(codes)('gives every Territory a core: a cell fully surrounded by its own cells (code %i)', (gameCode) => {
    const { map, territories } = newGame({ ...base, gameCode });
    for (const t of territories) {
      const hasCore = t.cells.some((c) => {
        const n = cellNeighbors(c, map.width, map.height);
        return n.length === 6 && n.every((x) => map.cells[x] === t.id);
      });
      expect(hasCore, `Territory ${t.id} has no core`).toBe(true);
    }
  });
});

describe('newGame setup', () => {
  const playerCounts = [2, 3, 5, 7, 8];
  const cases = playerCounts.flatMap((playerCount) =>
    codes.slice(0, 10).map((gameCode) => ({ playerCount, gameCode })),
  );

  it.each(cases)('gives Players Territory counts differing by at most 1 ($playerCount players, code $gameCode)', (c) => {
    const game = newGame({ ...base, ...c });
    const counts = game.players.map((p) => game.territories.filter((t) => t.owner === p.id).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(Math.min(...counts)).toBeGreaterThan(0);
  });

  it.each(cases)('gives every Player the same total Dice, 1 to 8 per Territory ($playerCount players, code $gameCode)', (c) => {
    const game = newGame({ ...base, ...c });
    for (const t of game.territories) {
      expect(t.dice).toBeGreaterThanOrEqual(1);
      expect(t.dice).toBeLessThanOrEqual(8);
    }
    const totals = game.players.map((p) =>
      game.territories.filter((t) => t.owner === p.id).reduce((n, t) => n + t.dice, 0),
    );
    expect(new Set(totals).size).toBe(1);
    // Roughly 3 Dice per Territory on average, like the original.
    expect(totals[0]! * game.players.length).toBeGreaterThan(game.territories.length * 2);
  });

  it('starts with a Turn Order containing every Player once', () => {
    const game = newGame(base);
    expect([...game.turnOrder].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(game.turnIndex).toBe(0);
  });

  it('does not always let the Human play first', () => {
    const firsts = codes.map((gameCode) => newGame({ ...base, gameCode }).turnOrder[0]);
    expect(firsts.some((p) => p !== 0)).toBe(true);
    expect(firsts.some((p) => p === 0)).toBe(true);
  });

  it.each([
    { playerCount: 1 }, { playerCount: 9 }, { playerCount: 2.5 },
    { humanColor: -1 }, { humanColor: 8 }, { humanColor: 1.5 },
    { gameCode: -1 }, { gameCode: 1.5 }, { gameCode: 2 ** 32 }, { gameCode: Number.NaN },
  ])('rejects invalid options %o', (bad) => {
    expect(() => newGame({ ...base, ...bad })).toThrow(RangeError);
  });
});
