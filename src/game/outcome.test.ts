import { describe, expect, it } from 'vitest';
import { gameOutcome } from './outcome';
import { line, makeGame } from './testing';

describe('gameOutcome', () => {
  it('is still playing while the Human and a Computer both own Territories', () => {
    const game = makeGame(line({ owner: 0, dice: 1 }, { owner: 1, dice: 1 }));
    expect(gameOutcome(game)).toBe('playing');
  });

  it('is won when the Human owns every Territory', () => {
    const game = makeGame(line({ owner: 0, dice: 1 }, { owner: 0, dice: 1 }));
    expect(gameOutcome(game)).toBe('won');
  });

  it('is lost as soon as the Human is Eliminated, even if Computers are still fighting', () => {
    const game = makeGame(line({ owner: 1, dice: 1 }, { owner: 2, dice: 1 }), { playerCount: 3 });
    expect(gameOutcome(game)).toBe('lost');
  });
});
