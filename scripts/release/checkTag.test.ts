import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseTagProblem } from './checkTag.ts';

const rows: { name: string; tag: string; version: string; problem?: string }[] = [
  { name: 'the tag is `v` plus the version', tag: 'v2026.11.0', version: '2026.11.0' },
  {
    name: 'a month of one digit and a MICRO of two digits',
    tag: 'v2027.1.12',
    version: '2027.1.12',
  },
  {
    name: 'the tag names another version',
    tag: 'v2026.11.1',
    version: '2026.11.0',
    problem: 'v2026.11.0',
  },
  { name: 'the tag has no `v`', tag: '2026.11.0', version: '2026.11.0', problem: 'v2026.11.0' },
  {
    name: 'the year has five digits',
    tag: 'v20266.11.0',
    version: '20266.11.0',
    problem: 'CalVer',
  },
  {
    name: 'the year has three digits',
    tag: 'v202.11.0',
    version: '202.11.0',
    problem: 'CalVer',
  },
  {
    name: 'the month has a leading zero',
    tag: 'v2026.01.0',
    version: '2026.01.0',
    problem: 'CalVer',
  },
  { name: 'the month is 13', tag: 'v2026.13.0', version: '2026.13.0', problem: 'CalVer' },
  {
    name: 'MICRO has a leading zero',
    tag: 'v2026.11.01',
    version: '2026.11.01',
    problem: 'CalVer',
  },
  {
    name: 'the version has a prerelease part',
    tag: 'v2026.11.0-next.1',
    version: '2026.11.0-next.1',
    problem: 'CalVer',
  },
  { name: 'the version is a SemVer version', tag: 'v0.1.0', version: '0.1.0', problem: 'CalVer' },
];

for (const { name, tag, version, problem } of rows) {
  test(`releaseTagProblem: ${name}`, () => {
    const actual = releaseTagProblem(tag, version);
    if (problem === undefined) {
      assert.equal(actual, undefined);
    } else {
      assert.ok(actual?.includes(problem), `The problem must name ${problem}. Found: ${actual}`);
    }
  });
}
