import { existsSync, readFileSync } from 'node:fs';
import type { EntrySize, PackageSize } from './measure.ts';

const metrics = { raw: 'Raw', gzip: 'gzip', brotli: 'Brotli' } as const;
const formats = ['raw', 'gzip', 'brotli'] as const;
const bytes = new Intl.NumberFormat('en-US');
const signedBytes = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' });
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

function entrySum(size: PackageSize): EntrySize {
  const sum = { raw: 0, gzip: 0, brotli: 0 };
  for (const entry of Object.values(size.entries)) {
    for (const key of formats) sum[key] += entry[key];
  }
  return sum;
}

function summary(size: PackageSize): string {
  const sum = entrySum(size);
  return (
    `Packed ${bytes.format(size.packed)} B, unpacked ${bytes.format(size.unpacked)} B. ` +
    `Entries total ${bytes.format(sum.raw)} B raw, ${bytes.format(sum.gzip)} B gzip and ${bytes.format(sum.brotli)} B Brotli.`
  );
}

function comparison(base: number | undefined, merge: number | undefined): string {
  const delta = (merge ?? 0) - (base ?? 0);
  const change = base ? percent.format(delta / base) : '—';
  return [
    base === undefined ? '—' : bytes.format(base),
    merge === undefined ? '—' : bytes.format(merge),
    signedBytes.format(delta),
    change,
  ].join(' | ');
}

export function sizeReport(base: PackageSize | undefined, merge: PackageSize | undefined): string {
  if (!base || !merge) {
    if (merge) return `Could not measure the base build.\n\n**Merge build**\n\n${summary(merge)}`;
    if (base) return `Could not measure the merge build.\n\n**Base build**\n\n${summary(base)}`;
    return 'Could not measure either build.';
  }

  const names = [...new Set([...Object.keys(base.entries), ...Object.keys(merge.entries)])].sort();
  const changed: string[] = [];
  const unchanged: string[] = [];
  for (const name of names) {
    const before = base.entries[name];
    const after = merge.entries[name];
    if (before && after && formats.every((key) => before[key] === after[key])) unchanged.push(name);
    else changed.push(name);
  }

  if (!changed.length && base.packed === merge.packed && base.unpacked === merge.unpacked) {
    return `No size change. ${summary(merge)}`;
  }

  const columns = 'Base (B) | Merge (B) | Change (B) | Change (%) |';
  const alignment = '---: | ---: | ---: | ---: |';
  const rows = [
    '### Package size',
    '',
    `| Measure | ${columns}`,
    `| --- | ${alignment}`,
    `| Packed tarball | ${comparison(base.packed, merge.packed)} |`,
    `| Unpacked tarball | ${comparison(base.unpacked, merge.unpacked)} |`,
  ];
  const baseSum = entrySum(base);
  const mergeSum = entrySum(merge);
  for (const key of formats) {
    rows.push(`| Sum of entries (${metrics[key]}) | ${comparison(baseSum[key], mergeSum[key])} |`);
  }
  if (!changed.length && base.unpacked === merge.unpacked) {
    rows.push(
      '',
      'Only the packed size changed. Declaration order can vary between builds of the same source.',
    );
  }
  if (changed.length) {
    rows.push(
      '',
      '### Changed entries',
      '',
      `| Entry | Format | ${columns}`,
      `| --- | --- | ${alignment}`,
    );
    for (const name of changed) {
      const before = base.entries[name];
      const after = merge.entries[name];
      let label = `\`${encodeURI(name)}\``;
      if (!before) label += ' (new)';
      if (!after) label += ' (removed)';
      for (const key of formats) {
        rows.push(`| ${label} | ${metrics[key]} | ${comparison(before?.[key], after?.[key])} |`);
        label = '';
      }
    }
  }
  if (unchanged.length) {
    rows.push(
      '',
      '<details>',
      `<summary>Unchanged entries (${unchanged.length})</summary>`,
      '',
      '| Entry | Raw (B) | gzip (B) | Brotli (B) |',
      '| --- | ---: | ---: | ---: |',
    );
    for (const name of unchanged) {
      const entry = merge.entries[name];
      const sizes = formats.map((key) => bytes.format(entry[key])).join(' | ');
      rows.push(`| \`${encodeURI(name)}\` | ${sizes} |`);
    }
    rows.push('', '</details>');
  }
  return rows.join('\n');
}

if (import.meta.main) {
  const [base, merge] = process.argv
    .slice(2)
    .map((path): PackageSize | undefined =>
      existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined,
    );
  console.log(sizeReport(base, merge));
}
