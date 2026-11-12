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

export default defineConfig({
  lang: 'en-US',
  title: 'Vase UI',
  description: manifest.description,
  base: '/vase-ui/',
  cleanUrls: true,
  // A demo is inside an element with the class `vp-raw`. This plugin keeps the styles of the theme
  // out of it, so the style sheet of the demo is the only one that styles it.
  vite: { css: { postcss: { plugins: [postcssIsolateStyles()] } } },
  transformPageData(pageData) {
    const family = familyOfPage(pageData.relativePath);
    return family === undefined ? undefined : { apiReference: readApiReference(family) };
  },
  themeConfig: {
    nav,
    sidebar,
    socialLinks: [{ icon: 'github', link: 'https://github.com/vase-ui/vase-ui' }],
    notFound: {
      title: 'Page not found',
      quote: 'Nothing here. Some vases are empty.',
      linkText: 'Go to the home page',
      linkLabel: 'Go to the home page',
    },
  },
});
