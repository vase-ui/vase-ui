import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PageLink {
  text: string;
  link: string;
}

export interface PageGroup {
  text: string;
  items: PageLink[];
}

interface Page extends PageLink {
  order: number;
}

const NOT_GROUP_FOLDERS = new Set(['node_modules', 'public']);

function firstMatch(lines: string[], pattern: RegExp): string | undefined {
  for (const line of lines) {
    const found = pattern.exec(line);
    if (found) {
      return found[1];
    }
  }
  return undefined;
}

function linkOf(folder: string | undefined, file: string): string {
  const name = file.slice(0, -'.md'.length);
  if (folder === undefined) {
    return `/${name}`;
  }
  return name === 'index' ? `/${folder}/` : `/${folder}/${name}`;
}

function readPage(docsRoot: string, folder: string | undefined, file: string): Page {
  const path = folder === undefined ? file : `${folder}/${file}`;
  const lines = readFileSync(join(docsRoot, path), 'utf8').split(/\r?\n/);
  const frontMatterEnd = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  const frontMatter = frontMatterEnd === -1 ? [] : lines.slice(1, frontMatterEnd);
  const text = firstMatch(lines.slice(frontMatterEnd + 1), /^# (\S.*?)\s*$/);
  if (text === undefined) {
    throw new Error(
      `docs/${path}: the page has no first-level heading. Add one. It is the title in the navigation.`,
    );
  }
  const order = firstMatch(frontMatter, /^order: (\d+)$/);
  if (order === undefined) {
    throw new Error(
      `docs/${path}: the page has no "order" in its front matter. Add the line "order: <whole number>" between two "---" lines at the top of the file.`,
    );
  }
  return { text, link: linkOf(folder, file), order: Number(order) };
}

function readPages(docsRoot: string, folder?: string): PageLink[] {
  return readdirSync(join(docsRoot, folder ?? ''), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .filter((entry) => folder !== undefined || entry.name !== 'index.md')
    .map((entry) => readPage(docsRoot, folder, entry.name))
    .sort((a, b) => a.order - b.order || a.text.localeCompare(b.text, 'en'))
    .map(({ text, link }) => ({ text, link }));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function readNavigation(docsRoot: string): { nav: PageLink[]; sidebar: PageGroup[] } {
  const nav = readPages(docsRoot);
  const groups = readdirSync(docsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && !entry.name.startsWith('.') && !NOT_GROUP_FOLDERS.has(entry.name),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((folder) => ({ text: capitalize(folder), items: readPages(docsRoot, folder) }))
    .filter((group) => group.items.length > 0);
  return {
    nav,
    sidebar: [...(nav.length > 0 ? [{ text: 'Overview', items: nav }] : []), ...groups],
  };
}
