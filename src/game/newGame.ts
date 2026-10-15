import { generateMap } from './map';
import { createRng, type Rng } from './rng';
import {
  MAX_DICE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type ColorId,
  type GameState,
  type Player,
  type PlayerId,
  type Territory,
} from './types';

export interface NewGameOptions {
  readonly playerCount: number;
  readonly humanColor: ColorId;
  /** Unsigned 32-bit integer. */
  readonly gameCode: number;
}

/** Average starting Dice per Territory. */
const STARTING_DICE_PER_TERRITORY = 3;

export function newGame(options: NewGameOptions): GameState {
  validate(options);
  const rng = createRng(options.gameCode);
  const players = createPlayers(options.playerCount, options.humanColor);
  const { map, territoryCells, adjacency } = generateMap(rng);

  const owners = dealTerritories(territoryCells.length, players.length, rng);
  const dice = dealStartingDice(owners, players.length, rng);
  const territories: Territory[] = territoryCells.map((cells, id) => ({
    id,
    owner: owners[id]!,
    dice: dice[id]!,
    cells,
    adjacent: adjacency[id] ?? [],
  }));

  return {
    gameCode: options.gameCode,
    map,
    territories,
    players,
    turnOrder: shuffle(players.map((p) => p.id), rng),
    turnIndex: 0,
    rng: rng.state,
  };
}

function validate({ playerCount, humanColor, gameCode }: NewGameOptions): void {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new RangeError(`playerCount must be an integer from ${MIN_PLAYERS} to ${MAX_PLAYERS}`);
  }
  if (!Number.isInteger(humanColor) || humanColor < 0 || humanColor >= MAX_PLAYERS) {
    throw new RangeError(`humanColor must be an integer from 0 to ${MAX_PLAYERS - 1}`);
  }
  if (!Number.isInteger(gameCode) || gameCode < 0 || gameCode > 0xffffffff) {
    throw new RangeError('gameCode must be an unsigned 32-bit integer');
  }
}

function createPlayers(count: number, humanColor: ColorId): Player[] {
  const computerColors: ColorId[] = [];
  for (let c = 0; c < MAX_PLAYERS; c++) if (c !== humanColor) computerColors.push(c);
  const colors = [humanColor, ...computerColors].slice(0, count);
  return colors.map((color, id) => ({
    id,
    color,
    kind: id === 0 ? 'human' : 'computer',
    stock: 0,
  }));
}

/** Territories go to Players in turn, in random order, so counts differ by at most 1. */
function dealTerritories(territoryCount: number, playerCount: number, rng: Rng): PlayerId[] {
  const order = shuffle(Array.from({ length: territoryCount }, (_, i) => i), rng);
  const owners = new Array<PlayerId>(territoryCount);
  order.forEach((territory, i) => (owners[territory] = i % playerCount));
  return owners;
}

/** Every Territory gets 1 Die, then each Player's extra Dice land randomly until all Players have the same total. */
function dealStartingDice(owners: readonly PlayerId[], playerCount: number, rng: Rng): number[] {
  const dice = owners.map(() => 1);
  const total = Math.floor((STARTING_DICE_PER_TERRITORY * owners.length) / playerCount);
  for (let player = 0; player < playerCount; player++) {
    const own = owners.flatMap((o, t) => (o === player ? [t] : []));
    for (let placed = own.length; placed < total; placed++) {
      const open = own.filter((t) => dice[t]! < MAX_DICE);
      const t = open[rng.int(open.length)]!;
      dice[t]!++;
    }
  }
  return dice;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
