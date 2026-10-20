# Handoff — Proyecto Dados Clonados Belicosos

Last updated: 2026-10-20. Read this first, then [CONTEXT.md](../CONTEXT.md) (the domain glossary; use its terms in code, tests and conversation).

## What this is

A browser clone of the rules of Dice Wars (GAMEDESIGN), written from scratch: one Human against 1–7 Computers on a random hex map. No code or artwork from the original is used, and none should be. The original's rules and the behaviour of its Computer are reimplemented; everything visual is our own design.

- Live: https://rbsteiner.github.io/dados/
- Repo: https://github.com/rbsteiner/dados (public, MIT, `main` deploys automatically)

## Status

| Iteration | Scope | State |
|---|---|---|
| 1 | Playable on desktop: rules, Normal Computer, colour + player-count choice, end screen, Pages deploy | Done |
| Visual pass | Bolder map, battle animation, grounded dice with pips and cast shadows, compact territories grown from a 7-cell core | Done, live (commit `01eba1e`) |
| 2 | iPhone: touch, map rotated 90° in portrait, Add to Home Screen (PWA), offline | **Next** |
| 3 | Comfort: speed setting, autosave, Game Code shown + "Replay this map", sounds (muted by default), end stats | Planned |
| 4 | Easy Computer | Planned |
| 5 | Hard Computer (modern non-LLM approaches, to explore) | Planned |

Tweaks before iteration 2: the credit wording (done) and the difficulty (Starting Dice now match the original; the owner is play-testing). **Ask whether more tweaks are wanted before starting iteration 2.**

## How the owner wants to work

These are standing rules, not suggestions:

1. **Ask instead of filling gaps.** When something wasn't decided, put it to the owner as a numbered question with a recommended answer (they usually reply "ok to all"). Small reversible technical choices can be made and then reported.
2. **TDD** for game logic: failing test first, then the code. Tests live at the agreed seams (below). UI and animation are checked with screenshots, not unit tests.
3. **A subagent code review before every push**, security included. Fix blocking findings, then push.
4. **Security always in mind**, even though it's a static site.
5. **Agile:** one playable increment at a time; one commit per finished step.
6. Ask before outward-facing actions (new repos, closing PRs, etc.).
7. The owner writes in English (not their first language) and likes clear explanations of *why*.

## Running it

Everything runs in Docker (Colima). Nothing but Docker is installed on the host — never run `npm`/`npx` on the host.

```sh
colima start
docker compose up -d                                   # dev server, http://localhost:5173/dados/ (this Mac only)
DEV_HOST=0.0.0.0 docker compose up -d                  # also reachable from a phone on trusted Wi-Fi
docker compose exec app npm test                       # tests (use exec, not run, while `up` is running)
docker compose exec app npm run lint
docker compose exec app npm run typecheck
docker compose exec app npm run build
docker compose exec app npm run simulate               # balance check: 1000 Computer-only games per player count (~1 min)
docker compose --profile tools run --rm screenshot     # screenshots into ./screenshots (git-ignored)
```

## Code map

```
src/game/          Pure game logic, no DOM. Every function takes a GameState and returns a new one.
  types.ts         GameState, Territory, Player, constants (MAX_DICE 8, STOCK_CAP 64, MAX_TERRITORIES 31)
  rng.ts           Seeded generator (mulberry32); its state lives in GameState.rng
  map.ts           Map generation: 7-cell cores, compact growth, small-lake filling, adjacency
  newGame.ts       Players, map, territory dealing, equal starting dice, turn order, option validation
  attack.ts        attackRefusal() / attack(); optional forced rolls for tests
  endTurn.ts       Reinforcement = Largest Group + Stock (pool capped at 64), next non-eliminated player
  computer.ts      Normal Computer: computerMove(state) -> attack or endTurn
  outcome.ts       'playing' | 'won' | 'lost' (lost as soon as the Human is eliminated)
  testing.ts       makeGame()/line() helpers for hand-built test positions
  *.test.ts        Vitest; fullGame.test.ts plays whole games checking invariants after every move
  balance.sim.ts   On-demand balance simulation (npm run simulate): wins by seat and by Turn Order position
src/ui/            Display only
  geometry.ts      HexLayout: cell <-> pixel, dice anchor (most interior cell), headroom above map
  render.ts        Canvas drawing: territories, borders, fight outline, dice piles, shadows, pips
  diceBar.ts       Tumbling dice under the map
  palette.ts       8 colours (Okabe-Ito based, grey instead of black, true red), text contrast
  strings.ts       All on-screen text (English; French can be added here)
src/main.ts        Controller: screens, clicks, battle sequence, Computer turn loop, dev-only window.__dados hook
tools/             Dev-only Playwright screenshot tool (own Docker image, never part of the site)
```

**Agreed test seams:** `newGame`, `attack`, `endTurn`, `computerMove` (plus `gameOutcome`). Don't test internals.

## Decisions already made (don't reopen without the owner)

