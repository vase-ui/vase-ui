import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestRow } from './cases.ts';
import { checkBetter, checkRepository, formatSummary } from './checkRepository.ts';
import type { BetterRow, FamilyExtract, FamilyFile, UpstreamFile } from './parityFiles.ts';
import { vaseFiles } from './paths.ts';
import type { ParityFiles } from './repository.ts';

const FIRST = 'a'.repeat(40);
const SECOND = 'b'.repeat(40);

function betterRow(id: string): BetterRow {
  return {
    id,
    evidence: ['https://example.com/issue'],
    behavior: 'A thing happens.',
    dueWith: 'packages/utils/src/useControlled.ts',
  };
}

const COUNTERPART = 'packages/vue/src/common/useControlled.ts';

function testsWith(...titles: string[][]): () => TestRow[] {
  return () =>
    titles.map((list) => ({ describe: list.slice(0, -1), title: list.at(-1) as string }));
}

test('a due row with no test is a problem', () => {
  const { problems, summary } = checkBetter(
    [betterRow('VUE-1')],
    vaseFiles([COUNTERPART]),
    testsWith(['other']),
  );
  assert.deepEqual(summary, { total: 1, due: 1 });
  assert.equal(problems.length, 1);
  assert.match(
    problems[0],
    /^parity\/better\/VUE-1\.json: due row has no test\. Vase UI has the counterpart of packages\/utils\/src\/useControlled\.ts\./,
  );
});

test('a due row passes when the title of a case holds its id', () => {
  const files = vaseFiles([COUNTERPART]);
  assert.deepEqual(
    checkBetter([betterRow('VUE-1')], files, testsWith(['VUE-1 stays undefined'])).problems,
    [],
  );
  assert.deepEqual(checkBetter([betterRow('VUE-1')], files, testsWith(['VUE-1: a'])).problems, []);
});

test('a due row passes when the title of a block holds its id', () => {
  const rows = testsWith(['VUE-1', 'stays undefined']);
  assert.deepEqual(checkBetter([betterRow('VUE-1')], vaseFiles([COUNTERPART]), rows).problems, []);
});

test('an id is not found inside a longer id', () => {
  const files = vaseFiles([COUNTERPART]);
  assert.equal(
    checkBetter([betterRow('VUE-1')], files, testsWith(['VUE-10 a'])).problems.length,
    1,
  );
  assert.equal(
    checkBetter([betterRow('VUE-1')], files, testsWith(['XVUE-1 a'])).problems.length,
    1,
  );
  assert.deepEqual(checkBetter([betterRow('VUE-10')], files, testsWith(['VUE-10 a'])).problems, []);
});

test('a row that is not due passes and reads no test file', () => {
  const result = checkBetter([betterRow('VUE-1')], vaseFiles([]), () => {
    throw new Error('A row that is not due must not read the tests.');
  });
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.summary, { total: 1, due: 0 });
});

const upstream: UpstreamFile = {
  commit: SECOND,
  describe: 'v1.0.0-1-gbbbbbbbb',
  release: '1.0.0',
  components: ['sample'],
  commits: [
    {
      sha: FIRST,
      date: '2026-01-01T00:00:00+00:00',
      subject: 'First',
      paths: ['packages/utils/src/a.ts'],
    },
    { sha: SECOND, date: '2026-01-02T00:00:00+00:00', subject: 'Second', paths: ['docs/page.mdx'] },
  ],
};

function makeFamily(): FamilyFile {
  return {
    upstreamPaths: ['packages/utils/src/**'],
    matchedCommit: SECOND,
    exceptions: [],
    surfaceAdditions: [],
    returnTypeDifferences: [],
    notApplicableCommits: [],
  };
}

function makeExtract(): FamilyExtract {
  return {
    commit: SECOND,
    upstreamPaths: ['packages/utils/src/**'],
    sources: [],
    typeTests: [],
    cases: [],
    surface: [],
  };
}

function makeParity(): ParityFiles {
  return {
    upstream: structuredClone(upstream),
    families: [
      {
        name: 'sample',
        family: makeFamily(),
        extract: makeExtract(),
        hasFamilyFile: true,
        hasExtract: true,
      },
    ],
    better: [],
    problems: [],
  };
}

function run(parity: ParityFiles) {
  return checkRepository({
    parity,
    files: vaseFiles([]),
    root: '/none',
    rowsOf: () => [],
    project: () => {
      throw new Error('A family with no surface must not make the project.');
    },
  });
}

test('a family with no problem gives a summary line and makes no project', () => {
  const result = run(makeParity());
  assert.deepEqual(result.problems, []);
  assert.deepEqual(formatSummary(result), [
    'sample: sources 0; type tests 0; cases 0; suite calls 0; 0 Vase UI rows with no upstream row',
    'parity/better: 0 rows, 0 due',
  ]);
});

