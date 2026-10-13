#!/usr/bin/env python3
"""Generate the Knowledge Base colour themes from docs/brand/web-themes.json (stdlib only).

    python3 scripts/brand/gen_web_themes.py            # rewrite the two generated files
    python3 scripts/brand/gen_web_themes.py --check    # exit 1 if they are stale or a pair fails (CI)

Writes frontend/src/styles/kb/themes.css (the tokens, per theme and per light/dark) and
frontend/src/generated/kb-themes.json (ids, names and swatches for the boot script and the picker).

A theme gives an accent, the text colour of that accent, the text colour that sits on its fill, and
a decorative companion, for light and for dark. Everything tinted is derived here: the page canvas,
the light "silk" cloth and its tiles, the dark canvas and tiles. The tint strength is SOLVED per
theme, so that every text colour still clears its floor on the tinted surface — and the neutral
inks on a chip laid over it, because a chip is a translucent wash and a page stacks them. The
accent's edge colour (--accent-ui) is the accent itself, deepened toward its text colour only as
far as it takes to hold 3:1 on those tints (Saffron and Gold, by day). The cloth carries a faint
motif in the companion colour (--motif is its strength): the cloth's own text and the accent edge
are proved on the motif too. Then every pair is proved
with the WCAG 2.x formula (the same one as contrast_report.py). A pair below its floor is an
error: nothing is written and the exit code is 1.

What is NOT proved, so a stylesheet must not do it: accent text on a chip (use --accent-wash), the
negative red on a chip that sits on the cloth or a tile, and any text in the companion colour.

Every colour a script reads back from the stylesheet is emitted as a literal hex: the charts build
colour strings from them, and would draw black from a color-mix() or an oklch().
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/brand/web-themes.json"
CSS_OUT = ROOT / "frontend/src/styles/kb/themes.css"
JSON_OUT = ROOT / "frontend/src/generated/kb-themes.json"
TEXT_MIN, UI_MIN = 4.5, 3.0
SOLVE_MIN = 4.6        # headroom over the floor when choosing a tint strength
UI_SOLVE = 3.1         # the same headroom for the accent's edge
INKS = (("ink", "ink"), ("soft ink", "inkSoft"), ("faint ink", "inkFaint"))
CLOTH = ("silk", "companion silk", "tile", "companion tile")


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


def over(layer, base):
    """A translucent rgba() layer painted over an opaque colour: the colour the eye gets."""
    r, g, b, a = (float(x) for x in re.fullmatch(r"rgba\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)", layer.replace(" ", "")).groups())
    return to_hex([a * c + (1 - a) * bc for c, bc in zip((r, g, b), rgb(base))])


def text_pairs(surface, neutral, accent_text, cloth=False):
    """(label, ratio) of every text colour allowed on a surface: the accent text and the negative red
    on the surface itself, and each neutral ink both on it and on a chip laid over it. The negative
    red is the app's own (Ink.negative) and is kept exact: it holds on a chip over a page surface,
    not over the stronger tint of the cloth and the tiles (`cloth`)."""
    chip = over(neutral["chip"], surface)
    out = [("accent text", ratio(accent_text, surface)), ("negative", ratio(neutral["negative"], surface))]
    if not cloth:
        out.append(("negative on a chip", ratio(neutral["negative"], chip)))
    for name, key in INKS:
        out.append((name, ratio(neutral[key], surface)))
        out.append((f"{name} on a chip", ratio(neutral[key], chip)))
    return out


def solve_tint(colour, base, start, neutral, accent_text, cloth=False):
    """The strongest tint of `colour` over `base` (at most `start`) every text pair still clears."""
    p = start
    while p > 0.02:
        tinted = mix(colour, base, p)
        if all(r >= SOLVE_MIN for _, r in text_pairs(tinted, neutral, accent_text, cloth)):
            return tinted
        p = round(p - 0.005, 3)
    return mix(colour, base, 0.02)


def hold_edge(accent, accent_text, surfaces):
    """The accent, deepened toward its text colour only as far as its edge needs on every surface."""
    p = 0.0
    while p < 1 and min(ratio(mix(accent_text, accent, p), s) for s in surfaces) < UI_SOLVE:
        p = round(p + 0.02, 2)
    return mix(accent_text, accent, p)


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
        canvas = solve_tint(lt["accent"], L["paper"], T["canvas"], L, lt["accentText"])
        silk_a = solve_tint(lt["accent"], L["paper"], T["silk"], L, lt["accentText"], cloth=True)
        silk_b = solve_tint(lt["companion"], L["paper"], T["silkCompanion"], L, lt["accentText"], cloth=True)
        dcanvas = D["base"] if t["collection"] == "app" else solve_tint(dk["accent"], D["base"], T["darkCanvas"], D, dk["accentText"])
        dtile1 = solve_tint(dk["accent"], D["card"], T["darkTile"], D, dk["accentText"], cloth=True)
        dtile2 = solve_tint(dk["companion"], D["card"], T["darkTile"], D, dk["accentText"], cloth=True)

        light_bg = {"canvas": canvas, "card": L["card"], "paper": L["paper"], "warm paper": L["paperWarm"],
                    "silk": silk_a, "companion silk": silk_b}
        dark_bg = {"canvas": dcanvas, "card": D["card"], "raised": D["raised"], "paper": D["paper"],
                   "tile": dtile1, "companion tile": dtile2}
        # the cloth, and the cloth where the motif (a wash of the companion) lies on it
        silks = {"silk": silk_a, "companion silk": silk_b}
        silks.update({f"the motif on the {n}": mix(lt["companion"], s, T["motif"]) for n, s in list(silks.items())})
        velvets = {f"velvet stop {i}": stop for i, stop in enumerate(velvet)}
        velvets.update({f"the motif on {n}": mix(dk["companion"], s, T["motif"]) for n, s in list(velvets.items())})
        edge = hold_edge(lt["accent"], lt["accentText"], [*light_bg.values(), *silks.values()])
        dedge = hold_edge(dk["accent"], dk["accentText"], [*dark_bg.values(), *velvets.values()])
        for mode, surfaces, neutral, accent_text, ui in (("light", light_bg, L, lt["accentText"], edge),
                                                         ("dark", dark_bg, D, dk["accentText"], dedge)):
            for name, bg in surfaces.items():
                for label, got in text_pairs(bg, neutral, accent_text, cloth=name in CLOTH):
                    need(tid, f"{mode} {label} on {name}", got, TEXT_MIN)
                need(tid, f"{mode} accent edge on {name}", ratio(ui, bg), UI_MIN)
        need(tid, "light text on the accent fill", ratio(lt["onAccent"], lt["accentFill"]), TEXT_MIN)
        need(tid, "dark text on the accent fill", ratio(dk["onAccent"], dk["accentFill"]), TEXT_MIN)
        for cloth, ink, soft, ui in ((silks, L["ink"], L["inkSoft"], edge), (velvets, D["clothInk"], D["clothSoft"], dedge)):
            for name, bg in cloth.items():
                need(tid, f"cloth ink on {name}", ratio(ink, bg), TEXT_MIN)
                need(tid, f"cloth soft ink on {name}", ratio(soft, bg), TEXT_MIN)
                need(tid, f"accent edge on {name}", ratio(ui, bg), UI_MIN)

        themes.append({
            "id": tid, "name": t["name"], "collection": t["collection"], "evokes": t["evokes"], "status": t["status"],
            "light": {
                "canvas": canvas, "surface-2": silk_a,
                "accent-ui": edge, "accent-text": lt["accentText"], "accent-fill": lt["accentFill"],
                "on-accent": lt["onAccent"], "accent-deep": lt["accentDeep"], "co": lt["companion"],
                "cloth": f"linear-gradient(90deg,{silk_a} 0%,{silk_a} 38%,{silk_b} 100%)",
                "tile1": silk_a, "tile2": silk_b, "chrome": silk_a, "glow": rgba(lt["accent"], ".16"),
            },
            "dark": {
                "canvas": dcanvas, "surface-2": D["paper"],
                "accent-ui": dedge, "accent-text": dk["accentText"], "accent-fill": dk["accentFill"],
                "on-accent": dk["onAccent"], "accent-deep": dk["accentDeep"], "co": dk["companion"],
                "cloth": f"linear-gradient(90deg,{velvet[0]} 0%,{velvet[1]} 55%,{velvet[2]} 100%)",
                "tile1": dtile1, "tile2": dtile2, "chrome": velvet[0], "glow": rgba(dk["accent"], ".30"),
            },
        })
    return themes, fails


def neutrals(src, mode):
    s = src["surfaces"][mode]
    light = mode == "light"
    return {
        "motif": str(src["tints"]["motif"]).lstrip("0"),
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
                               "dark": [t["dark"]["accent-fill"], t["dark"]["co"]]},
                    "chrome": {"light": t["light"]["chrome"], "dark": t["dark"]["chrome"]}} for t in themes],
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
