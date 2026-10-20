import { it } from 'vitest';
import { attack } from './attack';
import { computerMove } from './computer';
import { endTurn } from './endTurn';
import { newGame } from './newGame';
import type { GameState } from './types';

/**
 * Balance check, run on demand with `npm run simulate` (too slow and too noisy for a test).
 * The Normal Computer plays every seat, including the Human's, until one Player owns the whole Map.
 * In a fair game every seat and every Turn Order position wins about 1 game in N.
 */
const GAMES = 1000;
const percent = (part: number, whole: number) => `${((100 * part) / whole).toFixed(1)}%`;

function playOut(game: GameState): GameState {
  let state = game;
  while (new Set(state.territories.map((t) => t.owner)).size > 1) {
    const { move, state: next } = computerMove(state);
    state = move.type === 'attack' ? attack(next, move.from, move.to).state : endTurn(next).state;
  }
  return state;
}

it.each([2, 3, 5, 7, 8])('balance with %i players', (playerCount) => {
  const bySeat = new Array<number>(playerCount).fill(0);
  const byPosition = new Array<number>(playerCount).fill(0);
  for (let gameCode = 1; gameCode <= GAMES; gameCode++) {
    const end = playOut(newGame({ playerCount, humanColor: 0, gameCode }));
    const winner = end.territories[0]!.owner;
    bySeat[winner]!++;
    byPosition[end.turnOrder.indexOf(winner)]!++;
  }
  console.log(
    `${playerCount} players, ${GAMES} games, fair share ${percent(1, playerCount)}\n` +
      `  Human's seat wins ${percent(bySeat[0]!, GAMES)}; other seats ${bySeat.slice(1).map((w) => percent(w, GAMES)).join(' ')}\n` +
      `  by Turn Order position, 1st to last: ${byPosition.map((w) => percent(w, GAMES)).join(' ')}`,
  );
}, 600_000);
