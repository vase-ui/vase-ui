import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, postcssIsolateStyles } from 'vitepress';
import type { HeadConfig, MarkdownRenderer } from 'vitepress';
import { createApiReferenceReader } from '../../scripts/docs/apiReference.ts';
import { createBaseUiDifferencesReader } from '../../scripts/docs/baseUiDifferences.ts';
import { familyOfPage } from '../../scripts/docs/familyPages.ts';
import { readNavigation } from '../../scripts/docs/navigation.ts';
import { writeRedirectPages } from '../../scripts/docs/redirects.ts';
import { searchIndexHtml } from '../../scripts/docs/searchIndex.ts';
import { VASE_SOURCE_ROOT } from '../../scripts/parity/paths.ts';
import { REPOSITORY_ROOT } from '../../scripts/parity/repository.ts';
import { DEMO_VARIANT_STORAGE_KEY } from './components/demoVariantStorageKey.ts';
import { markdownHeadingBadge } from './markdownHeadingBadge.ts';
import { markdownLowerHeadings } from './markdownLowerHeadings.ts';
import { postcssFollowSiteTheme } from './postcssFollowSiteTheme.ts';
import { viteFollowSource } from './viteFollowSource.ts';

const docsRoot = join(import.meta.dirname, '..');
const manifest: { description: string; homepage: string } = JSON.parse(
  readFileSync(join(docsRoot, '../packages/vue/package.json'), 'utf8'),
);
const { nav, sidebar } = readNavigation(docsRoot);
// `vitepress build` sets `NODE_ENV` to `production` before it loads this file.
const isBuild = process.env.NODE_ENV === 'production';
// A build reads the reference of a family for its page. It reads the reference two more times for
// the search index, because VitePress makes the index two times. The reader thus keeps each
// reference in a build. The development server has one reader for its life, so a cache there keeps
// a reference until the server restarts.
const readApiReference = createApiReferenceReader(REPOSITORY_ROOT, { cache: isBuild });
const readBaseUiDifferences = createBaseUiDifferencesReader(REPOSITORY_ROOT);

/** The data that a family page shows from the source and from `parity`. */
function readFamilyData(family: string) {
  const apiReference = readApiReference(family);
  return { apiReference, baseUiDifferences: readBaseUiDifferences(family, apiReference) };
}

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
  markdownLowerHeadings(md);
  markdownSiteLinks(md);
}

const SITE_TITLE = 'Vase UI';
const PREVIEW_IMAGE = new URL('og-image.png', manifest.homepage).href;
const PREVIEW_IMAGE_ALT =
  'The Vase UI mark and summary beside a date picker, a menu and a time picker.';

export default defineConfig({
  lang: 'en-US',
  title: SITE_TITLE,
  description: manifest.description,
  base: '/',
  cleanUrls: true,
  head: [
    // If two icons are equally appropriate, a browser uses the last one. The SVG link thus follows
    // the raster icon links.
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: '48x48' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon.png' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    // Link crawlers need an absolute image address. X reads og:title and og:description.
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: SITE_TITLE }],
    ['meta', { property: 'og:image', content: PREVIEW_IMAGE }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: PREVIEW_IMAGE_ALT }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: PREVIEW_IMAGE }],
    // The script runs before the first paint, so `DemoSource` shows the stored variant at once.
    [
      'script',
      {},
      `try{if(localStorage.getItem('${DEMO_VARIANT_STORAGE_KEY}')==='tailwind')document.documentElement.dataset.demoVariant='tailwind'}catch{}`,
    ],
  ],
  // A demo is inside an element with the class `vp-raw`. The first PostCSS plugin keeps the styles
  // of the theme out of it, so the style sheet of the demo is the only one that styles it. For a
  // Tailwind demo, that is `docs/demos/tailwind.css`. The second PostCSS plugin makes a copied
  // style sheet follow the theme of the site. In `tailwind.css`, the variant `dark` does the same.
  vite: {
    plugins: [tailwindcss(), viteFollowSource(join(REPOSITORY_ROOT, VASE_SOURCE_ROOT))],
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
  // VitePress keeps the render of a page, with its page data, for each text of the page file. In
  // the development server, a page file that gets an earlier text again would thus show the API
  // reference of that earlier render.
  markdown: { cache: isBuild, colorReplacements: SYNTAX_COLORS, config: markdownConfig },
  transformPageData(pageData) {
    const pagePath = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
    const pageHead: HeadConfig[] = [
      ['meta', { property: 'og:url', content: new URL(pagePath, manifest.homepage).href }],
      ['meta', { property: 'og:title', content: pageData.title || SITE_TITLE }],
      [
        'meta',
        { property: 'og:description', content: pageData.description || manifest.description },
      ],
    ];
    const frontmatterHead: HeadConfig[] = Array.isArray(pageData.frontmatter.head)
      ? pageData.frontmatter.head
      : [];
    const family = familyOfPage(pageData.relativePath);
    return {
      frontmatter: { ...pageData.frontmatter, head: [...pageHead, ...frontmatterHead] },
      ...(family === undefined ? {} : readFamilyData(family)),
    };
  },
  buildEnd({ outDir }) {
    writeRedirectPages(outDir, manifest.homepage);
  },
  themeConfig: {
    logo: { light: '/mark-light.svg', dark: '/mark-dark.svg', alt: 'Vase UI' },
    siteTitle: false,
    nav,
    sidebar,
    outline: { level: [2, 3] },
    search: {
      provider: 'local',
      options: {
        // The detailed view mounts the page component of each result with the data of the open
        // page, so `ApiReference` throws on a page that has no reference.
        detailedView: false,
        // The index reads the Markdown of a page before Vue renders its components, so
        // `searchIndexHtml` adds the text of `<ApiReference />` and `<BaseUiDifferences />`. With
        // `_render`, VitePress does not read `search: false` of the front matter. This function
        // reads it after the render, because the render fills `env.frontmatter`.
        async _render(source, env, md) {
          const html = await md.renderAsync(source, env);
          if (env.frontmatter?.search === false) {
            return '';
          }
          const family = familyOfPage(env.relativePath);
          return searchIndexHtml(html, family === undefined ? undefined : readFamilyData(family));
        },
        miniSearch: {
          searchOptions: {
            // Without the factor, a section that repeats the term can come before the page whose
            // title is the term. MiniSearch gives the function the word of the index that matched,
            // so for `menu` the page Menubar also gets the factor. VitePress writes the source of
            // this function into the client, so the function uses no name of this module.
            boostDocument: (_id, term, storedFields) => {
              const { title, titles } = storedFields as { title: string; titles: string[] };
              return titles.length === 0 && title.toLowerCase() === term ? 1.5 : 1;
            },
            // With the default weight of a prefix, 0.375, Menubar thus comes before Menu for `menu`.
            // The type of `weights` needs both keys, so `fuzzy` has its default.
            weights: { fuzzy: 0.45, prefix: 0.15 },
          },
        },
      },
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/vase-ui/vase-ui' }],
    notFound: {
      title: 'Page not found',
      quote: 'Nothing here. Some vases are empty.',
      linkText: 'Go to the home page',
      linkLabel: 'Go to the home page',
    },
  },
});
