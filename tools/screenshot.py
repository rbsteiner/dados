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
                for i, (tid, name) in enumerate(zip(attack, ("3-selected", "4-fight"))):
                    pt = page.evaluate(f"window.__dados.territoryPoint({tid})")
                    page.mouse.click(pt["x"], pt["y"])
                    page.wait_for_timeout(150)
                    page.screenshot(path=f"/screenshots/{scheme}-{name}.png")
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
