import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readTestRows } from './cases.ts';
import type { TestRow } from './cases.ts';

const forms: { name: string; source: string; rows: TestRow[] }[] = [
  {
    name: 'nested blocks give the titles of the blocks, outermost first',
    source: `
      describe('a', () => {
        describe('b', () => {
          it('c', () => {});
        });
        it('d', () => {});
      });
      it('e', () => {});
    `,
    rows: [
      { describe: ['a', 'b'], title: 'c' },
      { describe: ['a'], title: 'd' },
      { describe: [], title: 'e' },
    ],
  },
  {
    name: 'it and test both declare a case',
    source: `
      it('first', () => {});
      test('second', () => {});
    `,
    rows: [
      { describe: [], title: 'first' },
      { describe: [], title: 'second' },
    ],
  },
  {
    name: 'skipIf and runIf are conditions, and white space in them is one space',
    source: `
      it.skipIf(isJSDOM)('a', () => {});
      it.runIf(
        isWebKit   &&   hasTouch,
      )('b', () => {});
    `,
    rows: [
      { describe: [], title: 'a', conditions: ['skipIf(isJSDOM)'] },
      { describe: [], title: 'b', conditions: ['runIf(isWebKit && hasTouch)'] },
    ],
  },
  {
    name: 'each and for give one row with the title as written',
    source: `
      it.each([1, 2])('adds $name', () => {});
      describe.for([1, 2])('suite %s', () => {
        it('inside', () => {});
      });
    `,
    rows: [
      { describe: [], title: 'adds $name' },
      { describe: ['suite %s'], title: 'inside' },
    ],
  },
  {
    name: 'skipIf and each can follow each other',
    source: `it.skipIf(isJSDOM).each(table)('row $name', () => {});`,
    rows: [{ describe: [], title: 'row $name', conditions: ['skipIf(isJSDOM)'] }],
  },
  {
    name: 'skip and todo are conditions without a call',
    source: `
      it.skip('a', () => {});
      it.todo('b');
    `,
    rows: [
      { describe: [], title: 'a', conditions: ['skip'] },
      { describe: [], title: 'b', conditions: ['todo'] },
    ],
  },
  {
    name: 'a condition of a block goes to each case in it, before the condition of the case',
    source: `
      describe.skipIf(isJSDOM)('a', () => {
        it.runIf(isWebKit)('b', () => {});
        it('c', () => {});
      });
    `,
    rows: [
      { describe: ['a'], title: 'b', conditions: ['skipIf(isJSDOM)', 'runIf(isWebKit)'] },
      { describe: ['a'], title: 'c', conditions: ['skipIf(isJSDOM)'] },
    ],
  },
  {
    name: 'a template title with no substitution is its text',
    source: 'it(`plain text`, () => {});',
    rows: [{ describe: [], title: 'plain text' }],
  },
  {
    name: 'another title expression is its source text with one space for each run of white space',
    source: 'it(`opens ${  name }\n   twice`, () => {}); it(prefix + "x", () => {});',
    rows: [
      { describe: [], title: '`opens ${ name } twice`' },
      { describe: [], title: 'prefix + "x"' },
    ],
  },
  {
    name: 'a plain call in a block is a suite call',
    source: `
      describe('<Button />', () => {
        describeConformance(Button, () => ({}));
        it('own case', () => {});
      });
    `,
    rows: [
      { describe: ['<Button />'], suite: 'describeConformance' },
      { describe: ['<Button />'], title: 'own case' },
    ],
  },
  {
    name: 'a suite call can have skip, and a block condition goes to it',
    source: `
      describe.skipIf(isJSDOM)('<Button />', () => {
        describeConformance.skip(Button, () => ({}));
      });
    `,
    rows: [
      {
        describe: ['<Button />'],
        suite: 'describeConformance',
        conditions: ['skipIf(isJSDOM)', 'skip'],
      },
    ],
  },
  {
    name: 'a hook and a call of a member are not suite calls',
    source: `
      describe('a', () => {
        beforeEach(() => {});
        afterAll(() => {});
        vi.mock('x');
        clock.withFakeTimers();
        it('b', () => {});
      });
    `,
    rows: [{ describe: ['a'], title: 'b' }],
  },
  {
    name: 'a plain call outside a block is not a suite call',
    source: `
      setup();
      it('a', () => {});
    `,
    rows: [{ describe: [], title: 'a' }],
  },
  {
    name: 'a case in an exported function that is not a block is a row of the file',
    source: `
      export function sharedCases(render) {
        describe('shared', () => {
          it('works', () => {});
        });
      }
    `,
    rows: [{ describe: ['shared'], title: 'works' }],
  },
  {
    name: 'nothing comes from the callback of a case',
    source: `
      it('outer', () => {
        it('inner', () => {});
        describe('hidden', () => {});
      });
    `,
    rows: [{ describe: [], title: 'outer' }],
  },
];

for (const { name, source, rows } of forms) {
  test(`readTestRows: ${name}`, () => {
    assert.deepEqual(readTestRows('sample.test.ts', source), rows);
  });
}

const refusals: { name: string; source: string; message: RegExp }[] = [
  {
    name: '.only on a case',
    source: `\n it.only('a', () => {});`,
    message: /^sample\.test\.ts:2: `\.only` is not allowed\. Remove it\.$/,
  },
  {
    name: '.only on a block',
    source: `describe('a', () => {\n  describe.only('b', () => {});\n});`,
    message: /^sample\.test\.ts:2: `\.only` is not allowed\. Remove it\.$/,
  },
  {
    name: '.only on a suite call',
    source: `describe('a', () => {\n  describeConformance.only(Button);\n});`,
    message: /^sample\.test\.ts:2: `\.only` is not allowed\. Remove it\.$/,
  },
  {
    name: '.only after skipIf',
    source: `it.skipIf(isJSDOM).only('a', () => {});`,
    message: /^sample\.test\.ts:1: `\.only` is not allowed\. Remove it\.$/,
  },
  {
    name: '.only after each',
    source: `it.each([1, 2]).only('a', () => {});`,
    message: /^sample\.test\.ts:1: `\.only` is not allowed\. Remove it\.$/,
  },
  {
    name: 'a tagged template table',
    source: `\n\n it.each\`\n a | b\n 1 | 2\n\`('adds $a', () => {});`,
    message: /^sample\.test\.ts:3: a tagged template table is not supported/,
  },
  {
    name: 'a modifier that the reader does not know',
    source: `it.concurrent('a', () => {});`,
    message: /^sample\.test\.ts:1: the modifier "concurrent" is not supported/,
  },
  {
    name: 'a modifier that the reader does not know, after skipIf',
    source: `it.skipIf(isJSDOM).concurrent('a', () => {});`,
    message: /^sample\.test\.ts:1: the modifier "concurrent" is not supported/,
  },
];

for (const { name, source, message } of refusals) {
  test(`readTestRows refuses ${name} and names the line`, () => {
    assert.throws(() => readTestRows('sample.test.ts', source), { message });
  });
}
