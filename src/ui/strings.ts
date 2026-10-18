/** Every piece of on-screen text, kept in one place so other languages can be added. */
export const STRINGS = {
  title: 'Proyecto Dados Clonados Belicosos',
  /** Footer credit: before + linked game name + after. */
  creditBefore: 'A fan-made clone of ',
  creditLink: 'Dice Wars',
  creditAfter: ' by GAMEDESIGN, with a few extras I missed. Not affiliated with GAMEDESIGN.',
  creditUrl: 'https://www.gamedesign.jp/games/dicewars/',
  players: 'Players',
  yourColor: 'Your color',
  play: 'Play',
  endTurn: 'End turn',
  yourTurn: 'Your turn: pick one of your territories with 2+ dice, then an adjacent enemy.',
  computerTurn: (name: string) => `${name} is playing…`,
  you: 'You',
  computer: (name: string) => `${name}`,
  won: 'Victory! You conquered every territory.',
  lost: 'Defeat. You have no territories left.',
  newGame: 'New game',
  stockTitle: 'Stock',
  groupTitle: 'Largest group',
} as const;
