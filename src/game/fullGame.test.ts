import { describe, expect, it } from 'vitest';
import { attack, attackRefusal, currentPlayer } from './attack';
import { computerMove } from './computer';
import { endTurn } from './endTurn';
import { newGame } from './newGame';
import { gameOutcome } from './outcome';
import { MAX_DICE, STOCK_CAP, type GameState } from './types';

/** Lets the Normal Computer play every seat, including the Human's, until the game ends. */
function playOut(game: GameState, maxMoves = 20_000): { game: GameState; moves: number } {
  let state = game;
  for (let moves = 0; moves < maxMoves; moves++) {
    if (gameOutcome(state) !== 'playing') return { game: state, moves };
    const { move, state: next } = computerMove(state);
    if (move.type === 'attack') {
      expect(attackRefusal(next, move.from, move.to)).toBeUndefined();
      const { state: after, result } = attack(next, move.from, move.to);
      expectOwnershipChangedOnlyBy(state, after, result.captured ? move.to : undefined);
      state = after;
    } else {
      state = endTurn(next).state;
      expectOwnershipChangedOnlyBy(next, state, undefined);
    }
    expectInvariants(state);
  }
  return { game: state, moves: maxMoves };
}

function expectInvariants(state: GameState): void {
  for (const t of state.territories) {
    expect(t.dice).toBeGreaterThanOrEqual(1);
    expect(t.dice).toBeLessThanOrEqual(MAX_DICE);
  }
  for (const p of state.players) expect(p.stock).toBeLessThanOrEqual(STOCK_CAP);
  if (gameOutcome(state) === 'playing') {
    expect(state.territories.some((t) => t.owner === currentPlayer(state))).toBe(true);
  }
}

function expectOwnershipChangedOnlyBy(before: GameState, after: GameState, captured: number | undefined): void {
  const changed = after.territories.filter((t) => t.owner !== before.territories[t.id]!.owner).map((t) => t.id);
  expect(changed).toEqual(captured === undefined ? [] : [captured]);
}

describe('a full game', () => {
  it.each([1, 2, 3, 4, 5])('always reaches an end, keeping every rule along the way (code %i)', (gameCode) => {
    const { game } = playOut(newGame({ playerCount: 8, humanColor: 3, gameCode }));
    expect(gameOutcome(game)).not.toBe('playing');
  });

  it('replays identically from the same Game Code', () => {
    const options = { playerCount: 4, humanColor: 0, gameCode: 777 };
    expect(playOut(newGame(options))).toEqual(playOut(newGame(options)));
  });
});
