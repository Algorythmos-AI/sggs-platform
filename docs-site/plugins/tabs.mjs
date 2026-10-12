// The section tabs in the header: five doors into the wiki, each opening a section's overview.
// A tab is lit when the current page sits in one of its sidebar groups (../sidebar.mjs); pages in
// Brand, Decisions and Reference light none. plugins/test/tabs.test.mjs fails if a group is renamed
// or an overview page goes away.
export const TABS = [
  { label: 'Get started', slug: 'onboarding', groups: ['Get started'] },
  { label: 'Scripture', slug: 'scripture', groups: ['Scripture 101'] },
  { label: 'Platform', slug: 'architecture', groups: ['Architecture', 'Data', 'Search & verification', 'iOS app'] },
  { label: 'API', slug: 'api', groups: ['API'] },
  { label: 'Operate', slug: 'process', groups: ['Ship & operate'] },
];

/** The tab for the page a Starlight sidebar marks as current, or null. */
export function litTab(sidebar) {
  const holds = (e) => (e.type === 'group' ? e.entries.some(holds) : e.isCurrent);
  const top = sidebar.find((e) => e.type === 'group' && holds(e));
  return top ? tabFor(top.label) : null;
}

/** The tab for a top-level sidebar group, or null. */
export const tabFor = (groupLabel) => TABS.find((t) => t.groups.includes(groupLabel)) ?? null;
