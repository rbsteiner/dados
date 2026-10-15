export const MAX_DICE = 8;
export const STOCK_CAP = 64;
export const MAX_TERRITORIES = 31;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

/** Index into the Color palette (0..7). */
export type ColorId = number;
/** Index into GameState.players. The Human is always player 0. */
export type PlayerId = number;
/** Index into GameState.territories. */
export type TerritoryId = number;

export interface Player {
  readonly id: PlayerId;
  readonly color: ColorId;
  readonly kind: 'human' | 'computer';
  readonly stock: number;
}

export interface Territory {
  readonly id: TerritoryId;
  readonly owner: PlayerId;
  readonly dice: number;
  /** Indexes of the Map cells forming this Territory. */
  readonly cells: readonly number[];
  readonly adjacent: readonly TerritoryId[];
}

/** A hex grid in "odd-r" offset layout: odd rows are shifted half a cell to the right. */
export interface GameMap {
  readonly width: number;
  readonly height: number;
  /** For each cell (row-major), the Territory it belongs to, or -1 for sea. */
  readonly cells: readonly number[];
}

export interface GameState {
  readonly gameCode: number;
  readonly map: GameMap;
  readonly territories: readonly Territory[];
  readonly players: readonly Player[];
  readonly turnOrder: readonly PlayerId[];
  /** Position in turnOrder of the Player whose turn it is. */
  readonly turnIndex: number;
  /** Seeded random generator state; every random event derives from it. */
  readonly rng: number;
}
