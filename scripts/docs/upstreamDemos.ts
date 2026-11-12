import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { FamilyFile } from '../parity/parityFiles.ts';
import { DOCS_FOLDER_PREFIX } from '../parity/paths.ts';
import {
  extractCommand,
  familyFile,
  readParityFiles,
  REPOSITORY_ROOT,
} from '../parity/repository.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import { listFiles, readFileAt, resolveCommit } from '../parity/upstreamClone.ts';
import { listFamilyPages } from './familyPages.ts';
import { docsFolderGlobs } from './upstreamDocs.ts';

/** A demo of Base UI has one folder for each variant. The Tailwind variants are not ported. */
const TAILWIND_FOLDER = 'tailwind';

export interface DemoRecord {
  commit: string;
  /** The folder of Base UI that holds the demos of the family. */
  upstream: string;
  /** The SHA-256 of each upstream file, by its path from `upstream`. */
  files: Record<string, string>;
}

export interface UpstreamDemos {
  record: DemoRecord;
  /** The text of each recorded style sheet, by its path from `upstream`. */
  styles: Map<string, string>;
}

export interface DemoFamily {
  name: string;
  /** The `matchedCommit` of the family file, or `undefined` when the family has no family file. */
  matchedCommit: string | undefined;
  /** The record of the family, or `undefined` when `docs/demos/<family>/upstream.json` does not exist. */
  record: DemoRecord | undefined;
  /** The SHA-256 of each file under `docs/demos/<family>`, by its path from that folder. */
  files: Map<string, string>;
}

function demosFolder(name: string): string {
  return `docs/demos/${name}`;
}

function recordPath(name: string): string {
  return `${demosFolder(name)}/upstream.json`;
}

function command(name: string): string {
  return `node scripts/docs/upstreamDemos.ts --upstream <path> ${name}`;
}

function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function upstreamDemosFolder(name: string, family: FamilyFile): string {
  const glob = family.upstreamPaths.find(
    (path) => path.startsWith(DOCS_FOLDER_PREFIX) && path.endsWith('/**'),
  );
  if (glob === undefined) {
    throw new Error(
      `${familyFile(name)}: "upstreamPaths" has no docs folder. Add the glob ${docsFolderGlobs(name)}. Then run \`${extractCommand(name)}\`.`,
    );
  }
  return `${glob.slice(0, -'/**'.length)}/demos`;
}

/** Reads the demo files of a family from the file list of Base UI at the matched commit of the family. */
export function readUpstreamDemos(
  name: string,
  family: FamilyFile,
  upstreamFiles: string[],
  readFile: (path: string) => string,
): UpstreamDemos {
  const upstream = upstreamDemosFolder(name, family);
  const files: Record<string, string> = {};
  const styles = new Map<string, string>();
  for (const path of upstreamFiles) {
    if (!path.startsWith(`${upstream}/`)) {
      continue;
    }
    const local = path.slice(upstream.length + 1);
    // `<demo>/index.ts` makes the demo with the docs code of Base UI.
    // The page of Vase UI does not use it.
    if (local.split('/').includes(TAILWIND_FOLDER) || /^[^/]+\/index\.ts$/.test(local)) {
      continue;
    }
    const text = readFile(path);
    files[local] = sha256(text);
    if (local.endsWith('.css')) {
      styles.set(local, text);
    }
  }
  return { record: { commit: family.matchedCommit, upstream, files }, styles };
}

/** The files that the command writes, by their path from the repository root. */
export function expectedFiles(name: string, demos: UpstreamDemos): Map<string, string> {
  return new Map([
    [recordPath(name), `${JSON.stringify(demos.record, null, 2)}\n`],
    ...[...demos.styles].map(([path, text]): [string, string] => [
      `${demosFolder(name)}/${path}`,
      text,
    ]),
  ]);
}

