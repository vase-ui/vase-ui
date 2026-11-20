import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateBetterRow,
  validateExtract,
  validateFamilyFile,
  validateOwnComponent,
  validateUpstreamFile,
} from './parityFiles.ts';

const COMMIT = 'a'.repeat(40);
const FILE = 'parity/families/sample.json';

type Json = Record<string, any>;

function makeFamily(): Json {
  return {
    upstreamPaths: ['packages/utils/src/**'],
    matchedCommit: COMMIT,
    exceptions: [
      { upstream: 'packages/utils/src/a.ts', kind: 'not-applicable', reason: 'A reason.' },
      {
        upstream: 'packages/utils/src/a.test.ts',
        describe: ['a'],
        title: 'b',
        kind: 'engine',
        engine: 'webkit',
        link: 'https://example.com/bug',
        reason: 'A reason.',
      },
      {
        upstream: 'docs/src/app/(docs)/react/components/sample/types.md',
        entry: 'Root',
        prop: 'open',
        kind: 'waits-on',
        waitsOn: 'packages/react/src/sample',
        reason: 'A reason.',
      },
    ],
    surfaceAdditions: [{ entry: 'Root', prop: 'disabled', reason: 'A reason.' }],
    returnTypeDifferences: [{ entry: 'useRoot', returns: 'Ref<string>', reason: 'A reason.' }],
    notApplicableCommits: [{ sha: COMMIT, reason: 'A reason.' }],
  };
}

test('a correct family file has no problem', () => {
  assert.deepEqual(validateFamilyFile(FILE, makeFamily()), []);
});

test('a relocation records a behavior or member and each part of a split on one row', () => {
  const row = {
    upstream: 'packages/utils/src/point.ts',
    relation: 'inlined-into',
    destination: 'packages/vue/src/tooltip/Root.vue',
    behavior: 'Track the cursor.',
    witness: 'packages/vue/src/tooltip/Root.test.ts',
    additional: [{ destination: 'packages/vue/src/tooltip/geometry.ts', member: 'axis' }],
  };
  const check = (...relocations: unknown[]) =>
    validateFamilyFile(FILE, { ...makeFamily(), relocations });
  assert.deepEqual(check(row), []);
  assert.match(
    check({ ...row, additional: [...row.additional, ...row.additional] })[0],
    /additional\[1\].*already names/,
  );
  assert.match(check({ ...row, ...row.additional[0] })[0], /additional\[0\].*already names/);
  assert.deepEqual(check({ ...row, member: 'point', behavior: 'Track the cursor.' }), []);
  assert.match(check(row, row)[0], /relocations\[1\].*same thing as relocations\[0\]/);
  const { behavior, witness, ...rest } = row;
  assert.match(check({ ...rest, witness })[0], /member.*behavior/);
  assert.match(check({ ...rest, behavior })[0], /needs the key "witness"/);
  assert.match(
    check({ ...row, additional: [{ destination: row.destination }] })[0],
    /needs the key "member"/,
  );
  assert.match(check({ ...row, relation: 'alias' })[0], /merged-into.*inlined-into.*moved-test/);
  assert.match(check({ ...row, relation: 'moved-test' })[0], /source relation/);
  assert.match(
    check({ ...row, upstream: row.upstream.replace('.ts', '.spec.ts') })[0],
    /moved-test/,
  );
  assert.match(
    check({ ...row, upstream: row.upstream.replace('.ts', '.test.ts'), relation: 'moved-test' })[0],
    /one destination/,
  );
});

for (const kind of ['stateField', 'constant']) {
  test(`a surfaceAdditions row accepts one ${kind}`, () => {
    const family = makeFamily();
    family.surfaceAdditions = [{ entry: 'Root', [kind]: 'disabled', reason: 'A reason.' }];
    assert.deepEqual(validateFamilyFile(FILE, family), []);
    family.surfaceAdditions[0].prop = 'disabled';
    assert.deepEqual(validateFamilyFile(FILE, family), [
      `${FILE}: surfaceAdditions[0]: names one member. Give exactly one of "prop", "emit", "slot", "exposed", "changeEventReason", "stateField" and "constant".`,
    ]);
  });
}

