/** @type {import('prettier').Config} */
export default {
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      // Prettier pads each cell of a Markdown table to the width of its column. With
      // `proseWrap: 'never'`, it removes that padding when the padded table is wider than
      // `printWidth`.
      files: 'CONTRIBUTING.md',
      options: { proseWrap: 'never' },
    },
  ],
};
