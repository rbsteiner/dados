import type { Rng } from './rng';
import { MAX_TERRITORIES, type GameMap } from './types';

export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 28;

const MIN_TARGET_CELLS = 14;
const MAX_TARGET_CELLS = 30;
/** Enclosed sea regions this small are filled with land. */
const MAX_FILLED_LAKE_CELLS = 3;
const SEA = -1;

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

  while (territoryCells.length < MAX_TERRITORIES) {
    const core = territoryCells.length === 0 ? coreAround(centerCell()) : pickCoastCore(cells, rng);
    if (core === undefined) break; // no room left for a full core
    territoryCells.push(growTerritory(cells, core, territoryCells.length, rng));
  }

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

/** A cell and its 6 neighbours, or undefined if the cell is on the edge of the grid. */
function coreAround(center: number): number[] | undefined {
  const neighbors = cellNeighbors(center);
  return neighbors.length === 6 ? [center, ...neighbors] : undefined;
}

/**
 * A random free core (7 sea cells) touching existing land, so the new Territory is connected to
 * the rest and has room for its dice. Undefined when no such core is left.
 */
function pickCoastCore(cells: readonly number[], rng: Rng): number[] | undefined {
  const candidates: number[][] = [];
  for (let c = 0; c < cells.length; c++) {
    const core = coreAround(c);
    if (!core || core.some((x) => cells[x] !== SEA)) continue;
    if (core.some((x) => cellNeighbors(x).some((n) => cells[n]! >= 0))) candidates.push(core);
  }
  return candidates.length ? candidates[rng.int(candidates.length)] : undefined;
}

/** Claims the core, then grows compactly into free cells up to a random size. */
function growTerritory(cells: number[], core: readonly number[], id: number, rng: Rng): number[] {
  const target = MIN_TARGET_CELLS + rng.int(MAX_TARGET_CELLS - MIN_TARGET_CELLS + 1);
  const grown = [...core];
  for (const c of core) cells[c] = id;
  const frontier = new Set(core.flatMap((c) => cellNeighbors(c)).filter((n) => cells[n] === SEA));

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
