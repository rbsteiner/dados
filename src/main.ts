import { attack, attackRefusal, currentPlayer, type AttackResult } from './game/attack';
import { computerMove } from './game/computer';
import { endTurn, largestGroup } from './game/endTurn';
import { newGame } from './game/newGame';
import { gameOutcome } from './game/outcome';
import { MAX_PLAYERS, MIN_PLAYERS, type GameState, type TerritoryId } from './game/types';
import { HexLayout } from './ui/geometry';
import { PALETTE, colorOf, textOn } from './ui/palette';
import { render, type View } from './ui/render';
import { STRINGS } from './ui/strings';

const COMPUTER_ATTACK_DELAY_MS = 600;
const DEFAULT_PLAYER_COUNT = 7;

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const ui = {
  title: element('title'),
  startScreen: element('start-screen'),
  startForm: element<HTMLFormElement>('start-form'),
  playersLabel: element('players-label'),
  playerCount: element('player-count'),
  colorLabel: element('color-label'),
  colorChoice: element('color-choice'),
  playButton: element<HTMLButtonElement>('play-button'),
  gameScreen: element('game-screen'),
  playerBar: element('player-bar'),
  status: element('status'),
  board: element('board'),
  canvas: element<HTMLCanvasElement>('map'),
  diceBar: element('dice-bar'),
  endTurn: element<HTMLButtonElement>('end-turn'),
  endDialog: element<HTMLDialogElement>('end-dialog'),
  endMessage: element('end-message'),
  newGame: element<HTMLButtonElement>('new-game'),
  credit: element<HTMLAnchorElement>('credit'),
};

let game: GameState | undefined;
let layout: HexLayout | undefined;
let view: View = {};
/** Bumped on every new game so a running Computer turn loop from the previous game stops. */
let session = 0;

// ---------- Start screen ----------

function buildStartScreen(): void {
  document.title = STRINGS.title;
  ui.title.textContent = STRINGS.title;
  ui.playersLabel.textContent = STRINGS.players;
  ui.colorLabel.textContent = STRINGS.yourColor;
  ui.playButton.textContent = STRINGS.play;
  ui.endTurn.textContent = STRINGS.endTurn;
  ui.newGame.textContent = STRINGS.newGame;
  ui.credit.textContent = STRINGS.credit;
  ui.credit.href = STRINGS.creditUrl;

  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    ui.playerCount.append(choice('players', String(n), n === DEFAULT_PLAYER_COUNT, (span) => (span.textContent = String(n))));
  }
  PALETTE.forEach((color, id) => {
    ui.colorChoice.append(
      choice('color', String(id), id === 0, (span) => {
        span.classList.add('swatch');
        span.style.background = color.fill;
        span.title = color.name;
        span.setAttribute('aria-label', color.name);
      }),
    );
  });
}

function choice(name: string, value: string, checked: boolean, decorate: (span: HTMLSpanElement) => void): HTMLLabelElement {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = name;
  input.value = value;
  input.checked = checked;
  const span = document.createElement('span');
  decorate(span);
  label.append(input, span);
  return label;
}

ui.startForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(ui.startForm);
  startGame(Number(data.get('players')), Number(data.get('color')));
});

// However the end dialog closes (button, Escape…), go back to the start screen.
ui.endDialog.addEventListener('close', backToStart);
ui.newGame.addEventListener('click', () => ui.endDialog.close());

function backToStart(): void {
  ui.gameScreen.hidden = true;
  ui.startScreen.hidden = false;
  game = undefined;
  session++;
}

// ---------- Game flow ----------

