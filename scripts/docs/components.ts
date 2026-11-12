import { isSourceFileTarget, targetOf } from '../parity/parityFiles.ts';
import type { FamilyFile } from '../parity/parityFiles.ts';
import { DOCS_FOLDER_PREFIX } from '../parity/paths.ts';
import type { FamilyFiles } from '../parity/repository.ts';

const COMPONENT_DOCS_ROOT = `${DOCS_FOLDER_PREFIX}components/`;

/** The name of the Base UI folder of the component that the family ports, or `undefined` when the family is not a component. */
function componentFolderOf(family: FamilyFile): string | undefined {
  const glob = family.upstreamPaths.find((path) => path.startsWith(COMPONENT_DOCS_ROOT));
  return glob?.slice(COMPONENT_DOCS_ROOT.length).split('/')[0];
}

export function isComponentFamily(family: FamilyFile): boolean {
  return componentFolderOf(family) !== undefined;
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

/** `components` is the list of component folders in `parity/upstream.json`. `notStarted` holds the names that no family file names. */
export function countComponents(
  families: FamilyFiles[],
  components: readonly string[],
): { done: number; total: number; notStarted: string[] } {
  const folders = families.map(({ family }) => family && componentFolderOf(family));
  return {
    done: families.filter(
      ({ family }) => family !== undefined && isComponentFamily(family) && isCompleteFamily(family),
    ).length,
    total: components.length,
    notStarted: components.filter((name) => !folders.includes(name)),
  };
}
