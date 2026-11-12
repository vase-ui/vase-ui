import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { format, resolveConfig } from 'prettier';

const COUNTS = [
  'input_tokens',
  'output_tokens',
  'cache_creation_input_tokens',
  'cache_read_input_tokens',
] as const;
const FIELDS = [...COUNTS, 'cache_creation_5m', 'cache_creation_1h', 'total'] as const;

const PRICED_TOKENS = [
  ['input_tokens', 'input'],
  ['cache_creation_5m', 'cache_write_5m'],
  ['cache_creation_1h', 'cache_write_1h'],
  ['cache_read_input_tokens', 'cache_read'],
  ['output_tokens', 'output'],
] as const;

const MODEL_COLUMNS = [
  ['Output', 'output_tokens'],
  ['Cache writes', 'cache_creation_input_tokens'],
  ['Cache reads', 'cache_read_input_tokens'],
  ['All tokens', 'total'],
] as const;

const WORK_LABELS = new Map([
  ['research and plan', 'Research and plan'],
  ['spikes', 'Experiments'],
  ['coordination', 'Coordination'],
  ['other', 'Other'],
]);

const MEASURED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/;
const READ_ON = /^\d{4}-\d{2}-\d{2}$/;
const MODEL_ID = /^([a-z]+(?:-[a-z]+)*)-(\d+)-(\d+)$/;
const PRICE = /^\d+(?:\.\d{1,4})?$/;
const USD = /^\d+\.\d{2}$/;
const START = '<!-- cost:start -->';
const END = '<!-- cost:end -->';

// The code reads a price as ten-thousandths of a dollar for one million tokens.
// A token count times such a price is then a whole number of hundred-millionths of a cent.
const PARTS_PER_CENT = 10n ** 8n;

type Field = (typeof FIELDS)[number];
type PriceName = (typeof PRICED_TOKENS)[number][1];

export type Usage = Record<Field, number> & { usd: string };

export interface Row {
  measuredAt: string;
  commit: string;
  prices: {
    readOn: string;
    source: string;
    unit: string;
    models: Record<string, Record<PriceName, string>>;
  };
  byModel: Record<string, Usage>;
  byWork: Record<string, Usage>;
  total: Usage & { cache_creation_lifetime_not_reported: number };
}

interface Line {
  label: string;
  total: number;
}

