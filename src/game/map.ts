import type { Rng } from './rng';
import { MAX_TERRITORIES, type GameMap } from './types';

export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 28;

const MIN_TERRITORY_CELLS = 8;
const MIN_TARGET_CELLS = 14;
const MAX_TARGET_CELLS = 30;
/** Enclosed sea regions this small are filled with land. */
const MAX_FILLED_LAKE_CELLS = 3;
const SEA = -1;
/** Cells turned into sea; never reused, so later Territories can't fill the hole. */
const LAKE = -2;

export interface GeneratedMap {
  readonly map: GameMap;
  readonly territoryCells: readonly (readonly number[])[];
  readonly adjacency: readonly (readonly number[])[];
}

/** Neighbouring cells of a cell on an "odd-r" hex grid. */
export function cellNeighbors(cell: number, width = MAP_WIDTH, height = MAP_HEIGHT): number[] {
  const x = cell % width;
  const y = Math.floor(cell / width);
  const shift = y % 2; // odd rows sit half a cell to the right
  const offsets: [number, number][] = [
    [-1, 0], [1, 0],
    [-1 + shift, -1], [shift, -1],
    [-1 + shift, 1], [shift, 1],
  ];
  const result: number[] = [];
  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) result.push(ny * width + nx);
  }
  return result;
}

export function generateMap(rng: Rng): GeneratedMap {
  const cells: number[] = new Array<number>(MAP_WIDTH * MAP_HEIGHT).fill(SEA);
  const territoryCells: number[][] = [];
  let attempts = 0;

  while (territoryCells.length < MAX_TERRITORIES && attempts < MAX_TERRITORIES * 4) {
    attempts++;
    const start = territoryCells.length === 0 ? centerCell() : pickCoastCell(cells, rng);
    if (start === undefined) break;

    const id = territoryCells.length;
    const grown = growTerritory(cells, start, id, rng);
    if (grown.length < MIN_TERRITORY_CELLS) {
      for (const c of grown) cells[c] = LAKE;
      continue;
    }
    territoryCells.push(grown);
  }

  for (let i = 0; i < cells.length; i++) if (cells[i] === LAKE) cells[i] = SEA;
  fillSmallLakes(cells, territoryCells, MAX_FILLED_LAKE_CELLS);

  return {
    map: { width: MAP_WIDTH, height: MAP_HEIGHT, cells },
    territoryCells,
    adjacency: computeAdjacency(cells, territoryCells.length),
  };
}

function centerCell(): number {
  return Math.floor(MAP_HEIGHT / 2) * MAP_WIDTH + Math.floor(MAP_WIDTH / 2);
}

/** A free cell touching existing land, so the new Territory is connected to the rest. */
function pickCoastCell(cells: readonly number[], rng: Rng): number | undefined {
  const coast: number[] = [];
  for (let c = 0; c < cells.length; c++) {
    if (cells[c] !== SEA) continue;
    if (cellNeighbors(c).some((n) => (cells[n] ?? SEA) >= 0)) coast.push(c);
  }
  return coast.length ? coast[rng.int(coast.length)] : undefined;
}

function growTerritory(cells: number[], start: number, id: number, rng: Rng): number[] {
  const target = MIN_TARGET_CELLS + rng.int(MAX_TARGET_CELLS - MIN_TARGET_CELLS + 1);
  const grown = [start];
  cells[start] = id;
  const frontier = new Set(cellNeighbors(start).filter((n) => cells[n] === SEA));

  while (grown.length < target && frontier.size > 0) {
    const next = pickCompact([...frontier], cells, id, rng);
    frontier.delete(next);
    cells[next] = id;
    grown.push(next);
    for (const n of cellNeighbors(next)) if (cells[n] === SEA) frontier.add(n);
  }
  return grown;
}

/**
 * Picks the next cell to grow into, favouring cells that already touch the Territory on several
 * sides (weight = touching sides cubed), which keeps Territories round instead of stringy.
 */
function pickCompact(options: readonly number[], cells: readonly number[], id: number, rng: Rng): number {
  const weights = options.map((c) => cellNeighbors(c).filter((n) => cells[n] === id).length ** 3);
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return options[i]!;
  }
  return options[options.length - 1]!;
}

/** Gives every enclosed sea region of at most `maxSize` cells to the Territory touching it most. */
function fillSmallLakes(cells: number[], territoryCells: number[][], maxSize: number): void {
  const seen = new Set<number>();
  for (let start = 0; start < cells.length; start++) {
    if (cells[start] !== SEA || seen.has(start)) continue;
    const region = [start];
    seen.add(start);
    let enclosed = true;
    for (let i = 0; i < region.length; i++) {
      const neighbors = cellNeighbors(region[i]!);
      if (neighbors.length < 6) enclosed = false;
      for (const n of neighbors) {
        if (cells[n] === SEA && !seen.has(n)) {
          seen.add(n);
          region.push(n);
        }
      }
    }
    if (!enclosed || region.length > maxSize) continue;

    const touching = new Map<number, number>();
    for (const c of region) {
      for (const n of cellNeighbors(c)) {
        const owner = cells[n]!;
        if (owner >= 0) touching.set(owner, (touching.get(owner) ?? 0) + 1);
      }
    }
    // Most touching sides wins; ties go to the lowest id so the result stays deterministic.
    const [owner] = [...touching].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]!;
    for (const c of region) {
      cells[c] = owner;
      territoryCells[owner]!.push(c);
    }
  }
}

function computeAdjacency(cells: readonly number[], count: number): number[][] {
  const sets = Array.from({ length: count }, () => new Set<number>());
  for (let c = 0; c < cells.length; c++) {
    const own = cells[c]!;
    if (own < 0) continue;
    for (const n of cellNeighbors(c)) {
      const other = cells[n]!;
      if (other >= 0 && other !== own) sets[own]!.add(other);
    }
  }
  return sets.map((s) => [...s].sort((a, b) => a - b));
}
