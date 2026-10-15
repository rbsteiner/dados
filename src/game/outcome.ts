import type { GameState } from './types';

export type Outcome = 'playing' | 'won' | 'lost';

/** The game ends when the Human owns every Territory, or is Eliminated. */
export function gameOutcome(state: GameState): Outcome {
  const human = state.players.find((p) => p.kind === 'human')!;
  const owned = state.territories.filter((t) => t.owner === human.id).length;
  if (owned === 0) return 'lost';
  if (owned === state.territories.length) return 'won';
  return 'playing';
}
