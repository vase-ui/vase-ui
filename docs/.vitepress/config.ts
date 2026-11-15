import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, postcssIsolateStyles } from 'vitepress';
import type { MarkdownRenderer } from 'vitepress';
import { createApiReferenceReader } from '../../scripts/docs/apiReference.ts';
import { familyOfPage } from '../../scripts/docs/familyPages.ts';
import { readNavigation } from '../../scripts/docs/navigation.ts';
import { markdownHeadingBadge } from './markdownHeadingBadge.ts';
import { postcssFollowSiteTheme } from './postcssFollowSiteTheme.ts';

const docsRoot = join(import.meta.dirname, '..');
const manifest: { description: string; homepage: string } = JSON.parse(
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

// README.md names a page of this site by its full address, because GitHub and npm show that file.
// This rule changes such an address to a path of the site, so the link opens in the same tab.
function markdownSiteLinks(md: MarkdownRenderer): void {
  md.core.ruler.after('linkify', 'site_links', ({ tokens }) => {
    for (const { children } of tokens) {
      for (const token of children ?? []) {
        const address = token.type === 'link_open' ? token.attrGet('href') : null;
        if (address?.startsWith(manifest.homepage)) {
          token.attrSet('href', `/${address.slice(manifest.homepage.length)}`);
        }
      }
    }
  });
}

// VitePress takes one function for the Markdown renderer.
function markdownConfig(md: MarkdownRenderer): void {
  markdownHeadingBadge(md);
  markdownSiteLinks(md);
}

export default defineConfig({
  lang: 'en-US',
  title: 'Vase UI',
  description: manifest.description,
  base: '/',
  cleanUrls: true,
  // A demo is inside an element with the class `vp-raw`. The first plugin keeps the styles of the
  // theme out of it, so the style sheet of the demo is the only one that styles it. The second
  // plugin makes that style sheet follow the theme of the site.
  vite: {
    css: {
      postcss: {
        plugins: [
          postcssIsolateStyles({
            includeFiles: [/vp-doc\.css/, /base\.css/, /[\\/]\.vitepress[\\/]theme[\\/]/],
          }),
          postcssFollowSiteTheme(),
        ],
      },
    },
  },
  markdown: { colorReplacements: SYNTAX_COLORS, config: markdownConfig },
  transformPageData(pageData) {
    const family = familyOfPage(pageData.relativePath);
    return family === undefined ? undefined : { apiReference: readApiReference(family) };
  },
  themeConfig: {
    logo: { light: '/wordmark-light.svg', dark: '/wordmark-dark.svg', alt: 'Vase UI' },
    siteTitle: false,
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
