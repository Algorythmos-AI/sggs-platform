#!/usr/bin/env python3
"""Generate the Knowledge Base colour themes from docs/brand/web-themes.json (stdlib only).

    python3 scripts/brand/gen_web_themes.py            # rewrite the two generated files
    python3 scripts/brand/gen_web_themes.py --check    # exit 1 if they are stale or a pair fails (CI)

Writes frontend/src/styles/kb/themes.css (the tokens, per theme and per light/dark) and
frontend/src/generated/kb-themes.json (ids, names and swatches for the boot script and the picker).

A theme gives an accent, the text colour of that accent, the text colour that sits on its fill, and
a decorative companion, for light and for dark. Everything tinted is derived here: the page canvas,
the light "silk" cloth and its tiles, the dark canvas and tiles. The tint strength is SOLVED per
theme, so that the accent text and the soft ink still clear their floor on the tinted surface; then
every text pair is proved with the WCAG 2.x formula (the same one as contrast_report.py). A pair
below its floor is an error: nothing is written and the exit code is 1.

Every colour a script reads back from the stylesheet is emitted as a literal hex: the charts build
colour strings from them, and would draw black from a color-mix() or an oklch().
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/brand/web-themes.json"
CSS_OUT = ROOT / "frontend/src/styles/kb/themes.css"
JSON_OUT = ROOT / "frontend/src/generated/kb-themes.json"
TEXT_MIN, UI_MIN = 4.5, 3.0
SOLVE_MIN = 4.6        # headroom over the floor when choosing a tint strength


def rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def to_hex(c):
    return "#%02X%02X%02X" % tuple(int(round(x)) for x in c)


def mix(a, b, p):
    """p of colour a over colour b."""
    A, B = rgb(a), rgb(b)
    return to_hex([A[i] * p + B[i] * (1 - p) for i in range(3)])


def luminance(h):
    ch = [x / 255 for x in rgb(h)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in ch]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def rgba(h, alpha):
    r, g, b = rgb(h)
    return f"rgba({r},{g},{b},{alpha})"


def solve_tint(colour, base, start, texts):
    """The strongest tint of `colour` over `base` (at most `start`) every text colour still clears."""
    p = start
    while p > 0.02:
        tinted = mix(colour, base, p)
        if all(ratio(t, tinted) >= SOLVE_MIN for t in texts):
            return tinted
        p = round(p - 0.01, 2)
    return mix(colour, base, 0.02)


def derive(src):
    """(themes, failures): the full token set of every shipped theme, and each pair under its floor."""
    L, D, T = src["surfaces"]["light"], src["surfaces"]["dark"], src["tints"]
    themes, fails = [], []

    def need(theme, label, got, floor):
        if got < floor:
            fails.append(f"{theme}: {label} is {got:.2f}, needs {floor}")

    for t in src["themes"]:
        if t["status"] == "held":
            continue
        tid, lt, dk, velvet = t["id"], t["light"], t["dark"], t["velvet"]
        texts = [lt["accentText"], L["inkSoft"], L["inkFaint"]]
        canvas = solve_tint(lt["accent"], L["paper"], T["canvas"], texts)
        silk_a = solve_tint(lt["accent"], L["paper"], T["silk"], texts)
        silk_b = solve_tint(lt["companion"], L["paper"], T["silkCompanion"], texts)
        dcanvas = D["base"] if t["collection"] == "app" else mix(dk["accent"], D["base"], T["darkCanvas"])
        dtile1 = mix(dk["accent"], D["card"], T["darkTile"])
        dtile2 = mix(dk["companion"], D["card"], T["darkTile"])

        light_bg = {"canvas": canvas, "card": L["card"], "paper": L["paper"], "warm paper": L["paperWarm"],
                    "silk": silk_a, "companion silk": silk_b}
        for name, bg in light_bg.items():
            need(tid, f"light accent text on {name}", ratio(lt["accentText"], bg), TEXT_MIN)
            need(tid, f"light soft ink on {name}", ratio(L["inkSoft"], bg), TEXT_MIN)
            need(tid, f"light faint ink on {name}", ratio(L["inkFaint"], bg), TEXT_MIN)
        need(tid, "light accent on card", ratio(lt["accent"], L["card"]), UI_MIN)
        need(tid, "light accent on paper", ratio(lt["accent"], L["paper"]), UI_MIN)
        need(tid, "light text on the accent fill", ratio(lt["onAccent"], lt["accentFill"]), TEXT_MIN)
        dark_bg = {"canvas": dcanvas, "card": D["card"], "raised": D["raised"], "paper": D["paper"],
                   "tile": dtile1, "companion tile": dtile2}
        for name, bg in dark_bg.items():
            need(tid, f"dark accent text on {name}", ratio(dk["accentText"], bg), TEXT_MIN)
            need(tid, f"dark soft ink on {name}", ratio(D["inkSoft"], bg), TEXT_MIN)
            need(tid, f"dark faint ink on {name}", ratio(D["inkFaint"], bg), TEXT_MIN)
        need(tid, "dark accent on card", ratio(dk["accent"], D["card"]), UI_MIN)
        need(tid, "dark text on the accent fill", ratio(dk["onAccent"], dk["accentFill"]), TEXT_MIN)
        for i, stop in enumerate(velvet):
            need(tid, f"cloth ink on velvet stop {i}", ratio(D["clothInk"], stop), TEXT_MIN)
            need(tid, f"cloth soft ink on velvet stop {i}", ratio(D["clothSoft"], stop), TEXT_MIN)

        themes.append({
            "id": tid, "name": t["name"], "collection": t["collection"], "evokes": t["evokes"], "status": t["status"],
            "light": {
                "canvas": canvas, "surface-2": silk_a,
                "accent-ui": lt["accent"], "accent-text": lt["accentText"], "accent-fill": lt["accentFill"],
                "on-accent": lt["onAccent"], "accent-deep": lt["accentDeep"], "co": lt["companion"],
                "cloth": f"linear-gradient(120deg,{silk_a} 0%,{silk_a} 38%,{silk_b} 100%)",
                "tile1": silk_a, "tile2": silk_b, "chrome": silk_a, "glow": rgba(lt["accent"], ".16"),
            },
            "dark": {
                "canvas": dcanvas, "surface-2": D["paper"],
                "accent-ui": dk["accent"], "accent-text": dk["accentText"], "accent-fill": dk["accentFill"],
                "on-accent": dk["onAccent"], "accent-deep": dk["accentDeep"], "co": dk["companion"],
                "cloth": f"linear-gradient(150deg,{velvet[0]} 0%,{velvet[1]} 55%,{velvet[2]} 100%)",
                "tile1": dtile1, "tile2": dtile2, "chrome": velvet[0], "glow": rgba(dk["accent"], ".30"),
            },
        })
    return themes, fails


def neutrals(src, mode):
    s = src["surfaces"][mode]
    light = mode == "light"
    return {
        "surface-card": s["card"], "surface-raised": s["raised"], "paper": s["paper"],
        "ink": s["ink"], "soft": s["inkSoft"], "faint": s["inkFaint"],
        "cloth-ink": s["ink"] if light else s["clothInk"], "cloth-soft": s["inkSoft"] if light else s["clothSoft"],
        "line": s["line"], "line-strong": s["lineStrong"], "chip": s["chip"], "shadow": s["shadow"],
        "negative": s["negative"], "negative-bg": s["negativeBg"],
    }


def block(selector, tokens, extra="", indent=""):
    body = "".join(f"{indent}  --{k}:{v};\n" for k, v in tokens.items())
    return f"{indent}{selector} {{\n{extra}{body}{indent}}}\n"


def render_css(src, themes):
    default = next(t for t in themes if t["id"] == src["default"])
    dark = {**neutrals(src, "dark"), **default["dark"]}
    out = [
        "/* GENERATED by scripts/brand/gen_web_themes.py from docs/brand/web-themes.json — do not edit.\n"
        "   Colour themes of the Knowledge Base: the neutral surfaces and inks per light/dark, then one\n"
        "   accent set per theme. The default theme needs no attribute; the others are chosen by\n"
        "   html[data-accent]. The original variable names (--bg, --accent, …) are aliases in tokens.css. */\n",
        block(':root, :root[data-theme="light"]', {**neutrals(src, "light"), **default["light"]}, "  color-scheme:light;\n"),
        block(':root[data-theme="dark"]', dark, "  color-scheme:dark;\n"),
        "@media (prefers-color-scheme: dark) {            /* no-JS fallback only */\n",
        block(":root:not([data-theme])", dark, "    color-scheme:dark;\n", "  "),
        "}\n",
        "/* paper tone: a warmer reading surface, by day only */\n",
        block(':root[data-tone="warm"]:not([data-theme="dark"])', {"paper": src["surfaces"]["light"]["paperWarm"]}),
    ]
    for t in themes:
        if t["id"] == src["default"]:
            continue
        out.append(f"/* {t['name']} — {t['evokes']} */\n")
        out.append(block(f':root[data-accent="{t["id"]}"]', t["light"]))
        out.append(block(f':root[data-theme="dark"][data-accent="{t["id"]}"]', t["dark"]))
    return "".join(out)


def render_json(src, themes):
    return json.dumps({
        "_generated": "scripts/brand/gen_web_themes.py from docs/brand/web-themes.json — do not edit",
        "default": src["default"],
        "collections": src["collections"],
        "themes": [{"id": t["id"], "name": t["name"], "collection": t["collection"], "evokes": t["evokes"],
                    "swatch": {"light": [t["light"]["accent-fill"], t["light"]["co"]],
                               "dark": [t["dark"]["accent-fill"], t["dark"]["co"]]}} for t in themes],
    }, indent=2, ensure_ascii=False) + "\n"


def main(argv=None):
    check = "--check" in (sys.argv[1:] if argv is None else argv)
    src = json.loads(SOURCE.read_text(encoding="utf-8"))
    themes, fails = derive(src)
    if fails:
        print("web themes: contrast failures\n  " + "\n  ".join(fails))
        return 1
    wanted = {CSS_OUT: render_css(src, themes), JSON_OUT: render_json(src, themes)}
    if check:
        stale = [p.relative_to(ROOT).as_posix() for p, text in wanted.items()
                 if not p.exists() or p.read_text(encoding="utf-8") != text]
        if stale:
            print("web themes: stale — run python3 scripts/brand/gen_web_themes.py\n  " + "\n  ".join(stale))
            return 1
        print(f"web themes: OK — {len(themes)} themes, every text pair at or above its floor, generated files current")
        return 0
    for p, text in wanted.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    print(f"web themes: wrote {len(themes)} themes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
