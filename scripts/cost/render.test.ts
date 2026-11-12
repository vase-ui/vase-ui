import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderBlock, replaceBlock, validate } from './render.ts';
import type { Row, Usage } from './render.ts';

const README_PATH = join(import.meta.dirname, '..', '..', 'README.md');

function usage(input: number, output: number, cacheWrites: number, cacheReads: number): Usage {
  return {
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: cacheWrites,
    cache_read_input_tokens: cacheReads,
    total: input + output + cacheWrites + cacheReads,
  };
}

function makeRow(measuredAt: string): Row {
  return {
    measuredAt,
    commit: '0123456789abcdef0123456789abcdef01234567',
    byModel: {
      'vendor-small-1-0': usage(1, 200, 3_000, 400_000),
      'vendor-large-2-1': usage(10, 2_000, 30_000, 4_000_000),
    },
    byWork: {
      'research and plan': usage(2, 300, 6_000, 1_000_000),
      coordination: usage(1, 301, 6_000, 1_000_000),
      'unit alpha': usage(4, 700, 6_000, 300_000),
      spikes: usage(3, 400, 12_000, 1_900_000),
      'unit beta': usage(1, 499, 3_000, 200_000),
    },
    total: usage(11, 2_200, 33_000, 4_400_000),
  };
}

function makeHistory(): Row[] {
  return [makeRow('2026-11-12T00:54Z'), makeRow('2026-11-13T01:00Z')];
}

function rename(group: Record<string, Usage>, from: string, to: string): Record<string, Usage> {
  return Object.fromEntries(
    Object.entries(group).map(([key, value]) => [key === from ? to : key, value]),
  );
}

test('renderBlock writes the date and both tables', async () => {
  const expected = [
    'Measured on 2026-11-12 (UTC).',
    '',
    '| Model            | Output | Cache writes | Cache reads | All tokens |',
    '| ---------------- | -----: | -----------: | ----------: | ---------: |',
    '| Vendor Large 2.1 |  2,000 |       30,000 |   4,000,000 |  4,032,010 |',
    '| Vendor Small 1.0 |    200 |        3,000 |     400,000 |    403,201 |',
    '| Total            |  2,200 |       33,000 |   4,400,000 |  4,435,211 |',
    '',
    '| Work              | All tokens |',
    '| ----------------- | ---------: |',
    '| Experiments       |  1,912,403 |',
    '| Coordination      |  1,006,302 |',
    '| Research and plan |  1,006,302 |',
    '| Pull requests     |    510,204 |',
    '',
  ].join('\n');
  assert.equal(await renderBlock(makeRow('2026-11-12T00:54Z'), README_PATH), expected);
});

test('replaceBlock replaces the text between the markers and nothing else', () => {
  const readme = 'Before.\n\n<!-- cost:start -->\n\nOld block.\n\n<!-- cost:end -->\n\nAfter.\n';
  const updated = replaceBlock(readme, 'New block.\n');
  assert.equal(
    updated,
    'Before.\n\n<!-- cost:start -->\n\nNew block.\n\n<!-- cost:end -->\n\nAfter.\n',
  );
  assert.equal(replaceBlock(updated, 'New block.\n'), updated);
});

for (const { name, readme, message } of [
  { name: 'a README with no marker', readme: 'Text.\n', message: /no <!-- cost:start -->/ },
  {
    name: 'a README with no end marker',
    readme: 'Text.\n\n<!-- cost:start -->\n',
    message: /no <!-- cost:end -->/,
  },
  {
    name: 'a README with the end marker first',
    readme: '<!-- cost:end -->\n\n<!-- cost:start -->\n',
    message: /<!-- cost:end --> comes before <!-- cost:start -->/,
  },
]) {
  test(`replaceBlock throws for ${name}`, () => {
    assert.throws(() => replaceBlock(readme, 'Block.\n'), message);
  });
}

test('validate accepts a correct history', () => {
  assert.doesNotThrow(() => validate(makeHistory()));
});

const faults: { name: string; change: (history: Row[]) => void; message: RegExp }[] = [
  {
    name: 'a measuredAt of another form',
    change: (history) => {
      history[1].measuredAt = '2026-11-13 01:00';
    },
    message: /row 2 \(2026-11-13 01:00\): measuredAt must have the form/,
  },
  {
    name: 'a row with the time of the row before it',
    change: (history) => {
      history[1].measuredAt = history[0].measuredAt;
    },
    message: /row 2 .*: measuredAt is not later than 2026-11-12T00:54Z/,
  },
  {
    name: 'a row that is earlier than the row before it',
    change: (history) => {
      history[1].measuredAt = '2026-11-12T00:53Z';
    },
    message: /row 2 .*: measuredAt is not later than 2026-11-12T00:54Z/,
  },
  {
    name: 'a model total that is not the sum of its counts',
    change: (history) => {
      history[1].byModel['vendor-small-1-0'].total += 1;
    },
    message:
      /row 2 .*: byModel "vendor-small-1-0": total is 403202, but the four counts add up to 403201\./,
  },
  {
    name: 'a work total that is not the sum of its counts',
    change: (history) => {
      history[1].byWork['unit beta'].total += 1;
    },
    message:
      /row 2 .*: byWork "unit beta": total is 203501, but the four counts add up to 203500\./,
  },
  {
    name: 'a row total that is not the sum of its counts',
    change: (history) => {
      history[1].total.total += 1;
    },
    message: /row 2 .*: total: total is 4435212, but the four counts add up to 4435211\./,
  },
  {
    name: 'models that do not add up to the total',
    change: (history) => {
      const model = history[1].byModel['vendor-small-1-0'];
      model.output_tokens += 1;
      model.total += 1;
    },
    message: /row 2 .*: byModel adds up to 2201 in output_tokens, but total has 2200\./,
  },
  {
    name: 'work that does not add up to the total',
    change: (history) => {
      const work = history[1].byWork.spikes;
      work.cache_read_input_tokens += 1;
      work.total += 1;
    },
    message:
      /row 2 .*: byWork adds up to 4400001 in cache_read_input_tokens, but total has 4400000\./,
  },
  {
    name: 'a model id of another form',
    change: (history) => {
      history[1].byModel = rename(history[1].byModel, 'vendor-small-1-0', 'vendor-small-1');
    },
    message: /row 2 .*: Model id "vendor-small-1" does not have the form .* Add a rule/,
  },
  {
    name: 'a work key with no label',
    change: (history) => {
      history[1].byWork = rename(history[1].byWork, 'spikes', 'odd job');
    },
    message: /row 2 .*: Work key "odd job" has no label\. Add a label/,
  },
];

for (const { name, change, message } of faults) {
  test(`validate throws for ${name}`, () => {
    const history = makeHistory();
    change(history);
    assert.throws(() => validate(history), message);
  });
}
