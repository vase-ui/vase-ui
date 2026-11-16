import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import { workspaceExceptions } from './workspaceExceptions.ts';

const WORKSPACE = `allowBuilds:
  # The reason of the first entry.
  first: false
  second: true
  third: true # The reason of the third entry.

  # A comment before an empty line.

  fourth: false
# A comment of the next setting.
minimumReleaseAgeExclude:
  - first@1.0.0
  # The reason of the second release.
  - second@2.0.0
packages:
  # A comment of a setting that is not an exception.
  - docs
`;

test('workspaceExceptions gives each entry of the two settings, and says which has a comment', () => {
  assert.deepEqual(workspaceExceptions(WORKSPACE), [
    { setting: 'allowBuilds', entry: 'first: false', hasComment: true },
    { setting: 'allowBuilds', entry: 'second: true', hasComment: false },
    { setting: 'allowBuilds', entry: 'third: true', hasComment: true },
    { setting: 'allowBuilds', entry: 'fourth: false', hasComment: false },
    { setting: 'minimumReleaseAgeExclude', entry: 'first@1.0.0', hasComment: false },
    { setting: 'minimumReleaseAgeExclude', entry: 'second@2.0.0', hasComment: true },
  ]);
});

for (const line of ['allowBuilds: { esbuild: true }', 'minimumReleaseAgeExclude: [vue]']) {
  test(`workspaceExceptions refuses the line "${line}"`, () => {
    assert.throws(() => workspaceExceptions(`${line}\n`), /on a line of its own/);
  });
}

const exceptions = workspaceExceptions(readRepositoryFile(REPOSITORY_ROOT, 'pnpm-workspace.yaml'));

test('each exception of pnpm-workspace.yaml has a comment', () => {
  assert.deepEqual(
    exceptions.filter((exception) => !exception.hasComment),
    [],
  );
});

for (const name of ['esbuild', 'vue-demi']) {
  test(`pnpm-workspace.yaml denies the install script of ${name}`, () => {
    assert.ok(
      exceptions.some(
        ({ setting, entry }) => setting === 'allowBuilds' && entry === `${name}: false`,
      ),
    );
  });
}
