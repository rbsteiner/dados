import { attack, attackRefusal, currentPlayer } from './game/attack';
import { computerMove } from './game/computer';
import { endTurn, largestGroup } from './game/endTurn';
import { newGame } from './game/newGame';
import { gameOutcome } from './game/outcome';
import { MAX_PLAYERS, MIN_PLAYERS, type GameState, type TerritoryId } from './game/types';
import { DiceBar } from './ui/diceBar';
import { HexLayout } from './ui/geometry';
import { PALETTE, colorOf } from './ui/palette';
import { render, type View } from './ui/render';
import { STRINGS } from './ui/strings';

interface BattleTiming {
  /** The attacking stack jolts toward its target. */
  readonly clashMs: number;
  /** Dice tumble in the bar. */
  readonly rollMs: number;
  /** Dice stop one by one. */
  readonly revealMs: number;
  /** Capture flash and bounce, or the failed attacker's shake. */
  readonly resultMs: number;
}

const HUMAN_BATTLE: BattleTiming = { clashMs: 200, rollMs: 600, revealMs: 400, resultMs: 400 };
const COMPUTER_BATTLE: BattleTiming = { clashMs: 0, rollMs: 300, revealMs: 0, resultMs: 300 };
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
  creditBefore: element<HTMLSpanElement>('credit-before'),
  credit: element<HTMLAnchorElement>('credit'),
  creditAfter: element<HTMLSpanElement>('credit-after'),
};

let game: GameState | undefined;
let layout: HexLayout | undefined;
let view: View = {};
/** True while a battle is being shown; the Human can't act meanwhile. */
let animating = false;
const diceBar = new DiceBar(ui.diceBar);
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
  ui.creditBefore.textContent = STRINGS.creditBefore;
  ui.credit.textContent = STRINGS.creditLink;
  ui.creditAfter.textContent = STRINGS.creditAfter;
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
  animating = false;
  diceBar.clear();
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
      game = state;
      await battle(move.from, move.to, COMPUTER_BATTLE);
    } else {
      game = endTurn(state).state;
      view = {};
    }
  }
}

/**
 * Resolves an Attack on the current game and shows it: clash, tumbling dice, reveal, then the
 * capture (flash and bounce) or the failure (shake). The game only changes once the dice are shown.
 */
async function battle(from: TerritoryId, to: TerritoryId, timing: BattleTiming): Promise<void> {
  if (!game || !layout) return;
  const mySession = session;
  const alive = () => mySession === session;
  const before = game;
  const { state: after, result } = attack(before, from, to);
  const fight = { from, to };
  const ownerColor = (t: TerritoryId) => colorOf(before.players[before.territories[t]!.owner]!.color);

  animating = true;
  try {
    const a = layout.anchor(before.territories[from]!);
    const b = layout.anchor(before.territories[to]!);
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const toward = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };

    await animate(timing.clashMs, alive, (t) => {
      const push = Math.sin(Math.PI * t) * 0.6;
      view = { fight, shift: new Map([[from, { x: toward.x * push, y: toward.y * push }]]) };
    });
    if (!alive()) return;
    view = { fight };
    refresh();

    await diceBar.roll(
      { color: ownerColor(from), values: result.attacker },
      { color: ownerColor(to), values: result.defender },
      { rollMs: timing.rollMs, revealMs: timing.revealMs },
      alive,
    );
    if (!alive()) return;

    game = after;
    diceBar.showWinner(result.captured);
    await animate(timing.resultMs, alive, (t) =>
      (view = result.captured
        ? { fight, flash: { territory: to, amount: 1 - t }, shift: new Map([[to, { x: 0, y: bounce(t) }]]) }
        : { fight, shift: new Map([[from, { x: shake(t), y: 0 }]]) }),
    );
    if (!alive()) return;
    view = {};
    refresh();
  } finally {
    if (alive()) {
      animating = false;
      refresh();
    }
  }
}

/** Runs `frame` on every animation frame for `ms`, redrawing the map each time. */
function animate(ms: number, alive: () => boolean, frame: (t: number) => void): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      if (!alive()) return resolve();
      const t = Math.min(1, (now - start) / ms);
      frame(t);
      refresh();
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** Vertical offset of the conquering stack dropping in: from 1.5 cells above, bouncing once. */
function bounce(t: number): number {
  const fall = t < 0.6 ? t / 0.6 : 1;
  const hop = t < 0.6 ? 0 : Math.sin(((t - 0.6) / 0.4) * Math.PI) * 0.35;
  return -1.5 * (1 - fall * fall) - hop;
}

/** Horizontal offset of a failed attacker shaking, fading out. */
function shake(t: number): number {
  return Math.sin(t * Math.PI * 8) * 0.35 * (1 - t);
}

function onBoardClick(event: MouseEvent): void {
  if (animating || !game || !layout || gameOutcome(game) !== 'playing') return;
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
    void humanAttack(view.selected, clicked);
    return;
  }
  refresh();
}

async function humanAttack(from: TerritoryId, to: TerritoryId): Promise<void> {
  await battle(from, to, HUMAN_BATTLE);
  if (game && gameOutcome(game) !== 'playing') showEnd();
}

ui.canvas.addEventListener('click', onBoardClick);

ui.endTurn.addEventListener('click', () => {
  if (animating || !game || game.players[currentPlayer(game)]!.kind !== 'human') return;
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
  ui.endTurn.disabled = animating || !humanTurn || gameOutcome(game) !== 'playing';
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
