import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createMarkdownRenderer, disposeMdItInstance } from 'vitepress';
import config from './config.ts';

// The renderer has the options of the site, so a case fails when the site does not use the plugin.
const md = await createMarkdownRenderer(import.meta.dirname, config.markdown, config.base);
after(disposeMdItInstance);

const render = (source: string) => md.renderAsync(source, { relativePath: 'page.md' });

function headings(html: string): string[] {
  return [...html.matchAll(/<(h[1-6]) id="([^"]*)"/g)].map(([, tag, id]) => `${tag}#${id}`);
}

test('lowers each heading between the two lines by one level, and no other heading', async () => {
  const html = await render(
    [
      '## Notes',
      '<!-- lower-headings -->',
      '## 2026.12.0',
      '### Fixed',
      '<!-- /lower-headings -->',
      '## After',
      '### Below',
    ].join('\n\n'),
  );

  assert.deepEqual(headings(html), [
    'h2#notes',
    'h3#_2026-12-0',
    'h4#fixed',
    'h2#after',
    'h3#below',
  ]);
  assert.ok(html.includes('</h3>\n<h4 id="fixed"'));
});

test('keeps the two lines out of the page', async () => {
  const html = await render('<!-- lower-headings -->\n\n## Notes\n\n<!-- /lower-headings -->\n');

  assert.ok(!html.includes('lower-headings'));
});

test('keeps a comment that is not one of the two lines', async () => {
  const html = await render('<!-- lower-headings of a file -->\n\n## Notes\n');

  assert.deepEqual(headings(html), ['h2#notes']);
  assert.ok(html.includes('<!-- lower-headings of a file -->'));
});

test('throws for a heading of level 6 between the two lines, and names the page', async () => {
  await assert.rejects(
    render('<!-- lower-headings -->\n\n###### Deep\n\n<!-- /lower-headings -->\n'),
    /^Error: page\.md: a heading of level 6 is between/,
  );
  await assert.rejects(
    md.renderAsync('<!-- lower-headings -->\n\n###### Deep\n\n<!-- /lower-headings -->\n', {
      path: '/docs/releases.md',
    }),
    /^Error: \/docs\/releases\.md: a heading of level 6 is between/,
  );
});

test('throws when a start line has no end line after it, and names the page', async () => {
  await assert.rejects(
    render('<!-- lower-headings -->\n\n## Notes\n'),
    /^Error: page\.md: "<!-- lower-headings -->" has no "<!-- \/lower-headings -->" after it\./,
  );
});
