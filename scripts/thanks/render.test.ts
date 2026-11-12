import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseContributorRows } from './github.ts';
import {
  automationRule,
  profileLink,
  PROJECTS,
  renderThanks,
  selectUnlinkedPeople,
  sortContributors,
} from './render.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const REPOSITORY = 'first-org/first-project';
const FIRST_PROJECT = {
  repository: REPOSITORY,
  title: 'First Project',
  relation: 'Vase UI is a port of First Project.',
  commit: '0123456789abcdef0123456789abcdef01234567',
};
const EMAIL = 'first-example@example.test';

const LINKED_ROW = { login: 'first-example', type: 'User', contributions: 9, node_id: 'NODE_ONE' };
const ANONYMOUS_ROW = { type: 'Anonymous', name: 'Second Example', email: EMAIL, contributions: 3 };

test('parseContributorRows gives a name and a number of commits for a person with no account', () => {
  assert.deepEqual(parseContributorRows([ANONYMOUS_ROW, LINKED_ROW], REPOSITORY), {
    contributors: [LINKED_ROW],
    unlinkedAuthors: [{ name: 'Second Example', contributions: 3 }],
  });
});

test('parseContributorRows does not keep the e-mail address of a person with no account', () => {
  const text = JSON.stringify(parseContributorRows([LINKED_ROW, ANONYMOUS_ROW], REPOSITORY));
  assert.ok(!text.includes('example.test'));
});

for (const { name, rows } of [
  { name: 'rows that are not a list', rows: { rows: [LINKED_ROW] } },
  { name: 'a person with no account and no name', rows: [{ ...ANONYMOUS_ROW, name: undefined }] },
  {
    name: 'a person with no account and no number of commits',
    rows: [{ ...ANONYMOUS_ROW, contributions: undefined }],
  },
  { name: 'an account with no node id', rows: [{ ...LINKED_ROW, node_id: undefined }] },
]) {
  test(`parseContributorRows throws for ${name} and names the project`, () => {
    assert.throws(
      () => parseContributorRows(rows, REPOSITORY),
      (error) =>
        error instanceof Error &&
        error.message.includes(REPOSITORY) &&
        !error.message.includes('example.test'),
    );
  });
}

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

const keys = (list: ({ login: string } | { name: string })[]) =>
  list.map((person) => ('login' in person ? person.login : person.name));

