import { basename } from 'node:path';
import type { TestRow } from './cases.ts';
import { isTestFile, isTypeTestFile, UPSTREAM_ROOTS } from './paths.ts';
import type { SurfaceFile } from './typesMd.ts';
import {
  array,
  boolean,
  nonEmptyString,
  nullable,
  object,
  oneOf,
  pattern,
  problemsOf,
  record,
  string,
  withRule,
} from './validate.ts';
import type { Check, Report } from './validate.ts';

export type ExceptionKind = 'replaced' | 'not-applicable' | 'engine' | 'waits-on';
export type Engine = 'chromium' | 'firefox' | 'webkit';
export type MemberKind = 'prop' | 'emit' | 'slot' | 'exposed';

export interface ExceptionRow {
  upstream: string;
  describe?: string[];
  title?: string;
  suite?: string;
  entry?: string;
  prop?: string;
  kind: ExceptionKind;
  test?: string;
  engine?: Engine;
  link?: string;
  waitsOn?: string;
  reason: string;
}

export interface SurfaceAddition {
  entry: string;
  prop?: string;
  emit?: string;
  slot?: string;
  exposed?: string;
  reason: string;
}

export interface FamilyFile {
  upstreamPaths: string[];
  matchedCommit: string;
  exceptions: ExceptionRow[];
  surfaceAdditions: SurfaceAddition[];
  notApplicableCommits: { sha: string; reason: string }[];
}

export interface UpstreamCommit {
  sha: string;
  date: string;
  subject: string;
  paths: string[];
}

export interface UpstreamFile {
  commit: string;
  describe: string;
  release: string;
  commits: UpstreamCommit[];
}

export interface FamilyExtract {
  commit: string;
  upstreamPaths: string[];
  sources: string[];
  typeTests: string[];
  cases: { file: string; rows: TestRow[] }[];
  surface: SurfaceFile[];
}

export interface BetterRow {
  id: string;
  evidence: string[];
  behavior: string;
  dueWith: string;
}

export type Target =
  | { type: 'file'; upstream: string }
  | { type: 'block'; upstream: string; describe: string[] }
  | { type: 'case'; upstream: string; describe: string[]; title: string }
  | { type: 'suite'; upstream: string; describe: string[]; suite: string }
  | { type: 'entry'; upstream: string; entry: string }
  | { type: 'prop'; upstream: string; entry: string; prop: string };

const KINDS: ExceptionKind[] = ['replaced', 'not-applicable', 'engine', 'waits-on'];
const ENGINES: Engine[] = ['chromium', 'firefox', 'webkit'];
export const MEMBER_KINDS: MemberKind[] = ['prop', 'emit', 'slot', 'exposed'];

export const FAMILY_NAME = /^[a-z][a-z0-9-]*$/;

/** The thing that an exception row names, or `undefined` when its keys do not fit together. */
export function targetOf(row: ExceptionRow): Target | undefined {
  const { upstream, describe, title, suite, entry, prop } = row;
  if (entry !== undefined) {
    if (describe || title !== undefined || suite !== undefined) {
      return undefined;
    }
    return prop === undefined
      ? { type: 'entry', upstream, entry }
      : { type: 'prop', upstream, entry, prop };
  }
  if (prop !== undefined) {
    return undefined;
  }
  if (describe === undefined) {
    return title === undefined && suite === undefined ? { type: 'file', upstream } : undefined;
  }
  if (title !== undefined) {
    return suite === undefined ? { type: 'case', upstream, describe, title } : undefined;
  }
  if (suite !== undefined) {
    return { type: 'suite', upstream, describe, suite };
  }
  return describe.length > 0 ? { type: 'block', upstream, describe } : undefined;
}

/** A file row on a file that is not a test names a source file, and it also covers the cases of the file. */
export function isSourceFileTarget(target: Target): boolean {
  return target.type === 'file' && !isTestFile(target.upstream) && !isTypeTestFile(target.upstream);
}

function nounOf(target: Target): string {
  switch (target.type) {
    case 'file':
      if (isTestFile(target.upstream)) {
        return 'a test';
      }
      return isTypeTestFile(target.upstream) ? 'a type test' : 'a source file';
    case 'block':
      return 'a describe block';
    case 'case':
      return 'a case';
    case 'suite':
      return 'a suite call';
    case 'entry':
      return 'an entry';
    case 'prop':
      return 'a prop row';
  }
}

function allowedKinds(target: Target): ExceptionKind[] {
  if (target.type === 'block' || target.type === 'case') {
    return KINDS;
  }
  if (target.type === 'file' && isTestFile(target.upstream)) {
    return KINDS;
  }
  if (target.type === 'suite' || (target.type === 'file' && isTypeTestFile(target.upstream))) {
    return ['replaced', 'not-applicable', 'waits-on'];
  }
  return ['not-applicable', 'waits-on'];
}

