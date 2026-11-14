import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { docsFolderOf } from '../parity/checkSurface.ts';
import type { FamilyExtract } from '../parity/parityFiles.ts';
import { VASE_SOURCE_ROOT } from '../parity/paths.ts';
import {
  extractCommand,
  extractFile,
  familyFile,
  readParityFiles,
  REPOSITORY_ROOT,
} from '../parity/repository.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import type { SurfaceFile, SurfacePart } from '../parity/typesMd.ts';
import { createVaseProject } from '../parity/vaseSurface.ts';
import type {
  ComponentSurface,
  FunctionSurface,
  MemberSurface,
  PropertySurface,
  VaseProject,
} from '../parity/vaseSurface.ts';
import { docsFolderGlobs } from './upstreamDocs.ts';

export interface ApiProp {
  name: string;
  type: string;
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

export interface ApiConstant {
  /** The value of the constant, such as `data-disabled`. */
  name: string;
  type: string | null;
  description: string;
}

export interface ApiPart {
  /** `Button`, or `Dialog.Root` for a part of a namespace. */
  name: string;
  description: string;
  /** Whether the `#render` slot of the part gets the `children` slot prop, which the slot must mount in its element. */
  hasChildren: boolean;
  props: ApiProp[];
  events: ApiMember[];
  slots: ApiSlot[];
  exposed: ApiMember[];
  dataAttributes: ApiConstant[];
  cssVariables: ApiConstant[];
}

export interface ApiFunction extends FunctionSurface {
  /** `mergeProps`, or `Dialog.createHandle` for a member of a namespace. */
  name: string;
}

export interface ApiType {
  /** `useRender.Parameters`. */
  name: string;
  properties: PropertySurface[];
}

export interface ApiReference {
  parts: ApiPart[];
  functions: ApiFunction[];
  types: ApiType[];
}

// Base UI puts `className`, `style` and `render` last. These are their Vue names.
const SHARED_PROPS = ['stateClass', 'stateStyle', 'as'];

function propsOf({ props }: ComponentSurface): ApiProp[] {
  const rank = (name: string): number => SHARED_PROPS.indexOf(name);
  return [...props]
    .map(([name, prop]) => ({ name, ...prop }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'en'));
}

function membersOf(members: Map<string, MemberSurface>): ApiMember[] {
  return [...members].map(([name, { type, description }]) => ({ name, type, description }));
}

function constantsOf(project: VaseProject, entryFile: string, namespace: string): ApiConstant[] {
  return (project.readConstants(entryFile, namespace) ?? []).flatMap(
    ({ value, type, description }) =>
      value === undefined ? [] : [{ name: value, type, description }],
  );
}

/**
 * The parts of `file`, in their sequence. A part with no export in the entry file is left out,
 * and so is an export that is not a component from a `.vue` file. `pnpm parity:check` reports both.
 */
export function buildApiParts(
  project: VaseProject,
  entryFile: string,
  file: SurfaceFile,
): ApiPart[] {
  return file.parts.flatMap(({ name: title }) => {
    const [match] = project.findExports(entryFile, title);
    const component = match && project.readComponent(match);
    if (!match || !component) {
      return [];
    }
    const flatName = match.path.replaceAll('.', '');
    return [
      {
        name: match.path,
        description: component.description,
        hasChildren:
          component.slots.get('render')?.props.some(({ name }) => name === 'children') === true,
        props: propsOf(component),
        events: membersOf(component.emits),
        slots: [...component.slots].map(([name, slot]) => ({ name, ...slot })),
        exposed: membersOf(component.exposed),
        dataAttributes: constantsOf(project, entryFile, `${flatName}DataAttributes`),
        cssVariables: constantsOf(project, entryFile, `${flatName}CssVariables`),
      },
    ];
  });
}

/** A `types.md` with the entry file of the family that its folder names. */
interface EntryTypesFile {
  entryFile: string;
  file: SurfaceFile;
}

/**
 * The entry file that exports `part`. It is `entryFile`, the entry file of the family of the
 * `types.md`, when that file exports the part. A `types.md` can repeat a part of another family: the
 * `types.md` of Radio Group has `Root` and `Indicator` of Radio. The entry file of the family whose
 * `types.md` has the same part, with the same text, then exports it. When no file exports the part,
 * the result is `entryFile`.
 */
function findEntryFileOfPart(
  project: VaseProject,
  entryFile: string,
  part: SurfacePart,
  typesFiles: EntryTypesFile[],
): string {
  if (project.findExports(entryFile, part.name).length > 0) {
    return entryFile;
  }
  const repeated = typesFiles.find(
    ({ entryFile: otherEntryFile, file }) =>
      file.parts.some((candidate) => isDeepStrictEqual(candidate, part)) &&
      project.findExports(otherEntryFile, part.name).length > 0,
  );
  return repeated?.entryFile ?? entryFile;
}

/**
 * The functions of a `types.md`: the names of its parts, then of its functions, in their sequence.
 * A name with no export in the entry file is left out. So is an export that is a component or has
 * no call signature.
 */
export function buildApiFunctions(
  project: VaseProject,
  entryFile: string,
  file: SurfaceFile,
): ApiFunction[] {
  return [...file.parts, ...file.functions].flatMap(({ name: title }) => {
    const [match] = project.findExports(entryFile, title);
    const surface = match && !project.readComponent(match) && project.readFunction(match);
    return match && surface ? [{ name: match.path, ...surface }] : [];
  });
}

/**
 * The types of a `types.md` that have one property or more, in its sequence. A name with no export
 * in the entry file is left out.
 */
export function buildApiTypes(
  project: VaseProject,
  entryFile: string,
  file: SurfaceFile,
): ApiType[] {
  return file.types.flatMap(({ name }) => {
    const match = project
      .findExports(entryFile, name.slice(name.lastIndexOf('.') + 1))
      .find(({ path }) => path === name);
    const properties = match && project.readProperties(match);
    return properties && properties.length > 0 ? [{ name, properties }] : [];
  });
}

/**
 * Puts the parts of a `types.md` in the sequence of the `<Types…>` tags of the Base UI page in the
 * same folder. The tag `TypesProgress.Root` names the part `Root`. A part that no tag names comes
 * last, in the sequence of the `types.md`.
 */
function sortPartsByPage(file: SurfaceFile, pages: FamilyExtract['pages']): SurfaceFile {
  const page = pages.find((row) => dirname(row.file) === dirname(file.file));
  const titles = (page?.referenceTags ?? []).flatMap((tag) => tag.split('.').slice(1));
  const place = ({ name }: SurfacePart): number => {
    const index = titles.indexOf(name);
    return index === -1 ? titles.length : index;
  };
  return { ...file, parts: [...file.parts].sort((a, b) => place(a) - place(b)) };
}

/** Returns a function from a family name to the API reference of the family. The first call makes the project. */
export function createApiReferenceReader(root = REPOSITORY_ROOT): (family: string) => ApiReference {
  let project: VaseProject | undefined;
  let families: FamilyFiles[] | undefined;

  return (family) => {
    if (!families) {
      const parity = readParityFiles(root, { readExtracts: true });
      if (parity.problems.length > 0) {
        throw new Error(
          `${parity.problems.join('\n')}\nCorrect these files, then build the site again.`,
        );
      }
      families = parity.families;
    }
    const files = families.find(({ name }) => name === family);
    if (!files?.hasFamilyFile) {
      throw new Error(
        `There is no family file ${familyFile(family)}, but the site has a page for ${family}. Add the family file.`,
      );
    }
    const pages = files.extract?.pages ?? [];
    const typesFiles = (files.extract?.surface ?? []).map((file) => sortPartsByPage(file, pages));
    if (typesFiles.length === 0) {
      throw new Error(
        `${extractFile(family)} has no types.md, so the API reference of ${family} has no source. Add the glob ${docsFolderGlobs(family)} to "upstreamPaths" in ${familyFile(family)}. Then run \`${extractCommand(family)}\`.`,
      );
    }
    const vaseProject = (project ??= createVaseProject(
      join(root, 'packages/vue/tsconfig.build.json'),
    ));
    const entryFileOf = (file: SurfaceFile): string =>
      join(root, VASE_SOURCE_ROOT, docsFolderOf(file), 'index.ts');
    const build = <T>(
      read: (project: VaseProject, entryFile: string, file: SurfaceFile) => T[],
    ): T[] => typesFiles.flatMap((file) => read(vaseProject, entryFileOf(file), file));
    const allTypesFiles = families.flatMap(({ extract }) =>
      (extract?.surface ?? []).map((file) => ({ entryFile: entryFileOf(file), file })),
    );
    return {
      // A part is read from the entry file that exports it. The parts keep the sequence of the file.
      parts: typesFiles.flatMap((file) =>
        file.parts.flatMap((part) =>
          buildApiParts(
            vaseProject,
            findEntryFileOfPart(vaseProject, entryFileOf(file), part, allTypesFiles),
            { ...file, parts: [part] },
          ),
        ),
      ),
      functions: build(buildApiFunctions),
      types: build(buildApiTypes),
    };
  };
}