- **Rules:** identical to the original. Max 8 dice per territory. The attacker needs ≥2 dice and an adjacent enemy territory; ties go to the defender. A capture moves all dice but one. Reinforcement equals the Largest Group, and Stock is capped at 64. Turn order is random and not compensated, like the original.
- **Starting Dice (changed 2026-10-20, checked against the original's public game script):** 1 die per territory, then 2 extra dice per territory dealt one at a time in rotation, the Human first. Territories are also dealt in rotation, Human first. We used to give every player the same dice total, which made whoever got an extra territory weaker (thinner dice); the Human always got it, so their seat won ~10% instead of ~14% at 7 players. The owner, who wins 9/10 in the original, had won 1/15 in ours. After the change (`npm run simulate`, 1000 games), the Human's seat wins 11.9% at 7 players and 28.9% at 3 (fair: 14.3% and 33.3%). That is still a bit low, but other seats spread as widely, and the original deals the same way. In 2000-game runs with a smarter bot in the Human's seat, it won 26% instead of 19%, and was knocked out within 3 turns 9% of the time instead of 13%.
- **Normal Computer:** if some player holds more than 40% of all dice, only attacks involving that player are considered. It never attacks a territory with more dice. On equal dice it attacks if either side leads (ties for the lead count), otherwise 90% of the time. It picks a random acceptable attack, or ends its turn. The original's buggy ranking is deliberately fixed.
- **Game Code** = 32-bit seed; the same code and the same choices replay the same game.
- **Map:** 30×28 grid (our own size), 30–31 territories, each starting from a 7-cell core.
- **Visual style:** flat cartoon, thick near-black outlines. The fight is shown as darkened territories with a red outline. Light comes from the upper left.
- **Battle timing:** Human 200 ms clash, 600 ms roll, 400 ms reveal, 400 ms result. Computer 300 ms roll, 300 ms result.
- **Title and credit:** "Proyecto Dados Clonados Belicosos", with the footer credit "A fan-made clone of Dice Wars by GAMEDESIGN, with a few extras I missed. Not affiliated with GAMEDESIGN." (only "Dice Wars" is a link). The README explains the why: a personal project to add missing features. The name "Dice Wars" is never used as our title.
- **Node:** LTS only. Dependabot ignores major Node bumps. **Node 22 reaches end of life in April 2027: move the Dockerfile, compose and CI to 24-alpine by hand before then.**

## Security posture

- **CSP** in a meta tag: `script-src 'self'`, `style-src 'self'`, no inline code, no external origins. The DOM is built with `textContent` only, and ESLint bans `innerHTML`/`outerHTML`.
- **Supply chain:**
  - exact dependency versions and a lockfile; `ignore-scripts=true`;
  - the Node image is pinned by digest;
  - GitHub Actions are pinned to commit SHAs, with least-privilege permissions;
  - Dependabot uses a 7-day cooldown.
- **Container:** `.git` is mounted read-only (tools can't plant git hooks); `cap_drop: ALL`; `no-new-privileges`; non-root user.
- **Dev server:** bound to 127.0.0.1 unless `DEV_HOST` is set.
- **Commits:** author email `9033866+rbsteiner@users.noreply.github.com`. Never use the owner's personal email in commits.
- **Dev-only code:** the `window.__dados` hook is behind `import.meta.env.DEV` and is verified absent from `dist/`.

## Gotchas

- **Stale code in the browser:** host edits didn't reach Vite in Colima until polling was enabled (`vite.config.ts`). If served code still looks stale, run `docker compose restart app`. To check, run `curl http://localhost:5173/dados/src/<file>.ts`; compare values, not whitespace, because Vite reformats.
- **The screenshot tool times out on the first run after a code change** (Vite reloads the page). Run it again.
- **Chromium forces HTTPS for the hostname `app`** (`.app` is HSTS-preloaded). That's why the dev server has the network alias `devserver`.
- **Don't run `docker compose run app …` while `up` is starting.** Both share `node_modules`, and the dev container runs `npm ci`. Use `exec`.
- **`mix()` in render.ts must return `#rrggbb`.** Colours get blended twice, and an `rgb()` string silently broke the capture flash once.

## Open follow-ups (from the last review — propose, don't do silently)

1. **Screen readers:** the dice bar is `aria-live`. Tumbling faces spam screen readers, so set `aria-busy` during the roll and announce only the result.
2. **Reduced motion:** `prefers-reduced-motion` only disables the CSS wobble. Also shorten or skip the canvas clash, bounce and shake.
3. **`animate()` in main.ts:** clamp `t` to `>= 0`.
4. **`DiceBar.roll()`:** a stale roll should clear only its own timer.
5. **Unhandled rejections:** catch rejections from `void humanAttack(...)` and `void continueTurns()`.
6. **Screenshot tool:** hash-pin its pip dependencies (`--require-hashes`), and consider making the container read-only.
7. **Missing test:** the dice anchor should always be a core cell.
8. **One Dependabot job failed on its first scan.** It hasn't been investigated; the site is unaffected.
9. **Known cosmetic issue:** a full 8-dice stack can still slightly overlap a neighbouring territory.

## Iteration 2 checklist (already agreed in principle)

- Tap works like click. Hit areas must be big enough for fingers.
- Portrait: the same map rotated 90° (so a Game Code gives the same map on every device).
- PWA: manifest, icons, a service worker for offline play, full screen from the Home Screen. All of it must keep working with the strict CSP.
- Layout at 375 px wide: player bar, dice bar and End turn must all fit.
- Test on a real iPhone via `DEV_HOST=0.0.0.0` or the live site.

Details not yet decided (for example orientation-change mid-game, safe-area insets, and the icon design) need to go to the owner as questions first.
