import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderBlock, replaceBlock, validate } from './render.ts';
import type { Row, Usage } from './render.ts';

const README_PATH = join(import.meta.dirname, '..', '..', 'README.md');

function usage(
  input: number,
  output: number,
  writes5m: number,
  writes1h: number,
  reads: number,
  usd: string,
): Usage {
  return {
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: writes5m + writes1h,
    cache_creation_5m: writes5m,
    cache_creation_1h: writes1h,
    cache_read_input_tokens: reads,
    total: input + output + writes5m + writes1h + reads,
    usd,
  };
}

function makeRow(measuredAt: string): Row {
  return {
    measuredAt,
    commit: '0123456789abcdef0123456789abcdef01234567',
    prices: {
      readOn: '2026-11-10',
      source: 'https://example.com/prices',
      unit: 'USD per million tokens',
      models: {
        'vendor-small-1-0': {
          input: '2',
          cache_write_5m: '2.50',
          cache_write_1h: '4',
          cache_read: '0.20',
          output: '10',
        },
        'vendor-large-2-1': {
          input: '8',
          cache_write_5m: '10',
          cache_write_1h: '16',
          cache_read: '0.80',
          output: '40',
        },
      },
    },
    byModel: {
      // The exact price is 1.015. Binary floating point gives 1.01.
      'vendor-small-1-0': usage(500, 50_000, 40_000, 10_000, 1_870_000, '1.02'),
      'vendor-large-2-1': usage(1_250, 20_000_000, 30_000_000, 5_000_000, 67_625_000, '1234.11'),
    },
    byWork: {
      'research and plan': usage(250, 3_000_000, 5_000_000, 0, 10_000_000, '185.00'),
      coordination: usage(250, 3_000_000, 0, 5_000_000, 10_000_000, '215.02'),
      'unit alpha': usage(500, 4_000_000, 8_000_000, 10_000, 15_000_000, '250.50'),
      spikes: usage(500, 6_000_000, 10_000_000, 0, 20_000_000, '370.10'),
      'unit beta': usage(250, 4_000_000, 7_000_000, 0, 14_000_000, '213.50'),
      other: usage(0, 50_000, 40_000, 0, 495_000, '1.01'),
    },
    total: {
      // The exact total is 1235.125, and a half cent goes to the even cent.
      // The rounded model prices add up to 1235.13.
      ...usage(1_750, 20_050_000, 30_040_000, 5_010_000, 69_495_000, '1235.12'),
      cache_creation_lifetime_not_reported: 0,
    },
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

test('renderBlock writes the dates, both tables and the prices', async () => {
  const expected = [
    'Measured on 2026-11-12 (UTC). Prices read on 2026-11-10.',
    '',
    '| Model            |     Output | Cache writes | Cache reads |  All tokens | API price |',
    '| ---------------- | ---------: | -----------: | ----------: | ----------: | --------: |',
    '| Vendor Large 2.1 | 20,000,000 |   35,000,000 |  67,625,000 | 122,626,250 | $1,234.11 |',
    '| Vendor Small 1.0 |     50,000 |       50,000 |   1,870,000 |   1,970,500 |     $1.02 |',
    '| Total            | 20,050,000 |   35,050,000 |  69,495,000 | 124,596,750 | $1,235.12 |',
    '',
    '| Work              | All tokens | API price |',
    '| ----------------- | ---------: | --------: |',
    '| Pull requests     | 52,010,750 |   $464.00 |',
    '| Experiments       | 36,000,500 |   $370.10 |',
    '| Coordination      | 18,000,250 |   $215.02 |',
    '| Research and plan | 18,000,250 |   $185.00 |',
    '| Other             |    585,000 |     $1.01 |',
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
      /row 2 .*: byModel "vendor-small-1-0": total is 1970501, but the four counts add up to 1970500\./,
  },
  {
    name: 'a work total that is not the sum of its counts',
    change: (history) => {
      history[1].byWork['unit beta'].total += 1;
    },
    message:
      /row 2 .*: byWork "unit beta": total is 25000251, but the four counts add up to 25000250\./,
  },
  {
    name: 'a row total that is not the sum of its counts',
    change: (history) => {
      history[1].total.total += 1;
    },
    message: /row 2 .*: total: total is 124596751, but the four counts add up to 124596750\./,
  },
  {
    name: 'models that do not add up to the total',
    change: (history) => {
      const model = history[1].byModel['vendor-small-1-0'];
      model.output_tokens += 1;
      model.total += 1;
    },
    message: /row 2 .*: byModel adds up to 20050001 in output_tokens, but total has 20050000\./,
  },
  {
    name: 'work that does not add up to the total',
    change: (history) => {
      const work = history[1].byWork.spikes;
      work.cache_read_input_tokens += 1;
      work.total += 1;
    },
    message:
      /row 2 .*: byWork adds up to 69495001 in cache_read_input_tokens, but total has 69495000\./,
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
  {
    name: 'cache writes that are not the sum of the two lifetimes',
    change: (history) => {
      history[1].byModel['vendor-small-1-0'].cache_creation_5m += 1;
    },
    message:
      /row 2 .*: byModel "vendor-small-1-0": cache_creation_input_tokens is 50000, but the two lifetimes add up to 50001\./,
  },
  {
    name: 'work that does not add up to the total in one lifetime',
    change: (history) => {
      const work = history[1].byWork['unit alpha'];
      work.cache_creation_5m -= 1;
      work.cache_creation_1h += 1;
    },
    message: /row 2 .*: byWork adds up to 30039999 in cache_creation_5m, but total has 30040000\./,
  },
  {
    name: 'a readOn of another form',
    change: (history) => {
      history[1].prices.readOn = '10 November 2026';
    },
    message: /row 2 .*: prices\.readOn must have the form 2026-11-12\./,
  },
  {
    name: 'a model that has no prices',
    change: (history) => {
      delete history[1].prices.models['vendor-small-1-0'];
    },
    message: /row 2 .*: prices has no model "vendor-small-1-0"\./,
  },
  {
    name: 'a price that is a number',
    change: (history) => {
      const prices: Record<string, unknown> = history[1].prices.models['vendor-small-1-0'];
      prices.cache_read = 0.2;
    },
    message:
      /row 2 .*: prices of "vendor-small-1-0": cache_read must be a string of digits with at most 4 decimals\./,
  },
  {
    name: 'a usd of another form',
    change: (history) => {
      history[1].byWork.spikes.usd = '370.1';
    },
    message:
      /row 2 .*: byWork "spikes": usd must be a string with two decimals, such as "12\.30"\./,
  },
  {
    name: 'a model usd that is not the price of its tokens',
    change: (history) => {
      history[1].byModel['vendor-large-2-1'].usd = '1234.12';
    },
    message:
      /row 2 .*: byModel "vendor-large-2-1": usd is 1234\.12, but the tokens at the prices of the row cost 1234\.11\./,
  },
  {
    name: 'a total usd that is the sum of the rounded model prices',
    change: (history) => {
      history[1].total.usd = '1235.13';
    },
    message: /row 2 .*: total: usd is 1235\.13, but the models cost 1235\.12 together\./,
  },
  {
    name: 'work prices that do not add up to the total',
    change: (history) => {
      history[1].byWork.spikes.usd = '370.13';
    },
    message:
      /row 2 .*: byWork adds up to 1235\.16 in usd, but the models cost 1235\.12 together\. The two can differ by half a cent for each work key\./,
  },
];

for (const { name, change, message } of faults) {
  test(`validate throws for ${name}`, () => {
    const history = makeHistory();
    change(history);
    assert.throws(() => validate(history), message);
  });
}