const wrongFamilies: { name: string; change: (family: Json) => void; message: RegExp }[] = [
  {
    name: 'an unknown key',
    change: (family) => {
      family.extra = [];
    },
    message: /^parity\/families\/sample\.json: has the key "extra", which is not known\.$/,
  },
  {
    name: 'a missing key',
    change: (family) => {
      delete family.surfaceAdditions;
    },
    message: /^parity\/families\/sample\.json: needs the key "surfaceAdditions"\.$/,
  },
  {
    name: 'an unknown key in a row',
    change: (family) => {
      family.exceptions[0].file = 'x';
    },
    message:
      /^parity\/families\/sample\.json: exceptions\[0\]: has the key "file", which is not known\.$/,
  },
  {
    name: 'a missing reason',
    change: (family) => {
      delete family.exceptions[0].reason;
    },
    message: /^parity\/families\/sample\.json: exceptions\[0\]: needs the key "reason"\.$/,
  },
  {
    name: 'a waits-on row of a test with no waitsOn',
    change: (family) => {
      family.exceptions[1] = {
        upstream: 'packages/utils/src/a.test.ts',
        kind: 'waits-on',
        reason: 'A reason.',
      };
    },
    message:
      /^parity\/families\/sample\.json: exceptions\[1\]: a "waits-on" row that names a test needs "waitsOn"\.$/,
  },
  {
    name: 'a waits-on row of a source file with waitsOn',
    change: (family) => {
      family.exceptions[0] = {
        upstream: 'packages/utils/src/a.ts',
        kind: 'waits-on',
        waitsOn: 'packages/utils/src/b.ts',
        reason: 'A reason.',
      };
    },
    message: /exceptions\[0\]: a "waits-on" row that names a source file has no "waitsOn"\./,
  },
  {
    name: 'an engine row with no link',
    change: (family) => {
      delete family.exceptions[1].link;
    },
    message: /exceptions\[1\]: an "engine" row needs "engine" and "link"\./,
  },
  {
    name: 'a row with engine that is not an engine row',
    change: (family) => {
      family.exceptions[0].engine = 'webkit';
    },
    message: /exceptions\[0\]: only an "engine" row has "engine" and "link"\./,
  },
  {
    name: 'a replaced row with no test',
    change: (family) => {
      family.exceptions[1] = {
        upstream: 'packages/utils/src/a.test.ts',
        kind: 'replaced',
        reason: 'A reason.',
      };
    },
    message: /exceptions\[1\]: a "replaced" row needs "test"\./,
  },
  {
    name: 'a kind that the target cannot have',
    change: (family) => {
      family.exceptions[0].kind = 'replaced';
      family.exceptions[0].test = 'packages/vue/src/common/a.test.ts';
    },
    message:
      /exceptions\[0\]: a row that names a source file cannot have the kind "replaced"\. Use "not-applicable", "waits-on"\./,
  },
  {
    name: 'a prop row without an entry',
    change: (family) => {
      delete family.exceptions[2].entry;
    },
    message: /exceptions\[2\]: has keys that do not name one thing\./,
  },
  {
    name: 'a block with no describe title',
    change: (family) => {
      family.exceptions[1] = {
        upstream: 'packages/utils/src/a.test.ts',
        describe: [],
        kind: 'not-applicable',
        reason: 'A reason.',
      };
    },
    message: /exceptions\[1\]: has keys that do not name one thing\./,
  },
  {
    name: 'a waitsOn path outside the mapped roots',
    change: (family) => {
      family.exceptions[2].waitsOn = 'docs/page.mdx';
    },
    message: /exceptions\[2\]\.waitsOn: must be a path that starts with packages\/react\/src\//,
  },
  {
    name: 'a waitsOn path with "/" at its end',
    change: (family) => {
      family.exceptions[2].waitsOn = 'packages/react/src/select/';
    },
    message:
      /exceptions\[2\]\.waitsOn: must be a path that starts with .* and has no "\/" at its end\./,
  },
  {
    name: 'an engine that is not known',
    change: (family) => {
      family.exceptions[1].engine = 'blink';
    },
    message: /exceptions\[1\]\.engine: must be one of "chromium", "firefox", "webkit"\./,
  },
  {
    name: 'a link that is not https',
    change: (family) => {
      family.exceptions[1].link = 'http://example.com';
    },
    message: /exceptions\[1\]\.link: must be a link that starts with https:\/\//,
  },
  {
    name: 'a surfaceAdditions row with two member keys',
    change: (family) => {
      family.surfaceAdditions[0].emit = 'x';
    },
    message:
      /surfaceAdditions\[0\]: names one member\. Give exactly one of "prop", "emit", "slot", "exposed", "changeEventReason", "stateField" and "constant"\./,
  },
  {
    name: 'a surfaceAdditions row with a prop and a change reason',
    change: (family) => {
      family.surfaceAdditions[0].changeEventReason = 'none';
    },
    message: /surfaceAdditions\[0\]: names one member\./,
  },
  {
    name: 'a surfaceAdditions row with no member key',
    change: (family) => {
      delete family.surfaceAdditions[0].prop;
    },
    message: /surfaceAdditions\[0\]: names one member\./,
  },
  {
    name: 'a nativeAttribute mark on a row with no prop',
    change: (family) => {
      family.surfaceAdditions[0] = {
        entry: 'Root',
        emit: 'x',
        nativeAttribute: true,
        reason: 'A reason.',
      };
    },
    message: /surfaceAdditions\[0\]: only a row with "prop" has "nativeAttribute"\./,
  },
  {
    name: 'a nativeAttribute mark that is not true',
    change: (family) => {
      family.surfaceAdditions[0].nativeAttribute = false;
    },
    message: /surfaceAdditions\[0\]\.nativeAttribute: must be true\./,
  },
  {
    name: 'two rows that name the same thing',
    change: (family) => {
      family.exceptions.push({ ...family.exceptions[0], reason: 'Another reason.' });
    },
    message: /exceptions\[3\]: names the same thing as exceptions\[0\]\. Keep one row\./,
  },
  {
    name: 'a missing returnTypeDifferences key',
    change: (family) => {
      delete family.returnTypeDifferences;
    },
    message: /^parity\/families\/sample\.json: needs the key "returnTypeDifferences"\.$/,
  },
  {
    name: 'a returnTypeDifferences row with no reason',
    change: (family) => {
      delete family.returnTypeDifferences[0].reason;
    },
    message: /returnTypeDifferences\[0\]: needs the key "reason"\./,
  },
  {
    name: 'two returnTypeDifferences rows with one entry',
    change: (family) => {
      family.returnTypeDifferences.push({ ...family.returnTypeDifferences[0], returns: 'string' });
    },
    message:
      /returnTypeDifferences\[1\]: names the same thing as returnTypeDifferences\[0\]\. Keep one row\./,
  },
  {
    name: 'a matchedCommit that is not 40 hexadecimal digits',
    change: (family) => {
      family.matchedCommit = 'abc123';
    },
    message: /matchedCommit: must be 40 hexadecimal digits\./,
  },
  {
    name: 'no upstream path',
    change: (family) => {
      family.upstreamPaths = [];
    },
    message: /upstreamPaths: must have at least one item\./,
  },
  {
    name: 'a describe that is not a list',
    change: (family) => {
      family.exceptions[1].describe = 'a';
    },
    message: /exceptions\[1\]\.describe: must be a list\./,
  },
];

