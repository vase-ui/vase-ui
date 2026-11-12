import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { UpstreamFile } from './parityFiles.ts';
import { buildUpstream } from './track.ts';
import { listFiles, readFileAt } from './upstreamClone.ts';

const DATE = '2026-01-02T03:04:05+01:00';
const repository = mkdtempSync(join(tmpdir(), 'parity-track-'));
after(() => rmSync(repository, { recursive: true, force: true }));

// The machine may sign commits through its own configuration. The test must not.
function git(...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-C', repository, ...args],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_SYSTEM: '/dev/null',
        GIT_COMMITTER_DATE: DATE,
        GIT_AUTHOR_DATE: DATE,
      },
    },
  ).trim();
}

function commit(subject: string): string {
  git('add', '--all');
  git('commit', '--message', subject);
  return git('rev-parse', 'HEAD');
}

git('init', '--initial-branch', 'main');
writeFileSync(join(repository, 'seed.txt'), 'seed');
commit('Root');
writeFileSync(join(repository, 'a.txt'), 'one');
mkdirSync(join(repository, 'docs'));
writeFileSync(join(repository, 'docs', 'x.md'), 'doc');
const start = commit('Start');
git('tag', 'v1.0.0');
git('mv', 'a.txt', 'b.txt');
const rename = commit('Rename');
writeFileSync(join(repository, 'b.txt'), 'two');
const change = commit('Change');

const current: UpstreamFile = {
  commit: start,
  describe: 'old',
  release: '0',
  commits: [{ sha: start, date: 'old', subject: 'old', paths: [] }],
};

test('buildUpstream lists the commits from the start commit, with the two paths of a rename', () => {
  const built = buildUpstream(repository, change, current);
  assert.deepEqual(built.commits, [
    { sha: start, date: DATE, subject: 'Start', paths: ['a.txt', 'docs/x.md'] },
    { sha: rename, date: DATE, subject: 'Rename', paths: ['a.txt', 'b.txt'] },
    { sha: change, date: DATE, subject: 'Change', paths: ['b.txt'] },
  ]);
  assert.equal(built.commit, change);
});

test('buildUpstream builds describe and release from the nearest tag', () => {
  const built = buildUpstream(repository, change, current);
  assert.equal(built.describe, `v1.0.0-2-g${change.slice(0, 8)}`);
  assert.equal(built.release, '1.0.0');
});

test('buildUpstream gives the tag as describe on the tagged commit', () => {
  const built = buildUpstream(repository, start, current);
  assert.equal(built.describe, 'v1.0.0');
  assert.deepEqual(
    built.commits.map(({ sha }) => sha),
    [start],
  );
});

test('buildUpstream accepts a short name of a commit and gives the full sha', () => {
  assert.equal(buildUpstream(repository, change.slice(0, 10), current).commit, change);
});

test('buildUpstream refuses a move to an older commit', () => {
  const later: UpstreamFile = { ...current, commit: change };
  assert.throws(() => buildUpstream(repository, rename, later), {
    message: new RegExp(
      `Commit ${rename} is not the tracked commit ${change} or a descendant of it\\.`,
    ),
  });
});

test('buildUpstream refuses a commit that the clone does not have, and says to fetch', () => {
  assert.throws(() => buildUpstream(repository, 'f'.repeat(40), current), {
    message: /has no commit f+\. Run `git fetch` in the clone/,
  });
});

test('buildUpstream refuses a folder that is not a git repository, and does not say to fetch', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'parity-plain-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  assert.throws(() => buildUpstream(folder, change, current), {
    message: `${folder} is not a git clone. Pass the path of a local clone of Base UI in --upstream.`,
  });
});

test('a file is read at the named commit when the working tree has other text', () => {
  writeFileSync(join(repository, 'b.txt'), 'other text in the working tree');
  assert.equal(readFileAt(repository, change, 'b.txt'), 'two');
  assert.equal(readFileAt(repository, rename, 'b.txt'), 'one');
  assert.deepEqual(listFiles(repository, change), ['b.txt', 'docs/x.md', 'seed.txt']);
});
