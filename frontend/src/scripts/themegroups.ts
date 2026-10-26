// themegroups.ts — the 54 corpus themes in their six theological groups, shared by /themes and
// /constellation (native parity: gurbani-soul-ios ThemesScreen). Each group has one colour,
// docs/brand/tokens.json themeGroup.* (CSS --tg-<key>, tokens.css), so a star, chip or legend
// swatch says which family a theme belongs to. `kaal` (time/death) sits with the Human Condition
// beside jam, as on iOS; `akal` (the Timeless) stays with the Divine Reality.
export type ThemeGroup = { key: string; title: string; caption: string; keys: string[] };

export const THEME_GROUPS: ThemeGroup[] = [
  { key: 'divine', title: 'The Divine Reality', caption: 'God, the Names, and the cosmic Word',
    keys: ['ik_onkar', 'vahiguru', 'karta', 'akal', 'hukam', 'naam', 'shabad', 'bani', 'jot', 'anhad', 'patit_pavan'] },
  { key: 'condition', title: 'The Human Condition & Illusions', caption: 'Ego, mind, attachment, and the wheel of birth–death',
    keys: ['haumai', 'maya', 'man', 'sansar', 'janam_maran', 'avagavan', 'manmukh', 'bharam', 'dukh_sukh', 'garab', 'trishna', 'bhavjal', 'jam', 'kaal'] },
  { key: 'vices', title: 'The Five Vices', caption: 'The panj chor that rob the soul',
    keys: ['kaam', 'krodh', 'lobh', 'moh', 'ahankar'] },
  { key: 'path', title: 'The Path & Praxis', caption: 'The Guru, the Sangat, and the daily practice',
    keys: ['satguru', 'gurmukh', 'simran', 'bhagti', 'seva', 'sangat', 'sant_sadh', 'sifat_salah', 'darshan', 'charan', 'marag_panth'] },
  { key: 'virtues', title: 'Virtues & Divine Attributes', caption: 'The qualities the gurmukh cultivates and the Lord embodies',
    keys: ['prem_pyar', 'daya', 'nimrata', 'santokh', 'bhau', 'bhana', 'karam_nadar'] },
  { key: 'states', title: 'Spiritual States', caption: 'The fruits of the path — poise, bliss, liberation',
    keys: ['anand', 'sahaj', 'sach', 'mukti', 'amrit', 'maran_jeevan'] },
];

const BY_THEME: Record<string, ThemeGroup> = {};
THEME_GROUPS.forEach((g) => g.keys.forEach((k) => { BY_THEME[k] = g; }));

/** the group a theme belongs to (undefined for a slug no group names — shown under "More themes") */
export const groupOf = (concept: string): ThemeGroup | undefined => BY_THEME[concept];
/** the CSS variable carrying a theme's group colour (the ink when the theme has no group) */
export const groupVar = (concept: string) => (BY_THEME[concept] ? `--tg-${BY_THEME[concept].key}` : '--soft');

const titleCase = (k: string) => k.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// The English name a theme is shown under, everywhere on the site. It is the slug's title case
// except where the widely used spelling differs: the slug `vahiguru` stays as it is in URLs, the
// API and saved data, but the Name is written "Waheguru" (search finds every spelling, see
// webapp/sggs/search.py SEEKER_LEXICON and theme_search).
const THEME_NAMES: Record<string, string> = { vahiguru: 'Waheguru' };
export const themeName = (k: string) => THEME_NAMES[k] || titleCase(k);
// Other Roman spellings a reader may type for a theme (native parity: gurbani-soul-ios
// ConceptName.aliases), so the palette finds the theme under each of them.
const THEME_ALIASES: Record<string, string[]> = { vahiguru: ['waheguru', 'vaheguru', 'wahiguru'] };
export const themeAliases = (k: string) => THEME_ALIASES[k] || [];
