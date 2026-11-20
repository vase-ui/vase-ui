import { readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { docsFolderOf } from '../parity/checkSurface.ts';
import type { HeadingBadge } from '../parity/headingBadge.ts';
import type { FamilyExtract, OwnComponent } from '../parity/parityFiles.ts';
import { VASE_SOURCE_ROOT } from '../parity/paths.ts';
import {
  extractCommand,
  extractFile,
  familyFile,
  ownFile,
  readParityFiles,
  REPOSITORY_ROOT,
} from '../parity/repository.ts';
import type { FamilyFiles, OwnComponentFile } from '../parity/repository.ts';
import type { SurfaceFile, SurfacePart } from '../parity/typesMd.ts';
import { createVaseProject } from '../parity/vaseSurface.ts';
import type {
  ClassSurface,
  ComponentSurface,
  ExportMatch,
  FunctionSurface,
  MemberSurface,
  PropertySurface,
  VaseProject,
} from '../parity/vaseSurface.ts';
import { docsFolderGlobs } from './upstreamDocs.ts';

export interface ApiProp {
  name: string;
  type: string;
  /** The text of the `@default` tag of the prop, or `null`. */
  default: string | null;
  required: boolean;
  description: string;
}

/** An event or an exposed member. For an event, `type` is the list of its arguments. */
export interface ApiMember {
  name: string;
  type: string;
  description: string;
}

export interface ApiSlot {
  name: string;
  description: string;
  props: { name: string; type: string }[];
}

/** A selector or a CSS variable of a part, from a `@selector` or a `@cssVariable` tag of its export. */
export interface ApiStyleHook {
  /** The text in backticks at the start of the tag, such as `[hidden]`, or `''` when the tag has none. */
  name: string;
  description: string;
}

export interface ApiPart {
  /** `Button`, or `Dialog.Root` for a part of a namespace. */
  name: string;
  /** The badge that the Base UI page shows on the heading of the part, or `null`. */
  badge: HeadingBadge | null;
  description: string;
  /** Whether the `#render` slot of the part gets the `children` slot prop, which the slot must mount in its element. */
  hasChildren: boolean;
  props: ApiProp[];
  events: ApiMember[];
  slots: ApiSlot[];
  exposed: ApiMember[];
  selectors: ApiStyleHook[];
  cssVariables: ApiStyleHook[];
}

export interface ApiFunction extends FunctionSurface {
  /** `mergeProps`, or `Dialog.createHandle` for a member of a namespace. */
  name: string;
}

export interface ApiClass extends ClassSurface {
  /** `Tooltip.Handle`. */
  name: string;
}

export interface ApiType {
  /** `useRender.Parameters`. */
  name: string;
  properties: PropertySurface[];
  /** The values of a union of strings, such as `ImageLoadingStatus`, in the sequence of the declaration. Empty for a type with properties. */
  values: string[];
}

export interface ApiReference {
  parts: ApiPart[];
  functions: ApiFunction[];
  classes: ApiClass[];
  types: ApiType[];
  /**
   * The family that ports each part of the Base UI page, in the sequence of the page: the family of
   * the page, or the family whose `types.md` has the same part. A part with no export has a family
   * too. Empty for a component of Vase UI's own.
   */
  homes: { part: string; family: string }[];
}

// Vue gives `undefined` to a controlled prop, and a composable can calculate a default. The `@default`
// tag gives the default that a user gets.
function propsOf({ props }: ComponentSurface, defaults: Map<string, string | null>): ApiProp[] {
  return [...props]
    .flatMap(([name, { ignored, ...prop }]) =>
      ignored ? [] : [{ name, ...prop, default: defaults.get(name) ?? null }],
    )
    .sort(
      (a, b) =>
        Number(a.name === 'as') - Number(b.name === 'as') || a.name.localeCompare(b.name, 'en'),
    );
}

// Each part that renders an element has these members, so the source gives them no JSDoc.
const SHARED_SLOT_DESCRIPTIONS = new Map([
  ['default', 'The content of the part.'],
  [
    'element',
    'Renders your element in place of the element of the part. Bind `props` with `v-bind` and `elementRef` with `:ref`.',
  ],
]);
const SHARED_EXPOSED_DESCRIPTIONS = new Map([
  ['element', 'The element of the part, or `null` while it is not mounted.'],
]);

function membersOf(
  members: Map<string, MemberSurface>,
  shared: ReadonlyMap<string, string> = new Map(),
): ApiMember[] {
  return [...members].map(([name, { type, description }]) => ({
    name,
    type,
    description: description || (shared.get(name) ?? ''),
  }));
}

/** The text of the `@default` tag of each property of the exported type `typeName`. */
function documentedDefaults(
  project: VaseProject,
  entryFile: string,
  typeName: string,
): Map<string, string | null> {
  const match = project.findExports(entryFile, typeName).find(({ path }) => path === typeName);
  const properties = (match && project.readProperties(match)) ?? [];
  return new Map(properties.map(({ name, default: text }) => [name, text]));
}

const STYLE_HOOK_TAG = /^`([^`]+)`\s*(.*)$/;

/** The `@selector` or `@cssVariable` tags of an export: `@selector \`[hidden]\` The panel is closed.` */
function styleHooksOf(project: VaseProject, match: ExportMatch, tagName: string): ApiStyleHook[] {
  return project.readTags(match).flatMap(({ name, text }) => {
    if (name !== tagName) {
      return [];
    }
    const [, hook = '', description = text] = STYLE_HOOK_TAG.exec(text) ?? [];
    return [{ name: hook, description }];
  });
}

