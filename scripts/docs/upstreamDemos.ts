import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { format, resolveConfig } from 'prettier';
import ts from 'typescript';
import type { FamilyFile } from '../parity/parityFiles.ts';
import { DOCS_FOLDER_PREFIX, toVaseName, VASE_SOURCE_ROOT } from '../parity/paths.ts';
import {
  extractCommand,
  familyFile,
  ownFile,
  readParityFiles,
  REPOSITORY_ROOT,
} from '../parity/repository.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import { listFiles, readFileAt, resolveCommit } from '../parity/upstreamClone.ts';
import { classRowOfBaseUi, classRowOfVue } from './demoClasses.ts';
import type { ClassRow, DemoFile } from './demoClasses.ts';
import { baseUiVariantsDiffer, compareVueVariants } from './demoVariants.ts';
import type { VariantDifference } from './demoVariants.ts';
import { listFamilyPages } from './familyPages.ts';
import { docsFolderGlobs } from './upstreamDocs.ts';

// A demo of Base UI has one folder for each variant.
const CSS_MODULES_FOLDER = 'css-modules';
const TAILWIND_FOLDER = 'tailwind';

// The Forms page teaches VeeValidate with the demo that uses React Hook Form upstream.
const VUE_DEMO_NAMES = new Map([['handbook-forms/react-hook-form', 'vee-validate']]);

/**
 * The families whose demos style the parts with the selectors of native elements and ARIA
 * attributes, such as `:checked` and `[aria-selected="true"]`, in place of the data attributes of
 * Base UI. A demo can add an element of its own for a mark or a thumb, and animate a part with
 * `<Transition>`. Its classes and its style sheets thus differ from those of the Base UI demo. A
 * demo of another family that imports such a family styles its parts in the same way.
 */
const RESTYLED_FAMILIES = new Set([
  'accordion',
  'autocomplete',
  'button',
  'checkbox',
  'checkbox-group',
  'collapsible',
  'combobox',
  'field',
  'fieldset',
  'form',
  'handbook-forms',
  'input',
  'number-field',
  'popover',
  'radio-group',
  'switch',
  'tabs',
  'toggle',
  'toggle-group',
]);

/**
 * The families whose demos select a state with CSS in place of an attribute that the parts no
 * longer write, such as `:hover` of the root in place of `data-hovering`. Their classes and their
 * style sheets thus differ from those of the Base UI demo.
 */
const CSS_STATE_FAMILIES = new Set(['scroll-area']);

/**
 * Whether a demo may differ from the classes and style sheets of Base UI, by a path from the folder
 * of its family.
 */
function hasOwnStyles(name: string, record: DemoRecord, path: string): boolean {
  const demo = path.split('/')[0];
  return (
    CSS_STATE_FAMILIES.has(name) ||
    [name, ...(record.entryPoints?.[demo] ?? [])].some((family) => RESTYLED_FAMILIES.has(family))
  );
}

const ENTRY_POINT_IMPORT = /^@base-ui\/react\/([^/]+)$/;

/** The Tailwind folder at the start of a path from the folder of a family, such as `hero/tailwind`. */
const TAILWIND_FOLDER_PATH = /^[^/]+\/tailwind(?=\/)/;

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
   * `upstream` and then by element name. The path of a file at the root is `.`. A string has one
   * space between its class names. A list keeps each repeat, in the sequence of the code units.
   * `classRowOfBaseUi` gives the count of each string. A folder with no class string has no row.
   */
  classes?: Record<string, ClassRow>;
  /**
   * The sorted names of the demos whose two variants differ in more than their classes and their
   * text. A record with no such demo has no key.
   */
  differentVariants?: string[];
}

export interface UpstreamDemos {
  record: DemoRecord;
  /** The text of each recorded style sheet, by its path from `upstream`. */
  styles: Map<string, string>;
}