const wrongFiles: { name: string; change: (parity: ParityFiles) => void; message: RegExp }[] = [
  {
    name: 'a family file with no extract',
    change: (parity) => {
      parity.families[0].hasExtract = false;
      parity.families[0].extract = undefined;
    },
    message:
      /^sample: parity\/families\/sample\.upstream\.json does not exist\. Run `pnpm parity:extract --upstream <path> sample`\./,
  },
  {
    name: 'an extract with no family file',
    change: (parity) => {
      parity.families[0].hasFamilyFile = false;
      parity.families[0].family = undefined;
    },
    message:
      /^sample: parity\/families\/sample\.json does not exist, but parity\/families\/sample\.upstream\.json does\./,
  },
  {
    name: 'an extract that was read at another commit',
    change: (parity) => {
      parity.families[0].extract!.commit = FIRST;
    },
    message:
      /^sample: parity\/families\/sample\.upstream\.json was read at commit a+, but matchedCommit is b+\. Run `pnpm parity:extract --upstream <path> sample`\./,
  },
  {
    name: 'an extract that was read with other upstream paths',
    change: (parity) => {
      parity.families[0].extract!.upstreamPaths = ['packages/utils/src/*'];
    },
    message:
      /^sample: parity\/families\/sample\.upstream\.json was read with other "upstreamPaths" than parity\/families\/sample\.json\. Run `pnpm parity:extract --upstream <path> sample`\./,
  },
  {
    name: 'a matchedCommit that is not in the tracked commits',
    change: (parity) => {
      parity.families[0].family!.matchedCommit = 'c'.repeat(40);
      parity.families[0].extract!.commit = 'c'.repeat(40);
    },
    message:
      /^sample: matchedCommit c+ is not a commit of parity\/upstream\.json\. Use a commit from that file, or run `pnpm parity:track <sha> --upstream <path>`\./,
  },
  {
    name: 'a not-applicable commit that is not in the tracked commits',
    change: (parity) => {
      parity.families[0].family!.notApplicableCommits = [
        { sha: 'c'.repeat(40), reason: 'A reason.' },
      ];
    },
    message:
      /^sample: notApplicableCommits\[0\] \(c+\): the commit is not in parity\/upstream\.json\./,
  },
  {
    name: 'a not-applicable commit after the matched commit',
    change: (parity) => {
      parity.families[0].family!.matchedCommit = FIRST;
      parity.families[0].extract!.commit = FIRST;
      parity.families[0].family!.notApplicableCommits = [{ sha: SECOND, reason: 'A reason.' }];
    },
    message: /^sample: notApplicableCommits\[0\] \(b+\): the commit is after matchedCommit\./,
  },
  {
    name: 'a not-applicable commit that changes no path of the family',
    change: (parity) => {
      parity.families[0].family!.notApplicableCommits = [{ sha: SECOND, reason: 'A reason.' }];
    },
    message:
      /^sample: notApplicableCommits\[0\] \(b+\): the commit changes no path of "upstreamPaths"\./,
  },
];

for (const { name, change, message } of wrongFiles) {
  test(`the check reports ${name}`, () => {
    const parity = makeParity();
    change(parity);
    const { problems } = run(parity);
    assert.equal(
      problems.some((problem) => message.test(problem)),
      true,
      problems.join('\n'),
    );
  });
}

test('a not-applicable commit that changes a path of the family and is not after the matched commit passes', () => {
  const parity = makeParity();
  parity.families[0].family!.notApplicableCommits = [{ sha: FIRST, reason: 'A reason.' }];
  assert.deepEqual(run(parity).problems, []);
});

test('a "surfaceAdditions" row of a family with no surface is a stale row', () => {
  const parity = makeParity();
  parity.families[0].family!.surfaceAdditions = [
    { entry: 'Ghost', prop: 'ghost', reason: 'A reason.' },
  ];
  assert.deepEqual(run(parity).problems, [
    'sample: stale row surfaceAdditions[0] (Ghost, prop ghost): the extract has no part `Ghost`. Remove the row.',
  ]);
});

test('a "returnTypeDifferences" row of a family with no surface is a stale row', () => {
  const parity = makeParity();
  parity.families[0].family!.returnTypeDifferences = [
    { entry: 'ghost', returns: 'string', reason: 'A reason.' },
  ];
  assert.deepEqual(run(parity).problems, [
    'sample: stale row returnTypeDifferences[0] (ghost): the extract has no return value for `ghost`. Remove the row.',
  ]);
});

test('a test file that the reader refuses is one problem, and the other families are still checked', () => {
  const refusedFile = 'packages/vue/src/common/refused.test.ts';
  const refusal = `${refusedFile}:6: \`.only\` is not allowed. Remove it.`;
  const parity = makeParity();
  parity.families[0].name = 'refused';
  parity.families[0].extract!.cases = [
    { file: 'packages/utils/src/refused.test.ts', rows: [{ describe: [], title: 'a' }] },
  ];
  parity.families.push({
    name: 'other',
    family: makeFamily(),
    extract: { ...makeExtract(), sources: ['packages/utils/src/other.ts'] },
    hasFamilyFile: true,
    hasExtract: true,
  });
  // A due row makes the check read the refused file again.
  parity.better = [betterRow('VUE-1')];
  const result = checkRepository({
    parity,
    files: vaseFiles([refusedFile, COUNTERPART]),
    root: '/none',
    rowsOf: (path) => {
      if (path === refusedFile) {
        throw new Error(refusal);
      }
      return [];
    },
    project: () => {
      throw new Error('A family with no surface must not make the project.');
    },
  });
  assert.equal(result.problems.filter((problem) => problem === refusal).length, 1);
  assert.equal(
    result.problems.some((problem) =>
      problem.startsWith('refused: uncovered case "a" in packages/utils/src/refused.test.ts'),
    ),
    true,
    result.problems.join('\n'),
  );
  assert.equal(
    result.problems.some((problem) => problem.startsWith('other: uncovered source file')),
    true,
    result.problems.join('\n'),
  );
  assert.deepEqual(
    formatSummary(result).map((line) => line.split(':')[0]),
    ['other', 'refused', 'parity/better'],
  );
});
