import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { readParityFiles, REPOSITORY_ROOT } from '../parity/repository.ts';
import { countComponents } from './components.ts';

const START = '<!-- status:start -->';
const END = '<!-- status:end -->';

export function renderStatusLine({ done, total }: { done: number; total: number }): string {
  return `Status: ${done} of ${total} components. The guarantee starts with the first full release.`;
}

export function replaceStatus(readme: string, line: string): string {
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
  return `${readme.slice(0, start + START.length)}\n\n${line}\n\n${readme.slice(end)}`;
}

function main(): void {
  const { values } = parseArgs({ options: { check: { type: 'boolean' } } });
  const { upstream, families, problems } = readParityFiles(REPOSITORY_ROOT, {
    readExtracts: false,
  });
  if (problems.length > 0 || upstream === undefined) {
    for (const problem of problems) {
      console.error(problem);
    }
    process.exitCode = 1;
    return;
  }
  const readmePath = join(REPOSITORY_ROOT, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const updated = replaceStatus(
    readme,
    renderStatusLine(countComponents(families, upstream.components)),
  );
  if (updated === readme) {
    return;
  }
  if (values.check) {
    console.error('README.md differs from the files in parity. Run `pnpm status:render`.');
    process.exitCode = 1;
    return;
  }
  writeFileSync(readmePath, updated);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
