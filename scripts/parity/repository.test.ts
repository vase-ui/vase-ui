import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { readParityFiles } from './repository.ts';

const COMMIT = 'a'.repeat(40);

const UPSTREAM = JSON.stringify({
  commit: COMMIT,
  describe: 'v1.0.0',
  release: '1.0.0',
  components: ['button'],
  commits: [{ sha: COMMIT, date: '2026-01-01T00:00:00+00:00', subject: 'First', paths: [] }],
});

const FAMILY = JSON.stringify({
  upstreamPaths: ['packages/utils/src/**'],
  matchedCommit: COMMIT,
  exceptions: [],
  surfaceAdditions: [],
  returnTypeDifferences: [],
  notApplicableCommits: [],
});

function ownRecord(part: string): string {
  return JSON.stringify({
    standard: ['https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/'],
    reason: 'Base UI has no such component.',
    parts: [part],
  });
}

const roots: string[] = [];

after(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function readFiles(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'parity-files-'));
  roots.push(root);
  for (const [path, text] of Object.entries({ 'parity/upstream.json': UPSTREAM, ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return readParityFiles(root, { readExtracts: false });
}

test('the reader gives the record of each file in parity/own, with its name, in the sequence of the names', () => {
  const { ownComponents, families, problems } = readFiles({
    'parity/own/beta.json': ownRecord('Beta'),
    'parity/own/alpha.json': ownRecord('Alpha'),
  });
  assert.deepEqual(problems, []);
  assert.deepEqual(
    ownComponents.map(({ name, record }) => [name, record.parts]),
    [
      ['alpha', ['Alpha']],
      ['beta', ['Beta']],
    ],
  );
  assert.deepEqual(families, []);
});

test('a record with a problem gives the problem and is not read', () => {
  const { ownComponents, problems } = readFiles({ 'parity/own/alpha.json': '{}' });
  assert.deepEqual(ownComponents, []);
  assert.match(problems.join('\n'), /^parity\/own\/alpha\.json: needs the key "standard"\./);
});

test('a record whose file name is not a family name gives a problem and is not read', () => {
  const { ownComponents, problems } = readFiles({ 'parity/own/Alpha.json': ownRecord('Alpha') });
  assert.deepEqual(ownComponents, []);
  assert.deepEqual(problems, [
    'parity/own/Alpha.json: the family name "Alpha" must match /^[a-z][a-z0-9-]*$/. Rename the file.',
  ]);
});

test('a record and a family file with the same name give a problem, and the record is not read', () => {
  const { ownComponents, problems } = readFiles({
    'parity/families/alpha.json': FAMILY,
    'parity/own/alpha.json': ownRecord('Alpha'),
  });
  assert.deepEqual(ownComponents, []);
  assert.deepEqual(problems, [
    "parity/own/alpha.json: parity/families/alpha.json exists too. A component is a port or a component of Vase UI's own, not both. Delete one file.",
  ]);
});
