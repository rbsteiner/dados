"""Dev-only: screenshots of the dev server (start, map, a selection and a fight) into /screenshots."""
from playwright.sync_api import sync_playwright

URL = "http://devserver:5173/dados/"
FIND_ATTACK = """() => {
  const g = window.__dados.state();
  const me = g.turnOrder[g.turnIndex];
  for (const t of g.territories) {
    if (t.owner !== me || t.dice < 2) continue;
    for (const a of t.adjacent) {
      const d = g.territories[a];
      if (d.owner !== me && d.dice < t.dice) return [t.id, d.id];
    }
  }
  return null;
}"""


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for scheme in ("dark", "light"):
            page = browser.new_page(viewport={"width": 1280, "height": 960}, device_scale_factor=2, color_scheme=scheme,
                                 bypass_csp=True)  # the page CSP rightly blocks eval; this tool needs it
            page.goto(URL)
            page.screenshot(path=f"/screenshots/{scheme}-1-start.png")
            page.evaluate("window.__dados.start(7, 5, 12345)")
            page.wait_for_function("!document.getElementById('end-turn').disabled", timeout=120_000)
            page.screenshot(path=f"/screenshots/{scheme}-2-map.png")
            if scheme == "light":
                page.close()
                continue
            attack = page.evaluate(FIND_ATTACK)
            if attack:
                source, target = (page.evaluate(f"window.__dados.territoryPoint({t})") for t in attack)
                page.mouse.click(source["x"], source["y"])
                page.wait_for_timeout(150)
                page.screenshot(path=f"/screenshots/{scheme}-3-selected.png")
                # Battle phases: clash, rolling, reveal, result, back to normal (ms after the click).
                page.mouse.click(target["x"], target["y"])
                elapsed = 0
                for at, name in ((100, "4a-clash"), (500, "4b-rolling"), (1000, "4c-reveal"),
                                 (1350, "4d-result"), (1900, "4e-after")):
                    page.wait_for_timeout(at - elapsed)
                    elapsed = at
                    page.screenshot(path=f"/screenshots/{scheme}-{name}.png", animations="allow")
            page.close()
        # A few more maps, to check how dice fit on different shapes.
        page = browser.new_page(viewport={"width": 1280, "height": 960}, device_scale_factor=2,
                                color_scheme="dark", bypass_csp=True)
        page.goto(URL)
        for code in (1, 2, 3):
            page.evaluate(f"window.__dados.start(8, 0, {code})")
            page.wait_for_timeout(300)
            page.locator("#board").screenshot(path=f"/screenshots/map-code-{code}.png")
        page.close()
        browser.close()


if __name__ == "__main__":
    main()
