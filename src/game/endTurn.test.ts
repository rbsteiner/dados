import { describe, expect, it } from 'vitest';
import { endTurn } from './endTurn';
import { line, makeGame } from './testing';
import type { GameState } from './types';

const diceOf = (game: GameState, player: number) =>
  game.territories.filter((t) => t.owner === player).reduce((n, t) => n + t.dice, 0);

describe('endTurn', () => {
  it('gives Reinforcement equal to the Largest Group', () => {
    // Player 0 owns a group of 3 (0-1-2) and a group of 2 (4-5), split by player 1's Territory 3.
    const game = makeGame(
      line(
        { owner: 0, dice: 1 }, { owner: 0, dice: 1 }, { owner: 0, dice: 1 },
        { owner: 1, dice: 1 },
        { owner: 0, dice: 1 }, { owner: 0, dice: 1 },
      ),
    );

    const { state } = endTurn(game);

    expect(diceOf(state, 0)).toBe(5 + 3);
    expect(diceOf(state, 1)).toBe(1);
  });

  it('never puts more than 8 Dice on a Territory and keeps the rest in Stock', () => {
    const game = makeGame(line({ owner: 0, dice: 7 }, { owner: 0, dice: 8 }, { owner: 0, dice: 8 }, { owner: 1, dice: 1 }));

    const { state } = endTurn(game);

    expect(state.territories.map((t) => t.dice)).toEqual([8, 8, 8, 1]);
    expect(state.players[0]?.stock).toBe(2);
  });

  it('spends the Stock together with the new Reinforcement', () => {
    const game = makeGame(line({ owner: 0, dice: 1 }, { owner: 0, dice: 1 }, { owner: 1, dice: 1 }), {
      stocks: [5, 0],
    });

    const { state } = endTurn(game);

    expect(diceOf(state, 0)).toBe(2 + 2 + 5);
    expect(state.players[0]?.stock).toBe(0);
  });

  it('caps the Stock at 64', () => {
    const game = makeGame(line({ owner: 0, dice: 8 }, { owner: 0, dice: 8 }, { owner: 1, dice: 1 }), {
      stocks: [63, 0],
    });

    const { state } = endTurn(game);

    expect(state.players[0]?.stock).toBe(64);
  });

  it('reports which Territories received Dice, one entry per Die', () => {
    const game = makeGame(line({ owner: 0, dice: 7 }, { owner: 0, dice: 8 }, { owner: 1, dice: 1 }));

    const { placed } = endTurn(game);

    expect(placed).toEqual([0]);
  });

  it('only reinforces the Player whose turn it is', () => {
    const game = makeGame(line({ owner: 0, dice: 1 }, { owner: 1, dice: 1 }, { owner: 1, dice: 1 }), {
      turnIndex: 1,
    });

    const { state } = endTurn(game);

    expect(diceOf(state, 0)).toBe(1);
    expect(diceOf(state, 1)).toBe(4);
  });

  it('passes the turn to the next Player, wrapping around the Turn Order', () => {
    const game = makeGame(line({ owner: 0, dice: 1 }, { owner: 1, dice: 1 }, { owner: 2, dice: 1 }), {
      playerCount: 3,
    });

    const second = endTurn(game).state;
    const third = endTurn(second).state;
    const backToFirst = endTurn(third).state;

    expect([second.turnIndex, third.turnIndex, backToFirst.turnIndex]).toEqual([1, 2, 0]);
  });

  it('skips Eliminated Players', () => {
    const game = makeGame(line({ owner: 0, dice: 1 }, { owner: 2, dice: 1 }), { playerCount: 3 });

    const { state } = endTurn(game);

    expect(state.turnIndex).toBe(2);
  });

  it('places the same Dice from the same game', () => {
    const game = makeGame(line({ owner: 0, dice: 1 }, { owner: 0, dice: 1 }, { owner: 0, dice: 1 }, { owner: 1, dice: 1 }));
    expect(endTurn(game)).toEqual(endTurn(game));
  });
});
