import type { GameState, PlayerId } from './types';

export interface TerritorySpec {
  readonly owner: PlayerId;
  readonly dice: number;
  readonly adjacent: readonly number[];
}

/** Builds a hand-made game for tests. Player 0 is the Human; turn order is 0, 1, 2… */
export function makeGame(
  territories: readonly TerritorySpec[],
  options: { playerCount?: number; turnIndex?: number; stocks?: readonly number[]; rng?: number } = {},
): GameState {
  const playerCount = options.playerCount ?? 2;
  return {
    gameCode: 1,
    map: { width: 0, height: 0, cells: [] },
    territories: territories.map((t, id) => ({ id, cells: [], ...t })),
    players: Array.from({ length: playerCount }, (_, id) => ({
      id,
      color: id,
      kind: id === 0 ? 'human' : 'computer',
      stock: options.stocks?.[id] ?? 0,
    })),
    turnOrder: Array.from({ length: playerCount }, (_, id) => id),
    turnIndex: options.turnIndex ?? 0,
    rng: options.rng ?? 42,
  };
}

/** A row of Territories, each touching the next: 0 – 1 – 2 – … */
export function line(...specs: readonly { owner: PlayerId; dice: number }[]): TerritorySpec[] {
  return specs.map((s, i) => ({
    ...s,
    adjacent: [i - 1, i + 1].filter((a) => a >= 0 && a < specs.length),
  }));
}
