import type { Rng } from './rng';
import { MAX_TERRITORIES, type GameMap } from './types';

export const MAP_WIDTH = 28;
export const MAP_HEIGHT = 32;

const MIN_TERRITORY_CELLS = 8;
const MIN_TARGET_CELLS = 14;
const MAX_TARGET_CELLS = 30;
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
    const options = [...frontier];
    const next = options[rng.int(options.length)]!;
    frontier.delete(next);
    cells[next] = id;
    grown.push(next);
    for (const n of cellNeighbors(next)) if (cells[n] === SEA) frontier.add(n);
  }
  return grown;
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
