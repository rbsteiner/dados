import type { GameState, TerritoryId } from '../game/types';
import type { HexLayout, Point } from './geometry';
import { colorOf } from './palette';

export interface View {
  readonly selected?: TerritoryId | undefined;
  /** The two Territories of the Attack being played. */
  readonly fight?: { readonly from: TerritoryId; readonly to: TerritoryId } | undefined;
  /** Offsets of dice stacks, in units of the cell radius (jolts, shakes, bounces). */
  readonly shift?: ReadonlyMap<TerritoryId, Point> | undefined;
  /** A Territory flashing toward white; amount from 0 (none) to 1. */
  readonly flash?: { readonly territory: TerritoryId; readonly amount: number } | undefined;
}

const BORDER = '#0b0c0f';
const FIGHT = '#ff3b30';
const SHADOW = 'rgba(0, 0, 0, 0.38)';
/** Light comes from the upper left, so shadows fall toward the lower right. */
const SHADOW_DIRECTION: Point = { x: 0.9, y: 0.45 };

export function render(ctx: CanvasRenderingContext2D, state: GameState, layout: HexLayout, view: View): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const highlighted = new Set<TerritoryId>();
  if (view.selected !== undefined) highlighted.add(view.selected);
  if (view.fight) highlighted.add(view.fight.from).add(view.fight.to);

  // Each Territory is filled as one shape, so no seams show between its cells.
  for (const territory of state.territories) {
    const base = colorOf(state.players[territory.owner]!.color);
    let fill = highlighted.has(territory.id) ? mix(base, '#000000', 0.45) : base;
    if (view.flash?.territory === territory.id) fill = mix(fill, '#ffffff', view.flash.amount * 0.7);
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (const cell of territory.cells) addPolygon(ctx, layout.corners(cell));
    ctx.fill();
  }

  const lineWidth = Math.max(2, layout.radius * 0.3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokeOutlines(ctx, state, layout, () => true, BORDER, lineWidth);
  if (highlighted.size) strokeOutlines(ctx, state, layout, (t) => highlighted.has(t), FIGHT, lineWidth);

  // Shadows first so no shadow is ever drawn over a neighbouring stack; then dice top to bottom,
  // so lower stacks overlap the ones behind them.
  const stacks = state.territories
    .map((t) => {
      const anchor = layout.anchor(t);
      const shift = view.shift?.get(t.id) ?? { x: 0, y: 0 };
      const at = { x: anchor.x + shift.x * layout.radius, y: anchor.y + shift.y * layout.radius };
      return { at, dice: t.dice, color: colorOf(state.players[t.owner]!.color) };
    })
    .sort((a, b) => a.at.y - b.at.y);
  ctx.fillStyle = SHADOW;
  for (const s of stacks) for (const pile of piles(s.at, s.dice, layout.radius)) drawShadow(ctx, pile);
  for (const s of stacks) for (const pile of piles(s.at, s.dice, layout.radius)) drawPile(ctx, pile, s.color);
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

interface Pile {
  /** Front-top corner of the bottom die's top face, as used by drawDie. */
  readonly base: Point;
  readonly count: number;
  /** Die size in pixels. */
  readonly size: number;
}

/** Up to 8 dice in two piles of 4: the second pile in front of the first and to its right. */
function piles(at: Point, count: number, radius: number): Pile[] {
  const size = radius * 2.1;
  const back: Pile = { base: { x: at.x - size * 0.28, y: at.y - size * 0.2 }, count: Math.min(count, 4), size };
  if (count <= 4) return [{ ...back, base: { x: at.x, y: at.y - size * 0.1 } }];
  return [back, { base: { x: at.x + size * 0.32, y: at.y + size * 0.12 }, count: count - 4, size }];
}

/** The shadow a pile casts on the map: its footprint swept away from the light, longer for taller piles. */
function drawShadow(ctx: CanvasRenderingContext2D, pile: Pile): void {
  const h = pile.size / 2;
  const q = pile.size / 4;
  const { x, y } = pile.base;
  const footprint: Point[] = [{ x, y }, { x: x + h, y: y + q }, { x, y: y + h }, { x: x - h, y: y + q }];
  const length = pile.count * h * 0.6;
  const cast = footprint.map((p) => ({ x: p.x + SHADOW_DIRECTION.x * length, y: p.y + SHADOW_DIRECTION.y * length }));
  ctx.beginPath();
  addPolygon(ctx, convexHull([...footprint, ...cast]));
  ctx.fill();
}

function drawPile(ctx: CanvasRenderingContext2D, pile: Pile, color: string): void {
  // Each die sits exactly on the one below (a die is h tall on screen).
  for (let i = 0; i < pile.count; i++) drawDie(ctx, pile.base.x, pile.base.y - (i * pile.size) / 2, pile.size, color);
}

/**
 * A die seen from above-left: (x, y) is the front corner of its top face, s its width.
 * Faces are shaded by the upper-left light and show 1 (top), 2 (left) and 3 (right) pips,
 * which meet at a corner on a real die.
 */
function drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  const h = s / 2;
  const q = s / 4;
  const faces: { corners: Point[]; fill: string; center: Point; u: Point; v: Point; pips: number }[] = [
    {
      corners: [{ x, y: y - h }, { x: x + h, y: y - q }, { x, y }, { x: x - h, y: y - q }],
      fill: mix(color, '#ffffff', 0.55),
      center: { x, y: y - q },
      u: { x: h / 2, y: q / 2 },
      v: { x: -h / 2, y: q / 2 },
      pips: 1,
    },
    {
      corners: [{ x: x - h, y: y - q }, { x, y }, { x, y: y + h }, { x: x - h, y: y + q }],
      fill: mix(color, '#ffffff', 0.1),
      center: { x: x - h / 2, y: y + h / 4 },
      u: { x: h / 2, y: q / 2 },
      v: { x: 0, y: h / 2 },
      pips: 2,
    },
    {
      corners: [{ x, y }, { x: x + h, y: y - q }, { x: x + h, y: y + q }, { x, y: y + h }],
      fill: mix(color, '#000000', 0.35),
      center: { x: x + h / 2, y: y + h / 4 },
      u: { x: h / 2, y: -q / 2 },
      v: { x: 0, y: h / 2 },
      pips: 3,
    },
  ];
  ctx.lineWidth = Math.max(1.2, s * 0.06);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = BORDER;
  for (const face of faces) {
    ctx.beginPath();
    addPolygon(ctx, face.corners);
    ctx.fillStyle = face.fill;
    ctx.fill();
    ctx.stroke();
    if (s >= 14) drawPips(ctx, face.center, face.u, face.v, face.pips);
  }
}

/** Pip positions on a face, in face coordinates from -1 to 1. */
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0, 0]],
  2: [[-0.5, -0.5], [0.5, 0.5]],
  3: [[-0.5, -0.5], [0, 0], [0.5, 0.5]],
};

/** Draws pips on a parallelogram face given its center and half-axes `u` and `v`. */
function drawPips(ctx: CanvasRenderingContext2D, center: Point, u: Point, v: Point, value: number): void {
  ctx.save();
  ctx.transform(u.x, u.y, v.x, v.y, center.x, center.y);
  ctx.fillStyle = BORDER;
  ctx.beginPath();
  const r = value === 1 ? 0.3 : 0.22;
  for (const [a, b] of PIPS[value] ?? []) {
    ctx.moveTo(a + r, b);
    ctx.arc(a, b, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

/** Convex hull of a few points (monotone chain). */
function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
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
  // Returns #rrggbb so results can be blended again (e.g. a highlighted Territory that flashes).
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}