/** The title of an entry of a `types.md`, or a name of the record of a component of Vase UI's own. */
interface Named {
  name: string;
}

/**
 * The parts of `file`, in their sequence. A part with no export in the entry file is left out,
 * and so is an export that is not a component from a `.vue` file. `pnpm parity:check` reports both.
 */
/**
 * The export of a part of a `types.md`. A family with one part, such as Checkbox, exports the part
 * `Root` of Base UI under the name of the family.
 */
function findPartExport(project: VaseProject, entryFile: string, title: string) {
  const [match] = project.findExports(entryFile, title);
  if (match || title !== 'Root') {
    return match;
  }
  const family = basename(dirname(entryFile))
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return project.findExports(entryFile, family)[0];
}

export function buildApiParts(
  project: VaseProject,
  entryFile: string,
  file: { parts: readonly Named[] },
  badges: ReadonlyMap<string, HeadingBadge> = new Map(),
): ApiPart[] {
  return file.parts.flatMap(({ name: title }) => {
    const match = findPartExport(project, entryFile, title);
    const component = match && project.readComponent(match);
    if (!match || !component) {
      return [];
    }
    const flatName = match.path.replaceAll('.', '');
    return [
      {
        name: match.path,
        badge: badges.get(title) ?? null,
        description: component.description,
        hasChildren:
          component.slots.get('render')?.props.some(({ name }) => name === 'children') === true,
        props: propsOf(component, documentedDefaults(project, entryFile, `${flatName}Props`)),
        events: membersOf(component.emits),
        slots: [...component.slots].map(([name, { description, props }]) => ({
          name,
          description: description || (SHARED_SLOT_DESCRIPTIONS.get(name) ?? ''),
          props,
        })),
        exposed: membersOf(component.exposed, SHARED_EXPOSED_DESCRIPTIONS),
        selectors: styleHooksOf(project, match, 'selector'),
        cssVariables: styleHooksOf(project, match, 'cssVariable'),
      },
    ];
  });
}

/** A `types.md` with the entry file of the family that its folder names. */
interface EntryTypesFile {
  family: string;
  entryFile: string;
  file: SurfaceFile;
}

/**
 * The `types.md` that ports `part`. It is the `types.md` of the page, `page`, when its entry file
 * exports the part. A `types.md` can repeat a part of another family: the `types.md` of Radio Group
 * has `Root` and `Indicator` of Radio. The `types.md` of another family that has the same part, with
 * the same text, then ports it. The result is `page` when no other `types.md` has the part.
 */
function findHomeOfPart(
  project: VaseProject,
  page: EntryTypesFile,
  part: SurfacePart,
  typesFiles: EntryTypesFile[],
): EntryTypesFile {
  if (project.findExports(page.entryFile, part.name).length > 0) {
    return page;
  }
  const repeated = typesFiles.find(
    ({ entryFile, file }) =>
      entryFile !== page.entryFile &&
      file.parts.some((candidate) => isDeepStrictEqual(candidate, part)),
  );
  return repeated ?? page;
}

/**
 * The functions of a `types.md`: the names of its parts, then of its functions, in their sequence.
 * A name with no export in the entry file is left out. So is an export that is a component or has
 * no call signature.
 */
export function buildApiFunctions(
  project: VaseProject,
  entryFile: string,
  file: { parts: readonly Named[]; functions: readonly Named[] },
): ApiFunction[] {
  return [...file.parts, ...file.functions].flatMap(({ name: title }) => {
    const [match] = project.findExports(entryFile, title);
    const surface = match && !project.readComponent(match) && project.readFunction(match);
    return match && surface ? [{ name: match.path, ...surface }] : [];
  });
}

/**
 * The classes of a `types.md`: the names of its functions that are a class export, in their
 * sequence. The parser of the `types.md` puts a class, such as `Handle`, with the functions.
 */