for (const { name, change, message } of wrongFamilies) {
  test(`validateFamilyFile reports ${name} with its place`, () => {
    const family = makeFamily();
    change(family);
    const problems = validateFamilyFile(FILE, family);
    assert.equal(
      problems.some((problem) => message.test(problem)),
      true,
      problems.join('\n'),
    );
  });
}

const OWN_COMPONENT_FILE = 'parity/own/sample.json';

function makeOwnComponent(): Json {
  return {
    standard: ['https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/'],
    reason: 'Base UI has no sample.',
    parts: ['Root', 'Panel'],
    functions: ['useSample'],
    types: ['Sample.Layout'],
  };
}

test('a correct record of an own component has no problem, with or without functions and types', () => {
  assert.deepEqual(validateOwnComponent(OWN_COMPONENT_FILE, makeOwnComponent()), []);
  const record = makeOwnComponent();
  delete record.functions;
  delete record.types;
  assert.deepEqual(validateOwnComponent(OWN_COMPONENT_FILE, record), []);
});

test('a utility record with functions and no parts has no problem', () => {
  const record = makeOwnComponent();
  delete record.parts;
  assert.deepEqual(validateOwnComponent(OWN_COMPONENT_FILE, record), []);
});

const wrongOwnComponents: { name: string; change: (record: Json) => void; message: RegExp }[] = [
  {
    name: 'an unknown key',
    change: (record) => {
      record.upstreamPaths = [];
    },
    message: /^parity\/own\/sample\.json: has the key "upstreamPaths", which is not known\.$/,
  },
  {
    name: 'a missing standard',
    change: (record) => {
      delete record.standard;
    },
    message: /^parity\/own\/sample\.json: needs the key "standard"\.$/,
  },
  {
    name: 'a missing reason',
    change: (record) => {
      delete record.reason;
    },
    message: /^parity\/own\/sample\.json: needs the key "reason"\.$/,
  },
  {
    name: 'a record with neither parts nor functions',
    change: (record) => {
      delete record.parts;
      delete record.functions;
    },
    message: /^parity\/own\/sample\.json: needs the key "parts" or the key "functions"\.$/,
  },
  {
    name: 'a standard with no link',
    change: (record) => {
      record.standard = [];
    },
    message: /standard: must have at least one item\./,
  },
  {
    name: 'a standard that is not an https link',
    change: (record) => {
      record.standard = ['http://example.com/pattern'];
    },
    message: /standard\[0\]: must be a link that starts with https:\/\//,
  },
  {
    name: 'a reason with no text',
    change: (record) => {
      record.reason = ' ';
    },
    message: /reason: must be a string with text\./,
  },
  {
    name: 'no part',
    change: (record) => {
      record.parts = [];
    },
    message: /parts: must have at least one item\./,
  },
  {
    name: 'a part with no text',
    change: (record) => {
      record.parts = [''];
    },
    message: /parts\[0\]: must be a string with text\./,
  },
  {
    name: 'an empty list of functions',
    change: (record) => {
      record.functions = [];
    },
    message: /functions: must have at least one item\./,
  },
  {
    name: 'an empty list of types',
    change: (record) => {
      record.types = [];
    },
    message: /types: must have at least one item\./,
  },
  {
    name: 'a part that the list has twice',
    change: (record) => {
      record.parts = ['Root', 'Panel', 'Root'];
    },
    message: /parts\[2\]: names the same thing as parts\[0\]\. Keep one row\./,
  },
  {
    name: 'a function that the list has twice',
    change: (record) => {
      record.functions = ['useSample', 'useSample'];
    },
    message: /functions\[1\]: names the same thing as functions\[0\]\. Keep one row\./,
  },
  {
    name: 'a type that the list has twice',
    change: (record) => {
      record.types = ['A', 'A'];
    },
    message: /types\[1\]: names the same thing as types\[0\]\. Keep one row\./,
  },
  {
    name: 'a standard that the list has twice',
    change: (record) => {
      record.standard = ['https://example.com/a', 'https://example.com/a'];
    },
    message: /standard\[1\]: names the same thing as standard\[0\]\. Keep one row\./,
  },
];

