import assert from 'node:assert/strict';
import { test } from 'node:test';
import { titleProblem } from './checkTitle.ts';

const accepted = [
  'feat(separator): add Separator',
  'fix: treat an empty id as no id in every part',
  'docs(handbook-forms): add the page',
  'feat(dialog)!: remove the prop `modal`',
  'refactor!: rename each export',
  // The commit of a pull request in the merge queue.
  'feat(separator): add Separator (#12)',
];

for (const title of accepted) {
  test(`titleProblem accepts "${title}"`, () => {
    assert.equal(titleProblem(title), undefined);
  });
}

const refused: { name: string; title: string }[] = [
  { name: 'a type that is not in the list', title: 'feature(separator): add Separator' },
  { name: 'a type with a capital letter', title: 'Feat(separator): add Separator' },
  { name: 'no type', title: 'Add Separator' },
  { name: 'no space after the colon', title: 'feat(separator):add Separator' },
  { name: 'two spaces after the colon', title: 'feat(separator):  add Separator' },
  { name: 'no description', title: 'feat(separator): ' },
  { name: 'an empty scope', title: 'feat(): add Separator' },
  { name: 'a scope with a capital letter', title: 'feat(Separator): add Separator' },
  { name: 'a scope with two hyphens in a row', title: 'feat(alert--dialog): add AlertDialog' },
  { name: 'a scope with a hyphen at its end', title: 'feat(dialog-): add Dialog' },
  { name: 'two scopes', title: 'feat(dialog,popover): add the prop' },
  { name: 'a space before the type', title: ' feat(separator): add Separator' },
  {
    name: 'the title that GitHub gives to a revert',
    title: 'Revert "feat(separator): add Separator"',
  },
];

for (const { name, title } of refused) {
  test(`titleProblem refuses ${name}`, () => {
    assert.match(titleProblem(title) ?? '', /is not a Conventional Commit/);
  });
}
