import { join } from 'node:path';
import { readTestRows } from './cases.ts';
import type { TestRow } from './cases.ts';
import { checkRepository, formatSummary } from './checkRepository.ts';
import type { CheckResult } from './checkRepository.ts';
import { vaseFiles } from './paths.ts';
import type { VaseFiles } from './paths.ts';
import {
  listVaseFiles,
  readParityFiles,
  readRepositoryFile,
  REPOSITORY_ROOT,
} from './repository.ts';
import type { ParityFiles } from './repository.ts';
import { createVaseProject } from './vaseSurface.ts';
import type { VaseProject } from './vaseSurface.ts';

export interface ParityCheckRun {
  parity: ParityFiles;
  files: VaseFiles;
  rowsOf: (path: string) => TestRow[];
  result: CheckResult;
}

/** Runs the check of `pnpm parity:check`. It gives the files that it read, so that the parity page does not read them again. */
export function runParityCheck(root = REPOSITORY_ROOT): ParityCheckRun {
  const rowCache = new Map<string, TestRow[]>();
  let project: VaseProject | undefined;
  const parity = readParityFiles(root, { readExtracts: true });
  const files = vaseFiles(listVaseFiles(root));
  const rowsOf = (path: string): TestRow[] => {
    let rows = rowCache.get(path);
    if (!rows) {
      rows = readTestRows(path, readRepositoryFile(root, path));
      rowCache.set(path, rows);
    }
    return rows;
  };
  const result = checkRepository({
    parity,
    files,
    root,
    rowsOf,
    project: () => (project ??= createVaseProject(join(root, 'packages/vue/tsconfig.json'))),
  });
  return { parity, files, rowsOf, result };
}

function main(): void {
  const { result } = runParityCheck();
  for (const problem of result.problems) {
    console.error(problem);
  }
  for (const line of formatSummary(result)) {
    console.log(line);
  }
  if (result.problems.length > 0) {
    const count = result.problems.length;
    console.error(
      `${count} ${count === 1 ? 'problem' : 'problems'}. Each line above says what to do.`,
    );
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
