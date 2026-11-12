import { basename, dirname, join } from 'node:path';
import { expectedSurface, normalizeDefault } from './mapping.ts';
import type { ExpectedSurface } from './mapping.ts';
import { labelOf, MEMBER_KINDS, memberOf, targetOf } from './parityFiles.ts';
import type { ExceptionRow, FamilyExtract, FamilyFile, MemberKind, Target } from './parityFiles.ts';
import { hasCounterpart, VASE_SOURCE_ROOT } from './paths.ts';
import type { VaseFiles } from './paths.ts';
import { extractCommand } from './repository.ts';
import type { SurfaceFile, SurfacePart } from './typesMd.ts';
import type { ComponentSurface, ExportMatch, VaseProject } from './vaseSurface.ts';

export interface Tally {
  total: number;
  matched: number;
  excepted: number;
}

export interface SurfaceSummary {
  entries: Tally;
  propRows: Tally;
}

export interface SurfaceResult {
  problems: string[];
  summary: SurfaceSummary;
}

/** One difference between Base UI and Vase UI. `row` is the Base UI prop row that causes it, when there is one. */
interface Difference {
  file: string;
  entry: string;
  row?: string;
  message: string;
}

interface EntryRow {
  row: ExceptionRow;
  index: number;
  target: Target;
}

type Add = (message: string, row?: string) => void;
type MembersByKind<T> = Record<MemberKind, T>;

interface PartMembers {
  expected: MembersByKind<Map<string, string>>;
  actual: MembersByKind<Set<string>>;
}

interface Context {
  family: FamilyFile;
  files: VaseFiles;
  root: string;
  project: VaseProject | undefined;
  differences: Difference[];
  usedAdditions: Set<number>;
  /** The members of each part that was read, by the title of the part. */
  members: Map<string, PartMembers[]>;
  /** The parts whose Vase UI component was read. */
  read: Set<string>;
}

const MEMBER_LABELS: MembersByKind<string> = {
  prop: 'prop',
  emit: 'emit',
  slot: 'slot',
  exposed: 'exposed member',
};

function inlineCode(text: string): string {
  return `\`${text}\``;
}

function keyOf(file: string, entry: string): string {
  return JSON.stringify([file, entry]);
}

function describeDefault(text: string | null): string {
  return text === null ? 'no default' : `the default ${inlineCode(text)}`;
}

/** The folder name of the docs page: `dialog` for `.../components/dialog/types.md`. */
export function docsFolderOf(file: SurfaceFile): string {
  return basename(dirname(file.file));
}

function titlesOf(file: SurfaceFile): Set<string> {
  return new Set(
    [file.parts, file.functions, file.types, file.additionalTypes, file.externalTypes].flatMap(
      (entries) => entries.map(({ name }) => name),
    ),
  );
}

function compareProps(expected: ExpectedSurface, actual: ComponentSurface, add: Add): void {
  for (const [name, wanted] of expected.props) {
    const found = actual.props.get(name);
    if (!found) {
      continue;
    }
    if (found.required !== wanted.required) {
      add(
        `prop ${inlineCode(name)} is ${wanted.required ? 'required in Base UI and optional here. Make it required.' : 'optional in Base UI and required here. Make it optional.'}`,
        wanted.row,
      );
    }
    const actualDefault = normalizeDefault(found.default);
    const wantedDefault = normalizeDefault(wanted.default);
    if (wanted.controlled) {
      if (actualDefault !== 'undefined') {
        add(
          `controlled prop ${inlineCode(name)} has ${describeDefault(actualDefault)}. A controlled prop needs the default ${inlineCode('undefined')}.`,
          wanted.row,
        );
      }
    } else if (wanted.compareDefault && wantedDefault !== actualDefault) {
      add(
        `prop ${inlineCode(name)} has ${describeDefault(actualDefault)}. Base UI has the default ${inlineCode(wantedDefault ?? '')}.`,
        wanted.row,
      );
    }
  }
}

