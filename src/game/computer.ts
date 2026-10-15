import { currentPlayer } from './attack';
import { createRng, type Rng } from './rng';
import type { GameState, PlayerId, Territory, TerritoryId } from './types';

export type Move =
  | { readonly type: 'attack'; readonly from: TerritoryId; readonly to: TerritoryId }
  | { readonly type: 'endTurn' };

/** Share of all Dice above which a Player becomes the Dominant Player. */
const DOMINANCE_SHARE = 0.4;
/** Chance of attacking an equal Territory when neither side leads. */
const EQUAL_DICE_ATTACK_CHANCE = 0.9;

/**
 * Normal difficulty, reproducing the original game's behaviour:
 * - when a Dominant Player exists, only Attacks involving them are considered;
 * - never attack a Territory holding more Dice;
 * - on equal Dice, attack if either side leads, otherwise 9 times in 10;
 * - pick one of the acceptable Attacks at random, or end the turn if there are none.
 */
export function computerMove(state: GameState): { move: Move; state: GameState } {
  const player = currentPlayer(state);
  const rng = createRng(state.rng);
  const totals = diceTotals(state);
  const dominant = dominantPlayer(totals);
  const leaders = leadingPlayers(totals);
  const candidates: Move[] = [];

  for (const from of state.territories) {
    if (from.owner !== player || from.dice < 2) continue;
    for (const id of from.adjacent) {
      const to = state.territories[id]!;
      if (to.owner === player) continue;
      if (dominant !== undefined && player !== dominant && to.owner !== dominant) continue;
      if (!acceptable(from, to, leaders, rng)) continue;
      candidates.push({ type: 'attack', from: from.id, to: to.id });
    }
  }

  const move = candidates.length ? candidates[rng.int(candidates.length)]! : { type: 'endTurn' as const };
  return { move, state: { ...state, rng: rng.state } };
}

function acceptable(from: Territory, to: Territory, leaders: ReadonlySet<PlayerId>, rng: Rng): boolean {
  if (to.dice > from.dice) return false;
  if (to.dice < from.dice) return true;
  if (leaders.has(from.owner) || leaders.has(to.owner)) return true;
  return rng.next() < EQUAL_DICE_ATTACK_CHANCE;
}

function diceTotals(state: GameState): Map<PlayerId, number> {
  const totals = new Map<PlayerId, number>(state.players.map((p) => [p.id, 0]));
  for (const t of state.territories) totals.set(t.owner, (totals.get(t.owner) ?? 0) + t.dice);
  return totals;
}

function dominantPlayer(totals: ReadonlyMap<PlayerId, number>): PlayerId | undefined {
  const all = [...totals.values()].reduce((a, b) => a + b, 0);
  for (const [player, dice] of totals) if (dice > all * DOMINANCE_SHARE) return player;
  return undefined;
}

/** Every Player tied for the most Dice. */
function leadingPlayers(totals: ReadonlyMap<PlayerId, number>): Set<PlayerId> {
  const most = Math.max(...totals.values());
  return new Set([...totals].filter(([, dice]) => dice === most).map(([player]) => player));
}
