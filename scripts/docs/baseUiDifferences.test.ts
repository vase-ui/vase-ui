import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import type { BetterRow, FamilyExtract, FamilyFile } from '../parity/parityFiles.ts';
import { readParityFiles, REPOSITORY_ROOT } from '../parity/repository.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import type { SurfacePart } from '../parity/typesMd.ts';
import type { ApiReference } from './apiReference.ts';
import { createApiReferenceReader } from './apiReference.ts';
import {
  buildBaseUiDifferences,
  checkBetterRowPages,
  createBaseUiDifferencesReader,
} from './baseUiDifferences.ts';
import type { DifferencesInput } from './baseUiDifferences.ts';
import { listFamilyPages } from './familyPages.ts';

const DOCS = 'docs/src/app/(docs)/react/components';

function surfacePart(name: string): SurfacePart {
  return {
    name,
    tag: 'div',
    props: null,
    state: null,
    actions: null,
    changeEventReason: null,
    changeEventDetails: null,
    dataAttributes: [],
    cssVariables: [],
  };
}

function familyFiles(
  name: string,
  { parts, functions = [], tags = [] }: { parts: string[]; functions?: string[]; tags?: string[] },
  family: Partial<FamilyFile> = {},
): FamilyFiles {
  const extract: FamilyExtract = {
    commit: '0'.repeat(40),
    upstreamPaths: [],
    sources: [],
    typeTests: [],
    cases: [],
    surface: [
      {
        file: `${DOCS}/${name}/types.md`,
        parts: parts.map(surfacePart),
        functions: functions.map((title) => ({ name: title, tables: [], code: [] })),
        types: [],
        additionalTypes: [],
        externalTypes: [],
      },
    ],
    pages: tags.length > 0 ? [{ file: `${DOCS}/${name}/page.mdx`, referenceTags: tags }] : [],
  };
  return {
    name,
    hasFamilyFile: true,
    hasExtract: true,
    extract,
    family: {
      upstreamPaths: [`packages/react/src/${name}/**`, `${DOCS}/${name}/**`],
      matchedCommit: '0'.repeat(40),
      exceptions: [],
      surfaceAdditions: [],
      returnTypeDifferences: [],
      notApplicableCommits: [],
      ...family,
    },
  };
}

function reference(homes: ApiReference['homes']): ApiReference {
  return { parts: [], functions: [], classes: [], types: [], homes };
}

function betterRow(id: string, dueWith: string, families?: string[]): BetterRow {
  return {
    id,
    evidence: ['https://example.com'],
    behavior: `Behavior ${id}.`,
    dueWith,
    ...(families ? { families } : {}),
  };
}

const typesMd = (name: string): string => `${DOCS}/${name}/types.md`;

const SAMPLE = familyFiles(
  'sample',
  { parts: ['Root', 'Trigger'], functions: ['createHandle'], tags: ['TypesSample.Root'] },
  {
    exceptions: [
      {
        upstream: typesMd('sample'),
        entry: 'Trigger',
        prop: 'nativeButton',
        kind: 'not-applicable',
        reason: 'The trigger reads its element.',
      },
      {
        upstream: typesMd('sample'),
        entry: 'Root',
        kind: 'not-applicable',
        reason: 'The root has no `data-closed`.',
      },
      {
        upstream: typesMd('sample'),
        entry: 'SampleRootDataAttributes',
        kind: 'not-applicable',
        reason: 'A type.',
      },
      {
        upstream: typesMd('sample'),
        entry: 'createHandle',
        kind: 'not-applicable',
        reason: 'The handle has no payload.',
      },
      {
        upstream: 'packages/react/src/sample/Sample.test.tsx',
        kind: 'not-applicable',
        reason: 'A test.',
      },
    ],
    surfaceAdditions: [
      { entry: 'Trigger', prop: 'disabled', nativeAttribute: true, reason: 'Native.' },
      { entry: 'Root', emit: 'update:triggerId', reason: '`v-model:trigger-id`.' },
    ],
    returnTypeDifferences: [{ entry: 'createHandle', returns: 'SampleHandle', reason: 'A class.' }],
  },
);

const INPUT: DifferencesInput = {
  release: '1.9.0',
  families: [SAMPLE, familyFiles('other', { parts: ['Root'], tags: ['TypesOther.Root'] })],
  ownComponents: [
    { name: 'clock', record: { standard: ['https://example.com/clock'], reason: 'A clock.' } },
  ],
  better: [
    betterRow('VUE-10', 'packages/react/src/sample/root/SampleRoot.tsx'),
    betterRow('VUE-2', 'packages/react/src/utils/popups/store.ts', ['sample', 'clock']),
    betterRow('VUE-3', 'packages/react/src/other/OtherRoot.tsx'),
    betterRow('VUE-4', 'packages/react/src/utils/popups/store.ts', []),
  ],
};

