import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import config from '../../docs/.vitepress/config.ts';

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');
const DOCS_ROOT = join(REPOSITORY_ROOT, 'docs');
const PUBLIC_ROOT = join(DOCS_ROOT, 'public');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function read(path: string): string {
  return readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
}

function pngSize(path: string): { width: number; height: number; byteLength: number } {
  const bytes = readFileSync(join(PUBLIC_ROOT, path));
  assert.ok(
    bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) &&
      bytes.subarray(12, 16).toString('ascii') === 'IHDR',
    `${path} is no PNG file.`,
  );
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    byteLength: bytes.byteLength,
  };
}

const manifest: { description: string } = JSON.parse(read('packages/vue/package.json'));
const buttonSource = read('docs/components/button.md');
const buttonDescription = /^description:\s*(.+)$/m.exec(buttonSource)?.[1] ?? '';

// The root package does not list VitePress, so the test loads VitePress from docs.
const vitepress: {
  build(
    root: string,
    options: {
      mpa: string;
      logLevel: 'silent';
      onAfterConfigResolve(siteConfig: {
        srcDir: string;
        publicDir: string;
        outDir: string;
        cacheDir: string;
        tempDir: string;
        pages: string[];
        ignoreDeadLinks: boolean;
        logger: { info: () => void };
      }): void;
    },
  ): Promise<void>;
} = await import(
  pathToFileURL(createRequire(join(DOCS_ROOT, 'package.json')).resolve('vitepress')).href
);

// CI runs `pnpm lint`, and thus this test, before `pnpm build`, so a demo cannot import
// `@vase-ui/vue` yet. These copies keep the front matter and the title of each page and omit the
// Vue components. The folder is in `.vitepress/cache` so Vite resolves `vue` from `docs`.
const cacheParent = join(DOCS_ROOT, '.vitepress', 'cache');
mkdirSync(cacheParent, { recursive: true });
const buildRoot = mkdtempSync(join(cacheParent, 'social-preview-'));
after(() => {
  rmSync(buildRoot, { recursive: true, force: true });
});

const sourceRoot = join(buildRoot, 'src');
const distRoot = join(buildRoot, 'dist');
mkdirSync(join(sourceRoot, 'components'), { recursive: true });
writeFileSync(
  join(sourceRoot, 'index.md'),
  read('docs/index.md')
    .replace(/<script\b[\s\S]*?<\/script>\s*/, '')
    .replace(/<PageLinks\s*\/>\s*/g, '')
    .replace(/<!--@include:.*?-->\s*/g, ''),
);
writeFileSync(
  join(sourceRoot, 'components', 'button.md'),
  buttonSource
    .slice(0, buttonSource.indexOf('<DemoFrame>'))
    .replace(/<script\b[\s\S]*?<\/script>\s*/, ''),
);

await vitepress.build(DOCS_ROOT, {
  mpa: 'true',
  logLevel: 'silent',
  onAfterConfigResolve(siteConfig) {
    siteConfig.srcDir = sourceRoot;
    siteConfig.publicDir = '';
    siteConfig.outDir = distRoot;
    siteConfig.cacheDir = join(buildRoot, 'cache');
    siteConfig.tempDir = join(buildRoot, 'temp');
    siteConfig.pages = ['index.md', 'components/button.md'];
    siteConfig.ignoreDeadLinks = true;
    siteConfig.logger.info = () => {};
  },
});

interface MetaTag {
  kind: 'name' | 'property';
  key: string;
  content: string;
}

function unescapeHtml(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function metaTagsOf(htmlFile: string): MetaTag[] {
  const html = readFileSync(join(distRoot, htmlFile), 'utf8');
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? '';
  const tags: MetaTag[] = [];
  for (const [element] of head.matchAll(/<meta\b[^>]*>/g)) {
    const attributes = Object.fromEntries(
      [...element.matchAll(/\s([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [
        name,
        unescapeHtml(value),
      ]),
    );
    if (attributes.property !== undefined && attributes.content !== undefined) {
      tags.push({ kind: 'property', key: attributes.property, content: attributes.content });
    } else if (attributes.name !== undefined && attributes.content !== undefined) {
      tags.push({ kind: 'name', key: attributes.name, content: attributes.content });
    }
  }
  return tags;
}

const configuredAlt =
  (config.head ?? []).find(
    ([tag, attributes]) => tag === 'meta' && attributes.property === 'og:image:alt',
  )?.[1].content ?? '';

test('docs/public/og-image.png is a 1200x630 PNG below 1 MB', () => {
  assert.ok(existsSync(join(PUBLIC_ROOT, 'og-image.png')), 'docs/public/og-image.png is absent.');
  const { width, height, byteLength } = pngSize('og-image.png');
  assert.equal(width, 1200);
  assert.equal(height, 630);
  assert.ok(byteLength < 1_000_000, `og-image.png is ${byteLength} bytes.`);
});

test('og:image:alt in docs/.vitepress/config.ts is one sentence', () => {
  assert.match(configuredAlt, /^[^.]+\.$/);
});

const PAGES: {
  name: string;
  file: string;
  url: string;
  title: string;
  description: string;
}[] = [
  {
    name: 'home page',
    file: 'index.html',
    url: 'https://vase-ui.com/',
    title: 'Vase UI',
    description: manifest.description,
  },
  {
    name: 'Button page',
    file: 'components/button.html',
    url: 'https://vase-ui.com/components/button',
    title: 'Button',
    description: buttonDescription,
  },
];

assert.notEqual(buttonDescription, '');
assert.notEqual(buttonDescription, manifest.description);

for (const { name, file, url, title, description } of PAGES) {
  test(`the built ${name} holds each Open Graph and X card meta tag, with og:image before og:image:*`, () => {
    const tags = metaTagsOf(file);
    const keys = tags.map(({ kind, key }) => `${kind}:${key}`);

    const expected: MetaTag[] = [
      { kind: 'property', key: 'og:type', content: 'website' },
      { kind: 'property', key: 'og:site_name', content: 'Vase UI' },
      { kind: 'property', key: 'og:url', content: url },
      { kind: 'property', key: 'og:title', content: title },
      { kind: 'property', key: 'og:description', content: description },
      { kind: 'property', key: 'og:image', content: 'https://vase-ui.com/og-image.png' },
      { kind: 'property', key: 'og:image:type', content: 'image/png' },
      { kind: 'property', key: 'og:image:width', content: '1200' },
      { kind: 'property', key: 'og:image:height', content: '630' },
      { kind: 'property', key: 'og:image:alt', content: configuredAlt },
      { kind: 'name', key: 'twitter:card', content: 'summary_large_image' },
      { kind: 'name', key: 'twitter:image', content: 'https://vase-ui.com/og-image.png' },
    ];
    for (const entry of expected) {
      const match = tags.find((tag) => tag.kind === entry.kind && tag.key === entry.key);
      assert.deepEqual(match, entry, `${file}: ${entry.kind}="${entry.key}"`);
    }

    const imageIndex = keys.indexOf('property:og:image');
    for (const subProperty of [
      'og:image:type',
      'og:image:width',
      'og:image:height',
      'og:image:alt',
    ]) {
      assert.ok(
        imageIndex < keys.indexOf(`property:${subProperty}`),
        `${file}: og:image must come before ${subProperty}.`,
      );
    }

    for (const redundant of ['twitter:title', 'twitter:description']) {
      assert.equal(
        tags.find((tag) => tag.key === redundant),
        undefined,
        `${file}: do not duplicate ${redundant}.`,
      );
    }
  });
}
