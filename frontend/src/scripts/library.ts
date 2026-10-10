// library.ts — the Knowledge Base home (/library). The page is complete without this script
// (the search form and the doors are plain HTML); it adds the current pahar, with the raags the
// timing layer records for it, and the places this browser was last reading. Raag timing is
// metadata about raags, never scripture; all API text passes esc() before innerHTML.
import { $, esc, api, guard, store } from './core';
import { loadClock, currentPahar } from './timing';
import { paharLabel, paharRange, raagsForPahar } from './pahar.js';

const renderNow = guard(async () => {
  const host = $('#hubNow'); if (!host) return;
  const clock = await loadClock();
  if (!clock?.available) return;
  const st = currentPahar();
  const raags = raagsForPahar(clock, st.pahar);
  host.innerHTML = `<p class="hub-eyebrow"><b>${esc(paharLabel(st.pahar))}</b>${st.mode === 'fixed' ? ' · ' + esc(paharRange(st.pahar)) : ' · solar'}
      <span class="hub-note">traditional timing, sources differ</span></p>
    ${raags.length
      ? `<div class="now-raags">${raags.map((c: any) =>
          `<button type="button" class="now-chip gm" lang="pa" data-go-ang="${c.first_ang || 1}" data-go-raag="${esc(c.raag_name)}"
             aria-label="Read raag ${esc(c.roman)} in the reader">${esc(c.raag_name)}<span class="tr">${esc(c.roman)}</span></button>`).join('')}
          <a class="hub-more" href="/raag-clock">Raag Clock ›</a></div>`
      : `<p class="quiet-note">✦ The quiet hours — no raag is assigned to this pahar. <a class="hub-more" href="/raag-clock">Raag Clock ›</a></p>`}`;
});

// the places this browser was last reading: the Reader's Ang, and any bani part-way through
const renderContinue = guard(async () => {
  const host = $('#hubContinue'); if (!host) return;
  const items: string[] = [];
  const last = parseInt(store.get('sggs_last_ang', ''), 10);
  if (last >= 1 && last <= 1430)
    items.push(`<a class="hub-cont" href="/reader?ang=${last}"><span>Continue reading</span><b>Ang ${last}</b></a>`);
  host.innerHTML = items.join('');
  const d = await api('banis');
  if (!d?.available) return;
  const rehras = store.get('sggs_rehras_variant') || 'sgpc';
  for (const b of d.banis) {
    if (items.length >= 3) break;
    if (!(b.key === 'rehras' ? b.variant === rehras : b.is_default)) continue;
    const pos = parseInt(store.get('sggs_bani_pos_' + (b.variant ? `${b.key}/${b.variant}` : b.key)) || '0', 10) || 0;
    if (pos <= 1 || !b.n_lines) continue;
    const pct = Math.min(100, Math.round((pos / b.n_lines) * 100));
    items.push(`<a class="hub-cont" href="/nitnem?bani=${encodeURIComponent(b.key)}"><span>${esc(b.title_en)} · ${pct}% read</span>
      <b class="gm" lang="pa">${esc(b.title_gm)}</b></a>`);
  }
  host.innerHTML = items.join('');
});

renderNow();
renderContinue();
