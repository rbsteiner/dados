import type { GameState, TerritoryId } from '../game/types';
import type { HexLayout, Point } from './geometry';
import { colorOf } from './palette';

export interface View {
  readonly selected?: TerritoryId | undefined;
  /** Territories involved in the last Attack, briefly highlighted. */
  readonly lastAttack?: { readonly from: TerritoryId; readonly to: TerritoryId } | undefined;
}

const BORDER = '#1d1f24';

export function render(ctx: CanvasRenderingContext2D, state: GameState, layout: HexLayout, view: View): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const territoryOf = state.map.cells;
  for (const territory of state.territories) {
    const base = colorOf(state.players[territory.owner]!.color);
    const highlighted = territory.id === view.selected || territory.id === view.lastAttack?.to;
    ctx.fillStyle = highlighted ? mix(base, '#ffffff', 0.45) : base;
    for (const cell of territory.cells) {
      polygon(ctx, layout.corners(cell));
      ctx.fill();
    }
  }

  // Borders: draw each cell edge whose neighbour belongs to another Territory or the sea.
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = Math.max(1.5, layout.radius * 0.18);
  ctx.lineCap = 'round';
  ctx.beginPath();
  territoryOf.forEach((owner, cell) => {
    if (owner < 0) return;
    const corners = layout.corners(cell);
    for (let edge = 0; edge < 6; edge++) {
      const across = neighborAcrossEdge(cell, edge, state.map.width, state.map.height);
      if (across !== undefined && territoryOf[across] === owner) continue;
      const a = corners[edge]!;
      const b = corners[(edge + 1) % 6]!;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  });
  ctx.stroke();

  for (const territory of state.territories) {
    drawDice(ctx, layout.anchor(territory), territory.dice, colorOf(state.players[territory.owner]!.color), layout.radius);
  }
}

/**
 * The cell sharing edge `edge` of a pointy-top hex (corners start at the top, clockwise):
 * 0 upper-right, 1 right, 2 lower-right, 3 lower-left, 4 left, 5 upper-left.
 */
function neighborAcrossEdge(cell: number, edge: number, width: number, height: number): number | undefined {
  const x = cell % width;
  const y = Math.floor(cell / width);
  const shift = y % 2;
  const offsets: readonly [number, number][] = [
    [shift, -1], [1, 0], [shift, 1], [shift - 1, 1], [-1, 0], [shift - 1, -1],
  ];
  const [dx, dy] = offsets[edge]!;
  const nx = x + dx;
  const ny = y + dy;
  return nx >= 0 && nx < width && ny >= 0 && ny < height ? ny * width + nx : undefined;
}

/** Up to 8 small cubes in two stacks of 4, the second stack in front and slightly to the right. */
function drawDice(ctx: CanvasRenderingContext2D, at: Point, count: number, color: string, radius: number): void {
  const size = radius * 1.05;
  const rise = size * 0.62;
  for (let i = 0; i < count; i++) {
    const stack = i < 4 ? 0 : 1;
    const level = i % 4;
    const x = at.x + (stack ? size * 0.55 : -size * 0.25);
    const y = at.y + (stack ? size * 0.55 : 0) - level * rise;
    drawCube(ctx, x, y, size, color);
  }
}

function drawCube(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  const h = s / 2;
  const q = s / 4;
  const top: Point[] = [{ x, y: y - h }, { x: x + h, y: y - q }, { x, y }, { x: x - h, y: y - q }];
  const left: Point[] = [{ x: x - h, y: y - q }, { x, y }, { x, y: y + h }, { x: x - h, y: y + q }];
  const right: Point[] = [{ x: x + h, y: y - q }, { x, y }, { x, y: y + h }, { x: x + h, y: y + q }];
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.strokeStyle = BORDER;
  for (const [face, fill] of [
    [top, mix(color, '#ffffff', 0.55)],
    [left, mix(color, '#ffffff', 0.15)],
    [right, mix(color, '#000000', 0.2)],
  ] as const) {
    polygon(ctx, face);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  }
  // One pip on the top face.
  ctx.fillStyle = BORDER;
  ctx.beginPath();
  ctx.ellipse(x, y - q, s * 0.08, s * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

/** Blends two #rrggbb colours; t = 0 gives `a`, t = 1 gives `b`. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}
