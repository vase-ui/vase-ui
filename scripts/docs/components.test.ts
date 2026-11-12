import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExceptionRow, FamilyFile } from '../parity/parityFiles.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import { countComponents, isCompleteFamily, isComponentFamily } from './components.ts';

const BUTTON_PATHS = [
  'packages/react/src/button/**',
  'docs/src/app/(docs)/react/components/button/**',
];

function makeFamily(upstreamPaths: string[], exceptions: ExceptionRow[] = []): FamilyFile {
  return {
    upstreamPaths,
    matchedCommit: 'a'.repeat(40),
    exceptions,
    surfaceAdditions: [],
    returnTypeDifferences: [],
    notApplicableCommits: [],
  };
}

function makeFiles(name: string, family?: FamilyFile): FamilyFiles {
  return { name, family, hasFamilyFile: family !== undefined, hasExtract: true };
}

const WAITING_FOR = 'packages/react/src/select/root/SelectRoot.tsx';
const BUTTON_TEST = 'packages/react/src/button/Button.test.tsx';
const TYPES_MD = 'docs/src/app/(docs)/react/components/button/types.md';

function makeRow(upstream: string, rest: Partial<ExceptionRow> = {}): ExceptionRow {
  return { upstream, kind: 'waits-on', reason: 'A reason.', ...rest };
}

test('a family with a path under the components docs is a component', () => {
  assert.equal(isComponentFamily(makeFamily(BUTTON_PATHS)), true);
});

for (const { name, paths } of [
  { name: 'a family with source paths only', paths: ['packages/utils/src/**'] },
  {
    name: 'a family with a utility docs path',
    paths: ['docs/src/app/(docs)/react/utils/csp-provider/**'],
  },
]) {
  test(`${name} is not a component`, () => {
    assert.equal(isComponentFamily(makeFamily(paths)), false);
  });
}

for (const { name, row, complete } of [
  {
    name: 'a waits-on row on a source file',
    row: makeRow('packages/react/src/button/Button.tsx'),
    complete: false,
  },
  {
    name: 'a waits-on row on an entry',
    row: makeRow(TYPES_MD, { entry: 'Button', waitsOn: WAITING_FOR }),
    complete: false,
  },
  {
    name: 'a waits-on row on a prop row',
    row: makeRow(TYPES_MD, { entry: 'Button', prop: 'render', waitsOn: WAITING_FOR }),
    complete: false,
  },
  {
    name: 'a waits-on row on a case',
    row: makeRow(BUTTON_TEST, { describe: ['<Button />'], title: 'renders', waitsOn: WAITING_FOR }),
    complete: true,
  },
  {
    name: 'a waits-on row on a block',
    row: makeRow(BUTTON_TEST, { describe: ['<Button />'], waitsOn: WAITING_FOR }),
    complete: true,
  },
  {
    name: 'a waits-on row on a suite call',
    row: makeRow(BUTTON_TEST, {
      describe: ['<Button />'],
      suite: 'describeConformance',
      waitsOn: WAITING_FOR,
    }),
    complete: true,
  },
  {
    name: 'a waits-on row on a test file',
    row: makeRow(BUTTON_TEST, { waitsOn: WAITING_FOR }),
    complete: true,
  },
  {
    name: 'a not-applicable row on a source file',
    row: makeRow('packages/react/src/button/index.ts', { kind: 'not-applicable' }),
    complete: true,
  },
]) {
  test(`a family with ${name} is ${complete ? 'complete' : 'not complete'}`, () => {
    assert.equal(isCompleteFamily(makeFamily(BUTTON_PATHS, [row])), complete);
  });
}

test('the count holds the complete components, and the list gives the total and the names with no family', () => {
  const waiting = makeRow('packages/react/src/dialog/Dialog.tsx');
  assert.deepEqual(
    countComponents(
      [
        makeFiles('button', makeFamily(BUTTON_PATHS)),
        makeFiles(
          'dialog',
          makeFamily(['docs/src/app/(docs)/react/components/dialog/**'], [waiting]),
        ),
        makeFiles('merge-props', makeFamily(['packages/react/src/merge-props/**'])),
        makeFiles('broken'),
      ],
      ['accordion', 'button', 'dialog', 'tabs'],
    ),
    { done: 1, total: 4, notStarted: ['accordion', 'tabs'] },
  );
});

test('a family is the component of the folder in its docs path, and not the component of its name', () => {
  const family = makeFiles(
    'toggle-button',
    makeFamily(['docs/src/app/(docs)/react/components/toggle/**']),
  );
  assert.deepEqual(countComponents([family], ['toggle', 'toggle-button']).notStarted, [
    'toggle-button',
  ]);
});
