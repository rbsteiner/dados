import type { GameState, TerritoryId } from '../game/types';
import type { HexLayout, Point } from './geometry';
import { colorOf } from './palette';

export interface View {
  readonly selected?: TerritoryId | undefined;
  /** Territories involved in the last Attack, briefly highlighted. */
  readonly lastAttack?: { readonly from: TerritoryId; readonly to: TerritoryId } | undefined;
}

const BORDER = '#0b0c0f';
const FIGHT = '#ff3b30';
const SHADOW = 'rgba(0, 0, 0, 0.35)';

export function render(ctx: CanvasRenderingContext2D, state: GameState, layout: HexLayout, view: View): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const highlighted = new Set<TerritoryId>();
  if (view.selected !== undefined) highlighted.add(view.selected);
  if (view.lastAttack) highlighted.add(view.lastAttack.from).add(view.lastAttack.to);

  // Each Territory is filled as one shape, so no seams show between its cells.
  for (const territory of state.territories) {
    const base = colorOf(state.players[territory.owner]!.color);
    ctx.fillStyle = highlighted.has(territory.id) ? mix(base, '#000000', 0.45) : base;
    ctx.beginPath();
    for (const cell of territory.cells) addPolygon(ctx, layout.corners(cell));
    ctx.fill();
  }

  const lineWidth = Math.max(2, layout.radius * 0.3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokeOutlines(ctx, state, layout, () => true, BORDER, lineWidth);
  if (highlighted.size) strokeOutlines(ctx, state, layout, (t) => highlighted.has(t), FIGHT, lineWidth);

  // Dice last, top to bottom, so lower stacks overlap the ones behind them.
  const stacks = state.territories
    .map((t) => ({ at: layout.anchor(t), dice: t.dice, color: colorOf(state.players[t.owner]!.color) }))
    .sort((a, b) => a.at.y - b.at.y);
  for (const s of stacks) drawDice(ctx, s.at, s.dice, s.color, layout.radius);
}

/** Strokes every cell edge on the outline of the Territories matching `include`. */
function strokeOutlines(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: HexLayout,
  include: (territory: TerritoryId) => boolean,
  color: string,
  lineWidth: number,
): void {
  const cells = state.map.cells;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  cells.forEach((owner, cell) => {
    if (owner < 0 || !include(owner)) return;
    const corners = layout.corners(cell);
    for (let edge = 0; edge < 6; edge++) {
      const across = neighborAcrossEdge(cell, edge, state.map.width, state.map.height);
      if (across !== undefined && cells[across] === owner) continue;
      const a = corners[edge]!;
      const b = corners[(edge + 1) % 6]!;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  });
  ctx.stroke();
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

/** Up to 8 cubes in two stacks of 4, the second stack in front and slightly to the right. */
function drawDice(ctx: CanvasRenderingContext2D, at: Point, count: number, color: string, radius: number): void {
  const size = radius * 2;
  const rise = size * 0.55;
  const back = { x: at.x - size * 0.22, y: at.y - size * 0.12 };
  const front = { x: at.x + size * 0.32, y: at.y + size * 0.2 };

  // Soft shadow under the stacks.
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  const shadowWidth = count > 4 ? size * 0.95 : size * 0.65;
  const shadowX = count > 4 ? (back.x + front.x) / 2 + size * 0.08 : back.x + size * 0.08;
  const shadowY = (count > 4 ? front.y : back.y) + size * 0.42;
  ctx.ellipse(shadowX, shadowY, shadowWidth, size * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < count; i++) {
    const base = i < 4 ? back : front;
    drawCube(ctx, base.x, base.y - (i % 4) * rise, size, color);
  }
}

function drawCube(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  const h = s / 2;
  const q = s / 4;
  const top: Point[] = [{ x, y: y - h }, { x: x + h, y: y - q }, { x, y }, { x: x - h, y: y - q }];
  const left: Point[] = [{ x: x - h, y: y - q }, { x, y }, { x, y: y + h }, { x: x - h, y: y + q }];
  const right: Point[] = [{ x: x + h, y: y - q }, { x, y }, { x, y: y + h }, { x: x + h, y: y + q }];
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = BORDER;
  for (const [face, fill] of [
    [top, mix(color, '#ffffff', 0.6)],
    [left, color],
    [right, mix(color, '#000000', 0.3)],
  ] as const) {
    ctx.beginPath();
    addPolygon(ctx, face);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  }
  // One pip on the top face.
  ctx.fillStyle = BORDER;
  ctx.beginPath();
  ctx.ellipse(x, y - q, s * 0.09, s * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Adds a closed polygon to the current path. */
function addPolygon(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
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
