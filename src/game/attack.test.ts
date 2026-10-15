import { describe, expect, it } from 'vitest';
import { attack, attackRefusal } from './attack';
import { line, makeGame } from './testing';

describe('attack', () => {
  it('Captures the Defender when the Attacker rolls a greater total', () => {
    const game = makeGame(line({ owner: 0, dice: 4 }, { owner: 1, dice: 2 }));

    const { state, result } = attack(game, 0, 1, { attacker: [6, 6, 6, 6], defender: [1, 1] });

    expect(result.captured).toBe(true);
    expect(state.territories[0]).toMatchObject({ owner: 0, dice: 1 });
    expect(state.territories[1]).toMatchObject({ owner: 0, dice: 3 });
  });

  it('leaves the Attacker with 1 Die and the Defender unchanged when the Attack fails', () => {
    const game = makeGame(line({ owner: 0, dice: 4 }, { owner: 1, dice: 2 }));

    const { state, result } = attack(game, 0, 1, { attacker: [1, 1, 1, 1], defender: [6, 6] });

    expect(result.captured).toBe(false);
    expect(state.territories[0]).toMatchObject({ owner: 0, dice: 1 });
    expect(state.territories[1]).toMatchObject({ owner: 1, dice: 2 });
  });

  it('gives a tie to the Defender', () => {
    const game = makeGame(line({ owner: 0, dice: 3 }, { owner: 1, dice: 2 }));

    const { state, result } = attack(game, 0, 1, { attacker: [2, 2, 2], defender: [3, 3] });

    expect(result.captured).toBe(false);
    expect(state.territories[1]).toMatchObject({ owner: 1, dice: 2 });
  });

  it('does not modify the game it was given', () => {
    const game = makeGame(line({ owner: 0, dice: 4 }, { owner: 1, dice: 2 }));
    const before = structuredClone(game);

    attack(game, 0, 1, { attacker: [6, 6, 6, 6], defender: [1, 1] });

    expect(game).toEqual(before);
  });

  describe('without given rolls', () => {
    const game = makeGame(line({ owner: 0, dice: 4 }, { owner: 1, dice: 4 }));

    it('rolls one die per Die on each side, each from 1 to 6', () => {
      const { result } = attack(game, 0, 1);
      expect(result.attacker).toHaveLength(4);
      expect(result.defender).toHaveLength(4);
      for (const v of [...result.attacker, ...result.defender]) {
        expect(Number.isInteger(v) && v >= 1 && v <= 6).toBe(true);
      }
    });

    it('rolls the same dice from the same game, and moves the random state on', () => {
      expect(attack(game, 0, 1).result).toEqual(attack(game, 0, 1).result);
      expect(attack(game, 0, 1).state.rng).not.toBe(game.rng);
    });

    it('produces both outcomes and every die face across games', () => {
      const results = Array.from({ length: 200 }, (_, rng) => attack({ ...game, rng }, 0, 1).result);
      expect(new Set(results.map((r) => r.captured))).toEqual(new Set([true, false]));
      expect(new Set(results.flatMap((r) => r.attacker))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    });
  });

  describe('refuses', () => {
    // 0 (Human, 1 Die) – 1 (Human, 3) – 2 (Computer, 2) – 3 (Computer, 5); 4 (Computer, 2) touches only 3.
    const game = makeGame([
      { owner: 0, dice: 1, adjacent: [1, 4] },
      { owner: 0, dice: 3, adjacent: [0, 2] },
      { owner: 1, dice: 2, adjacent: [1, 3] },
      { owner: 1, dice: 5, adjacent: [2] },
      { owner: 1, dice: 2, adjacent: [0] },
    ]);
    const rolls = { attacker: [6, 6, 6], defender: [1, 1] };

    it.each([
      ['an Attacker with 1 Die', 0, 4, /2 dice/],
      ['attacking an own Territory', 1, 0, /own territory/],
      ['a Defender that is not Adjacent', 1, 3, /not adjacent/],
      ['a Territory of a Player whose turn it is not', 3, 2, /not your territory/],
      ['an unknown Attacker', 9, 2, /unknown/],
      ['an unknown Defender', 1, 9, /unknown/],
    ])('%s', (_, from, to, reason) => {
      expect(attackRefusal(game, from, to)).toMatch(reason);
      expect(() => attack(game, from, to, rolls)).toThrow(/illegal attack/i);
    });

    it.each([
      ['too few attacker rolls', { attacker: [6, 6], defender: [1, 1] }],
      ['too many defender rolls', { attacker: [6, 6, 6], defender: [1, 1, 1] }],
      ['a value above 6', { attacker: [6, 6, 7], defender: [1, 1] }],
      ['a value below 1', { attacker: [6, 6, 6], defender: [0, 1] }],
      ['a non-integer value', { attacker: [6, 6, 2.5], defender: [1, 1] }],
    ])('rolls with %s', (_, bad) => {
      expect(() => attack(game, 1, 2, bad)).toThrow(RangeError);
    });
  });
});
