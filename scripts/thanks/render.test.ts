import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { automationRule, profileLink, PROJECTS, renderThanks, sortContributors } from './render.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const REPOSITORY = 'first-org/first-project';

for (const { name, login, type, rule } of [
  { name: 'a Bot type', login: 'first-example', type: 'Bot', rule: 'its type is Bot' },
  {
    name: 'a login that ends with [bot]',
    login: 'first-example[bot]',
    type: 'User',
    rule: 'its login ends with [bot]',
  },
  {
    name: 'a login of AUTOMATION_LOGINS',
    login: 'l10nbot',
    type: 'User',
    rule: 'its login is in AUTOMATION_LOGINS',
  },
  {
    name: 'a login of AUTOMATION_LOGINS in other letter case',
    login: 'L10nBot',
    type: 'User',
    rule: 'its login is in AUTOMATION_LOGINS',
  },
]) {
  test(`automationRule removes ${name}`, () => {
    assert.equal(automationRule({ login, type }), rule);
  });
}

for (const { name, login } of [
  { name: 'a login that starts with bot', login: 'Bot-example' },
  { name: 'a login that has bot inside', login: 'robot-example' },
  { name: 'a login that ends with -bot', login: 'example-bot' },
]) {
  test(`automationRule keeps a User with ${name}`, () => {
    assert.equal(automationRule({ login, type: 'User' }), undefined);
  });
}

const logins = (list: { login: string }[]) => list.map(({ login }) => login);

test('sortContributors puts more commits first', () => {
  const sorted = sortContributors([
    { login: 'a-example', contributions: 1 },
    { login: 'b-example', contributions: 9 },
    { login: 'c-example', contributions: 5 },
  ]);
  assert.deepEqual(logins(sorted), ['b-example', 'c-example', 'a-example']);
});

test('sortContributors puts equal commits in the sequence of the lower-case login', () => {
  const sorted = sortContributors([
    { login: 'Z-example', contributions: 5 },
    { login: 'b-example', contributions: 5 },
    { login: 'A-example', contributions: 5 },
  ]);
  assert.deepEqual(logins(sorted), ['A-example', 'b-example', 'Z-example']);
});

test('sortContributors gives the same result for each sequence of the input', () => {
  const contributors = [
    { login: 'b-example', contributions: 5 },
    { login: 'Z-example', contributions: 5 },
    { login: 'a-example', contributions: 5 },
    { login: 'c-example', contributions: 9 },
    { login: 'd-example', contributions: 1 },
  ];
  const expected = ['c-example', 'a-example', 'b-example', 'Z-example', 'd-example'];
  for (const input of [
    contributors,
    [...contributors].reverse(),
    [...contributors.slice(2), ...contributors.slice(0, 2)],
  ]) {
    assert.deepEqual(logins(sortContributors(input)), expected);
  }
});

for (const { name, displayName, text } of [
  { name: 'a plain name', displayName: 'First Example', text: 'First Example' },
  {
    name: 'a name with a dot, an apostrophe, a typographic apostrophe and a hyphen',
    displayName: "First O'Example-Second O’Example Jr.",
    text: "First O'Example-Second O’Example Jr.",
  },
  {
    name: 'a name with a combining mark',
    displayName: 'First Example\u0301',
    text: 'First Example\u0301',
  },
  { name: 'a name in another script', displayName: 'Первый Пример', text: 'Первый Пример' },
  { name: 'a name with numbers', displayName: '1st Example 2', text: '1st Example 2' },
  {
    name: 'a name with extra white space',
    displayName: '  First \t Example\n',
    text: 'First Example',
  },
]) {
  test(`profileLink uses the display name for ${name}`, () => {
    assert.equal(
      profileLink({ login: 'first-example', name: displayName }, REPOSITORY),
      `[${text}](https://github.com/first-example)`,
    );
  });
}

