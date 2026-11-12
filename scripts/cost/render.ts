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
const FIELDS = [...COUNTS, 'total'] as const;

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
]);

const MEASURED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/;
const MODEL_ID = /^([a-z]+(?:-[a-z]+)*)-(\d+)-(\d+)$/;
const START = '<!-- cost:start -->';
const END = '<!-- cost:end -->';

type Field = (typeof FIELDS)[number];

export type Usage = Record<Field, number>;

export interface Row {
  measuredAt: string;
  commit: string;
  byModel: Record<string, Usage>;
  byWork: Record<string, Usage>;
  total: Usage;
}

interface Line {
  label: string;
  total: number;
}

function add(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
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

function checkSum(where: string, usage: Usage): void {
  const counted = add(COUNTS.map((field) => usage[field]));
  if (usage.total !== counted) {
    throw new Error(`${where}: total is ${usage.total}, but the four counts add up to ${counted}.`);
  }
}

function checkGroup(name: string, group: Record<string, Usage>, total: Usage): void {
  for (const [key, usage] of Object.entries(group)) {
    checkSum(`${name} "${key}"`, usage);
  }
  for (const field of FIELDS) {
    const added = add(Object.values(group).map((usage) => usage[field]));
    if (added !== total[field]) {
      throw new Error(`${name} adds up to ${added} in ${field}, but total has ${total[field]}.`);
    }
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
  checkSum('total', row.total);
  checkGroup('byModel', row.byModel, row.total);
  checkGroup('byWork', row.byWork, row.total);
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

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
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
    ['Model', ...MODEL_COLUMNS.map(([title]) => title)],
    [...models, { label: 'Total', ...row.total }].map((line) => [
      line.label,
      ...MODEL_COLUMNS.map(([, field]) => formatNumber(line[field])),
    ]),
  );
}

function workTable(row: Row): string {
  const totals = new Map<string, number>();
  for (const [key, usage] of Object.entries(row.byWork)) {
    const label = workLabel(key);
    totals.set(label, (totals.get(label) ?? 0) + usage.total);
  }
  const work = [...totals].map(([label, total]) => ({ label, total })).sort(largestFirst);
  return table(
    ['Work', 'All tokens'],
    work.map(({ label, total }) => [label, formatNumber(total)]),
  );
}

export async function renderBlock(row: Row, readmePath: string): Promise<string> {
  const markdown = [
    `Measured on ${row.measuredAt.slice(0, 10)} (UTC).`,
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