/** Checks the records and the copied style sheets of the families against each other. Each problem says what to do. */
export function checkDemos(families: DemoFamily[]): string[] {
  const problems: string[] = [];
  for (const { name, matchedCommit, record, files } of families) {
    const folder = demosFolder(name);
    const rerun = `Run \`${command(name)}\`.`;
    if (record === undefined) {
      problems.push(`${recordPath(name)} does not exist. ${rerun}`);
      continue;
    }
    if (matchedCommit === undefined) {
      problems.push(
        `${familyFile(name)} does not exist, but ${name} has a page or a demo folder. Add the family file.`,
      );
    } else if (record.commit !== matchedCommit) {
      problems.push(
        `${recordPath(name)}: the record was read at commit ${record.commit}, but matchedCommit of ${name} is ${matchedCommit}. ${rerun}`,
      );
    }
    for (const [path, hash] of Object.entries(record.files)) {
      if (!path.endsWith('.css')) {
        continue;
      }
      if (!files.has(path)) {
        problems.push(`${folder}/${path} does not exist. ${rerun}`);
      } else if (files.get(path) !== hash) {
        problems.push(
          `${folder}/${path} differs from the style sheet of Base UI. Do not edit a copied style sheet. ${rerun}`,
        );
      }
    }
    for (const path of [...files.keys()].filter((file) => file.endsWith('.css'))) {
      if (!(path in record.files)) {
        problems.push(
          `${folder}/${path} is not in ${recordPath(name)}. Base UI has no such style sheet. Delete the file.`,
        );
      }
    }
    for (const path of Object.keys(record.files)) {
      const demo = /^(.+)\/css-modules\/index\.tsx$/.exec(path)?.[1];
      if (demo !== undefined && !files.has(`${demo}/css-modules/index.vue`)) {
        problems.push(
          `${folder}/${demo}/css-modules/index.vue does not exist. Base UI has the demo ${demo}. Port it.`,
        );
      }
    }
  }
  return problems;
}

function listFolderFiles(folder: string): Map<string, string> {
  return new Map(
    readdirSync(folder, { recursive: true, withFileTypes: true })
      .filter((item) => item.isFile())
      .map((item): [string, string] => {
        const path = join(item.parentPath, item.name);
        return [path.slice(folder.length + 1), sha256(readFileSync(path))];
      }),
  );
}

/** The families that have a family page or a folder in `docs/demos`. */
export function demoFamilyNames(root: string): string[] {
  const demos = join(root, 'docs/demos');
  const folders = existsSync(demos)
    ? readdirSync(demos, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => item.name)
    : [];
  const pages = listFamilyPages(join(root, 'docs')).map(({ family }) => family);
  return [...new Set([...pages, ...folders])].sort((a, b) => a.localeCompare(b, 'en'));
}

function readFamilyFiles(root: string): FamilyFiles[] {
  const { families, problems } = readParityFiles(root, { readExtracts: false });
  if (problems.length > 0) {
    throw new Error(`${problems.join('\n')}\nCorrect these files first.`);
  }
  return families;
}

function readRecord(name: string, file: string): DemoRecord {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `${recordPath(name)}: ${error instanceof Error ? error.message : String(error)}. Run \`${command(name)}\`.`,
      { cause: error },
    );
  }
}

export function loadDemoFamilies(root: string): DemoFamily[] {
  const families = readFamilyFiles(root);
  return demoFamilyNames(root).map((name) => {
    const folder = join(root, demosFolder(name));
    const recordFile = join(root, recordPath(name));
    return {
      name,
      matchedCommit: families.find((item) => item.name === name)?.family?.matchedCommit,
      record: existsSync(recordFile) ? readRecord(name, recordFile) : undefined,
      files: existsSync(folder) ? listFolderFiles(folder) : new Map(),
    };
  });
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { upstream: { type: 'string' }, check: { type: 'boolean' } },
  });
  if (values.upstream === undefined) {
    throw new Error('Pass --upstream <path>, the path of a local clone of Base UI.');
  }
  const clone = resolve(values.upstream);
  const families = readFamilyFiles(REPOSITORY_ROOT);
  const names = positionals.length > 0 ? positionals : demoFamilyNames(REPOSITORY_ROOT);
  for (const name of names) {
    const family = families.find((item) => item.name === name)?.family;
    if (!family) {
      throw new Error(`There is no family file ${familyFile(name)}.`);
    }
    const commit = resolveCommit(clone, family.matchedCommit);
    const demos = readUpstreamDemos(name, family, listFiles(clone, commit), (path) =>
      readFileAt(clone, commit, path),
    );
    for (const [path, text] of expectedFiles(name, demos)) {
      const file = join(REPOSITORY_ROOT, path);
      if (!values.check) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, text);
        console.log(`Wrote ${path}.`);
      } else if (!existsSync(file)) {
        console.error(`${path} does not exist. Run \`${command(name)}\`.`);
        process.exitCode = 1;
      } else if (readFileSync(file, 'utf8') !== text) {
        console.error(`${path} differs from a fresh read of Base UI. Run \`${command(name)}\`.`);
        process.exitCode = 1;
      }
    }
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
