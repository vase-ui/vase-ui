import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** The folders of `docs` that hold one page for each family. */
const FAMILY_PAGE_FOLDERS = ['components'];

const FAMILY_PAGE = /^([^/]+)\/([^/]+)\.md$/;

export interface FamilyPage {
  /** The path from the docs folder, such as `components/button.md`. */
  path: string;
  family: string;
}

/** The family of a page path such as `components/button.md`, or `undefined` when the page is not a family page. */
export function familyOfPage(relativePath: string): string | undefined {
  const [, folder, family] = FAMILY_PAGE.exec(relativePath) ?? [];
  return folder !== undefined && FAMILY_PAGE_FOLDERS.includes(folder) ? family : undefined;
}

export function listFamilyPages(docsRoot: string): FamilyPage[] {
  return FAMILY_PAGE_FOLDERS.filter((folder) => existsSync(join(docsRoot, folder)))
    .flatMap((folder) => readdirSync(join(docsRoot, folder)).map((name) => `${folder}/${name}`))
    .flatMap((path) => {
      const family = familyOfPage(path);
      return family === undefined ? [] : [{ path, family }];
    });
}
