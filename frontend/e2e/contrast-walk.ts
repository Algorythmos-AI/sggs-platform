// The in-page half of kb-contrast.spec.ts: every visible text node of the document, its colour
// against the backgrounds composited behind it. Not a spec. It is passed to page.evaluate, so it
// must stay self-contained (no imports, no closures).
//
// Why not axe: axe answers "cannot tell" for text over a gradient, for text faded by an ancestor's
// opacity and for SVG text, and a "cannot tell" is not a failure. Here a gradient is tested stop by
// stop, opacity is applied, and SVG text is measured against the fill of the shape under its
// centre. Not measured (stated, not hidden): images, pseudo-element layers, and controls that are
// disabled (WCAG 1.4.3 exempts an inactive control).
export function walkContrast(skip: string): string[] {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  type C = number[];                                             // r, g, b (0–255), alpha (0–1)
  const parsed = new Map<string, C>();
  const parse = (c: string): C => {                              // any CSS colour, via the canvas
    let v = parsed.get(c);
    if (!v) {
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data; v = [d[0], d[1], d[2], d[3] / 255]; parsed.set(c, v);
    }
    return v;
  };
  const over = (top: C, bottom: C): C => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
  const lum = (c: C) => {
    const f = (x: number) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a: C, b: C) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c: C) => '#' + c.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  const stops = (image: string) => (image.match(/rgba?\([^)]*\)|color\([^)]*\)/g) || []).map(parse).filter((c) => c[3] > 0.5);
  // every colour that may lie behind an element's text (several where a gradient is in the chain),
  // and the opacity its ancestors give it
  const behind = (el: Element) => {
    const chain: Element[] = []; for (let e: Element | null = el; e; e = e.parentElement) chain.unshift(e);
    let cols: C[] = [[255, 255, 255, 1]], op = 1;
    for (const e of chain) {
      const s = getComputedStyle(e);
      if (s.backgroundImage.includes('gradient')) { const st = stops(s.backgroundImage); if (st.length) cols = st.map((c) => over(c, cols[0])); }
      const b = parse(s.backgroundColor); if (b[3] > 0) cols = cols.map((c) => over(b, c));
      op *= parseFloat(s.opacity || '1');
    }
    return { cols, op };
  };
  const name = (el: Element) => {
    const path: string[] = [];
    for (let e: Element | null = el, i = 0; e && i < 3; e = e.parentElement, i++) {
      const cls = (e.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      path.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (cls ? '.' + cls : ''));
    }
    return path.join(' > ');
  };
  const found = new Map<string, number>();
  const check = (el: Element, fg: C, cols: C[], s: CSSStyleDeclaration, note: string) => {
    const px = parseFloat(s.fontSize), weight = parseInt(s.fontWeight, 10) || 400;
    const floor = px >= 24 || (px >= 18.66 && weight >= 700) ? 3 : 4.5;      // WCAG "large text"
    for (const bg of cols) {
      const seen = over(fg, bg), r = ratio(seen, bg);
      if (r < floor - 0.005) { const k = `${name(el)}  ${r.toFixed(2)}:1 ${hex(seen)} on ${hex(bg)}${note}`; found.set(k, (found.get(k) || 0) + 1); return; }
    }
  };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    if (!t.nodeValue || !t.nodeValue.trim()) continue;
    const el = t.parentElement;
    if (!el || el.closest('script,style,noscript,[hidden],[inert],[disabled],[aria-disabled="true"]') || (skip && el.closest(skip))) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const s = getComputedStyle(el), rc = el.getBoundingClientRect();
    if (rc.width < 2 || rc.height < 2 || s.clipPath !== 'none' || /rect\(0/.test(s.clip)) continue;     // visually hidden
    if ((el as SVGElement).ownerSVGElement) {
      const svg = (el as SVGElement).ownerSVGElement!, fill = parse(s.fill);
      if (fill[3] === 0) continue;
      let shape: Element | null = null;                                  // the first filled thing under the text's centre
      for (const u of document.elementsFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2)) {
        if (u === el || /^(text|tspan|line|polyline)$/.test(u.tagName)) continue;
        if ((u as SVGElement).ownerSVGElement && getComputedStyle(u).fill === 'none') continue;
        shape = u; break;
      }
      if (!shape) continue;
      let cols = behind((shape as SVGElement).ownerSVGElement ? svg : shape).cols;
      if ((shape as SVGElement).ownerSVGElement && shape !== svg) {
        const ss = getComputedStyle(shape), f = parse(ss.fill);
        const a = f[3] * parseFloat(ss.fillOpacity || '1') * parseFloat(ss.opacity || '1');
        cols = cols.map((c) => over([f[0], f[1], f[2], a], c));
      }
      check(el, [fill[0], fill[1], fill[2], fill[3] * parseFloat(s.fillOpacity || '1') * parseFloat(s.opacity || '1')], cols, s, ' [svg]');
      continue;
    }
    const fg = parse(s.color), { cols, op } = behind(el);
    check(el, [fg[0], fg[1], fg[2], fg[3] * op], cols, s, '');
  }
  return [...found].map(([k, n]) => `${n} × ${k}`);
}