function compareNativeListeners(
  expected: ExpectedSurface,
  actual: ComponentSurface,
  add: Add,
): void {
  for (const { row, prop, emit } of expected.nativeListeners) {
    const kinds = [
      ...(actual.props.has(prop) ? [`the prop ${inlineCode(prop)}`] : []),
      ...(actual.emits.has(emit) ? [`the emit ${inlineCode(emit)}`] : []),
    ];
    for (const what of kinds) {
      add(
        `${inlineCode(row)} is a native listener, so the part must not have ${what}. Remove it. The listener comes through the attributes.`,
        row,
      );
    }
  }
}

function membersOf(expected: ExpectedSurface, actual: ComponentSurface): PartMembers {
  return {
    expected: {
      prop: new Map([...expected.props].map(([name, { row }]) => [name, row])),
      emit: expected.emits,
      slot: expected.slots,
      exposed: expected.exposed,
    },
    actual: {
      prop: new Set(actual.props.keys()),
      emit: new Set(actual.emits.keys()),
      slot: new Set(actual.slots.keys()),
      exposed: new Set(actual.exposed.keys()),
    },
  };
}

function compareMembers(
  context: Context,
  part: string,
  expected: ExpectedSurface,
  members: PartMembers,
  add: Add,
): void {
  const native: Partial<MembersByKind<Set<string>>> = {
    prop: new Set(expected.nativeListeners.map(({ prop }) => prop)),
    emit: new Set(expected.nativeListeners.map(({ emit }) => emit)),
  };
  for (const kind of MEMBER_KINDS) {
    const label = MEMBER_LABELS[kind];
    for (const [name, row] of members.expected[kind]) {
      if (!members.actual[kind].has(name)) {
        add(`missing ${label} ${inlineCode(name)} (Base UI row ${inlineCode(row)}). Add it.`, row);
      }
    }
    for (const name of [...members.actual[kind]].sort()) {
      if (members.expected[kind].has(name) || native[kind]?.has(name)) {
        continue;
      }
      const index = context.family.surfaceAdditions.findIndex(
        (row) => row.entry === part && memberOf(row).kind === kind && memberOf(row).name === name,
      );
      if (index === -1) {
        add(
          `${label} ${inlineCode(name)} has no Base UI row. Add a "surfaceAdditions" row, or remove it.`,
        );
      } else {
        context.usedAdditions.add(index);
      }
    }
  }
}

function compareSets(
  what: string,
  typeName: string,
  expected: string[],
  actual: string[],
  add: Add,
): void {
  for (const name of expected.filter((item) => !actual.includes(item))) {
    add(`missing ${what} ${inlineCode(name)} in ${inlineCode(typeName)}. Add it.`);
  }
  for (const name of actual.filter((item) => !expected.includes(item))) {
    add(`${what} ${inlineCode(name)} of ${inlineCode(typeName)} is not in Base UI. Remove it.`);
  }
}

function compareConstants(
  expected: { name: string; value: string }[],
  actual: { name: string; value: string | undefined }[],
  namespace: string,
  add: Add,
): void {
  for (const { name, value } of expected) {
    const found = actual.find((constant) => constant.name === name);
    if (!found) {
      add(`missing constant ${inlineCode(name)} in ${inlineCode(namespace)}. Add it.`);
    } else if (found.value !== value) {
      add(
        `constant ${inlineCode(name)} of ${inlineCode(namespace)} has ${found.value === undefined ? 'a value that is not a string' : `the value ${inlineCode(found.value)}`}. Base UI has ${inlineCode(value)}.`,
      );
    }
  }
  for (const { name } of actual.filter(
    ({ name: item }) => !expected.some((entry) => entry.name === item),
  )) {
    add(`constant ${inlineCode(name)} of ${inlineCode(namespace)} is not in Base UI. Remove it.`);
  }
}

