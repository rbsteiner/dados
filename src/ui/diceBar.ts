import { textOn } from './palette';

export interface Side {
  readonly color: string;
  readonly values: readonly number[];
}

export interface RollTiming {
  /** How long every die tumbles before the first one stops. */
  readonly rollMs: number;
  /** Time over which the dice stop one by one (0 stops them all at once). */
  readonly revealMs: number;
}

const FACE_CHANGE_MS = 70;

/** The bar under the map where both sides' dice are rolled. */
export class DiceBar {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly root: HTMLElement) {}

  clear(): void {
    this.stopTumbling();
    this.root.replaceChildren();
  }

  /** Shows the dice tumbling, then stops them on their real values. Resolves once all are shown. */
  async roll(attacker: Side, defender: Side, timing: RollTiming, alive: () => boolean): Promise<void> {
    this.stopTumbling();
    const a = this.side(attacker);
    const d = this.side(defender);
    const vs = document.createElement('span');
    vs.className = 'vs';
    vs.textContent = 'vs';
    this.root.replaceChildren(a.el, vs, d.el);

    const dice = [...a.dice, ...d.dice];
    const values = [...attacker.values, ...defender.values];
    this.timer = setInterval(() => {
      for (const die of dice) if (die.classList.contains('rolling')) die.textContent = String(1 + Math.floor(Math.random() * 6));
    }, FACE_CHANGE_MS);

    await wait(timing.rollMs);
    const step = timing.revealMs / dice.length;
    for (let i = 0; i < dice.length; i++) {
      if (!alive()) return this.stopTumbling();
      const die = dice[i]!;
      die.classList.remove('rolling');
      die.classList.add('landed');
      die.textContent = String(values[i]);
      if (step > 0) await wait(step);
    }
    this.stopTumbling();
    a.total.textContent = String(sum(attacker.values));
    d.total.textContent = String(sum(defender.values));
  }

  /** Marks the winning side once the result is known. */
  showWinner(attackerWon: boolean): void {
    const sides = this.root.querySelectorAll('.side');
    sides[attackerWon ? 0 : 1]?.classList.add('won');
  }

  private side(side: Side) {
    const el = document.createElement('div');
    el.className = 'side';
    const dice = side.values.map(() => {
      const die = document.createElement('span');
      die.className = 'die rolling';
      die.style.background = side.color;
      die.style.color = textOn(side.color);
      die.textContent = String(1 + Math.floor(Math.random() * 6));
      el.append(die);
      return die;
    });
    const total = document.createElement('span');
    total.className = 'total';
    el.append(total);
    return { el, dice, total };
  }

  private stopTumbling(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
