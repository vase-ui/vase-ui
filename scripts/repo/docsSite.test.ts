import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';

test('`base` of the site is `/`', () => {
  const config = readRepositoryFile(REPOSITORY_ROOT, 'docs/.vitepress/config.ts');
  // Two spaces: a property of the object that `defineConfig` gets.
  const values = [...config.matchAll(/^ {2}base: (.*),$/gm)].map(([, value]) => value);
  assert.deepEqual(values, ["'/'"]);
});

test('docs/public has no CNAME file', () => {
  assert.ok(!existsSync(join(REPOSITORY_ROOT, 'docs', 'public', 'CNAME')));
});
