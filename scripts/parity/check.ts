import { join } from 'node:path';
import { readTestRows } from './cases.ts';
import type { TestRow } from './cases.ts';
import { checkRepository, formatSummary } from './checkRepository.ts';
import { vaseFiles } from './paths.ts';
import {
  listVaseFiles,
  readParityFiles,
  readRepositoryFile,
  REPOSITORY_ROOT,
} from './repository.ts';
import { createVaseProject } from './vaseSurface.ts';
import type { VaseProject } from './vaseSurface.ts';

function main(): void {
  const rowCache = new Map<string, TestRow[]>();
  let project: VaseProject | undefined;
  const result = checkRepository({
    parity: readParityFiles(REPOSITORY_ROOT, { readExtracts: true }),
    files: vaseFiles(listVaseFiles(REPOSITORY_ROOT)),
    root: REPOSITORY_ROOT,
    rowsOf: (path) => {
      let rows = rowCache.get(path);
      if (!rows) {
        rows = readTestRows(path, readRepositoryFile(REPOSITORY_ROOT, path));
        rowCache.set(path, rows);
      }
      return rows;
    },
    project: () =>
      (project ??= createVaseProject(join(REPOSITORY_ROOT, 'packages/vue/tsconfig.json'))),
  });
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
