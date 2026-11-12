import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitepress';
import { readNavigation } from '../../scripts/docs/navigation.ts';

const docsRoot = join(import.meta.dirname, '..');
const manifest: { description: string } = JSON.parse(
  readFileSync(join(docsRoot, '../packages/vue/package.json'), 'utf8'),
);
const { nav, sidebar } = readNavigation(docsRoot);

export default defineConfig({
  lang: 'en-US',
  title: 'Vase UI',
  description: manifest.description,
  base: '/vase-ui/',
  cleanUrls: true,
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
