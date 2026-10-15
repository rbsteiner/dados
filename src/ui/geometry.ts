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

  /** Where to draw a Territory's Dice: its cell closest to the Territory's average position. */
  anchor(territory: Territory): Point {
    const points = territory.cells.map((c) => this.center(c));
    const avg = {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
    return points.reduce((best, p) =>
      (p.x - avg.x) ** 2 + (p.y - avg.y) ** 2 < (best.x - avg.x) ** 2 + (best.y - avg.y) ** 2 ? p : best,
    );
  }

  private unitCenter(cell: number): Point {
    const col = cell % this.map.width;
    const row = Math.floor(cell / this.map.width);
    return { x: SQRT3 * (col + 0.5 * (row % 2)), y: 1.5 * row };
  }
}

const SQRT3 = Math.sqrt(3);
