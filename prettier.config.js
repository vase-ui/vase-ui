/** @type {import('prettier').Config} */
export default {
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      // Prettier pads each cell of a Markdown table to the width of its column. With
      // `proseWrap: 'never'`, it writes a table that is wider than `printWidth` with no padding.
      files: 'CONTRIBUTING.md',
      options: { proseWrap: 'never' },
    },
  ],
};
