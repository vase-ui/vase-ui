/**
 * The tables of the section "Differences from Base UI" of a family page, in their sequence.
 * `BaseUiDifferences.vue` gives each heading its `id`, and the search index links to it. The rule has
 * a module of its own, because the script of the index cannot import an SFC.
 */
export const DIFFERENCES_SECTIONS = [
  { key: 'api', id: 'differences-api', title: 'API', columns: ['Base UI', 'Vase UI'] },
  {
    key: 'added',
    id: 'differences-added',
    title: 'Added in Vase UI',
    columns: ['Part', 'Member', 'Why'],
  },
  {
    key: 'returnTypes',
    id: 'differences-return-types',
    title: 'Return types',
    columns: ['Function', 'Vase UI returns', 'Why'],
  },
  {
    key: 'behavior',
    id: 'differences-behavior',
    title: 'Behavior',
    columns: ['Vase UI', 'Evidence'],
  },
] as const;

/** The handbook sections with the differences that all components share. */
export const HANDBOOK_DIFFERENCES = [
  'Styling',
  'Animation',
  'Composition',
  'Customization',
  'Forms',
  'TypeScript',
].map((title) => ({ title, href: `/handbook/${title.toLowerCase()}#differences-from-base-ui` }));
