# Proyecto Dados Clonados Belicosos

A browser game of territory conquest with dice, inspired by
[Dice Wars by GAMEDESIGN](https://www.gamedesign.jp/games/dicewars/).
The rules are reimplemented from scratch; no code or artwork from the original is used.

The game's vocabulary is defined in [CONTEXT.md](CONTEXT.md).

## Development

Everything runs in Docker; nothing but Docker is needed on the host.

```sh
docker compose up                              # dev server on http://localhost:5173/dicewars/
docker compose run --rm app npm test           # tests
docker compose run --rm app npm run lint       # lint
docker compose run --rm app npm run build      # production build in dist/
```

Pushes to `main` are tested and published to GitHub Pages by `.github/workflows/deploy.yml`.

## License

MIT
