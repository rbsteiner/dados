import { currentPlayer } from './attack';
import { createRng } from './rng';
import { MAX_DICE, STOCK_CAP, type GameState, type PlayerId, type TerritoryId } from './types';

/** The size of the biggest set of a Player's Territories connected through each other. */
export function largestGroup(state: GameState, player: PlayerId): number {
  const seen = new Set<TerritoryId>();
  let best = 0;
  for (const start of state.territories) {
    if (start.owner !== player || seen.has(start.id)) continue;
    let size = 0;
    const queue = [start.id];
    seen.add(start.id);
    while (queue.length) {
      const t = state.territories[queue.pop()!]!;
      size++;
      for (const a of t.adjacent) {
        if (!seen.has(a) && state.territories[a]!.owner === player) {
          seen.add(a);
          queue.push(a);
        }
      }
    }
    best = Math.max(best, size);
  }
  return best;
}

export function endTurn(state: GameState): { state: GameState; placed: TerritoryId[] } {
  const player = currentPlayer(state);
  const rng = createRng(state.rng);
  const dice = state.territories.map((t) => t.dice);
  const placed: TerritoryId[] = [];

  let pool = Math.min(STOCK_CAP, state.players[player]!.stock + largestGroup(state, player));
  while (pool > 0) {
    const open = state.territories.filter((t) => t.owner === player && dice[t.id]! < MAX_DICE);
    if (open.length === 0) break;
    const target = open[rng.int(open.length)]!.id;
    dice[target]!++;
    placed.push(target);
    pool--;
  }

  const reinforced: GameState = {
    ...state,
    territories: state.territories.map((t) => (dice[t.id] === t.dice ? t : { ...t, dice: dice[t.id]! })),
    players: state.players.map((p) => (p.id === player ? { ...p, stock: pool } : p)),
    rng: rng.state,
  };
  return { state: { ...reinforced, turnIndex: nextTurnIndex(reinforced) }, placed };
}

/** The next position in the Turn Order whose Player still owns a Territory. */
function nextTurnIndex(state: GameState): number {
  const n = state.turnOrder.length;
  for (let step = 1; step <= n; step++) {
    const index = (state.turnIndex + step) % n;
    const player = state.turnOrder[index]!;
    if (state.territories.some((t) => t.owner === player)) return index;
  }
  return state.turnIndex;
}
