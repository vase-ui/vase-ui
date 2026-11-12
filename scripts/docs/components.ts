import { isSourceFileTarget, targetOf } from '../parity/parityFiles.ts';
import type { FamilyFile } from '../parity/parityFiles.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import { DOCS_FOLDER_PREFIX } from './upstreamDocs.ts';

// The number of folders under `docs/src/app/(docs)/react/components` in Base UI at the tracked commit.
// `pnpm parity:extract --upstream <path> --counts` prints it as `Components (38 types.md files)`.
// `parity/upstream.json` does not hold it.
export const BASE_UI_COMPONENT_COUNT = 38;

const COMPONENT_DOCS_ROOT = `${DOCS_FOLDER_PREFIX}components/`;

export function isComponentFamily(family: FamilyFile): boolean {
  return family.upstreamPaths.some((path) => path.startsWith(COMPONENT_DOCS_ROOT));
}

/** A `waits-on` row on a test waits for another family. Only a row on a source file, an entry or a prop row holds back this family. */
export function isCompleteFamily(family: FamilyFile): boolean {
  return !family.exceptions.some((row) => {
    const target = targetOf(row);
    return (
      row.kind === 'waits-on' &&
      target !== undefined &&
      (isSourceFileTarget(target) || target.type === 'entry' || target.type === 'prop')
    );
  });
}

export function countComponents(families: FamilyFiles[]): { done: number; total: number } {
  const done = families.filter(
    ({ family }) => family !== undefined && isComponentFamily(family) && isCompleteFamily(family),
  ).length;
  return { done, total: BASE_UI_COMPONENT_COUNT };
}
