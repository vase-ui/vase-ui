import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import config from '../../docs/.vitepress/config.ts';
import { redirectPage, REDIRECTS } from './redirects.ts';

const DOCS_ROOT = join(import.meta.dirname, '..', '..', 'docs');
const SITE = 'https://vase-ui.com/';

// The root package does not depend on VitePress, so the test loads VitePress from the docs package.
const vitepress = await import(
  pathToFileURL(createRequire(join(DOCS_ROOT, 'package.json')).resolve('vitepress')).href
);
// The renderer has the options of the site, so an id is the id that the site gives the heading.
const md: { renderAsync(source: string, env: object): Promise<string> } =
  await vitepress.createMarkdownRenderer(DOCS_ROOT, config.markdown, config.base);
const roots: string[] = [];
after(() => {
  vitepress.disposeMdItInstance();
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const pageFile = (address: string) => join(DOCS_ROOT, `${address.slice(1)}.md`);

for (const { from, to, section } of REDIRECTS) {
  test(`${from} is not a page, and ${to} is a page with the heading ${section}`, async () => {
    assert.ok(!existsSync(pageFile(from)), `docs${from}.md is a page. Remove its redirect.`);
    const path = pageFile(to);
    const html = await md.renderAsync(readFileSync(path, 'utf8'), { path });
    assert.match(html, new RegExp(`<h[2-6] id="${section}"`));
  });
}

/** The address that the script of the file goes to, for an address with the anchor `hash`. */
function destination(html: string, hash: string): string {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  let destination = '';
  const location = {
    hash,
    replace: (address: string) => {
      destination = address;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- The test runs the script of the file.
  new Function('location', script)(location);
  return destination;
}

test('the script of the file keeps an anchor, and goes to the section with no anchor or with the anchor of the title', () => {
  const html = redirectPage(
    { from: '/handbook/parity', to: '/releases', section: 'parity-with-base-ui' },
    SITE,
  );

  assert.equal(destination(html, '#families'), '/releases#families');
  assert.equal(destination(html, ''), '/releases#parity-with-base-ui');
  assert.equal(destination(html, '#parity'), '/releases#parity-with-base-ui');
});

test('the file goes to the section in a browser that runs no script, and names the page as canonical', () => {
  const html = redirectPage({ from: '/benchmarks', to: '/about', section: 'benchmarks' }, SITE);

  assert.ok(
    html.includes('<noscript><meta http-equiv="refresh" content="0; url=/about#benchmarks" />'),
  );
  assert.ok(html.includes('<link rel="canonical" href="https://vase-ui.com/about" />'));
  assert.ok(html.includes('<a href="/about#benchmarks">https://vase-ui.com/about#benchmarks</a>'));
});

test('the site build writes the file of each redirect', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'redirects-'));
  roots.push(outDir);
  assert.ok(config.buildEnd, 'docs/.vitepress/config.ts has no buildEnd.');

  await config.buildEnd({ outDir } as Parameters<typeof config.buildEnd>[0]);

  for (const redirect of REDIRECTS) {
    assert.equal(
      readFileSync(join(outDir, `${redirect.from.slice(1)}.html`), 'utf8'),
      redirectPage(redirect, SITE),
    );
  }
});