export interface DemoFamily {
  name: string;
  /**
   * Whether the family is a component of Vase UI's own. Such a family has no family file and no
   * record, and its demos are not demos of Base UI.
   */
  own: boolean;
  /** The `matchedCommit` of the family file, or `undefined` when the family has no family file. */
  matchedCommit: string | undefined;
  /** The record of the family, or `undefined` when `docs/demos/<family>/upstream.json` does not exist. */
  record: DemoRecord | undefined;
  /** The SHA-256 of each file under `docs/demos/<family>`, by its path from that folder. */
  files: Map<string, string>;
  /**
   * The class strings by Vue folder and element name. A recorded folder contributes a row when
   * it has a `.vue` or `.ts` file. For a component of Vase UI's own, the folders are its Tailwind demos.
   */
  vueClasses: Map<string, ClassRow>;
  /**
   * The first difference between the two Vue variants of each demo that has both, by the name of its
   * Vue folder.
   */
  vueVariants: Map<string, VariantDifference>;
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

function vueDemoPath(family: string, upstreamPath: string): string {
  const [demo, ...rest] = upstreamPath.split('/');
  return toVaseName([VUE_DEMO_NAMES.get(`${family}/${demo}`) ?? demo, ...rest].join('/'));
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

function stringsOf(row: ClassRow, element: string): string[] {
  return Object.hasOwn(row, element) ? row[element] : [];
}

/** For each element name that the rows do not share, its absent and its extra strings, as text. */
function rowDifferences(expected: ClassRow, actual: ClassRow): string[] {
  const elements = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return [...elements].toSorted().flatMap((element) => {
    const absent = subtract(stringsOf(expected, element), stringsOf(actual, element));
    const extra = subtract(stringsOf(actual, element), stringsOf(expected, element));
    const differences = [
      ...absent.map((item) => `absent ${JSON.stringify(item)}`),
      ...extra.map((item) => `extra ${JSON.stringify(item)}`),
    ];
    return differences.length > 0 ? [`${element}: ${differences.join(', ')}.`] : [];
  });
}

/**
 * Reads the demo files of a family from the file list of Base UI at the matched commit of the family.
 * The record also names the other entry points that each demo imports, the class strings of each
 * folder and the demos whose two variants differ in more than their classes and their text.
 */
export function readUpstreamDemos(
  name: string,
  family: FamilyFile,
  upstreamFiles: string[],
  readFile: (path: string) => string,
): UpstreamDemos {
  const upstream = upstreamDemosFolder(name, family);
  const files: Record<string, string> = {};
  const styles = new Map<string, string>();
  const imported = new Map<string, string[]>();
  const sources = new Map<string, string>();
  for (const path of upstreamFiles) {
    if (!path.startsWith(`${upstream}/`)) {
      continue;
    }
    const local = path.slice(upstream.length + 1);
    // `<demo>/index.ts` makes the demo with the docs code of Base UI.
    // The page of Vase UI does not use it.
    if (/^[^/]+\/index\.ts$/.test(local)) {
      continue;
    }
    const text = readFile(path);
    files[local] = sha256(text);
    if (local.endsWith('.css')) {
      styles.set(local, text);
    } else if (/\.tsx?$/.test(local)) {
      sources.set(local, text);
      if (local.includes('/')) {
        const demo = local.slice(0, local.indexOf('/'));
        imported.set(demo, [...(imported.get(demo) ?? []), ...importedEntryPoints(text, name)]);
      }
    }
  }
  const entryPoints = Object.fromEntries(
    [...imported]
      .filter(([, names]) => names.length > 0)
      .map(([demo, names]): [string, string[]] => [demo, sortedUnique(names)])
      .sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
  const classes = readClassRows(sources);
  const differentVariants = readDifferentVariants(sources);
  return {
    record: {
      commit: family.matchedCommit,
      upstream,
      files,
      ...(Object.keys(entryPoints).length > 0 ? { entryPoints } : {}),
      ...(Object.keys(classes).length > 0 ? { classes } : {}),
      ...(differentVariants.length > 0 ? { differentVariants } : {}),
    },
    styles,
  };
}

/** The class row of each folder that has a class string, by the path of the folder. */
function readClassRows(sources: Map<string, string>): Record<string, ClassRow> {
  const folders = new Map<string, DemoFile[]>();
  for (const [local, text] of sources) {
    const folder = posix.dirname(local);
    folders.set(folder, [...(folders.get(folder) ?? []), { name: posix.basename(local), text }]);
  }
  // A comparison with `<` compares the code units. The record then does not depend on the collation
  // data of the machine.
  return Object.fromEntries(
    [...folders]
      .map(([folder, folderFiles]): [string, ClassRow] => [folder, classRowOfBaseUi(folderFiles)])
      .filter(([, row]) => Object.keys(row).length > 0)
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

/** The names of the demos that have the two variants and whose variants differ in more than classes and text. */
function readDifferentVariants(sources: Map<string, string>): string[] {
  const variantFiles = (demo: string, variant: string): DemoFile[] =>
    [...sources].flatMap(([local, text]) =>
      local.startsWith(`${demo}/${variant}/`)
        ? [{ name: local.slice(`${demo}/${variant}/`.length), text }]
        : [],
    );
  return [...sources.keys()]
    .flatMap((local) => {
      const [demo, variant, file, ...deeper] = local.split('/');
      return variant === TAILWIND_FOLDER && file === 'index.tsx' && deeper.length === 0
        ? [demo]
        : [];
    })
    .filter((demo) => sources.has(`${demo}/${CSS_MODULES_FOLDER}/index.tsx`))
    .filter((demo) =>
      baseUiVariantsDiffer(
        variantFiles(demo, CSS_MODULES_FOLDER),
        variantFiles(demo, TAILWIND_FOLDER),
      ),
    )
    .toSorted();
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
      `${demosFolder(name)}/${vueDemoPath(name, path)}`,
      text,
    ]),
  ]);
}

/**
 * Checks the records and the copied style sheets of the families against each other. It also
 * checks the class strings of each Vue folder and the two variants of each Vue demo. A component of
 * Vase UI's own has no record, so the check reads only its two variants. Each problem says what to
 * do. `entryPoints` holds the names of the entry points that Vase UI has. A demo with no Vue file
 * waits while an entry point that it imports is not among them.
 */
export function checkDemos(families: DemoFamily[], entryPoints: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  for (const { name, own, matchedCommit, record, files, vueClasses, vueVariants } of families) {
    const folder = demosFolder(name);
    if (own) {
      problems.push(...checkOwnDemos(folder, files, vueVariants));
      continue;
    }
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
    const styles = new Set<string>();
    for (const [upstreamPath, hash] of Object.entries(record.files)) {
      if (!upstreamPath.endsWith('.css')) {
        continue;
      }
      const path = vueDemoPath(name, upstreamPath);
      styles.add(path);
      if (!files.has(path)) {
        problems.push(`${folder}/${path} does not exist. ${rerun}`);
      } else if (files.get(path) !== hash && !hasOwnStyles(name, record, upstreamPath)) {
        problems.push(
          `${folder}/${path} differs from the style sheet of Base UI. Do not edit a copied style sheet. ${rerun}`,
        );
      }
    }
    for (const path of [...files.keys()].filter((file) => file.endsWith('.css'))) {
      if (!styles.has(path)) {
        problems.push(
          `${folder}/${path} is not in ${recordPath(name)}. Base UI has no such style sheet. Delete the file.`,
        );
      }
    }
    const imports = new Map(Object.entries(record.entryPoints ?? {}));
    for (const path of Object.keys(record.files)) {
      const match = /^(.+)\/(css-modules|tailwind)\/index\.tsx$/.exec(path);
      if (match === null) {
        continue;
      }
      const [, demo, variant] = match;
      const vueFile = `${vueDemoPath(name, demo)}/${variant}/index.vue`;
      const waits = imports.get(demo)?.some((entryPoint) => !entryPoints.has(entryPoint));
      if (!files.has(vueFile) && !waits) {
        const kind = variant === TAILWIND_FOLDER ? 'Tailwind demo' : 'demo';
        problems.push(
          `${folder}/${vueFile} does not exist. Base UI has the ${kind} ${demo}. Port it.`,
        );
      }
    }
    for (const [key, row] of Object.entries(record.classes ?? {}).filter(
      ([key]) => !hasOwnStyles(name, record, key),
    )) {
      const path = vueDemoPath(name, key);
      const vueRow = vueClasses.get(path);
      if (vueRow === undefined) {
        continue;
      }
      const differences = rowDifferences(row, vueRow);
      if (differences.length > 0) {
        problems.push(
          `${folder}/${path} has classes that differ from Base UI. ${differences.join(' ')} Copy each class string from the Base UI file to the same element. Do not change it.`,
        );
      }
    }
    const recordedFolders = new Set(
      Object.keys(record.files)
        .flatMap((path) => /^([^/]+)\/tailwind\//.exec(path)?.[1] ?? [])
        .map((demo) => vueDemoPath(name, demo)),
    );
    const vueFolders = new Set(
      [...files.keys()].flatMap((path) => /^([^/]+)\/tailwind\//.exec(path)?.[1] ?? []),
    );
    for (const vueDemo of vueFolders) {
      if (!recordedFolders.has(vueDemo)) {
        problems.push(
          `${folder}/${vueDemo}/${TAILWIND_FOLDER} is not in ${recordPath(name)}. ${rerun} When the record still lacks the folder, Base UI has no such Tailwind demo. Delete the folder.`,
        );
      }
    }
    const differentVariants = new Set(
      record.differentVariants?.map((demo) => vueDemoPath(name, demo)),
    );
    for (const [vueDemo, { form, text }] of vueVariants) {
      const differs = differentVariants.has(vueDemo);
      if (!differs && form !== undefined) {
        problems.push(
          `${folder}/${vueDemo}: the Tailwind demo differs from the CSS-module demo in more than its classes, and the two Base UI files do not. ${form}. Make the two demos equal apart from the classes.`,
        );
      } else if (differs && text !== undefined) {
        problems.push(
          `${folder}/${vueDemo}: the Tailwind demo has other texts than the CSS-module demo. ${text}. Give the Tailwind demo the texts of the CSS-module demo.`,
        );
      }
    }
  }
  return problems;
}

/**
 * The problems of the demos of a component of Vase UI's own. Each demo has the two variants, and
 * the variants differ only in their classes.
 */
function checkOwnDemos(
  folder: string,
  files: ReadonlyMap<string, string>,
  vueVariants: ReadonlyMap<string, VariantDifference>,
): string[] {
  const demos = new Set(
    [...files.keys()].flatMap(
      (path) => /^([^/]+)\/(?:css-modules|tailwind)\/index\.vue$/.exec(path)?.[1] ?? [],
    ),
  );
  return [...demos].toSorted().flatMap((demo) => {
    for (const [variant, kind] of [
      [CSS_MODULES_FOLDER, 'CSS-module'],
      [TAILWIND_FOLDER, 'Tailwind'],
    ] as const) {
      if (!files.has(`${demo}/${variant}/index.vue`)) {
        return [
          `${folder}/${demo}/${variant}/index.vue does not exist. A demo of a component of Vase UI's own has the two variants. Add the ${kind} demo.`,
        ];
      }
    }
    const form = vueVariants.get(demo)?.form;
    return form === undefined
      ? []
      : [
          `${folder}/${demo}: the Tailwind demo differs from the CSS-module demo in more than its classes. ${form}. Make the two demos equal apart from the classes.`,
        ];
  });
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

/** The names that have a family page or a folder in `docs/demos`. */
function demoFolderNames(root: string): string[] {
  const demos = join(root, 'docs/demos');
  const folders = existsSync(demos)
    ? readdirSync(demos, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => item.name)
    : [];
  const pages = listFamilyPages(join(root, 'docs')).map(({ family }) => family);
  return [...new Set([...pages, ...folders])].sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * The families whose demos are demos of Base UI: each name that has a family page or a folder in
 * `docs/demos`, without the components that Base UI does not have. `ownComponents` holds the names
 * of these components. The command writes a record for each family of the list.
 */
export function demoFamilyNames(root: string, ownComponents: ReadonlySet<string>): string[] {
  return demoFolderNames(root).filter((name) => !ownComponents.has(name));
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

/** The `.vue` and `.ts` files of a folder, with no file of a subfolder, in the sequence of their names. */
function readDemoFiles(directory: string): DemoFile[] {
  return existsSync(directory)
    ? readdirSync(directory)
        .filter((file) => /\.(?:vue|ts)$/.test(file))
        .toSorted()
        .map((file) => ({ name: file, text: readFileSync(join(directory, file), 'utf8') }))
    : [];
}

function readVueClasses(folder: string, paths: string[]): Map<string, ClassRow> {
  return new Map(
    paths.flatMap((path): [string, ClassRow][] => {
      const files = readDemoFiles(join(folder, path));
      return files.length === 0 ? [] : [[path, classRowOfVue(files)]];
    }),
  );
}

/** The first difference between the two variants of each demo that has a Vue file for both. */
function readVueVariants(folder: string): Map<string, VariantDifference> {
  if (!existsSync(folder)) {
    return new Map();
  }
  return new Map(
    readdirSync(folder, { withFileTypes: true }).flatMap((item): [string, VariantDifference][] => {
      const cssModules = join(folder, item.name, CSS_MODULES_FOLDER);
      const tailwind = join(folder, item.name, TAILWIND_FOLDER);
      return item.isDirectory() &&
        existsSync(join(cssModules, 'index.vue')) &&
        existsSync(join(tailwind, 'index.vue'))
        ? [[item.name, compareVueVariants(readDemoFiles(cssModules), readDemoFiles(tailwind))]]
        : [];
    }),
  );
}

/** The Tailwind folders of the demos, such as `hero/tailwind`, in the sequence of their names. */
function tailwindFolders(files: ReadonlyMap<string, string>): string[] {
  return [
    ...new Set([...files.keys()].flatMap((path) => TAILWIND_FOLDER_PATH.exec(path)?.[0] ?? [])),
  ].toSorted();
}

/**
 * The families that have a family page or a folder in `docs/demos`, the components of Vase UI's own
 * included. Each check of the demos reads this list, so no check leaves out a component of Vase
 * UI's own.
 */
export function loadDemoFamilies(root: string): DemoFamily[] {
  const { families, ownComponents } = readFamilyFiles(root);
  return demoFolderNames(root).map((name) => {
    const own = ownComponents.has(name);
    const folder = join(root, demosFolder(name));
    const recordFile = join(root, recordPath(name));
    const record = !own && existsSync(recordFile) ? readRecord(name, recordFile) : undefined;
    const files: Map<string, string> = existsSync(folder) ? listFolderFiles(folder) : new Map();
    return {
      name,
      own,
      matchedCommit: families.find((item) => item.name === name)?.family?.matchedCommit,
      record,
      files,
      vueClasses: readVueClasses(
        folder,
        own
          ? tailwindFolders(files)
          : Object.keys(record?.classes ?? {}).map((key) => vueDemoPath(name, key)),
      ),
      vueVariants: readVueVariants(folder),
    };
  });
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
    const demos = readUpstreamDemos(name, family, listFiles(clone, commit), (path) =>
      readFileAt(clone, commit, path),
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
