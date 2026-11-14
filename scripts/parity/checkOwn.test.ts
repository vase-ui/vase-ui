import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { runParityCheck } from './check.ts';
import { checkOwnComponent } from './checkOwn.ts';
import type { OwnContext } from './checkOwn.ts';
import type { OwnComponent } from './parityFiles.ts';
import { vaseFiles } from './paths.ts';
import { createVaseProject } from './vaseSurface.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const ENTRY_FILE = 'packages/vue/src/sample/index.ts';
const ENTRY = join(FIXTURES, ENTRY_FILE);

const project = createVaseProject(join(FIXTURES, 'tsconfig.json'));

const context: OwnContext = {
  upstream: {
    commit: 'a'.repeat(40),
    describe: 'v1.0.0',
    release: '1.0.0',
    components: ['button'],
    commits: [],
  },
  files: vaseFiles([ENTRY_FILE]),
  root: FIXTURES,
  project: () => project,
};

function makeRecord(changes: Partial<OwnComponent> = {}): OwnComponent {
  return {
    standard: ['https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/'],
    reason: 'Base UI has no sample component.',
    parts: ['Root', 'Popup'],
    functions: ['createHandle'],
    types: ['Sample.Handle', 'SampleRootChangeEventReason'],
    ...changes,
  };
}

const RECORD = 'parity/own/sample.json';

test('the check of a repository with a record of an own component, read from its file, has no problem', () => {
  const { parity, result } = runParityCheck(FIXTURES);
  assert.deepEqual(
    parity.ownComponents.map(({ name }) => name),
    ['sample'],
  );
  assert.deepEqual(result.problems, []);
});

test('a record whose names each have an export of the right kind has no problem', () => {
  assert.deepEqual(checkOwnComponent('sample', makeRecord(), context), []);
});

test('a record with no functions and no types has no problem', () => {
  const record = makeRecord({ functions: undefined, types: undefined });
  assert.deepEqual(checkOwnComponent('sample', record, context), []);
});

test('a name that a Base UI component has is a problem', () => {
  const upstream = context.upstream && { ...context.upstream, components: ['sample'] };
  assert.deepEqual(checkOwnComponent('sample', makeRecord(), { ...context, upstream }), [
    `sample: parity/upstream.json lists a Base UI component with this name. Add a family file and delete ${RECORD}.`,
  ]);
});

test('a record with no entry point is a problem, and the check makes no project', () => {
  const problems = checkOwnComponent('sample', makeRecord(), {
    ...context,
    files: vaseFiles([]),
    project: () => {
      throw new Error('A component with no entry point must not make the project.');
    },
  });
  assert.deepEqual(problems, [
    `sample: ${ENTRY_FILE} does not exist. Add the entry point, or delete ${RECORD}.`,
  ]);
});

const wrongNames: { name: string; change: Partial<OwnComponent>; problem: string }[] = [
  {
    name: 'a part with no export',
    change: { parts: ['Root', 'Ghost'] },
    problem: `sample: part \`Ghost\` has no export in ${ENTRY_FILE}. Export it, or remove it from "parts" in ${RECORD}.`,
  },
  {
    name: 'a part that is not a component',
    change: { parts: ['createHandle'] },
    problem: `sample: part \`createHandle\` is not a component. Move it to "functions" or "types", or remove it from "parts" in ${RECORD}.`,
  },
  {
    name: 'a function with no export',
    change: { functions: ['ghost'] },
    problem: `sample: function \`ghost\` has no export in ${ENTRY_FILE}. Export it, or remove it from "functions" in ${RECORD}.`,
  },
  {
    name: 'a function that is a component',
    change: { functions: ['Root'] },
    problem: `sample: function \`Root\` is a component. Move it to "parts", or remove it from "functions" in ${RECORD}.`,
  },
  {
    name: 'a function that is a type',
    change: { functions: ['SampleRootChangeEventReason'] },
    problem: `sample: function \`SampleRootChangeEventReason\` is not a function or a class. Move it to "types", or remove it from "functions" in ${RECORD}.`,
  },
  {
    name: 'a type with no export',
    change: { types: ['Sample.Ghost'] },
    problem: `sample: type \`Sample.Ghost\` has no export in ${ENTRY_FILE}. Export it, or remove it from "types" in ${RECORD}.`,
  },
  {
    name: 'a type with no property that is not a union of strings',
    change: { types: ['SamplePopupDataAttributes'] },
    problem: `sample: type \`SamplePopupDataAttributes\` has no property and is not a union of strings, so the API reference shows nothing for it. Remove it from "types" in ${RECORD}.`,
  },
];

for (const { name, change, problem } of wrongNames) {
  test(`the check reports ${name}`, () => {
    assert.deepEqual(checkOwnComponent('sample', makeRecord(change), context), [problem]);
  });
}

test('a name that matches more than one export is a problem', () => {
  const original = readFileSync(ENTRY, 'utf8');
  project.updateFile(ENTRY, `${original}\nexport * as Other from './index.parts';\n`);
  try {
    const record = makeRecord({ parts: ['Root'], functions: undefined, types: undefined });
    assert.deepEqual(checkOwnComponent('sample', record, context), [
      'sample: part `Root` matches more than one export (Sample.Root, Other.Root). Keep one.',
    ]);
  } finally {
    project.updateFile(ENTRY, original);
  }
});
