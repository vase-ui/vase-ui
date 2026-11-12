import { DOCS_FOLDER_PREFIX } from '../parity/paths.ts';

/** The two globs that can name the docs folder of a family in its family file, as text for a message. */
export function docsFolderGlobs(family: string): string {
  return `"${DOCS_FOLDER_PREFIX}components/${family}/**" or "${DOCS_FOLDER_PREFIX}utils/${family}/**"`;
}