export function labelOf(target: Target): string {
  switch (target.type) {
    case 'file':
      return target.upstream;
    case 'block':
      return `${target.upstream}, block "${target.describe.join(' > ')}"`;
    case 'case':
      return `${target.upstream}, case "${[...target.describe, target.title].join(' > ')}"`;
    case 'suite':
      return `${target.upstream}, suite call "${[...target.describe, target.suite].join(' > ')}"`;
    case 'entry':
      return `${target.upstream}, entry "${target.entry}"`;
    case 'prop':
      return `${target.upstream}, entry "${target.entry}", prop "${target.prop}"`;
  }
}

export function targetKey(row: ExceptionRow): string {
  const { upstream, describe, title, suite, entry, prop, kind } = row;
  return JSON.stringify([kind === 'engine', upstream, describe, title, suite, entry, prop]);
}

function memberKeysOf(row: SurfaceAddition): MemberKind[] {
  return MEMBER_KINDS.filter((kind) => row[kind] !== undefined);
}

export function memberOf(row: SurfaceAddition): { kind: MemberKind; name: string } {
  const kind = memberKeysOf(row)[0];
  return { kind, name: row[kind] as string };
}

const sha = pattern(/^[0-9a-f]{40}$/, '40 hexadecimal digits');
const upstreamRootPath = pattern(
  new RegExp(`^(?:${UPSTREAM_ROOTS.join('|')})`),
  `a path that starts with ${UPSTREAM_ROOTS.join(', ')}`,
);
const link = pattern(/^https:\/\/\S+$/, 'a link that starts with https://');
const strings = array(string);

function checkExceptionRow(row: ExceptionRow, place: string, report: Report): void {
  const target = targetOf(row);
  if (!target) {
    report(
      place,
      'has keys that do not name one thing. Give "upstream" with one of these: nothing, "describe" with at least one title, "describe" and "title", "describe" and "suite", "entry", or "entry" and "prop".',
    );
    return;
  }
  const noun = nounOf(target);
  const allowed = allowedKinds(target);
  if (!allowed.includes(row.kind)) {
    report(
      place,
      `a row that names ${noun} cannot have the kind "${row.kind}". Use ${allowed.map((kind) => `"${kind}"`).join(', ')}.`,
    );
  }
  if (row.kind === 'replaced') {
    if (row.test === undefined) {
      report(place, 'a "replaced" row needs "test".');
    }
  } else if (row.test !== undefined) {
    report(place, 'only a "replaced" row has "test".');
  }
  if (row.kind === 'engine') {
    if (row.engine === undefined || row.link === undefined) {
      report(place, 'an "engine" row needs "engine" and "link".');
    }
  } else if (row.engine !== undefined || row.link !== undefined) {
    report(place, 'only an "engine" row has "engine" and "link".');
  }
  if (row.kind !== 'waits-on') {
    if (row.waitsOn !== undefined) {
      report(place, 'only a "waits-on" row has "waitsOn".');
    }
  } else if (isSourceFileTarget(target)) {
    if (row.waitsOn !== undefined) {
      report(
        place,
        'a "waits-on" row that names a source file has no "waitsOn". The row waits for the file itself.',
      );
    }
  } else if (row.waitsOn === undefined) {
    report(place, `a "waits-on" row that names ${noun} needs "waitsOn".`);
  }
}

function checkDuplicates<T>(
  rows: T[],
  keyOf: (row: T) => string,
  place: string,
  report: Report,
): void {
  const firstIndex = new Map<string, number>();
  rows.forEach((row, index) => {
    const key = keyOf(row);
    const first = firstIndex.get(key);
    if (first === undefined) {
      firstIndex.set(key, index);
    } else {
      report(`${place}[${index}]`, `names the same thing as ${place}[${first}]. Keep one row.`);
    }
  });
}

const exceptionRow = withRule<ExceptionRow>(
  object(
    {
      upstream: nonEmptyString,
      describe: strings,
      title: string,
      suite: nonEmptyString,
      entry: nonEmptyString,
      prop: nonEmptyString,
      kind: oneOf(...KINDS),
      test: nonEmptyString,
      engine: oneOf(...ENGINES),
      link,
      waitsOn: upstreamRootPath,
      reason: nonEmptyString,
    },
    ['describe', 'title', 'suite', 'entry', 'prop', 'test', 'engine', 'link', 'waitsOn'],
  ),
  checkExceptionRow,
);