export function buildApiClasses(
  project: VaseProject,
  entryFile: string,
  file: { functions: readonly Named[] },
): ApiClass[] {
  return file.functions.flatMap(({ name: title }) => {
    const [match] = project.findExports(entryFile, title);
    const surface = match && project.readClass(match);
    return match && surface ? [{ name: match.path, ...surface }] : [];
  });
}

/**
 * The types and then the additional types of a `types.md`, in its sequence. The properties are in
 * the sequence of their names. A type with no property is left out, unless it is a union of strings.
 * So is a name with no export in the entry file.
 */
export function buildApiTypes(
  project: VaseProject,
  entryFile: string,
  file: { types: readonly Named[]; additionalTypes: readonly Named[] },
): ApiType[] {
  return [...file.types, ...file.additionalTypes].flatMap(({ name }) => {
    const match = project.findExportAt(entryFile, name);
    // TypeScript gives the properties of a mapped type, such as an `Omit`, in an order that changes
    // with the order in which it reads the program.
    const properties = ((match && project.readProperties(match)) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    );
    const values =
      match && properties.length === 0 ? (project.readUnionValues(entryFile, name) ?? []) : [];
    return properties.length > 0 || values.length > 0 ? [{ name, properties, values }] : [];
  });
}

type Page = FamilyExtract['pages'][number];

/** The Base UI page in the folder of a `types.md`. */
function pageOf(file: SurfaceFile, pages: readonly Page[]): Page | undefined {
  return pages.find((row) => dirname(row.file) === dirname(file.file));
}

/**
 * The badge of each part of a `types.md`, by the title of the part. The Base UI page in the same
 * folder shows the badge on the heading above the tag of the part: `### FilterProvider [Preview]`
 * above `<TypesMenu.FilterProvider />`. The site writes the heading of a part, so it can show the
 * badge there. A page of the site writes each other heading of its reference by hand. The function
 * throws for a badge on one of those, because the site would lose it.
 */
export function readPartBadges(
  file: SurfaceFile,
  pages: readonly Page[],
): Map<string, HeadingBadge> {
  const page = pageOf(file, pages);
  if (!page?.referenceBadges) {
    return new Map();
  }
  return new Map(
    Object.entries(page.referenceBadges).map(([tag, badge]) => {
      const title = tag.split('.').at(1);
      if (title === undefined || !file.parts.some(({ name }) => name === title)) {
        throw new Error(
          `The Base UI page ${page.file} has the badge ${badge} on the heading above <${tag}>, but ${file.file} has no part for that tag. The reference shows a badge only on the heading of a part, so the site would not show this badge. Write [${badge}] at the end of the heading that the page of the site has for <${tag}>. Then change \`readPartBadges\` in scripts/docs/apiReference.ts so that it accepts <${tag}> when the page of the site has the badge on that heading.`,
        );
      }
      return [title, badge];
    }),
  );
}

/**
 * Puts the parts of a `types.md` in the sequence of the `<Types…>` tags of the Base UI page in the
 * same folder. The tag `TypesProgress.Root` names the part `Root`. A part that no tag names comes
 * last, in the sequence of the `types.md`.
 */
function sortPartsByPage(file: SurfaceFile, pages: FamilyExtract['pages']): SurfaceFile {
  const titles = (pageOf(file, pages)?.referenceTags ?? []).flatMap((tag) =>
    tag.split('.').slice(1),
  );
  const place = ({ name }: SurfacePart): number => {
    const index = titles.indexOf(name);
    return index === -1 ? titles.length : index;
  };
  return { ...file, parts: [...file.parts].sort((a, b) => place(a) - place(b)) };
}

/**
 * The API reference of a component of Vase UI's own. The record gives the names, in their
 * sequence. A name with no export is left out. `pnpm parity:check` reports it.
 */
export function buildOwnApiReference(
  project: VaseProject,
  entryFile: string,
  record: OwnComponent,
): ApiReference {
  const named = (names: readonly string[] = []): Named[] => names.map((name) => ({ name }));
  const functions = named(record.functions);
  return {
    parts: buildApiParts(project, entryFile, { parts: named(record.parts) }),
    functions: buildApiFunctions(project, entryFile, { parts: [], functions }),
    classes: buildApiClasses(project, entryFile, { functions }),
    types: buildApiTypes(project, entryFile, {
      types: named(record.types),
      additionalTypes: [],
    }),
    homes: [],
  };
}

/** The path, the modification time and the size of each file and each folder below `folder`. */
function readDiskState(folder: string): string {
  return readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .map((path) => {
      const stats = statSync(join(folder, path), { bigint: true, throwIfNoEntry: false });
      return stats ? `${path} ${stats.mtimeNs} ${stats.size}` : path;
    })
    .join('\n');
}

