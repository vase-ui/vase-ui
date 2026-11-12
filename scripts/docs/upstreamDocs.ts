/** The folder of Base UI that holds one docs folder for each component and each utility. */
export const DOCS_FOLDER_PREFIX = 'docs/src/app/(docs)/react/';

/** The two globs that can name the docs folder of a family in its family file, as text for a message. */
export function docsFolderGlobs(family: string): string {
  return `"${DOCS_FOLDER_PREFIX}components/${family}/**" or "${DOCS_FOLDER_PREFIX}utils/${family}/**"`;
}