const surfaceAddition = withRule<SurfaceAddition>(
  object(
    {
      entry: nonEmptyString,
      prop: nonEmptyString,
      emit: nonEmptyString,
      slot: nonEmptyString,
      exposed: nonEmptyString,
      reason: nonEmptyString,
    },
    MEMBER_KINDS,
  ),
  (row, place, report) => {
    if (memberKeysOf(row).length !== 1) {
      report(place, 'names one member. Give exactly one of "prop", "emit", "slot" and "exposed".');
    }
  },
);

const familyFile = withRule<FamilyFile>(
  object({
    upstreamPaths: array(nonEmptyString, { nonEmpty: true }),
    matchedCommit: sha,
    exceptions: array(exceptionRow),
    surfaceAdditions: array(surfaceAddition),
    notApplicableCommits: array(object({ sha, reason: nonEmptyString })),
  }),
  (family, _place, report) => {
    checkDuplicates(family.exceptions, targetKey, 'exceptions', report);
    checkDuplicates(
      family.surfaceAdditions,
      (row) => JSON.stringify([row.entry, memberOf(row)]),
      'surfaceAdditions',
      report,
    );
  },
);

const upstreamFile = withRule<UpstreamFile>(
  object({
    commit: sha,
    describe: nonEmptyString,
    release: nonEmptyString,
    commits: array(object({ sha, date: nonEmptyString, subject: string, paths: strings }), {
      nonEmpty: true,
    }),
  }),
  (upstream, _place, report) => {
    if (upstream.commit !== upstream.commits.at(-1)?.sha) {
      report('commit', 'must be the "sha" of the last row of "commits".');
    }
    checkDuplicates(upstream.commits, (commit) => commit.sha, 'commits', report);
  },
);

const conditions = array(nonEmptyString, { nonEmpty: true });
const caseRow = object({ describe: strings, title: string, conditions }, ['conditions']);
const suiteRow = object({ describe: strings, suite: nonEmptyString, conditions }, ['conditions']);
const testRow: Check = (value, place, report) => {
  const isSuite = typeof value === 'object' && value !== null && 'suite' in value;
  (isSuite ? suiteRow : caseRow)(value, place, report);
};

const tableRows = object({ label: string, rows: array(record(nullable(string))) });
const namedCode = object({ name: string, code: string });
const surfaceFile = object({
  file: nonEmptyString,
  parts: array(
    object(
      {
        name: string,
        tag: nullable(string),
        props: nullable(
          array(
            object({ name: string, required: boolean, type: string, default: nullable(string) }),
          ),
        ),
        state: nullable(
          object({
            name: string,
            fields: array(object({ name: string, optional: boolean, type: string })),
            code: string,
          }),
        ),
        actions: nullable(object({ name: string, members: strings, code: string })),
        changeEventReason: nullable(object({ name: string, values: strings, code: string })),
        changeEventDetails: nullable(namedCode),
        dataAttributes: array(object({ name: string, type: nullable(string) })),
        cssVariables: array(object({ name: string, type: nullable(string) })),
        tables: array(tableRows),
        code: strings,
      },
      ['tables', 'code'],
    ),
  ),
  functions: array(object({ name: string, tables: array(tableRows), code: strings })),
  types: array(namedCode),
  additionalTypes: array(
    object(
      { name: string, code: string, constants: array(object({ name: string, value: string })) },
      ['constants'],
    ),
  ),
  externalTypes: array(namedCode),
});

const extract = object({
  commit: sha,
  upstreamPaths: array(nonEmptyString, { nonEmpty: true }),
  sources: strings,
  typeTests: strings,
  cases: array(object({ file: nonEmptyString, rows: array(testRow) })),
  surface: array(surfaceFile),
});

const betterRow = object({
  id: pattern(/^(?:VUE|BUG)-[0-9]+$/, 'VUE- or BUG- and a number'),
  evidence: array(link, { nonEmpty: true }),
  behavior: nonEmptyString,
  dueWith: upstreamRootPath,
});

export function validateFamilyFile(file: string, value: unknown): string[] {
  return problemsOf(file, familyFile, value);
}

export function validateExtract(file: string, value: unknown): string[] {
  return problemsOf(file, extract, value);
}

export function validateUpstreamFile(file: string, value: unknown): string[] {
  return problemsOf(file, upstreamFile, value);
}

export function validateBetterRow(file: string, value: unknown): string[] {
  const problems = problemsOf(file, betterRow, value);
  const id = (value as { id?: unknown } | null)?.id;
  if (problems.length === 0 && basename(file) !== `${id}.json`) {
    problems.push(`${file}: the file name must be ${id}.json, the id plus .json.`);
  }
  return problems;
}
