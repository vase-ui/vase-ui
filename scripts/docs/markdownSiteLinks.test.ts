import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import config from '../../docs/.vitepress/config.ts';

const DOCS_ROOT = join(import.meta.dirname, '..', '..', 'docs');
const BASE = config.base ?? '/';

// The root package does not depend on VitePress, so the test loads the copy of the docs package.
const vitepress = await import(
  pathToFileURL(createRequire(join(DOCS_ROOT, 'package.json')).resolve('vitepress')).href
);
// The renderer has the options of the site, so a case fails when the site does not use the rule.
const md: { renderAsync(source: string, env: object): Promise<string> } =
  await vitepress.createMarkdownRenderer(DOCS_ROOT, config.markdown, BASE);
after(vitepress.disposeMdItInstance);

const render = (source: string, path = join(DOCS_ROOT, 'page.md')) =>
  md.renderAsync(source, { path, cleanUrls: config.cleanUrls });

test('a link to a page of the site, by its full address, is a link by path in the same tab', async () => {
  const html = await render('[The parity page](https://vase-ui.com/parity)');

  assert.equal(html.trim(), `<p><a href="${BASE}parity">The parity page</a></p>`);
});

test('a link to another address keeps its address, also when its host starts with the host of the site', async () => {
  const html = await render('[Other](https://vase-ui.community/parity)');

  assert.ok(html.includes('<a href="https://vase-ui.community/parity"'));
});

test('the home page links its parity page by path', async () => {
  const path = join(DOCS_ROOT, 'index.md');
  const html = await render(readFileSync(path, 'utf8'), path);

  assert.ok(html.includes(`<a href="${BASE}parity">`));
});
