import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';

// The repository states the code as it is. A file names no earlier form of the code, no plan and no
// label of a plan step.

const SELF = 'scripts/repo/history.test.ts';

/** Files that hold history by design, and text that the repository copies from Base UI or GitHub. */
const SKIPPED_FILES = [
  /^CHANGELOG\.md$/,
  /^docs\/methodology\.md$/,
  /^THANKS\.md$/, // `pnpm thanks:render` writes it.
  /^pnpm-lock\.yaml$/,
  /^patches\//,
  /^parity\/upstream\.json$/, // `pnpm parity:track` writes it.
  /\.upstream\.json$/, // `pnpm parity:extract` writes it.
  /^docs\/demos\/[^/]+\/upstream\.json$/, // `pnpm docs:demos` writes it.
  /^docs\/demos\/.+\.css$/, // The style sheets of the Base UI demos.
  /\.(?:png|ico)$/,
];

/** A line that is not a trace, as its file and its text with no indent. */
const ALLOWED_LINES: { file: string; text: string }[] = [
  // `refactor` is a type of a Conventional Commit.
  { file: 'scripts/ci/checkTitle.ts', text: "'refactor'," },
  { file: 'scripts/ci/checkTitle.test.ts', text: "'refactor!: rename each export'," },
  // The title of a Base UI case, which `pnpm parity:check` matches.
  {
    file: 'packages/vue/src/tabs/TabsIndicator.test.ts',
    text: "test('does not resurrect the indicator when the captured tab is no longer active', async () => {",
  },
];

// A label is one to three capitals and a number of one or two digits, such as `L4`, `T20` or `SM1`.
// `F1` to `F12` are keys.
const LABEL = String.raw`(?!F\d)[A-Z]{1,3}\d{1,2}[a-z]?\b`;
const LABELS = String.raw`${LABEL}(?:(?:, | and | to | or )${LABEL})*`;

const TRACES: [kind: string, pattern: RegExp][] = [
  [
    'a word of a rewrite',
    /\b(?:refactor(?:ed|ing|s)?|rewr(?:ite|ites|itten|ote)|rebuil(?:d|ds|t)|recod(?:e|ed|es)|legacy)\b/i,
  ],
  ['a word of an earlier state', /\b(?:formerly|previously|no longer|anymore|any more)\b/i],
  // "is used to" and "was used to" state a purpose.
  ['a word of an earlier state', /(?<!\b(?:is|are|be|been|was|were) )\bused to\b/i],
  ['a name of a form', /\b(?:old|new|former|previous|refactored|legacy) forms?\b/i],
  ['a name of a form', /\bboth forms\b|\buntil (?:each|every) family\b/i],
  ['an identifier of a form', /REFACTORED|[Rr]efactored|[Ll]egacy[A-Z_]|\b[Vv]2[A-Z_]|[a-z]V2\b/],
  [
    'a plan label',
    new RegExp(
      [
        String.raw`\(${LABELS}\)`,
        String.raw`['"\x60]${LABELS}: `,
        String.raw`\bmeasurement ${LABEL}`,
        String.raw`\.test\.tsx?\x60?, ${LABELS}`,
        String.raw`\b${LABEL} of \x60?[\w/.-]*test`,
        String.raw`^\s*(?:\/\/|\*) ${LABEL}(?:\.| is )`,
        String.raw`\b${LABEL}(?:, ${LABEL})* (?:to|and) ${LABEL}`,
        String.raw`\(\d\.\d, ${LABEL}`,
      ].join('|'),
    ),
  ],
  // A link to another repository, such as `vuejs/core#123`, is a reason and stays.
  ['a pull request of this repository', /(?<![\w/-])(?:PR|pull request) #\d+/i],
];

function tracesOf(text: string): string[] {
  return TRACES.filter(([, pattern]) => pattern.test(text)).map(([kind]) => kind);
}

const rows: { name: string; text: string; traces: string[] }[] = [
  {
    name: 'a word of a rewrite',
    text: '// The rebuilt list keeps its order.',
    traces: ['a word of a rewrite'],
  },
  {
    name: 'a word of an earlier state',
    text: '// The root no longer reads the store.',
    traces: ['a word of an earlier state'],
  },
  {
    name: 'a habit of the code',
    text: '// The part used to clone each item.',
    traces: ['a word of an earlier state'],
  },
  { name: 'a purpose', text: '// The id is used to name the popup.', traces: [] },
  {
    name: 'two forms of a part',
    text: '// The check accepts both forms until each family has the new one.',
    traces: ['a name of a form'],
  },
  {
    name: 'an identifier of an earlier form',
    text: 'export const REFACTORED_FOLDERS = [];',
    traces: ['an identifier of a form'],
  },
  {
    name: 'a label after a title',
    text: "describe('the root (L1)', () => {",
    traces: ['a plan label'],
  },
  { name: 'a label before a title', text: "test('M3: a press', () => {", traces: ['a plan label'] },
  {
    name: 'a label after a measurement file',
    text: '// The input keeps the focus (test/measurements/combobox.test.ts, C1).',
    traces: ['a plan label'],
  },
  { name: 'a range of labels', text: '// M1 to M6 use native elements.', traces: ['a plan label'] },
  {
    name: 'a pull request of this repository',
    text: '// The order came with PR #745.',
    traces: ['a pull request of this repository'],
  },
  { name: 'an issue of another repository', text: '// See vuejs/core#13042.', traces: [] },
  { name: 'a key', text: "test('F6 moves the focus to the toasts (F6)', () => {", traces: [] },
  {
    name: 'a title with the name of a measurement',
    text: '// (test/measurements/combobox.test.ts, "a press in a popup").',
    traces: [],
  },
];

for (const { name, text, traces } of rows) {
  test(`tracesOf: ${name}`, () => {
    assert.deepEqual(tracesOf(text), traces);
  });
}

// The list has each file that git tracks or that is new, and no ignored file.
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: REPOSITORY_ROOT, encoding: 'utf8' },
)
  .split('\0')
  .filter(
    (file) =>
      file !== '' &&
      file !== SELF &&
      !SKIPPED_FILES.some((skipped) => skipped.test(file)) &&
      existsSync(join(REPOSITORY_ROOT, file)),
  );

test('no file names an earlier form of the code, a plan or a plan label', () => {
  const found = files.flatMap((file) => [
    ...tracesOf(file).map((kind) => `${file}: ${kind} in the path`),
    ...readRepositoryFile(REPOSITORY_ROOT, file)
      .split('\n')
      .flatMap((line, index) => {
        const text = line.trim();
        if (ALLOWED_LINES.some((allowed) => allowed.file === file && allowed.text === text)) {
          return [];
        }
        return tracesOf(line).map((kind) => `${file}:${index + 1}: ${kind}: ${text}`);
      }),
  ]);
  assert.deepEqual(found, []);
});