function add(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function hasForm(value: unknown, form: RegExp): boolean {
  return typeof value === 'string' && form.test(value);
}

function readPrice(price: string): bigint {
  const [dollars, fraction = ''] = price.split('.');
  return BigInt(dollars + fraction.padEnd(4, '0'));
}

function readCents(usd: string): bigint {
  const [dollars, cents] = usd.split('.');
  return BigInt(dollars + cents);
}

function formatCents(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

function exactPrice(usage: Usage, prices: Record<PriceName, string>): bigint {
  return PRICED_TOKENS.reduce(
    (sum, [tokens, price]) => sum + BigInt(usage[tokens]) * readPrice(prices[price]),
    0n,
  );
}

function roundToCents(parts: bigint): bigint {
  const cents = parts / PARTS_PER_CENT;
  const twiceRest = (parts % PARTS_PER_CENT) * 2n;
  // An exact half cent goes to the even cent. The measurements round this way.
  const up = twiceRest > PARTS_PER_CENT || (twiceRest === PARTS_PER_CENT && cents % 2n === 1n);
  return up ? cents + 1n : cents;
}

function modelLabel(id: string): string {
  const match = MODEL_ID.exec(id);
  if (!match) {
    throw new Error(
      `Model id "${id}" does not have the form <words>-<major>-<minor>. Add a rule for it to modelLabel in scripts/cost/render.ts.`,
    );
  }
  const [, words, major, minor] = match;
  const name = words
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return `${name} ${major}.${minor}`;
}

function workLabel(key: string): string {
  // Each key that starts with `unit ` is the work on one pull request. The table adds them into one row.
  if (key.startsWith('unit ')) {
    return 'Pull requests';
  }
  const label = WORK_LABELS.get(key);
  if (label === undefined) {
    throw new Error(
      `Work key "${key}" has no label. Add a label for it to WORK_LABELS in scripts/cost/render.ts.`,
    );
  }
  return label;
}

function checkEntry(where: string, usage: Usage): void {
  const counted = add(COUNTS.map((field) => usage[field]));
  if (usage.total !== counted) {
    throw new Error(`${where}: total is ${usage.total}, but the four counts add up to ${counted}.`);
  }
  const lifetimes = usage.cache_creation_5m + usage.cache_creation_1h;
  if (usage.cache_creation_input_tokens !== lifetimes) {
    throw new Error(
      `${where}: cache_creation_input_tokens is ${usage.cache_creation_input_tokens}, but the two lifetimes add up to ${lifetimes}.`,
    );
  }
  if (!hasForm(usage.usd, USD)) {
    throw new Error(`${where}: usd must be a string with two decimals, such as "12.30".`);
  }
}

function checkGroup(name: string, group: Record<string, Usage>, total: Usage): void {
  for (const [key, usage] of Object.entries(group)) {
    checkEntry(`${name} "${key}"`, usage);
  }
  for (const field of FIELDS) {
    const added = add(Object.values(group).map((usage) => usage[field]));
    if (added !== total[field]) {
      throw new Error(`${name} adds up to ${added} in ${field}, but total has ${total[field]}.`);
    }
  }
}

function checkPrices(row: Row): void {
  if (!READ_ON.test(row.prices.readOn)) {
    throw new Error('prices.readOn must have the form 2026-11-12.');
  }
  for (const id of Object.keys(row.byModel)) {
    const prices = row.prices.models[id];
    if (prices === undefined) {
      throw new Error(`prices has no model "${id}".`);
    }
    for (const [, name] of PRICED_TOKENS) {
      if (!hasForm(prices[name], PRICE)) {
        throw new Error(
          `prices of "${id}": ${name} must be a string of digits with at most 4 decimals.`,
        );
      }
    }
  }
}

function checkUsd(row: Row): void {
  let exactTotal = 0n;
  for (const [id, usage] of Object.entries(row.byModel)) {
    const exact = exactPrice(usage, row.prices.models[id]);
    exactTotal += exact;
    const cents = roundToCents(exact);
    if (readCents(usage.usd) !== cents) {
      throw new Error(
        `byModel "${id}": usd is ${usage.usd}, but the tokens at the prices of the row cost ${formatCents(cents)}.`,
      );
    }
  }
  const totalCents = roundToCents(exactTotal);
  if (readCents(row.total.usd) !== totalCents) {
    throw new Error(
      `total: usd is ${row.total.usd}, but the models cost ${formatCents(totalCents)} together.`,
    );
  }
  // A work key mixes models, so its exact price is not known.
  // Each work price is at most half a cent from its exact price.
  const works = Object.values(row.byWork);
  const workCents = works.reduce((sum, usage) => sum + readCents(usage.usd), 0n);
  const workParts = workCents * PARTS_PER_CENT;
  const gap = workParts > exactTotal ? workParts - exactTotal : exactTotal - workParts;
  if (gap * 2n > BigInt(works.length) * PARTS_PER_CENT) {
    throw new Error(
      `byWork adds up to ${formatCents(workCents)} in usd, but the models cost ${formatCents(totalCents)} together. The two can differ by half a cent for each work key.`,
    );
  }
}

function checkRow(row: Row, previous: Row | undefined): void {
  if (!MEASURED_AT.test(row.measuredAt)) {
    throw new Error('measuredAt must have the form 2026-11-12T00:54Z.');
  }
  if (previous && row.measuredAt <= previous.measuredAt) {
    throw new Error(`measuredAt is not later than ${previous.measuredAt}, the row before it.`);
  }
  for (const id of Object.keys(row.byModel)) {
    modelLabel(id);
  }
  for (const key of Object.keys(row.byWork)) {
    workLabel(key);
  }
  checkEntry('total', row.total);
  checkGroup('byModel', row.byModel, row.total);
  checkGroup('byWork', row.byWork, row.total);
  checkPrices(row);
  checkUsd(row);
}

export function validate(history: Row[]): void {
  history.forEach((row, index) => {
    try {
      checkRow(row, history[index - 1]);
    } catch (error) {
      const fault = error instanceof Error ? error.message : String(error);
      throw new Error(`cost/history.json, row ${index + 1} (${row.measuredAt}): ${fault}`, {
        cause: error,
      });
    }
  });
}

function largestFirst(a: Line, b: Line): number {
  return b.total - a.total || a.label.localeCompare(b.label, 'en');
}

function formatNumber(value: number | bigint): string {
  return value.toLocaleString('en-US');
}

function formatPrice(cents: bigint): string {
  return `$${formatNumber(cents / 100n)}.${String(cents % 100n).padStart(2, '0')}`;
}

function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  const alignment = header.map((_, index) => (index === 0 ? '---' : '---:'));
  return [line(header), line(alignment), ...rows.map(line)].join('\n');
}

function modelTable(row: Row): string {
  const models = Object.entries(row.byModel)
    .map(([id, usage]) => ({ label: modelLabel(id), ...usage }))
    .sort(largestFirst);
  return table(
    ['Model', ...MODEL_COLUMNS.map(([title]) => title), 'API price'],
    [...models, { label: 'Total', ...row.total }].map((line) => [
      line.label,
      ...MODEL_COLUMNS.map(([, field]) => formatNumber(line[field])),
      formatPrice(readCents(line.usd)),
    ]),
  );
}

function workTable(row: Row): string {
  const totals = new Map<string, { total: number; cents: bigint }>();
  for (const [key, usage] of Object.entries(row.byWork)) {
    const label = workLabel(key);
    const sum = totals.get(label) ?? { total: 0, cents: 0n };
    totals.set(label, { total: sum.total + usage.total, cents: sum.cents + readCents(usage.usd) });
  }
  const work = [...totals].map(([label, sum]) => ({ label, ...sum })).sort(largestFirst);
  return table(
    ['Work', 'All tokens', 'API price'],
    work.map(({ label, total, cents }) => [label, formatNumber(total), formatPrice(cents)]),
  );
}

export async function renderBlock(row: Row, readmePath: string): Promise<string> {
  const markdown = [
    `Measured on ${row.measuredAt.slice(0, 10)} (UTC). Prices read on ${row.prices.readOn}.`,
    modelTable(row),
    workTable(row),
  ].join('\n\n');
  // Prettier sets the column widths. The block then passes `prettier --check`, and `pnpm format` does not change it.
  return format(markdown, { ...(await resolveConfig(readmePath)), parser: 'markdown' });
}

export function replaceBlock(readme: string, block: string): string {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start === -1) {
    throw new Error(`README.md has no ${START}.`);
  }
  if (end === -1) {
    throw new Error(`README.md has no ${END}.`);
  }
  if (end < start) {
    throw new Error(`In README.md, ${END} comes before ${START}.`);
  }
  return `${readme.slice(0, start + START.length)}\n\n${block.trimEnd()}\n\n${readme.slice(end)}`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { check: { type: 'boolean' } } });
  const root = join(import.meta.dirname, '..', '..');
  const readmePath = join(root, 'README.md');
  const history: Row[] = JSON.parse(readFileSync(join(root, 'cost', 'history.json'), 'utf8'));
  validate(history);
  const readme = readFileSync(readmePath, 'utf8');
  const updated = replaceBlock(readme, await renderBlock(history[history.length - 1], readmePath));
  if (updated === readme) {
    return;
  }
  if (values.check) {
    console.error(
      'README.md differs from the newest row of cost/history.json. Run `pnpm cost:render`.',
    );
    process.exitCode = 1;
    return;
  }
  writeFileSync(readmePath, updated);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
