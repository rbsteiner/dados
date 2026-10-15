import { describe, expect, it } from 'vitest';
import { attack } from './attack';
import { computerMove } from './computer';
import { endTurn } from './endTurn';
import { newGame } from './newGame';
import { gameOutcome } from './outcome';
import type { GameState } from './types';

/** Lets the Normal Computer play every seat, including the Human's, until the game ends. */
function playOut(game: GameState, maxMoves = 20_000): { game: GameState; moves: number } {
  let state = game;
  for (let moves = 0; moves < maxMoves; moves++) {
    if (gameOutcome(state) !== 'playing') return { game: state, moves };
    const { move, state: next } = computerMove(state);
    state = move.type === 'attack' ? attack(next, move.from, move.to).state : endTurn(next).state;
  }
  return { game: state, moves: maxMoves };
}

describe('a full game', () => {
  it.each([1, 2, 3, 4, 5])('always reaches an end (code %i)', (gameCode) => {
    const { game } = playOut(newGame({ playerCount: 8, humanColor: 3, gameCode }));
    expect(gameOutcome(game)).not.toBe('playing');
  });

  it('replays identically from the same Game Code', () => {
    const options = { playerCount: 4, humanColor: 0, gameCode: 777 };
    expect(playOut(newGame(options))).toEqual(playOut(newGame(options)));
  });
});
