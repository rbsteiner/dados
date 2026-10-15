import { cellNeighbors } from '../game/map';
import type { GameMap, Territory } from '../game/types';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Converts Map cells to pixels for a pointy-top hex grid in "odd-r" layout, fitted to a box. */
export class HexLayout {
  readonly radius: number;
  private readonly originX: number;
  private readonly originY: number;

  constructor(
    private readonly map: GameMap,
    width: number,
    height: number,
    padding = 12,
  ) {
    // Bounds of the land in unit-radius coordinates.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    map.cells.forEach((owner, cell) => {
      if (owner < 0) return;
      const { x, y } = this.unitCenter(cell);
      minX = Math.min(minX, x - SQRT3 / 2);
      maxX = Math.max(maxX, x + SQRT3 / 2);
      minY = Math.min(minY, y - 1);
      maxY = Math.max(maxY, y + 1);
    });
    // Room above the top row for a full stack of dice (about 4 cell radii tall).
    minY -= DICE_HEADROOM;
    const scale = Math.min((width - 2 * padding) / (maxX - minX), (height - 2 * padding) / (maxY - minY));
    this.radius = scale;
    this.originX = (width - (maxX - minX) * scale) / 2 - minX * scale;
    this.originY = (height - (maxY - minY) * scale) / 2 - minY * scale;
  }

  center(cell: number): Point {
    const u = this.unitCenter(cell);
    return { x: this.originX + u.x * this.radius, y: this.originY + u.y * this.radius };
  }

  /** The 6 corners of a cell, starting at the top and going clockwise. */
  corners(cell: number): Point[] {
    const c = this.center(cell);
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      return { x: c.x + this.radius * Math.cos(angle), y: c.y + this.radius * Math.sin(angle) };
    });
  }

  /** The land cell under a point, or undefined over the sea. */
  cellAt(p: Point): number | undefined {
    let best: number | undefined;
    let bestDistance = this.radius * this.radius;
    this.map.cells.forEach((owner, cell) => {
      if (owner < 0) return;
      const c = this.center(cell);
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = cell;
      }
    });
    return best;
  }

  /**
   * Where to draw a Territory's Dice: its cell farthest from any border, so the stack stays inside.
   * Ties go to the cell closest to the Territory's average position.
   */
  anchor(territory: Territory): Point {
    const cached = this.anchors.get(territory.id);
    if (cached && cached.cells === territory.cells) return cached.point;

    const depth = this.depthFromBorder(territory);
    const points = territory.cells.map((c) => this.center(c));
    const avg = {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
    let best = 0;
    territory.cells.forEach((cell, i) => {
      const d = depth.get(cell)!;
      const bestDepth = depth.get(territory.cells[best]!)!;
      const closer = (points[i]!.x - avg.x) ** 2 + (points[i]!.y - avg.y) ** 2 <
        (points[best]!.x - avg.x) ** 2 + (points[best]!.y - avg.y) ** 2;
      if (d > bestDepth || (d === bestDepth && closer)) best = i;
    });
    const point = points[best]!;
    this.anchors.set(territory.id, { cells: territory.cells, point });
    return point;
  }

  private readonly anchors = new Map<number, { cells: readonly number[]; point: Point }>();

  /** For each cell of a Territory, how many steps it is from the nearest cell outside it. */
  private depthFromBorder(territory: Territory): Map<number, number> {
    const own = new Set(territory.cells);
    const depth = new Map<number, number>();
    const queue: number[] = [];
    for (const cell of territory.cells) {
      const neighbors = cellNeighbors(cell, this.map.width, this.map.height);
      if (neighbors.length < 6 || neighbors.some((n) => !own.has(n))) {
        depth.set(cell, 0);
        queue.push(cell);
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i]!;
      for (const n of cellNeighbors(cell, this.map.width, this.map.height)) {
        if (own.has(n) && !depth.has(n)) {
          depth.set(n, depth.get(cell)! + 1);
          queue.push(n);
        }
      }
    }
    return depth;
  }

  private unitCenter(cell: number): Point {
    const col = cell % this.map.width;
    const row = Math.floor(cell / this.map.width);
    return { x: SQRT3 * (col + 0.5 * (row % 2)), y: 1.5 * row };
  }
}

const SQRT3 = Math.sqrt(3);
/** Extra space above the map, in cell radii, so stacks on the top row aren't cut off. */
const DICE_HEADROOM = 4;
