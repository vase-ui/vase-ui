import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { format, resolveConfig } from 'prettier';
import ts from 'typescript';
import type { FamilyFile } from '../parity/parityFiles.ts';
import { DOCS_FOLDER_PREFIX, VASE_SOURCE_ROOT } from '../parity/paths.ts';
import {
  extractCommand,
  familyFile,
  ownFile,
  readParityFiles,
  REPOSITORY_ROOT,
} from '../parity/repository.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import { listFiles, readFileAt, resolveCommit } from '../parity/upstreamClone.ts';
import { classStringsOfScript, classStringsOfTsx, classStringsOfVue } from './demoClasses.ts';
import { listFamilyPages } from './familyPages.ts';
import { docsFolderGlobs } from './upstreamDocs.ts';

/** A demo of Base UI has one folder for each variant. */
const TAILWIND_FOLDER = 'tailwind';

/**
 * The name of a Vue folder of a demo, by family, when it is not the name of the Base UI folder. The
 * library of such a demo has no Vue release, so the Vue demo uses another library.
 */
const VUE_DEMO_NAMES: Record<string, Record<string, string> | undefined> = {
  'handbook-forms': { 'react-hook-form': 'vee-validate' },
};

const ENTRY_POINT_IMPORT = /^@base-ui\/react\/([^/]+)$/;

export interface DemoRecord {
  commit: string;
  /** The folder of Base UI that holds the demos of the family. */
  upstream: string;
  /** The SHA-256 of each upstream file, by its path from `upstream`. */
  files: Record<string, string>;
  /**
   * The entry points of Base UI that a demo imports besides its family, such as `toggle`, by the
   * folder of the demo. A demo that imports no other entry point has no row.
   */
  entryPoints?: Record<string, string[]>;
  /**
   * The class strings of the `.ts` and `.tsx` files of a folder, by the path of the folder from
   * `upstream`. The path of a file at the root is `.`. A string has one space between its class
   * names. A row has a string as often as the folder repeats it, in the sequence of the code units.
   * A folder with no class string has no row. Only a record that has Tailwind demos has this key.
   */
  classes?: Record<string, string[]>;
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
  /**
   * The class strings of the `.vue` and `.ts` files in the Vue folder of each key of
   * `record.classes`, by that key, in the sequence of the file names. A key whose Vue folder has no
   * such file is not in the map.
   */
  vueClasses: Map<string, string[]>;
}

function demosFolder(name: string): string {
  return `docs/demos/${name}`;
}

function recordPath(name: string): string {
  return `${demosFolder(name)}/upstream.json`;
}

function command(name: string): string {
  return `pnpm docs:demos --upstream <path> ${name}`;
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

/** The names of the entry points of Base UI that the file imports, other than the entry point `own`. */
function importedEntryPoints(text: string, own: string): string[] {
  return ts.preProcessFile(text, true, true).importedFiles.flatMap(({ fileName }) => {
    const name = ENTRY_POINT_IMPORT.exec(fileName)?.[1];
    return name === undefined || name === own ? [] : [name];
  });
}

function sortedUnique(names: string[]): string[] {
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'en'));
}

/** The name of the Vue folder of the demo of Base UI `demo`. */
function vueDemoName(family: string, demo: string): string {
  return VUE_DEMO_NAMES[family]?.[demo] ?? demo;
}

/** The name of the demo of Base UI that the Vue folder `vueDemo` holds. */
function upstreamDemoName(family: string, vueDemo: string): string {
  const names = Object.entries(VUE_DEMO_NAMES[family] ?? {});
  return names.find(([, name]) => name === vueDemo)?.[0] ?? vueDemo;
}

/** The Vue folder of a folder of Base UI, both by their paths from the folder of the demos. */
function vueFolder(family: string, upstreamFolder: string): string {
  const [demo, ...rest] = upstreamFolder.split('/');
  return [vueDemoName(family, demo), ...rest].join('/');
}

/** The strings of `strings` that `other` does not have. A repeated string counts as often as it repeats. */
function subtract(strings: string[], other: string[]): string[] {
  const available = new Map<string, number>();
  for (const item of other) {
    available.set(item, (available.get(item) ?? 0) + 1);
  }
  return strings.filter((item) => {
    const count = available.get(item) ?? 0;
    available.set(item, count - 1);
    return count < 1;
  });
}

/**
 * Reads the demo files of a family from the file list of Base UI at the matched commit of the family.
 * The record also names the other entry points that each demo imports. With `tailwind`, the record
 * also has the files of the `tailwind` folders and the class strings of each folder.
 */
