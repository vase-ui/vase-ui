import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { familyOfPage, listFamilyPages } from './familyPages.ts';

const roots: string[] = [];

after(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeDocs(paths: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'family-pages-'));
  roots.push(root);
  for (const path of paths) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), '# Page\n');
  }
  return root;
}

test('a page in the components folder is a family page', () => {
  const root = makeDocs(['components/button.md', 'components/accordion.md']);
  assert.deepEqual(
    listFamilyPages(root).sort((a, b) => a.path.localeCompare(b.path)),
    [
      { path: 'components/accordion.md', family: 'accordion' },
      { path: 'components/button.md', family: 'button' },
    ],
  );
});

test('a page in another folder, a top-level page and a sample folder are not family pages', () => {
  const root = makeDocs([
    'guides/button.md',
    'quick-start.md',
    'components/button/Anatomy.vue',
    'components/button/notes.md',
    'components/button.md',
  ]);
  assert.deepEqual(listFamilyPages(root), [{ path: 'components/button.md', family: 'button' }]);
});

test('a docs folder with no components folder has no family page', () => {
  assert.deepEqual(listFamilyPages(makeDocs(['quick-start.md'])), []);
});

for (const { path, family } of [
  { path: 'components/button.md', family: 'button' },
  { path: 'components/merge-props.md', family: 'merge-props' },
  { path: 'components/button/notes.md', family: undefined },
  { path: 'guides/button.md', family: undefined },
  { path: 'quick-start.md', family: undefined },
]) {
  test(`familyOfPage gives ${family ?? 'nothing'} for ${path}`, () => {
    assert.equal(familyOfPage(path), family);
  });
}