function comparePart(
  context: Context,
  file: SurfaceFile,
  part: SurfacePart,
  entry: { file: string; path: string | undefined },
  findOne: (name: string, add: Add) => ExportMatch | undefined,
  add: Add,
): void {
  const match = findOne(part.name, add);
  if (part.props === null) {
    return;
  }
  const expected = expectedSurface(part, file);
  const actual = match && context.project?.readComponent(match);
  if (match && !actual) {
    add(
      `the export ${inlineCode(match.path)} is not a component from a .vue file. Export the component of the SFC with its own type.`,
    );
  }
  if (actual) {
    context.read.add(keyOf(file.file, part.name));
    const members = membersOf(expected, actual);
    context.members.set(part.name, [...(context.members.get(part.name) ?? []), members]);
    compareProps(expected, actual, add);
    compareNativeListeners(expected, actual, add);
    compareMembers(context, part.name, expected, members, add);
  }
  if (entry.path && context.project) {
    if (part.state) {
      const fields = context.project.readFields(entry.path, part.state.name);
      if (fields === undefined) {
        add(
          `missing export ${inlineCode(part.state.name)} (the type of ${part.name}.State) in ${entry.file}. Add it.`,
        );
      } else {
        compareSets(
          'state field',
          part.state.name,
          part.state.fields.map(({ name }) => name),
          fields,
          add,
        );
      }
    }
    if (part.changeEventReason) {
      const { name, values } = part.changeEventReason;
      const found = context.project.readUnionValues(entry.path, name);
      if (found === undefined) {
        add(
          `missing export ${inlineCode(name)} in ${entry.file}, or it is not a union of strings. Add it as a union of the reason strings.`,
        );
      } else {
        compareSets('reason', name, values, found, add);
      }
    }
  }
}

function compareFile(context: Context, file: SurfaceFile): void {
  const entryFile = `${VASE_SOURCE_ROOT}/${docsFolderOf(file)}/index.ts`;
  const entry = {
    file: entryFile,
    path: context.files.paths.has(entryFile) ? join(context.root, entryFile) : undefined,
  };
  const adder =
    (title: string): Add =>
    (message, row) => {
      context.differences.push({ file: file.file, entry: title, row, message });
    };
  const findOne = (name: string, add: Add): ExportMatch | undefined => {
    const matches =
      entry.path && context.project ? context.project.findExports(entry.path, name) : [];
    if (matches.length === 1) {
      return matches[0];
    }
    add(
      matches.length === 0
        ? `missing export ${inlineCode(name)} in ${entryFile}. Add it, or add an exception row.`
        : `the name ${inlineCode(name)} matches more than one export (${matches.map(({ path }) => path).join(', ')}). Keep one.`,
    );
    return undefined;
  };
  for (const part of file.parts) {
    comparePart(context, file, part, entry, findOne, adder(part.name));
  }
  for (const { name } of file.functions) {
    findOne(name, adder(name));
  }
  for (const type of file.additionalTypes) {
    if (!type.constants) {
      continue;
    }
    const add = adder(type.name);
    const actual = entry.path ? context.project?.readConstants(entry.path, type.name) : undefined;
    if (actual) {
      compareConstants(type.constants, actual, type.name, add);
    } else {
      add(
        `missing export ${inlineCode(type.name)} in ${entryFile}. Add it, or add an exception row.`,
      );
    }
  }
}

/** The row of an exception that excuses a difference: a row for the prop row first, then a row for the entry. */
function excusingRow(rows: EntryRow[], difference: Difference): EntryRow | undefined {
  const own = rows.filter(
    ({ row }) => row.upstream === difference.file && row.entry === difference.entry,
  );
  return (
    own.find(({ row }) => row.prop !== undefined && row.prop === difference.row) ??
    own.find(({ row }) => row.prop === undefined)
  );
}

function summarize(
  extract: FamilyExtract,
  rows: EntryRow[],
  context: Context,
  remaining: Difference[],
): SurfaceSummary {
  const summary: SurfaceSummary = {
    entries: { total: 0, matched: 0, excepted: 0 },
    propRows: { total: 0, matched: 0, excepted: 0 },
  };
  for (const file of extract.surface) {
    const compared = [
      ...file.parts.map(({ name }) => name),
      ...file.functions.map(({ name }) => name),
      ...file.additionalTypes.filter(({ constants }) => constants).map(({ name }) => name),
    ];
    const hasEntryRow = (title: string): boolean =>
      rows.some(
        ({ row }) => row.upstream === file.file && row.entry === title && row.prop === undefined,
      );
    for (const title of compared) {
      summary.entries.total += 1;
      if (hasEntryRow(title)) {
        summary.entries.excepted += 1;
      } else if (!remaining.some((item) => item.file === file.file && item.entry === title)) {
        summary.entries.matched += 1;
      }
    }
    for (const part of file.parts) {
      for (const prop of part.props ?? []) {
        summary.propRows.total += 1;
        const hasPropRow = rows.some(
          ({ row }) =>
            row.upstream === file.file && row.entry === part.name && row.prop === prop.name,
        );
        if (hasEntryRow(part.name) || hasPropRow) {
          summary.propRows.excepted += 1;
        } else if (
          context.read.has(keyOf(file.file, part.name)) &&
          !remaining.some(
            (item) => item.file === file.file && item.entry === part.name && item.row === prop.name,
          )
        ) {
          summary.propRows.matched += 1;
        }
      }
    }
  }
  return summary;
}

