import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempDisposableSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('compares the recorded base and head when the merge ref advances', () => {
  using temporary = mkdtempDisposableSync(join(tmpdir(), 'size-merge-'));
  const origin = join(temporary.path, 'origin');
  const checkout = join(temporary.path, 'checkout');
  mkdirSync(origin);
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  };
  function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: 'pipe' }).trim();
  }
  function commit(file: string): string {
    writeFileSync(join(origin, file), file);
    git(origin, 'add', file);
    git(origin, 'commit', '--no-gpg-sign', '-qm', file);
    return git(origin, 'rev-parse', 'HEAD');
  }

  git(origin, 'init', '--quiet', '--initial-branch=base');
  commit('common');
  git(origin, 'switch', '--quiet', '-c', 'topic');
  const head = commit('change');
  git(origin, 'switch', '--quiet', 'base');
  const base = commit('base');
  const later = commit('later');
  git(origin, 'merge', '--no-gpg-sign', '--no-ff', '--no-edit', 'topic');
  git(temporary.path, 'clone', '--quiet', '--depth=2', pathToFileURL(origin).href, checkout);

  const script = fileURLToPath(new URL('./merge.sh', import.meta.url));
  execFileSync('bash', [script, later, head], { cwd: checkout });
  assert.equal(git(checkout, 'rev-parse', '--is-shallow-repository'), 'true');
  assert.equal(git(checkout, 'ls-files'), 'base\nchange\ncommon\nlater');
  assert.throws(() => git(checkout, 'cat-file', '-e', `${base}^{commit}`));

  execFileSync('bash', [script, base, head], { cwd: checkout });
  assert.deepEqual(
    readdirSync(checkout)
      .filter((file) => file !== '.git')
      .sort(),
    ['base', 'change', 'common'],
  );
  assert.equal(
    git(checkout, 'rev-parse', `${base}^{tree}`),
    git(origin, 'rev-parse', `${base}^{tree}`),
  );
});