for (const { name, change, message } of wrongOwnComponents) {
  test(`validateOwnComponent reports ${name} with its place`, () => {
    const record = makeOwnComponent();
    change(record);
    const problems = validateOwnComponent(OWN_COMPONENT_FILE, record);
    assert.equal(
      problems.some((problem) => message.test(problem)),
      true,
      problems.join('\n'),
    );
  });
}

function makeBetter(): Json {
  return {
    id: 'BUG-1',
    evidence: ['https://example.com/issue'],
    behavior: 'A thing happens.',
    dueWith: 'packages/react/src/sample/Sample.tsx',
  };
}

test('a correct better row has no problem, with or without families', () => {
  assert.deepEqual(validateBetterRow('parity/better/BUG-1.json', makeBetter()), []);
  for (const families of [[], ['dialog', 'alert-dialog']]) {
    assert.deepEqual(
      validateBetterRow('parity/better/BUG-1.json', { ...makeBetter(), families }),
      [],
    );
  }
});

const wrongBetter: { name: string; change: (row: Json) => void; file?: string; message: RegExp }[] =
  [
    {
      name: 'a file name that is not the id',
      change: () => {},
      file: 'parity/better/BUG-2.json',
      message:
        /^parity\/better\/BUG-2\.json: the file name must be BUG-1\.json, the id plus \.json\.$/,
    },
    {
      name: 'an id of another form',
      change: (row) => {
        row.id = 'FIX-1';
      },
      message: /id: must be VUE- or BUG- and a number\./,
    },
    {
      name: 'no evidence',
      change: (row) => {
        row.evidence = [];
      },
      message: /evidence: must have at least one item\./,
    },
    {
      name: 'evidence that is not a link',
      change: (row) => {
        row.evidence = ['issue 5'];
      },
      message: /evidence\[0\]: must be a link that starts with https:\/\//,
    },
    {
      name: 'a dueWith path outside the mapped roots',
      change: (row) => {
        row.dueWith = 'docs/page.mdx';
      },
      message: /dueWith: must be a path that starts with/,
    },
    {
      name: 'a dueWith path with "/" at its end',
      change: (row) => {
        row.dueWith = 'packages/react/src/select/';
      },
      message: /dueWith: must be a path that starts with .* and has no "\/" at its end\./,
    },
    {
      name: 'a name of families that is not a family name',
      change: (row) => {
        row.families = ['Dialog'];
      },
      message: /families\[0\]: must be a name that matches/,
    },
    {
      name: 'a family that families names two times',
      change: (row) => {
        row.families = ['dialog', 'dialog'];
      },
      message: /families\[1\]: names the same thing as families\[0\]\./,
    },
    {
      name: 'an unknown key',
      change: (row) => {
        row.test = 'x';
      },
      message: /has the key "test", which is not known\./,
    },
  ];