export function checkSurface(options: {
  name: string;
  family: FamilyFile;
  extract: FamilyExtract;
  files: VaseFiles;
  /** The absolute path of the repository root. */
  root: string;
  /** Makes the project that reads the Vase UI source. The check calls it only when the extract has a surface. */
  project: () => VaseProject;
}): SurfaceResult {
  const { name, family, extract, files, root } = options;
  const problems: string[] = [];
  const problem = (kind: string, place: string, message: string): void => {
    problems.push(`${name}: ${kind} ${place}: ${message}`);
  };
  const rows: EntryRow[] = family.exceptions.flatMap((row, index) => {
    const target = targetOf(row);
    return target?.type === 'entry' || target?.type === 'prop' ? [{ row, index, target }] : [];
  });
  const where = ({ index, target }: EntryRow): string =>
    `exceptions[${index}] (${labelOf(target)})`;

  const context: Context = {
    family,
    files,
    root,
    project: extract.surface.length > 0 ? options.project() : undefined,
    differences: [],
    usedAdditions: new Set(),
    members: new Map(),
    read: new Set(),
  };
  for (const file of extract.surface) {
    compareFile(context, file);
  }

  const usedRows = new Set<number>();
  const staleRows = new Set<number>();
  for (const item of rows) {
    const { row, target } = item;
    const file = extract.surface.find(({ file: path }) => path === row.upstream);
    const part = file?.parts.find(({ name: title }) => title === row.entry);
    const named =
      file !== undefined &&
      titlesOf(file).has(row.entry as string) &&
      (target.type === 'entry' || part?.props?.some(({ name: prop }) => prop === row.prop));
    if (!named) {
      staleRows.add(item.index);
      problem(
        'stale row',
        where(item),
        `the extract has nothing that the row names. Remove the row, or run \`${extractCommand(name)}\` if the family paths changed.`,
      );
    }
  }

  const remaining: Difference[] = [];
  for (const difference of context.differences) {
    const covering = excusingRow(rows, difference);
    if (covering) {
      usedRows.add(covering.index);
    } else {
      remaining.push(difference);
    }
  }
  for (const { file, entry, message } of remaining) {
    problem('surface difference', `${basename(dirname(file))}/${entry}`, message);
  }
  for (const item of rows) {
    if (!usedRows.has(item.index) && !staleRows.has(item.index)) {
      problem('stale row', where(item), 'it covers no difference. Remove the row.');
    }
    const { waitsOn } = item.row;
    if (item.row.kind === 'waits-on' && waitsOn !== undefined && hasCounterpart(waitsOn, files)) {
      problem(
        'stale row',
        where(item),
        `Vase UI has the counterpart of ${waitsOn}. Port the entry, then remove the row.`,
      );
    }
  }

  const partTitles = new Set(
    extract.surface.flatMap(({ parts }) => parts.map(({ name: title }) => title)),
  );
  family.surfaceAdditions.forEach((row, index) => {
    if (context.usedAdditions.has(index)) {
      return;
    }
    const { kind, name: member } = memberOf(row);
    const mapped = (context.members.get(row.entry) ?? []).some(({ expected }) =>
      expected[kind].has(member),
    );
    const reason = !partTitles.has(row.entry)
      ? `the extract has no part ${inlineCode(row.entry)}`
      : mapped
        ? `a Base UI row maps to the ${MEMBER_LABELS[kind]} ${inlineCode(member)}`
        : `the part does not have the ${MEMBER_LABELS[kind]} ${inlineCode(member)}`;
    problem(
      'stale row',
      `surfaceAdditions[${index}] (${row.entry}, ${kind} ${member})`,
      `${reason}. Remove the row.`,
    );
  });

  return { problems, summary: summarize(extract, rows, context, remaining) };
}
