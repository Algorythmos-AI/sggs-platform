// shareimage.ts — "Share as image": a 1080×1080 card of one verse, drawn in the browser so the
// Gurmukhi is shaped by the browser's own text engine in the page's own Sant Lipi. The same design
// as the link cards (src/og/render.ts) and the app's square card: paper, the app icon and
// "Gurbani Soul", the verse in ink (verbatim, as text from the API model, never cut: it wraps at
// spaces only), the gold rule (fill + accent edge), the citation, the site. No gold text, no red.
const S = 1080, P = 96;
const C = { paper: '#FBF7F0', ink: '#201A12', muted: '#62584D', fill: '#FFBC0D', deep: '#FFB81C', edge: '#A87900' };
const GM = '"Sant Lipi", "Noto Sans Gurmukhi", sans-serif';
const SERIF = '"Source Serif 4", Georgia, serif';

function icon(): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = '/favicon.svg'; });
}

// wrap at spaces, balanced: the narrowest measure that keeps the greedy line count
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const greedy = (limit: number) => {
    const out: string[] = []; let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (cur && ctx.measureText(t).width > limit) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  };
  let best = greedy(maxW);
  let lo = maxW / Math.max(1, best.length), hi = maxW;
  while (best.length > 1 && hi - lo > 4) {
    const mid = (lo + hi) / 2, l = greedy(mid);
    if (l.length === best.length) { best = l; hi = mid; } else lo = mid;
  }
  return best;
}

export async function verseImage(gm: string, ang: number): Promise<Blob> {
  const cite = `Sri Guru Granth Sahib Ji · Ang ${ang}`;
  await Promise.all([
    document.fonts.load(`400 76px ${GM}`, gm),
    document.fonts.load(`600 34px ${SERIF}`, cite),
  ]).catch(() => { /* fall back to the stack; the text is still the verbatim line */ });
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, S, S);
  const glow = ctx.createRadialGradient(S * 0.92, S * 0.05, 0, S * 0.92, S * 0.05, S * 0.75);
  glow.addColorStop(0, 'rgba(255,188,13,0.13)'); glow.addColorStop(1, 'rgba(255,188,13,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);

  try { ctx.drawImage(await icon(), P, 96, 72, 72); } catch { /* the card stands without the icon */ }
  ctx.fillStyle = C.ink; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 32px ${SERIF}`; ctx.fillText('Gurbani Soul', P + 92, 144);

  let size = 76, lines: string[];
  do { ctx.font = `400 ${size}px ${GM}`; lines = wrap(ctx, gm, S - P * 2); } while (lines.length > 5 && (size -= 6) >= 46);
  const lh = size * 1.5, y0 = 540 - (lines.length * lh) / 2 + size * 0.7;
  lines.forEach((l, i) => ctx.fillText(l, P, y0 + i * lh));
  const after = y0 + (lines.length - 1) * lh;

  const rule = ctx.createLinearGradient(P, 0, P + 104, 0);
  rule.addColorStop(0, C.fill); rule.addColorStop(1, C.deep);
  ctx.beginPath(); ctx.roundRect(P, after + 64, 104, 6, 3);
  ctx.fillStyle = rule; ctx.fill(); ctx.strokeStyle = C.edge; ctx.lineWidth = 1; ctx.stroke();

  ctx.fillStyle = C.ink; ctx.font = `600 34px ${SERIF}`; ctx.fillText(cite, P, after + 124);
  ctx.fillStyle = C.muted; ctx.font = `500 26px ${SERIF}`; ctx.fillText('gurbanisoul.com', P, S - 92);
  return new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('toBlob'))), 'image/png'));
}

/** share the image where the browser can share files; otherwise save it */
export async function shareImage(blob: Blob, name: string, text: string): Promise<'shared' | 'saved' | 'dismissed'> {
  const file = new File([blob], name, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return 'shared'; } catch { return 'dismissed'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'saved';
}
