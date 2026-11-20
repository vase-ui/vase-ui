import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import config from '../../docs/.vitepress/config.ts';
import type { ApiReference } from './apiReference.ts';
import { apiReferenceSearchHtml, searchIndexHtml } from './searchIndex.ts';

const DOCS_ROOT = join(import.meta.dirname, '..', '..', 'docs');

// The root package does not depend on VitePress, so the test loads VitePress from the docs package.
const vitepress = await import(
  pathToFileURL(createRequire(join(DOCS_ROOT, 'package.json')).resolve('vitepress')).href
);
// The renderer has the options of the site, so a case fails when the site does not use the rule.
const md = await vitepress.createMarkdownRenderer(DOCS_ROOT, config.markdown, config.base ?? '/');
after(vitepress.disposeMdItInstance);

const search = config.themeConfig?.search;
assert.equal(search?.provider, 'local');
const { _render, miniSearch } = search.options ?? {};
assert.ok(_render);

const renderForIndex = async (source: string, relativePath: string): Promise<string> =>
  _render(
    source,
    { path: join(DOCS_ROOT, relativePath), relativePath, cleanUrls: config.cleanUrls ?? false },
    md,
  );

// These are the two expressions of `localSearchPlugin.ts` of VitePress 2.0.0-alpha.21. VitePress
// does not export them. A heading that they do not match makes no section, so its text goes to the
// section above it.
const HEADING = /<h(\d*).*?>(.*?<a.*? href="#.*?".*?>.*?<\/a>)<\/h\1>/gi;
const HEADING_CONTENT = /(.*)<a.*? href="#(.*?)".*?>.*?<\/a>/i;
function sectionsOf(
  html: string,
): { level: number; title: string; anchor: string; text: string }[] {
  const [, ...parts] = html.split(HEADING);
  const sections = [];
  for (let index = 0; index < parts.length; index += 3) {
    const [level, heading, content] = parts.slice(index, index + 3);
    const [, title = '', anchor = ''] = HEADING_CONTENT.exec(heading) ?? [];
    sections.push({
      level: Number(level),
      title: title.replace(/<[^>]*>/g, '').trim(),
      anchor,
      text: content.replace(/<[^>]*>/g, ''),
    });
  }
  return sections;
}

const reference: ApiReference = {
  parts: [
    {
      name: 'Sample.Root',
      badge: null,
      description: 'Groups the parts.',
      hasChildren: false,
      props: [
        {
          name: 'closeDelay',
          type: 'Array<number>',
          default: null,
          required: false,
          description: 'The time before the popup closes.',
        },
      ],
      events: [{ name: 'openChange', type: '[open: boolean]', description: 'The popup opened.' }],
      slots: [],
      exposed: [],
      dataAttributes: [{ name: 'data-open', type: null, description: 'Present while open.' }],
      cssVariables: [{ name: '--sample-width', type: null, description: 'The width.' }],
    },
  ],
  functions: [
    {
      name: 'Sample.createHandle',
      description: 'Makes a handle.',
      parameters: [
        { name: 'options', type: 'Options<T>', optional: true, description: 'The options.' },
      ],
      returns: { type: 'Sample.Handle', description: 'The new handle.' },
    },
  ],
  classes: [
    {
      name: 'Sample.Handle',
      properties: [
        { name: 'isOpen', type: 'boolean', readonly: true, description: 'Whether it is open.' },
      ],
      methods: [
        {
          name: 'open',
          description: 'Opens the popup.',
          parameters: [
            { name: 'triggerId', type: 'string', optional: false, description: 'The trigger.' },
          ],
          returns: { type: 'boolean', description: 'Whether the popup opened.' },
        },
      ],
    },
  ],
  types: [],
};

test('a part is one section, with the id of its heading on the page, its names and its descriptions', () => {
  const [section, ...others] = sectionsOf(apiReferenceSearchHtml(reference));

  assert.deepEqual(others, []);
  assert.equal(section?.level, 3);
  assert.equal(section?.title, 'Sample.Root');
  assert.equal(section?.anchor, 'api-sample-root');
  for (const text of [
    'Groups the parts.',
    'closeDelay',
    'openChange',
    'data-open',
    '--sample-width',
  ]) {
    assert.ok(section?.text.includes(text), text);
  }
});

test('a named reference adds text to the section of the page heading above it, and no section', () => {
  const functionHtml = apiReferenceSearchHtml(reference, 'Sample.createHandle');
  const classHtml = apiReferenceSearchHtml(reference, 'Sample.Handle');

  assert.deepEqual(sectionsOf(functionHtml + classHtml), []);
  for (const text of ['options The options.', 'The new handle.']) {
    assert.ok(functionHtml.includes(text), text);
  }
  for (const text of [
    'isOpen Whether it is open.',
    'open Opens the popup. Whether the popup opened.',
    'triggerId The trigger.',
  ]) {
    assert.ok(classHtml.includes(text), text);
  }
});

test('the text of the reference cannot add an element', () => {
  const html = searchIndexHtml('<ApiReference />', {
    ...reference,
    parts: reference.parts.map((part) => ({ ...part, description: 'Takes <b>bold</b> & more.' })),
  });

  assert.ok(html.includes('Takes &lt;b&gt;bold&lt;/b&gt; &amp; more.'));
});

test('each form of the tag gets its reference', () => {
  const html = searchIndexHtml(
    '<ApiReference />\n<ApiReference name="Sample.createHandle" :heading-level="3" />',
    reference,
  );

  assert.ok(!html.includes('<ApiReference'));
  assert.ok(html.includes('#api-sample-root'));
  assert.ok(html.includes('The new handle.'));
});

test('the site: the index of a component page has its props', async () => {
  const html = await renderForIndex(
    '# Button\n\n## API reference\n\n<ApiReference />\n',
    'components/button.md',
  );
  const sections = sectionsOf(html);

  assert.deepEqual(
    sections.map(({ title, anchor }) => `${title} ${anchor}`),
    ['Button button', 'API reference api-reference', 'Button api-button'],
  );
  assert.ok(sections[2]?.text.includes('focusableWhenDisabled'));
});

test('the site: the index leaves out the badge of a heading', async () => {
  const html = await renderForIndex(
    '# Menu\n\n### Filtering [Preview]\n\nText.\n',
    'handbook/styling.md',
  );

  assert.deepEqual(
    sectionsOf(html).map(({ title }) => title),
    ['Menu', 'Filtering'],
  );
});

test('the site: the index leaves out a page that has `search: false`', async () => {
  assert.equal(await renderForIndex('---\nsearch: false\n---\n\n# Page\n\nText.\n', 'page.md'), '');
});

test('the site: the ranking function runs with no name of the module, as it does in the browser', () => {
  const { boostDocument } = miniSearch?.searchOptions ?? {};
  assert.ok(boostDocument);
  // VitePress writes the source text of the function into the client, where no module name exists.
  const boost: typeof boostDocument = runInNewContext(`(${String(boostDocument)})`);

  assert.equal(boost('/components/menu', 'menu', { title: 'Menu', titles: [] }), 1.5);
  assert.equal(boost('/components/menu#items', 'menu', { title: 'Items', titles: ['Menu'] }), 1);
  assert.equal(boost('/components/context-menu', 'menu', { title: 'Context Menu', titles: [] }), 1);
});