for (const { name, displayName } of [
  { name: 'no name', displayName: null },
  { name: 'an empty name', displayName: '' },
  { name: 'a name of white space only', displayName: ' \t ' },
  { name: 'a name with @', displayName: 'First @ Example' },
  { name: 'a name with {{', displayName: 'First {{ Example }}' },
  { name: 'a name with <', displayName: 'First <b>Example</b>' },
  { name: 'a name with ]', displayName: 'First] Example' },
  { name: 'a name with an emoji', displayName: 'First \u{1F642}' },
  { name: 'a name with *', displayName: '*First* Example' },
  { name: 'a name with a backtick', displayName: 'First `Example`' },
  { name: 'a name with &', displayName: 'First &amp; Example' },
  { name: 'a name with a quotation mark', displayName: 'First "Example" Second' },
  { name: 'a name that starts with a hyphen', displayName: '-First Example' },
]) {
  test(`profileLink uses the login for ${name}`, () => {
    assert.equal(
      profileLink({ login: 'first-example', name: displayName }, REPOSITORY),
      '[first-example](https://github.com/first-example)',
    );
  });
}

for (const login of ['first_example', 'first example', 'first/example', '']) {
  test(`profileLink throws for the login ${JSON.stringify(login)} and names the project`, () => {
    assert.throws(
      () => profileLink({ login, name: null }, REPOSITORY),
      (error) => error instanceof Error && error.message.includes(REPOSITORY),
    );
  });
}

test('renderThanks writes the whole file', () => {
  const text = renderThanks({
    readOn: '2026-01-02',
    projects: [
      {
        repository: 'first-org/first-project',
        title: 'First Project',
        relation: 'Vase UI is a port of First Project.',
        commit: '0123456789abcdef0123456789abcdef01234567',
        people: [
          { login: 'first-example', name: 'First Example' },
          { login: 'second-example', name: null },
        ],
      },
      {
        repository: 'second-org/second-project',
        title: 'Second Project',
        relation: 'Base UI ported `markOthers` from Second Project.',
        commit: 'fedcba9876543210fedcba9876543210fedcba98',
        people: [{ login: 'first-example', name: 'First Example' }],
      },
    ],
  });
  assert.equal(
    text,
    `# Thanks

<!-- #region thanks -->

Vase UI is a port, so the people on this page did the hard part before we started. They spent years on focus management, screen readers and browser bugs. We carried their work across, and we thank each of them.

Each list is GitHub's contributor list of the project, read on \`2026-01-02\` (UTC). A list starts with the person who has the most commits. People with the same number of commits are in the sequence of their account names. A list does not have automation accounts. It also does not have a person whose commits GitHub links to no account.

## First Project

The contributors of [first-org/first-project](https://github.com/first-org/first-project) at commit \`0123456789abcdef0123456789abcdef01234567\`. Vase UI is a port of First Project.

- [First Example](https://github.com/first-example)
- [second-example](https://github.com/second-example)

## Second Project

The contributors of [second-org/second-project](https://github.com/second-org/second-project) at commit \`fedcba9876543210fedcba9876543210fedcba98\`. Base UI ported \`markOthers\` from Second Project.

- [First Example](https://github.com/first-example)

<!-- #endregion thanks -->
`,
  );
  assert.ok(!text.includes('@'));
});

// VitePress copies the region into the site page. It allows HTML in the page and compiles the page
// as a Vue template. A line that the script does not write, such as raw HTML or `{{ }}`, then
// reaches the site. GitHub folds the diff of a generated file such as THANKS.md, so a reviewer can
// miss such a line.
// This test writes the file again from the date, the commits and the people that it holds, and
// compares the two texts. The date and the commits go into the new text as they are, so their
// patterns must stay strict. A text goes through `profileLink`, so its pattern can be wide.
test('THANKS.md has only what renderThanks writes', () => {
  const text = readFileSync(join(ROOT, 'THANKS.md'), 'utf8');
  const [start, ...sections] = text.split('\n## ');
  const projects = PROJECTS.map((project, index) => {
    const section = sections[index] ?? '';
    return {
      ...project,
      commit: /at commit `([0-9a-f]{40})`/.exec(section)?.[1] ?? '',
      people: [...section.matchAll(/^- \[(.+)\]\(https:\/\/github\.com\/([A-Za-z0-9-]+)\)$/gm)].map(
        ([, name, login]) => ({ login, name }),
      ),
    };
  });
  const readOn = /read on `(\d{4}-\d{2}-\d{2})`/.exec(start)?.[1] ?? '';
  assert.deepEqual(text.split('\n'), renderThanks({ readOn, projects }).split('\n'));
});

test('docs/thanks.md includes the region thanks of THANKS.md', () => {
  const page = readFileSync(join(ROOT, 'docs', 'thanks.md'), 'utf8');
  assert.match(page, /<!--\s*@include:\s*\.\.\/THANKS\.md#thanks\s*-->/);
});
