import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExtract, missingPaths, pathExists } from './extractFamily.ts';
import type { FamilyFile } from './parityFiles.ts';

const COMMIT = 'a'.repeat(40);

function makeFamily(...upstreamPaths: string[]): FamilyFile {
  return {
    upstreamPaths,
    matchedCommit: COMMIT,
    exceptions: [],
    surfaceAdditions: [],
    returnTypeDifferences: [],
    notApplicableCommits: [],
  };
}

const texts: Record<string, string> = {
  'packages/utils/src/clamp.ts': 'export const clamp = 1;',
  'packages/utils/src/clamp.test.ts': "describe('clamp', () => { it('clamps', () => {}); });",
  'packages/utils/src/clamp.spec.ts': 'export const typeTest = 1;',
  'packages/utils/src/types.d.ts': 'declare const x: number;',
  'packages/utils/src/prehydration.template.js': 'export const x = 1;',
  'packages/utils/src/store/Store.tsx': 'export const Store = 1;',
  'packages/utils/src/shared.tsx': "export function shared() { it('shared case', () => {}); }",
  'packages/react/src/dialog/Dialog.tsx': 'export const Dialog = 1;',
  'docs/src/app/(docs)/react/utils/clamp/types.md':
    '# Clamp\n\n## API Reference\n\n### clamp\n\n**Return Value:**\n\n```tsx\ntype ReturnValue = number;\n```\n',
  'docs/src/app/(docs)/react/utils/clamp/page.mdx': '# Clamp page',
  'README.md': '# Base UI',
};
const files = Object.keys(texts);
const read = (path: string): string => texts[path];

test('buildExtract sorts the files of a family into sources, type tests, cases and the surface', () => {
  const extract = buildExtract(
    makeFamily('packages/utils/src/**', 'docs/src/app/(docs)/react/utils/clamp/*'),
    files,
    read,
  );
  assert.equal(extract.commit, COMMIT);
  assert.deepEqual(extract.sources, [
    'packages/utils/src/clamp.ts',
    'packages/utils/src/prehydration.template.js',
    'packages/utils/src/shared.tsx',
    'packages/utils/src/store/Store.tsx',
    'packages/utils/src/types.d.ts',
  ]);
  assert.deepEqual(extract.typeTests, ['packages/utils/src/clamp.spec.ts']);
  assert.deepEqual(extract.cases, [
    {
      file: 'packages/utils/src/clamp.test.ts',
      rows: [{ describe: ['clamp'], title: 'clamps' }],
    },
    { file: 'packages/utils/src/shared.tsx', rows: [{ describe: [], title: 'shared case' }] },
  ]);
  assert.deepEqual(
    extract.surface.map(({ file, functions }) => [file, functions.map(({ name }) => name)]),
    [['docs/src/app/(docs)/react/utils/clamp/types.md', ['clamp']]],
  );
});

test('buildExtract leaves out a file that no glob names and a matching file outside the mapped roots', () => {
  const extract = buildExtract(makeFamily('packages/utils/src/clamp.*', 'README.md'), files, read);
  assert.deepEqual(extract.sources, ['packages/utils/src/clamp.ts']);
  assert.deepEqual(extract.typeTests, ['packages/utils/src/clamp.spec.ts']);
  assert.equal(extract.surface.length, 0);
});

test('buildExtract refuses a glob that matches no file', () => {
  assert.throws(
    () => buildExtract(makeFamily('packages/utils/src/**', 'packages/none/**'), files, read),
    {
      message: /The glob "packages\/none\/\*\*" matches no file at commit a+\./,
    },
  );
});

test('pathExists accepts a file and a folder with a file in it', () => {
  assert.equal(pathExists(files, 'packages/utils/src/clamp.ts'), true);
  assert.equal(pathExists(files, 'packages/utils/src/store'), true);
  assert.equal(pathExists(files, 'packages/utils/src/clam'), false);
  assert.equal(pathExists(files, 'packages/utils/src/none.ts'), false);
});

test('missingPaths gives one line for each path that does not exist', () => {
  assert.deepEqual(
    missingPaths(COMMIT, files, [
      { place: 'a.json: exceptions[0]', path: 'packages/utils/src/clamp.ts' },
      { place: 'a.json: exceptions[1]', path: 'packages/utils/src/none.ts' },
    ]),
    [
      `a.json: exceptions[1]: "packages/utils/src/none.ts" does not exist in Base UI at commit ${COMMIT}. Correct the path.`,
    ],
  );
});
