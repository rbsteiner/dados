import { describe, expect, it } from 'vitest';
import { attackRefusal } from './attack';
import { computerMove } from './computer';
import { newGame } from './newGame';
import { line, makeGame, type TerritorySpec } from './testing';
import type { GameState } from './types';

/** The Computer (player 1) plays; returns its moves over many random states. */
function movesOver(game: GameState, runs = 500) {
  return Array.from({ length: runs }, (_, rng) => computerMove({ ...game, rng }).move);
}

const asComputer = (specs: TerritorySpec[], playerCount = 2) => makeGame(specs, { playerCount, turnIndex: 1 });

describe('computerMove (Normal)', () => {
  it('ends its turn when no Territory has 2 or more Dice', () => {
    const game = asComputer(line({ owner: 1, dice: 1 }, { owner: 0, dice: 1 }));
    expect(computerMove(game).move).toEqual({ type: 'endTurn' });
  });

  it('attacks a Territory holding fewer Dice', () => {
    const game = asComputer(line({ owner: 1, dice: 3 }, { owner: 0, dice: 2 }));
    expect(new Set(movesOver(game).map((m) => JSON.stringify(m)))).toEqual(
      new Set([JSON.stringify({ type: 'attack', from: 0, to: 1 })]),
    );
  });

  it('never attacks a Territory holding more Dice', () => {
    const game = asComputer(line({ owner: 1, dice: 3 }, { owner: 0, dice: 4 }));
    expect(movesOver(game).every((m) => m.type === 'endTurn')).toBe(true);
  });

  describe('with equal Dice', () => {
    const attackRate = (game: GameState) => {
      const moves = movesOver(game, 2000);
      return moves.filter((m) => m.type === 'attack').length / moves.length;
    };

    it('attacks about 9 times in 10 when neither side leads', () => {
      // Totals: Computer 3, Human 3, player 2 leads with 4 (exactly 40%, so not Dominant).
      const game = asComputer(line({ owner: 1, dice: 3 }, { owner: 0, dice: 3 }, { owner: 2, dice: 4 }), 3);
      const rate = attackRate(game);
      expect(rate).toBeGreaterThan(0.85);
      expect(rate).toBeLessThan(0.95);
    });

    it('always attacks when the Computer leads', () => {
      const game = asComputer(
        line({ owner: 1, dice: 3 }, { owner: 0, dice: 3 }, { owner: 2, dice: 3 }, { owner: 1, dice: 1 }),
        3,
      );
      expect(attackRate(game)).toBe(1);
    });

    it('always attacks when the Defender\'s owner leads', () => {
      const game = asComputer(
        line({ owner: 1, dice: 3 }, { owner: 0, dice: 3 }, { owner: 0, dice: 1 }, { owner: 2, dice: 3 }),
        3,
      );
      expect(attackRate(game)).toBe(1);
    });
  });

  describe('when a Dominant Player exists', () => {
    // Territory 0 (Computer) touches 1 (Human) and 2 (player 2). Player 2 also owns 3.
    const map = (dice: { t0: number; t2: number; t3: number }, owner3 = 2): TerritorySpec[] => [
      { owner: 1, dice: dice.t0, adjacent: [1, 2] },
      { owner: 0, dice: 1, adjacent: [0] },
      { owner: 2, dice: dice.t2, adjacent: [0, 3] },
      { owner: owner3, dice: dice.t3, adjacent: [2] },
    ];

    it('only attacks the Dominant Player', () => {
      const game = asComputer(map({ t0: 4, t2: 3, t3: 8 }), 3); // player 2: 11 of 16 Dice
      expect(new Set(movesOver(game).map((m) => JSON.stringify(m)))).toEqual(
        new Set([JSON.stringify({ type: 'attack', from: 0, to: 2 })]),
      );
    });

    it('ends its turn rather than attack someone else', () => {
      const game = asComputer(map({ t0: 4, t2: 5, t3: 8 }), 3);
      expect(movesOver(game).every((m) => m.type === 'endTurn')).toBe(true);
    });

    it('attacks anyone when it is the Dominant Player itself', () => {
      const game = asComputer(map({ t0: 8, t2: 3, t3: 1 }, 1), 3); // Computer: 9 of 13 Dice
      const targets = new Set(movesOver(game).flatMap((m) => (m.type === 'attack' ? [m.to] : [])));
      expect(targets).toEqual(new Set([1, 2]));
    });
  });

  it('only chooses legal Attacks in generated games', () => {
    for (let gameCode = 1; gameCode <= 30; gameCode++) {
      const game = newGame({ playerCount: 6, humanColor: 0, gameCode });
      const turnIndex = game.turnOrder.findIndex((p) => p !== 0);
      const { move } = computerMove({ ...game, turnIndex });
      if (move.type === 'attack') expect(attackRefusal({ ...game, turnIndex }, move.from, move.to)).toBeUndefined();
    }
  });

  it('chooses the same move from the same game', () => {
    const game = asComputer(line({ owner: 1, dice: 5 }, { owner: 0, dice: 2 }, { owner: 0, dice: 1 }));
    expect(computerMove(game)).toEqual(computerMove(game));
  });
});