test('a family of Base UI has the rows of its parts and functions in the sequence of the page, its additions less native attributes, its return types and its behavior by id', () => {
  const differences = buildBaseUiDifferences(
    'sample',
    reference([
      { part: 'Root', family: 'sample' },
      { part: 'Trigger', family: 'sample' },
    ]),
    INPUT,
  );
  assert.deepEqual(differences, {
    release: '1.9.0',
    own: null,
    api: [
      { baseUi: 'Sample.Root', prop: null, vaseUi: 'The root has no `data-closed`.' },
      { baseUi: 'Sample.Trigger', prop: 'nativeButton', vaseUi: 'The trigger reads its element.' },
      { baseUi: 'Sample.createHandle', prop: null, vaseUi: 'The handle has no payload.' },
    ],
    added: [
      {
        part: 'Sample.Root',
        kind: 'emit',
        member: 'update:triggerId',
        why: '`v-model:trigger-id`.',
      },
    ],
    returnTypes: [{ name: 'Sample.createHandle', returns: 'SampleHandle', why: 'A class.' }],
    behavior: [
      { id: 'VUE-2', behavior: 'Behavior VUE-2.', evidence: ['https://example.com'] },
      { id: 'VUE-10', behavior: 'Behavior VUE-10.', evidence: ['https://example.com'] },
    ],
  });
});

test('a part that another family ports has the rows of that family, and the page shows the additions and behavior of that family', () => {
  const page = familyFiles(
    'sample-group',
    { parts: ['SampleGroup', 'Root'], tags: ['TypesSampleGroup.SampleGroup'] },
    {
      exceptions: [
        {
          upstream: typesMd('sample-group'),
          entry: 'Root',
          kind: 'not-applicable',
          reason: 'Sample ports it.',
        },
        {
          upstream: typesMd('sample-group'),
          entry: 'SampleGroup',
          kind: 'not-applicable',
          reason: 'The group has no `focused`.',
        },
      ],
    },
  );
  const differences = buildBaseUiDifferences(
    'sample-group',
    reference([
      { part: 'SampleGroup', family: 'sample-group' },
      { part: 'Root', family: 'sample' },
      { part: 'Trigger', family: 'sample' },
    ]),
    { ...INPUT, families: [...INPUT.families, page] },
  );
  assert.deepEqual(differences.api, [
    { baseUi: 'SampleGroup', prop: null, vaseUi: 'The group has no `focused`.' },
    { baseUi: 'Sample.Root', prop: null, vaseUi: 'The root has no `data-closed`.' },
    { baseUi: 'Sample.Trigger', prop: 'nativeButton', vaseUi: 'The trigger reads its element.' },
  ]);
  assert.deepEqual(
    differences.added.map(({ part, member }) => `${part} ${member}`),
    ['Sample.Root update:triggerId'],
  );
  assert.deepEqual(
    differences.behavior.map(({ id }) => id),
    ['VUE-2', 'VUE-10'],
  );
});

test('a family with no page of Base UI takes its namespace from its name', () => {
  const differences = buildBaseUiDifferences(
    'sample-group',
    reference([{ part: 'Indicator', family: 'sample-radio' }]),
    {
      ...INPUT,
      families: [
        familyFiles(
          'sample-radio',
          { parts: ['Indicator'] },
          {
            exceptions: [
              {
                upstream: typesMd('sample-radio'),
                entry: 'Indicator',
                kind: 'not-applicable',
                reason: 'Cut.',
              },
            ],
          },
        ),
      ],
    },
  );
  assert.deepEqual(differences.api, [
    { baseUi: 'SampleRadio.Indicator', prop: null, vaseUi: 'Cut.' },
  ]);
});

test('a component of Vase UI own has the reason and the standards of its record, and the behavior that names it', () => {
  assert.deepEqual(buildBaseUiDifferences('clock', reference([]), INPUT), {
    release: null,
    own: { reason: 'A clock.', standard: ['https://example.com/clock'] },
    api: [],
    added: [],
    returnTypes: [],
    behavior: [{ id: 'VUE-2', behavior: 'Behavior VUE-2.', evidence: ['https://example.com'] }],
  });
});

test('a better row needs a page by its dueWith or by families, and each name of families has a page', () => {
  const pages = new Set(['sample', 'clock']);
  assert.deepEqual(checkBetterRowPages(INPUT.better, INPUT.families, pages), [
    'parity/better/VUE-3.json: no family with a page has packages/react/src/other/OtherRoot.tsx. Add "families" with the families whose page shows the row, or [] for a row of no one component.',
  ]);
  assert.deepEqual(
    checkBetterRowPages(
      [betterRow('VUE-5', 'packages/react/src/utils/x.ts', ['other'])],
      INPUT.families,
      pages,
    ),
    [
      'parity/better/VUE-5.json: "families" names other, which has no page. Name a family with a page.',
    ],
  );
});

const parity = readParityFiles(REPOSITORY_ROOT, { readExtracts: true });
const pageFamilies = listFamilyPages(join(REPOSITORY_ROOT, 'docs')).map(({ family }) => family);

test('each better row of the repository shows on a page or has families, and each name of families has a page', () => {
  assert.deepEqual(parity.problems, []);
  assert.deepEqual(checkBetterRowPages(parity.better, parity.families, new Set(pageFamilies)), []);
});

test('the Radio Group page has the rows of Radio for the parts that Radio ports', () => {
  const readReference = createApiReferenceReader(REPOSITORY_ROOT, { cache: true });
  const differences = createBaseUiDifferencesReader(REPOSITORY_ROOT)(
    'radio-group',
    readReference('radio-group'),
  );
  const names = differences.api.map(({ baseUi }) => baseUi);
  assert.ok(names.includes('Radio.Indicator'), names.join(', '));
  assert.ok(names.includes('RadioGroup'), names.join(', '));
  assert.ok(differences.api.every(({ vaseUi }) => !vaseUi.includes('repeats this entry')));
});