/**
 * Returns a function from a family name to the API reference of the family. The first call makes
 * the project. Without `cache`, a later call makes the project again when a file or a folder below
 * `packages/vue/src` has another modification time or another size, or when one was added or
 * removed. The function does not look at the text of a file, and it reads the files of `parity`
 * one time. With `cache`, the function keeps the reference of each family that it reads. Each
 * later call for that family gives the kept reference. Use `cache` only where the source does not
 * change while the function is in use, such as a build.
 */
export function createApiReferenceReader(
  root = REPOSITORY_ROOT,
  { cache = false }: { cache?: boolean } = {},
): (family: string) => ApiReference {
  let project: VaseProject | undefined;
  let parity: { families: FamilyFiles[]; ownComponents: OwnComponentFile[] } | undefined;
  let diskState: string | undefined;
  const readProject = (): VaseProject => {
    // The state is from before the project reads the files. An edit between the two reads thus
    // gives a new project at the next call.
    const state = cache ? undefined : readDiskState(join(root, VASE_SOURCE_ROOT));
    // vue-component-meta keeps the text of each file that it read. After its `reload`, an import of
    // a file that did not exist at the first read still has no file. A new project has neither
    // fault.
    if (!project || state !== diskState) {
      project = createVaseProject(join(root, 'packages/vue/tsconfig.build.json'));
      diskState = state;
    }
    return project;
  };

  const readFamily = (family: string): ApiReference => {
    if (!parity) {
      const read = readParityFiles(root, { readExtracts: true });
      if (read.problems.length > 0) {
        throw new Error(
          `${read.problems.join('\n')}\nCorrect these files, then build the site again.`,
        );
      }
      parity = read;
    }
    const { families, ownComponents } = parity;
    const record = ownComponents.find(({ name }) => name === family)?.record;
    if (record) {
      return buildOwnApiReference(
        readProject(),
        join(root, VASE_SOURCE_ROOT, family, 'index.ts'),
        record,
      );
    }
    const files = families.find(({ name }) => name === family);
    if (!files?.hasFamilyFile) {
      throw new Error(
        `There is no family file ${familyFile(family)} and no record ${ownFile(family)}, but the site has a page for ${family}. Add the family file. For a component that Base UI does not have, add the record.`,
      );
    }
    const pages = files.extract?.pages ?? [];
    const typesFiles = (files.extract?.surface ?? []).map((file) => sortPartsByPage(file, pages));
    if (typesFiles.length === 0) {
      throw new Error(
        `${extractFile(family)} has no types.md, so the API reference of ${family} has no source. Add the glob ${docsFolderGlobs(family)} to "upstreamPaths" in ${familyFile(family)}. Then run \`${extractCommand(family)}\`.`,
      );
    }
    const vaseProject = readProject();
    const entryTypesFile = (name: string, file: SurfaceFile): EntryTypesFile => ({
      family: name,
      entryFile: join(root, VASE_SOURCE_ROOT, docsFolderOf(file), 'index.ts'),
      file,
    });
    const pageFiles = typesFiles.map((file) => entryTypesFile(family, file));
    const build = <T>(
      read: (project: VaseProject, entryFile: string, file: SurfaceFile) => T[],
    ): T[] => pageFiles.flatMap(({ entryFile, file }) => read(vaseProject, entryFile, file));
    const allTypesFiles = families.flatMap(({ name, extract }) =>
      (extract?.surface ?? []).map((file) => entryTypesFile(name, file)),
    );
    const homes = pageFiles.flatMap((page) => {
      const badges = readPartBadges(page.file, pages);
      return page.file.parts.map((part) => ({
        part,
        page,
        badges,
        home: findHomeOfPart(vaseProject, page, part, allTypesFiles),
      }));
    });
    return {
      // A part is read from the entry file that exports it. The parts keep the sequence of the file.
      parts: homes.flatMap(({ part, page, badges, home }) => {
        const entryFile =
          home !== page && findPartExport(vaseProject, home.entryFile, part.name)
            ? home.entryFile
            : page.entryFile;
        return buildApiParts(vaseProject, entryFile, { parts: [part] }, badges);
      }),
      functions: build(buildApiFunctions),
      classes: build(buildApiClasses),
      types: build(buildApiTypes),
      homes: homes.map(({ part, home }) => ({ part: part.name, family: home.family })),
    };
  };

  if (!cache) {
    return readFamily;
  }
  const references = new Map<string, ApiReference>();
  return (family) => {
    const kept = references.get(family);
    if (kept) {
      return kept;
    }
    const reference = readFamily(family);
    references.set(family, reference);
    return reference;
  };
}
