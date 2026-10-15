import { createRng } from './rng';
import type { GameState, Territory, TerritoryId } from './types';

export interface Rolls {
  readonly attacker: readonly number[];
  readonly defender: readonly number[];
}

export interface AttackResult extends Rolls {
  readonly from: TerritoryId;
  readonly to: TerritoryId;
  readonly captured: boolean;
}

export class IllegalAttackError extends Error {
  constructor(reason: string) {
    super(`Illegal attack: ${reason}`);
    this.name = 'IllegalAttackError';
  }
}

export function currentPlayer(state: GameState): number {
  return state.turnOrder[state.turnIndex]!;
}

/** Why an Attack from `from` to `to` is not allowed, or undefined when it is. */
export function attackRefusal(state: GameState, from: TerritoryId, to: TerritoryId): string | undefined {
  const attacker = state.territories[from];
  const defender = state.territories[to];
  if (!attacker || !defender) return 'unknown territory';
  if (attacker.owner !== currentPlayer(state)) return 'not your territory';
  if (attacker.dice < 2) return 'the attacker needs at least 2 dice';
  if (defender.owner === attacker.owner) return 'cannot attack your own territory';
  if (!attacker.adjacent.includes(to)) return 'territories are not adjacent';
  return undefined;
}

export function attack(
  state: GameState,
  from: TerritoryId,
  to: TerritoryId,
  /** Forced rolls (tests, replays). When omitted, Dice are rolled from the game's random state. */
  forcedRolls?: Rolls,
): { state: GameState; result: AttackResult } {
  const refusal = attackRefusal(state, from, to);
  if (refusal) throw new IllegalAttackError(refusal);
  const attacker = state.territories[from]!;
  const defender = state.territories[to]!;
  const rng = createRng(state.rng);
  const rolls = forcedRolls ?? {
    attacker: rollDice(attacker.dice, rng.int.bind(rng)),
    defender: rollDice(defender.dice, rng.int.bind(rng)),
  };
  checkRolls(rolls.attacker, attacker.dice, 'attacker');
  checkRolls(rolls.defender, defender.dice, 'defender');

  const captured = sum(rolls.attacker) > sum(rolls.defender);
  const territories = state.territories.map((t): Territory => {
    if (t.id === from) return { ...t, dice: 1 };
    if (t.id === to && captured) return { ...t, owner: attacker.owner, dice: attacker.dice - 1 };
    return t;
  });

  return {
    state: { ...state, territories, rng: rng.state },
    result: { from, to, captured, attacker: [...rolls.attacker], defender: [...rolls.defender] },
  };
}

function rollDice(count: number, int: (n: number) => number): number[] {
  return Array.from({ length: count }, () => 1 + int(6));
}

function checkRolls(values: readonly number[], dice: number, side: string): void {
  if (values.length !== dice) throw new RangeError(`${side} must roll exactly ${dice} dice`);
  if (!values.every((v) => Number.isInteger(v) && v >= 1 && v <= 6)) {
    throw new RangeError(`${side} rolls must be integers from 1 to 6`);
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
