import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { readNavigation } from './navigation.ts';

const roots: string[] = [];

after(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeDocs(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'navigation-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

function page(title: string, order: number): string {
  return `---\norder: ${order}\n---\n\n# ${title}\n\nText.\n`;
}

test('the top-level pages are in the sequence of order, then of text', () => {
  const root = makeDocs({
    'index.md': '# Home\n',
    'a-last.md': page('Last', 2),
    'first.md': page('First', 1),
    'z-also-second.md': page('Also second', 2),
  });
  const items = [
    { text: 'First', link: '/first' },
    { text: 'Also second', link: '/z-also-second' },
    { text: 'Last', link: '/a-last' },
  ];
  assert.deepEqual(readNavigation(root), { nav: items, sidebar: [{ text: 'Overview', items }] });
});

test('each folder that has pages is one group, with its pages in the sequence of order', () => {
  const root = makeDocs({
    'start.md': page('Start', 1),
    'guides/index.md': page('Guides', 1),
    'guides/use.md': page('Use', 2),
    'components/button.md': page('Button', 2),
    'components/accordion.md': page('Accordion', 1),
  });
  const { nav, sidebar } = readNavigation(root);
  assert.deepEqual(nav, [{ text: 'Start', link: '/start' }]);
  assert.deepEqual(sidebar, [
    { text: 'Overview', items: [{ text: 'Start', link: '/start' }] },
    {
      text: 'Components',
      items: [
        { text: 'Accordion', link: '/components/accordion' },
        { text: 'Button', link: '/components/button' },
      ],
    },
    {
      text: 'Guides',
      items: [
        { text: 'Guides', link: '/guides/' },
        { text: 'Use', link: '/guides/use' },
      ],
    },
  ]);
});

test('the groups Handbook, Components and Utils come first, and each other group follows in the sequence of its folder name', () => {
  const root = makeDocs({
    'utils/merge.md': page('Merge', 1),
    'guides/use.md': page('Use', 1),
    'components/button.md': page('Button', 1),
    'blog/post.md': page('Post', 1),
    'handbook/animation.md': page('Animation', 1),
  });
  assert.deepEqual(
    readNavigation(root).sidebar.map(({ text }) => text),
    ['Handbook', 'Components', 'Utils', 'Blog', 'Guides'],
  );
});

test('a docs folder with groups only has no group Overview', () => {
  const root = makeDocs({ 'components/button.md': page('Button', 1) });
  const { nav, sidebar } = readNavigation(root);
  assert.deepEqual(nav, []);
  assert.deepEqual(
    sidebar.map(({ text }) => text),
    ['Components'],
  );
});

for (const { name, files } of [
  { name: 'index.md of the docs folder', files: { 'index.md': '# Home\n' } },
  {
    name: 'a folder with no page in it',
    files: { 'examples/sample/Sample.md': page('Sample', 1) },
  },
  { name: 'a folder that starts with a dot', files: { '.vitepress/theme.md': page('Theme', 1) } },
  { name: 'the folder public', files: { 'public/page.md': page('Public', 1) } },
  { name: 'the folder node_modules', files: { 'node_modules/page.md': page('Module', 1) } },
  { name: 'a file that is not Markdown', files: { 'notes.txt': '# Notes\n' } },
]) {
  test(`the navigation leaves out ${name}`, () => {
    const root = makeDocs({ 'kept.md': page('Kept', 1), ...files });
    const items = [{ text: 'Kept', link: '/kept' }];
    assert.deepEqual(readNavigation(root), { nav: items, sidebar: [{ text: 'Overview', items }] });
  });
}

test('the title is the first heading after the front matter, not a comment in it', () => {
  const root = makeDocs({ 'use.md': '---\n# A comment.\norder: 1\n---\n\n# Use\n' });
  assert.deepEqual(readNavigation(root).nav, [{ text: 'Use', link: '/use' }]);
});

test('a page with no first-level heading throws and names the file', () => {
  const root = makeDocs({ 'guides/use.md': '---\norder: 1\n---\n\n## Use\n' });
  assert.throws(
    () => readNavigation(root),
    /^Error: docs\/guides\/use\.md: the page has no first-level heading\. Add one\./,
  );
});

for (const { name, text } of [
  { name: 'no front matter', text: '# Use\n' },
  { name: 'front matter with no order', text: '---\ndescription: Use it.\n---\n\n# Use\n' },
  { name: 'an order that is not a whole number', text: '---\norder: first\n---\n\n# Use\n' },
  { name: 'an order after the end of the front matter', text: '---\n---\n\norder: 1\n\n# Use\n' },
]) {
  test(`a listed page with ${name} throws and names the file`, () => {
    const root = makeDocs({ 'use.md': text });
    assert.throws(() => readNavigation(root), /^Error: docs\/use\.md: the page has no "order"/);
  });
}
