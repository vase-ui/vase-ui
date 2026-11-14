import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, postcssIsolateStyles } from 'vitepress';
import { createApiReferenceReader } from '../../scripts/docs/apiReference.ts';
import { familyOfPage } from '../../scripts/docs/familyPages.ts';
import { readNavigation } from '../../scripts/docs/navigation.ts';

const docsRoot = join(import.meta.dirname, '..');
const manifest: { description: string } = JSON.parse(
  readFileSync(join(docsRoot, '../packages/vue/package.json'), 'utf8'),
);
const { nav, sidebar } = readNavigation(docsRoot);
const readApiReference = createApiReferenceReader();

// These colors of the GitHub themes of Shiki become the syntax colors that the Base UI docs give to
// the same tokens. `docs/.vitepress/theme/tokens.css` sets these colors for light and dark.
const SYNTAX_ROLES = {
  text: ['#24292e', '#e1e4e8'],
  comment: ['#6a737d', '#6a737d'],
  constant: ['#005cc5', '#79b8ff'],
  entity: ['#6f42c1', '#b392f0'],
  tag: ['#22863a', '#85e89d'],
  keyword: ['#d73a49', '#f97583'],
  string: ['#032f62', '#9ecbff'],
  variable: ['#e36209', '#ffab70'],
  invalid: ['#b31d28', '#fdaeb7'],
} as const;
const SYNTAX_COLORS = Object.fromEntries(
  (['github-light', 'github-dark'] as const).map((theme, index) => [
    theme,
    Object.fromEntries(
      Object.entries(SYNTAX_ROLES).map(([role, colors]) => [
        colors[index],
        `var(--vase-syntax-${role})`,
      ]),
    ),
  ]),
);

export default defineConfig({
  lang: 'en-US',
  title: 'Vase UI',
  description: manifest.description,
  base: '/vase-ui/',
  cleanUrls: true,
  // A demo is inside an element with the class `vp-raw`. This plugin keeps the styles of the theme
  // out of it, so the style sheet of the demo is the only one that styles it.
  vite: {
    css: {
      postcss: {
        plugins: [
          postcssIsolateStyles({
            includeFiles: [/vp-doc\.css/, /base\.css/, /[\\/]\.vitepress[\\/]theme[\\/]/],
          }),
        ],
      },
    },
  },
  markdown: { colorReplacements: SYNTAX_COLORS },
  transformPageData(pageData) {
    const family = familyOfPage(pageData.relativePath);
    return family === undefined ? undefined : { apiReference: readApiReference(family) };
  },
  themeConfig: {
    nav,
    sidebar,
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: 'https://github.com/vase-ui/vase-ui' }],
    notFound: {
      title: 'Page not found',
      quote: 'Nothing here. Some vases are empty.',
      linkText: 'Go to the home page',
      linkLabel: 'Go to the home page',
    },
  },
});