export function readUpstreamDemos(
  name: string,
  family: FamilyFile,
  upstreamFiles: string[],
  readFile: (path: string) => string,
  tailwind: boolean,
): UpstreamDemos {
  const upstream = upstreamDemosFolder(name, family);
  const files: Record<string, string> = {};
  const styles = new Map<string, string>();
  const imported = new Map<string, string[]>();
  const classRows = new Map<string, string[]>();
  for (const path of upstreamFiles) {
    if (!path.startsWith(`${upstream}/`)) {
      continue;
    }
    const local = path.slice(upstream.length + 1);
    // `<demo>/index.ts` makes the demo with the docs code of Base UI.
    // The page of Vase UI does not use it.
    if (
      (!tailwind && local.split('/').includes(TAILWIND_FOLDER)) ||
      /^[^/]+\/index\.ts$/.test(local)
    ) {
      continue;
    }
    const text = readFile(path);
    files[local] = sha256(text);
    if (local.endsWith('.css')) {
      styles.set(local, text);
    } else if (/\.tsx?$/.test(local)) {
      if (local.includes('/')) {
        const demo = local.slice(0, local.indexOf('/'));
        imported.set(demo, [...(imported.get(demo) ?? []), ...importedEntryPoints(text, name)]);
      }
      const strings = tailwind ? classStringsOfTsx(text) : [];
      if (strings.length > 0) {
        const folder = posix.dirname(local);
        classRows.set(folder, [...(classRows.get(folder) ?? []), ...strings]);
      }
    }
  }
  const entryPoints = Object.fromEntries(
    [...imported]
      .filter(([, names]) => names.length > 0)
      .map(([demo, names]): [string, string[]] => [demo, sortedUnique(names)])
      .sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
  // A sort of strings with no function compares the code units. The record then does not depend
  // on the collation data of the machine.
  const classes = Object.fromEntries(
    [...classRows]
      .map(([folder, strings]): [string, string[]] => [folder, strings.toSorted()])
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  return {
    record: {
      commit: family.matchedCommit,
      upstream,
      files,
      ...(Object.keys(entryPoints).length > 0 ? { entryPoints } : {}),
      ...(Object.keys(classes).length > 0 ? { classes } : {}),
    },
    styles,
  };
}

/** The files that the command writes, by their path from the repository root. */
export async function expectedFiles(
  name: string,
  demos: UpstreamDemos,
): Promise<Map<string, string>> {
  // Prettier sets the line breaks of the arrays. The record then passes `prettier --check`.
  const record = await format(JSON.stringify(demos.record, null, 2), {
    ...(await resolveConfig(join(REPOSITORY_ROOT, recordPath(name)))),
    parser: 'json',
  });
  return new Map([
    [recordPath(name), record],
    ...[...demos.styles].map(([path, text]): [string, string] => [
      `${demosFolder(name)}/${path}`,
      text,
    ]),
  ]);
}

/**
 * Checks the records and the copied style sheets of the families against each other. Each problem
 * says what to do. `entryPoints` holds the names of the entry points that Vase UI has. A demo
 * with no Vue file waits while an entry point that it imports is not among them.
 */
export function checkDemos(families: DemoFamily[], entryPoints: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  for (const { name, matchedCommit, record, files, vueClasses } of families) {
    const folder = demosFolder(name);
    const rerun = `Run \`${command(name)}\`.`;
    if (matchedCommit === undefined) {
      problems.push(
        `${familyFile(name)} does not exist, but ${name} has a page or a demo folder. Add the family file. For a component that Base UI does not have, add ${ownFile(name)}.`,
      );
      if (record === undefined) {
        continue;
      }
    } else if (record === undefined) {
      problems.push(`${recordPath(name)} does not exist. ${rerun}`);
      continue;
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
      const match = /^(.+)\/(css-modules|tailwind)\/index\.tsx$/.exec(path);
      if (match === null) {
        continue;
      }
      const [, demo, variant] = match;
      const vueFile = `${vueDemoName(name, demo)}/${variant}/index.vue`;
      const waits = (record.entryPoints?.[demo] ?? []).some(
        (entryPoint) => !entryPoints.has(entryPoint),
      );
      if (!files.has(vueFile) && !waits) {
        const kind = variant === TAILWIND_FOLDER ? 'Tailwind demo' : 'demo';
        problems.push(
          `${folder}/${vueFile} does not exist. Base UI has the ${kind} ${demo}. Port it.`,
        );
      }
    }
    for (const [key, row] of Object.entries(record.classes ?? {})) {
      const vueStrings = vueClasses.get(key);
      if (vueStrings === undefined) {
        continue;
      }
      const absent = subtract(row, vueStrings);
      const extra = subtract(vueStrings, row);
      if (absent.length > 0 || extra.length > 0) {
        const lists = [
          absent.length > 0
            ? ` Absent: ${absent.map((item) => JSON.stringify(item)).join(', ')}.`
            : '',
          extra.length > 0
            ? ` Extra: ${extra.map((item) => JSON.stringify(item)).join(', ')}.`
            : '',
        ].join('');
        problems.push(
          `${folder}/${vueFolder(name, key)} has class strings that differ from Base UI.${lists} Copy each class string from the Base UI file. Do not change it.`,
        );
      }
    }
    const recordedFolders = new Set(
      Object.keys(record.files).flatMap((path) => /^([^/]+)\/tailwind\//.exec(path)?.[1] ?? []),
    );
    const vueFolders = new Set(
      [...files.keys()].flatMap((path) => /^([^/]+)\/tailwind\//.exec(path)?.[1] ?? []),
    );
    for (const vueDemo of vueFolders) {
      if (!recordedFolders.has(upstreamDemoName(name, vueDemo))) {
        problems.push(
          `${folder}/${vueDemo}/${TAILWIND_FOLDER} is not in ${recordPath(name)}. ${rerun} When the record still lacks the folder, Base UI has no such Tailwind demo. Delete the folder.`,
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

/**
 * The families that have a family page or a folder in `docs/demos`. `ownComponents` holds the names
 * of the components that Base UI does not have. They have no demos of Base UI, so they are not in
 * the list.
 */
export function demoFamilyNames(root: string, ownComponents: ReadonlySet<string>): string[] {
  const demos = join(root, 'docs/demos');
  const folders = existsSync(demos)
    ? readdirSync(demos, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => item.name)
    : [];
  const pages = listFamilyPages(join(root, 'docs')).map(({ family }) => family);
  return [...new Set([...pages, ...folders])]
    .filter((name) => !ownComponents.has(name))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

/** The names of the entry points of Vase UI: the folders of the source that have an `index.ts`. */
export function loadEntryPoints(root: string): Set<string> {
  const source = join(root, VASE_SOURCE_ROOT);
  return new Set(
    readdirSync(source, { withFileTypes: true })
      .filter((item) => item.isDirectory() && existsSync(join(source, item.name, 'index.ts')))
      .map((item) => item.name),
  );
}

function readFamilyFiles(root: string): {
  families: FamilyFiles[];
  ownComponents: ReadonlySet<string>;
} {
  const { families, ownComponents, problems } = readParityFiles(root, { readExtracts: false });
  if (problems.length > 0) {
    throw new Error(`${problems.join('\n')}\nCorrect these files first.`);
  }
  return { families, ownComponents: new Set(ownComponents.map(({ name }) => name)) };
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

/** The class strings of the `.vue` and `.ts` files in the Vue folder of each folder in `classes`. */
function readVueClasses(
  name: string,
  folder: string,
  classes: Record<string, string[]>,
): Map<string, string[]> {
  return new Map(
    Object.keys(classes).flatMap((key): [string, string[]][] => {
      const directory = join(folder, vueFolder(name, key));
      const sources = existsSync(directory)
        ? readdirSync(directory)
            .filter((file) => /\.(?:vue|ts)$/.test(file))
            .sort()
        : [];
      if (sources.length === 0) {
        return [];
      }
      return [
        [
          key,
          sources.flatMap((file) => {
            const text = readFileSync(join(directory, file), 'utf8');
            return file.endsWith('.vue') ? classStringsOfVue(text) : classStringsOfScript(text);
          }),
        ],
      ];
    }),
  );
}

export function loadDemoFamilies(root: string): DemoFamily[] {
  const { families, ownComponents } = readFamilyFiles(root);
  return demoFamilyNames(root, ownComponents).map((name) => {
    const folder = join(root, demosFolder(name));
    const recordFile = join(root, recordPath(name));
    const record = existsSync(recordFile) ? readRecord(name, recordFile) : undefined;
    return {
      name,
      matchedCommit: families.find((item) => item.name === name)?.family?.matchedCommit,
      record,
      files: existsSync(folder) ? listFolderFiles(folder) : new Map(),
      vueClasses: readVueClasses(name, folder, record?.classes ?? {}),
    };
  });
}

/**
 * A family has the record of its Tailwind demos when a demo folder of `docs/demos/<family>` has a
 * `tailwind` folder. Without it, the record has no Tailwind row, and the check does not ask for the
 * Tailwind demos of the family.
 */
function hasTailwindFolder(folder: string): boolean {
  return (
    existsSync(folder) &&
    readdirSync(folder, { withFileTypes: true }).some(
      (item) => item.isDirectory() && existsSync(join(folder, item.name, TAILWIND_FOLDER)),
    )
  );
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { upstream: { type: 'string' }, check: { type: 'boolean' } },
  });
  if (values.upstream === undefined) {
    throw new Error('Pass --upstream <path>, the path of a local clone of Base UI.');
  }
  const clone = resolve(values.upstream);
  const { families, ownComponents } = readFamilyFiles(REPOSITORY_ROOT);
  const names =
    positionals.length > 0 ? positionals : demoFamilyNames(REPOSITORY_ROOT, ownComponents);
  for (const name of names) {
    const family = families.find((item) => item.name === name)?.family;
    if (!family) {
      throw new Error(`There is no family file ${familyFile(name)}.`);
    }
    const commit = resolveCommit(clone, family.matchedCommit);
    const demos = readUpstreamDemos(
      name,
      family,
      listFiles(clone, commit),
      (path) => readFileAt(clone, commit, path),
      hasTailwindFolder(join(REPOSITORY_ROOT, demosFolder(name))),
    );
    for (const [path, text] of await expectedFiles(name, demos)) {
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
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