function randomGameCode(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

function startGame(playerCount: number, humanColor: number, gameCode = randomGameCode()): void {
  session++;
  game = newGame({ playerCount, humanColor, gameCode });
  view = {};
  ui.diceBar.replaceChildren();
  ui.startScreen.hidden = true;
  ui.gameScreen.hidden = false;
  resize();
  void continueTurns();
}

/** Plays Computer turns until it is the Human's turn or the game is over. */
async function continueTurns(): Promise<void> {
  const mySession = session;
  while (game && mySession === session) {
    refresh();
    if (gameOutcome(game) !== 'playing') return showEnd();
    if (game.players[currentPlayer(game)]!.kind === 'human') return;

    const { move, state } = computerMove(game);
    if (move.type === 'attack') {
      const { state: next, result } = attack(state, move.from, move.to);
      showRolls(state, result);
      game = next;
      view = { lastAttack: result };
      refresh();
      await delay(COMPUTER_ATTACK_DELAY_MS);
    } else {
      game = endTurn(state).state;
      view = {};
    }
  }
}

function onBoardClick(event: MouseEvent): void {
  if (!game || !layout || gameOutcome(game) !== 'playing') return;
  if (game.players[currentPlayer(game)]!.kind !== 'human') return;

  const rect = ui.canvas.getBoundingClientRect();
  const scale = ui.canvas.width / rect.width;
  const cell = layout.cellAt({ x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale });
  const clicked = cell === undefined ? undefined : game.map.cells[cell];
  if (clicked === undefined || clicked < 0) return;
  selectOrAttack(clicked);
}

function selectOrAttack(clicked: TerritoryId): void {
  if (!game) return;
  const territory = game.territories[clicked]!;
  const human = currentPlayer(game);

  if (view.selected === clicked) {
    view = {};
  } else if (territory.owner === human) {
    view = territory.dice >= 2 ? { selected: clicked } : {};
  } else if (view.selected !== undefined && attackRefusal(game, view.selected, clicked) === undefined) {
    const { state, result } = attack(game, view.selected, clicked);
    showRolls(game, result);
    game = state;
    view = { lastAttack: result };
    if (gameOutcome(game) !== 'playing') {
      refresh();
      return showEnd();
    }
  }
  refresh();
}

ui.canvas.addEventListener('click', onBoardClick);

ui.endTurn.addEventListener('click', () => {
  if (!game || game.players[currentPlayer(game)]!.kind !== 'human') return;
  game = endTurn(game).state;
  view = {};
  void continueTurns();
});

function showEnd(): void {
  if (!game) return;
  ui.endMessage.textContent = gameOutcome(game) === 'won' ? STRINGS.won : STRINGS.lost;
  if (!ui.endDialog.open) ui.endDialog.showModal();
}

// ---------- Drawing ----------

function refresh(): void {
  if (!game || !layout) return;
  const ctx = ui.canvas.getContext('2d');
  if (ctx) render(ctx, game, layout, view);
  renderPlayerBar(game);
  const humanTurn = game.players[currentPlayer(game)]!.kind === 'human';
  ui.endTurn.disabled = !humanTurn || gameOutcome(game) !== 'playing';
  ui.status.textContent = humanTurn ? STRINGS.yourTurn : STRINGS.computerTurn(playerName(game, currentPlayer(game)));
}

function playerName(state: GameState, player: number): string {
  const p = state.players[player]!;
  return p.kind === 'human' ? STRINGS.you : STRINGS.computer(PALETTE[p.color]?.name ?? '');
}

function renderPlayerBar(state: GameState): void {
  const items = state.turnOrder.map((id, index) => {
    const li = document.createElement('li');
    const owns = state.territories.some((t) => t.owner === id);
    if (index === state.turnIndex) li.classList.add('current');
    if (!owns) li.classList.add('eliminated');

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = colorOf(state.players[id]!.color);

    const name = document.createElement('span');
    name.textContent = playerName(state, id);

    const group = document.createElement('strong');
    group.textContent = String(largestGroup(state, id));
    group.title = STRINGS.groupTitle;

    li.append(dot, name, group);
    const stock = state.players[id]!.stock;
    if (stock > 0) {
      const s = document.createElement('span');
      s.className = 'stock';
      s.textContent = `+${stock}`;
      s.title = STRINGS.stockTitle;
      li.append(s);
    }
    return li;
  });
  ui.playerBar.replaceChildren(...items);
}

/** Shows both sides' dice, coloured by their owners before the Attack. */
function showRolls(before: GameState, result: AttackResult): void {
  const ownerColor = (t: TerritoryId) => colorOf(before.players[before.territories[t]!.owner]!.color);
  const attackerColor = ownerColor(result.from);
  const defenderColor = ownerColor(result.to);

  const side = (values: readonly number[], color: string, won: boolean) => {
    const el = document.createElement('div');
    el.className = 'side';
    for (const v of values) {
      const die = document.createElement('span');
      die.className = 'die';
      die.style.background = color;
      die.style.color = textOn(color);
      die.textContent = String(v);
      el.append(die);
    }
    const total = document.createElement('span');
    total.className = won ? 'total won' : 'total';
    total.textContent = String(values.reduce((a, b) => a + b, 0));
    el.append(total);
    return el;
  };

  const vs = document.createElement('span');
  vs.textContent = 'vs';
  ui.diceBar.replaceChildren(
    side(result.attacker, attackerColor, result.captured),
    vs,
    side(result.defender, defenderColor, !result.captured),
  );
}

function resize(): void {
  if (!game) return;
  const rect = ui.board.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  ui.canvas.width = Math.round(rect.width * ratio);
  ui.canvas.height = Math.round(rect.height * ratio);
  layout = new HexLayout(game.map, ui.canvas.width, ui.canvas.height, 12 * ratio);
  refresh();
}

new ResizeObserver(resize).observe(ui.board);

function watchPixelRatio(): void {
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
    'change',
    () => {
      resize();
      watchPixelRatio();
    },
    { once: true },
  );
}
watchPixelRatio();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

buildStartScreen();

// Dev-only hooks for the screenshot tool; stripped from production builds.
if (import.meta.env.DEV) {
  Object.assign(window, {
    __dados: {
      start: startGame,
      state: () => game,
      /** Page coordinates of a Territory's dice anchor. */
      territoryPoint(id: TerritoryId) {
        if (!game || !layout) return undefined;
        const p = layout.anchor(game.territories[id]!);
        const rect = ui.canvas.getBoundingClientRect();
        const scale = rect.width / ui.canvas.width;
        return { x: rect.left + p.x * scale, y: rect.top + p.y * scale };
      },
    },
  });
}
