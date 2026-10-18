# Proyecto Dados Clonados Belicosos

I loved [Dice Wars by GAMEDESIGN](https://www.gamedesign.jp/games/dicewars/) and missed a few
features, so I built this clone as a personal project. Not affiliated with GAMEDESIGN.

The things I wanted to add:

- choosing my own colour;
- playing on my iPhone, also offline from the Home Screen;
- a Game Code to replay the same map, a speed setting and autosave;
- an easier and a harder Computer, as an excuse to learn how artificial players work.

The rules are reimplemented from scratch; no code or artwork from the original is used.

The game's vocabulary is defined in [CONTEXT.md](CONTEXT.md). Project status, decisions and next steps
are in [docs/HANDOFF.md](docs/HANDOFF.md).

## Development

Everything runs in Docker; nothing but Docker is needed on the host.

```sh
docker compose up                              # dev server on http://localhost:5173/dados/ (this Mac only)
DEV_HOST=0.0.0.0 docker compose up             # also reachable from your phone on a trusted Wi-Fi
docker compose run --rm app npm test           # tests
docker compose run --rm app npm run lint       # lint
docker compose run --rm app npm run build      # production build in dist/
```

While `docker compose up` is running, use `docker compose exec app npm test` instead of `run`:
both share `node_modules`, and the dev container reinstalls it on start.

Pushes to `main` are tested and published to GitHub Pages by `.github/workflows/deploy.yml`.

## License

MIT