test('sortContributors puts a person with no account among linked people by commits and name', () => {
  const sorted = sortContributors([
    { login: 'D-example', contributions: 5 },
    { login: 'a-example', contributions: 1 },
    { name: 'C Example', contributions: 5 },
    { name: 'Third Example', contributions: 7 },
    { login: 'b-example', name: 'Z Example', contributions: 5 },
    { name: 'A Example', contributions: 5 },
  ]);
  assert.deepEqual(keys(sorted), [
    'Third Example',
    'A Example',
    'b-example',
    'C Example',
    'D-example',
    'a-example',
  ]);
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

const REJECTED_NAMES = [
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
];

for (const { name, displayName } of [
  { name: 'no name', displayName: null },
  { name: 'an empty name', displayName: '' },
  { name: 'a name of white space only', displayName: ' \t ' },
  ...REJECTED_NAMES,
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

const unlinked = (name: string, contributions = 1) => ({ name, contributions });
const FIRST_LINKED = { login: 'first-example', name: 'First Example' };
const NO_REMOVALS = { automation: 0, sameAsLinked: 0, notPlainText: 0, mergedByName: 0 };

for (const { name, author } of [
  { name: 'a name that ends with [bot]', author: 'first-example[bot]' },
  { name: 'a name of automation with no [bot] ending', author: 'dependabot' },
  { name: 'a name of automation in other letter case', author: 'Renovate' },
  { name: 'a login of AUTOMATION_LOGINS', author: 'l10nbot' },
]) {
  test(`selectUnlinkedPeople removes ${name}`, () => {
    assert.deepEqual(selectUnlinkedPeople([unlinked(author)], []), {
      people: [],
      ...NO_REMOVALS,
      automation: 1,
    });
  });
}

for (const { name, author, linked } of [
  { name: 'the display name of a linked person', author: 'First Example', linked: FIRST_LINKED },
  {
    name: 'the display name of a linked person with extra white space',
    author: 'First Example',
    linked: { login: 'first-example', name: ' First \t Example ' },
  },
  {
    name: 'the login of a linked person in other letter case',
    author: 'First-Example',
    linked: { login: 'first-example', name: null },
  },
  {
    name: 'a display name that the page does not show',
    author: 'First <b>Example</b>',
    linked: { login: 'first-example', name: 'First <b>Example</b>' },
  },
]) {
  test(`selectUnlinkedPeople removes a name equal to ${name}`, () => {
    assert.deepEqual(selectUnlinkedPeople([unlinked(author)], [linked]), {
      people: [],
      ...NO_REMOVALS,
      sameAsLinked: 1,
    });
  });
}

test('selectUnlinkedPeople does not take an empty name for the empty display name of a person', () => {
  assert.deepEqual(
    selectUnlinkedPeople([unlinked(' \t ')], [{ login: 'first-example', name: null }]),
    { people: [], ...NO_REMOVALS, notPlainText: 1 },
  );
});

for (const { name, author } of [
  { name: 'a name that is an e-mail address', author: EMAIL },
  { name: 'an empty name', author: '' },
  { name: 'a name of white space only', author: ' \t ' },
  ...REJECTED_NAMES.map(({ name, displayName }) => ({ name, author: displayName })),
  { name: 'a dot after a number', author: '1. Example' },
  { name: 'a dot before a letter in a domain name', author: 'www.example.com' },
  { name: 'a dot between two words', author: 'first.example' },
  { name: 'dots between numbers', author: '1.2.3.4' },
]) {
  test(`selectUnlinkedPeople removes ${name}`, () => {
    assert.deepEqual(selectUnlinkedPeople([unlinked(author)], [FIRST_LINKED]), {
      people: [],
      ...NO_REMOVALS,
      notPlainText: 1,
    });
  });
}

for (const { name, author } of [
  { name: 'a dot at the end', author: 'Example Jr.' },
  { name: 'a dot before a space', author: 'F. Example' },
  { name: 'a dot after a letter with a combining mark', author: 'Jose\u0301. Example' },
]) {
  test(`selectUnlinkedPeople lists a name with ${name}`, () => {
    assert.deepEqual(selectUnlinkedPeople([unlinked(author, 4)], [FIRST_LINKED]), {
      people: [unlinked(author, 4)],
      ...NO_REMOVALS,
    });
  });
}

test('selectUnlinkedPeople lists each other name with its commits and extra white space removed', () => {
  assert.deepEqual(
    selectUnlinkedPeople([unlinked(' Third \t Example', 4), unlinked('Fourth Example', 2)], []),
    { people: [unlinked('Third Example', 4), unlinked('Fourth Example', 2)], ...NO_REMOVALS },
  );
});

for (const { name, authors, person } of [
  {
    name: 'the spelling of the entry with more commits',
    authors: [unlinked('Third Example', 2), unlinked('third EXAMPLE', 3)],
    person: unlinked('third EXAMPLE', 5),
  },
  {
    name: 'the first spelling by code units for equal commits',
    authors: [unlinked('third example', 2), unlinked('Third Example', 2)],
    person: unlinked('Third Example', 4),
  },
  {
    name: 'names that differ only in white space',
    authors: [unlinked(' Third  Example', 1), unlinked('Third Example\t', 1)],
    person: unlinked('Third Example', 2),
  },
]) {
  test(`selectUnlinkedPeople merges two entries with one name and keeps ${name}`, () => {
    for (const input of [authors, [...authors].reverse()]) {
      assert.deepEqual(selectUnlinkedPeople(input, []), {
        people: [person],
        ...NO_REMOVALS,
        mergedByName: 1,
      });
    }
  });
}

test('selectUnlinkedPeople counts each author once, by the first rule that removes it', () => {
  assert.deepEqual(
    selectUnlinkedPeople(
      [
        unlinked('renovate'),
        unlinked('First Example'),
        unlinked('First <b>Example</b>'),
        unlinked('Third Example', 4),
        unlinked('third example', 2),
      ],
      [FIRST_LINKED, { login: 'renovate', name: null }],
    ),
    {
      people: [unlinked('Third Example', 6)],
      automation: 1,
      sameAsLinked: 1,
      notPlainText: 1,
      mergedByName: 1,
    },
  );
});

test('renderThanks writes the whole file', () => {
  const text = renderThanks({
    readOn: '2026-01-02',
    projects: [
      {
        ...FIRST_PROJECT,
        people: [FIRST_LINKED, { name: 'Third Example' }, { login: 'second-example', name: null }],
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

Each list is GitHub's contributor list of the project, read on \`2026-01-02\` (UTC). A list starts with the person who has the most commits. People with the same number of commits are in the sequence of their account names. A list does not have automation. GitHub links the commits of some people to no account. A list shows each of these people by the name in their commits, with no link. The sequence uses that name for a person who has no account name. A list does not have such a name when the page cannot show it as plain text.

## First Project

The contributors of [first-org/first-project](https://github.com/first-org/first-project) at commit \`0123456789abcdef0123456789abcdef01234567\`. Vase UI is a port of First Project.

- [First Example](https://github.com/first-example)
- Third Example
- [second-example](https://github.com/second-example)

## Second Project

The contributors of [second-org/second-project](https://github.com/second-org/second-project) at commit \`fedcba9876543210fedcba9876543210fedcba98\`. Base UI ported \`markOthers\` from Second Project.

- [First Example](https://github.com/first-example)

<!-- #endregion thanks -->
`,
  );
  assert.ok(!text.includes('@'));
});

for (const { name, text } of [
  { name: 'markup', text: 'Third <b>Example</b>' },
  { name: 'an e-mail address', text: EMAIL },
  { name: 'a dot after a number', text: '1. Example' },
  { name: 'a dot before a letter in a domain name', text: 'www.example.com' },
]) {
  test(`renderThanks throws for a name with no link that has ${name}, and names the project`, () => {
    assert.throws(
      () =>
        renderThanks({
          readOn: '2026-01-02',
          projects: [{ ...FIRST_PROJECT, people: [{ name: text }] }],
        }),
      (error) =>
        error instanceof Error &&
        error.message.includes(REPOSITORY) &&
        !error.message.includes(text),
    );
  });
}

// VitePress copies the region into the site page. It allows HTML in the page and compiles the page
// as a Vue template. A line that the script does not write, such as raw HTML or `{{ }}`, then
// reaches the site. GitHub folds the diff of a generated file such as THANKS.md, so a reviewer can
// miss such a line.
// This test writes the file again from the date, the commits and the people that it holds, and
// compares the two texts. The date and the commits go into the new text as they are, so their
// patterns must stay strict. A text goes through `profileLink` or, for a line that is not a
// profile link, through the test of `renderThanks` for a name with no link. Their patterns can be
// wide.
test('THANKS.md has only what renderThanks writes', () => {
  const text = readFileSync(join(ROOT, 'THANKS.md'), 'utf8');
  const [start, ...sections] = text.split('\n## ');
  const projects = PROJECTS.map((project, index) => {
    const section = sections[index] ?? '';
    return {
      ...project,
      commit: /at commit `([0-9a-f]{40})`/.exec(section)?.[1] ?? '',
      people: [...section.matchAll(/^- (.*)$/gm)].map(([, item]) => {
        const link = /^\[(.+)\]\(https:\/\/github\.com\/([A-Za-z0-9-]+)\)$/.exec(item);
        return link ? { login: link[2], name: link[1] } : { name: item };
      }),
    };
  });
  const readOn = /read on `(\d{4}-\d{2}-\d{2})`/.exec(start)?.[1] ?? '';
  assert.deepEqual(text.split('\n'), renderThanks({ readOn, projects }).split('\n'));
});

test('docs/thanks.md includes the region thanks of THANKS.md', () => {
  const page = readFileSync(join(ROOT, 'docs', 'thanks.md'), 'utf8');
  assert.match(page, /<!--\s*@include:\s*\.\.\/THANKS\.md#thanks\s*-->/);
});
