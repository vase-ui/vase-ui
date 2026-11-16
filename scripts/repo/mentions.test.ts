import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import { mentionsOf } from './mentions.ts';

const rows: { name: string; markdown: string; mentions: string[] }[] = [
  { name: 'a name in a sentence', markdown: 'Thanks to @octocat.', mentions: ['@octocat'] },
  { name: 'a name with a hyphen', markdown: '- By @octo-cat', mentions: ['@octo-cat'] },
  { name: 'a name with a capital letter', markdown: 'Thanks to @OctoCat.', mentions: ['@OctoCat'] },
  {
    name: 'two names in a sentence',
    markdown: 'Thanks to @octocat and @hubot.',
    mentions: ['@octocat', '@hubot'],
  },
  {
    name: 'a name in a cell of a table',
    markdown: '| a |\n| - |\n| @octocat |',
    mentions: ['@octocat'],
  },
  {
    name: 'a name in the text of a link',
    markdown: '[@octocat](https://github.com/octocat)',
    mentions: ['@octocat'],
  },
  { name: 'a name in quotation marks', markdown: 'The "@see" comment.', mentions: ['@see'] },
  { name: 'a code span', markdown: 'The `@see` comment.', mentions: [] },
  { name: 'a code block', markdown: '```vue\n<button @click="close" />\n```', mentions: [] },
  { name: 'the name of a package', markdown: 'Install @vase-ui/vue.', mentions: [] },
  { name: 'a version of a package', markdown: 'Use vue@3.5.12 or pnpm@latest.', mentions: [] },
  { name: 'an email address', markdown: 'Write to security@example.com.', mentions: [] },
  {
    name: 'an address with an at sign in its path',
    markdown: '<https://example.com/@octocat>',
    mentions: [],
  },
];

for (const { name, markdown, mentions } of rows) {
  test(`mentionsOf: ${name}`, () => {
    assert.deepEqual(mentionsOf(markdown), mentions);
  });
}

// The list has each Markdown file that git tracks or that is new, and no ignored file.
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.md'],
  { cwd: REPOSITORY_ROOT, encoding: 'utf8' },
)
  .split('\0')
  .filter((file) => file !== '' && existsSync(join(REPOSITORY_ROOT, file)));

test('no Markdown file names an account with an at sign', () => {
  assert.deepEqual(
    files.flatMap((file) =>
      mentionsOf(readRepositoryFile(REPOSITORY_ROOT, file)).map((name) => `${file}: ${name}`),
    ),
    [],
  );
});