for (const { name, change, file = 'parity/better/BUG-1.json', message } of wrongBetter) {
  test(`validateBetterRow reports ${name}`, () => {
    const row = makeBetter();
    change(row);
    const problems = validateBetterRow(file, row);
    assert.equal(
      problems.some((problem) => message.test(problem)),
      true,
      problems.join('\n'),
    );
  });
}

test('validateUpstreamFile needs the commit to be the sha of the last row', () => {
  const commit = (sha: string) => ({
    sha,
    date: '2026-01-01T00:00:00+00:00',
    subject: 'A change',
    paths: ['a'],
  });
  const file = {
    commit: 'b'.repeat(40),
    describe: 'v1.0.0-1-gbbbbbbbb',
    release: '1.0.0',
    components: ['accordion'],
    commits: [commit(COMMIT)],
  };
  assert.deepEqual(validateUpstreamFile('parity/upstream.json', file), [
    'parity/upstream.json: commit: must be the "sha" of the last row of "commits".',
  ]);
  assert.deepEqual(validateUpstreamFile('parity/upstream.json', { ...file, commit: COMMIT }), []);
});

test('validateExtract needs each key and a row of each kind to have its fields', () => {
  const extract: Json = {
    commit: COMMIT,
    upstreamPaths: ['a/**'],
    sources: ['a/b.ts'],
    typeTests: [],
    cases: [
      {
        file: 'a/b.test.ts',
        rows: [
          { describe: [], title: 'a' },
          { describe: [], suite: 'x', conditions: ['skip'] },
        ],
      },
    ],
    surface: [],
    pages: [{ file: 'a/page.mdx', referenceTags: ['TypesA.Root', 'TypesA'] }],
  };
  assert.deepEqual(validateExtract('x.upstream.json', extract), []);
  const withoutPages = { ...extract };
  delete withoutPages.pages;
  assert.deepEqual(validateExtract('x.upstream.json', withoutPages), [
    'x.upstream.json: needs the key "pages".',
  ]);
  assert.match(
    validateExtract('x.upstream.json', {
      ...extract,
      cases: [{ file: 'a', rows: [{ describe: [] }] }],
    })[0],
    /cases\[0\]\.rows\[0\]: needs the key "title"\./,
  );
});

test('validateExtract accepts a badge of a Base UI heading for a tag of a page, and refuses another word', () => {
  const extract = (badge: string): Json => ({
    commit: COMMIT,
    upstreamPaths: ['a/**'],
    sources: [],
    typeTests: [],
    cases: [],
    surface: [],
    pages: [
      {
        file: 'a/page.mdx',
        referenceTags: ['TypesA.Root'],
        referenceBadges: { 'TypesA.Root': badge },
      },
    ],
  });
  assert.deepEqual(validateExtract('x.upstream.json', extract('Preview')), []);
  assert.deepEqual(validateExtract('x.upstream.json', extract('New')), []);
  assert.deepEqual(validateExtract('x.upstream.json', extract('Beta')), [
    'x.upstream.json: pages[0].referenceBadges.TypesA.Root: must be one of "New", "Preview".',
  ]);
});
