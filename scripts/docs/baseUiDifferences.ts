import { memberOf } from '../parity/parityFiles.ts';
import type { BetterRow, MemberKind } from '../parity/parityFiles.ts';
import { matchesAny } from '../parity/paths.ts';
import { readParityFiles, REPOSITORY_ROOT } from '../parity/repository.ts';
import type { FamilyFiles, OwnComponentFile } from '../parity/repository.ts';
import type { ApiReference } from './apiReference.ts';

/** The rows of the section "Differences from Base UI" of a family page. */
export interface BaseUiDifferences {
  /** The release of Base UI that Vase UI ports, or `null` for a component of Vase UI's own. */
  release: string | null;
  /** The reason and the standards of the record of a component of Vase UI's own. */
  own: { reason: string; standard: string[] } | null;
  /** The exception rows of the parts and the functions, in the sequence of the Base UI page. */
  api: { baseUi: string; prop: string | null; vaseUi: string }[];
  /** The members that Vase UI adds, less a native attribute that Base UI takes in the same way. */
  added: { part: string; kind: MemberKind; member: string; why: string }[];
  returnTypes: { name: string; returns: string; why: string }[];
  behavior: { id: string; behavior: string; evidence: string[] }[];
}

export interface DifferencesInput {
  release: string;
  families: FamilyFiles[];
  ownComponents: OwnComponentFile[];
  better: BetterRow[];
}

/**
 * `Collapsible` from the tag `TypesCollapsible.Root` of the Base UI page. `null` when no tag of the
 * page has a namespace, as `TypesMergeProps` of `mergeProps`. `NumberField` from `number-field`
 * when the family has no Base UI page.
 */
function namespaceOf(family: FamilyFiles | undefined, name: string): string | null {
  const tags = family?.extract?.pages.flatMap(({ referenceTags }) => referenceTags) ?? [];
  if (tags.length === 0) {
    return name.replace(/(?:^|-)(\w)/g, (_match, letter: string) => letter.toUpperCase());
  }
  return (
    tags
      .find((tag) => tag.includes('.'))
      ?.replace(/^Types/, '')
      .split('.')[0] ?? null
  );
}

/** `Collapsible.Root`, `RadioGroup` for the part `RadioGroup` of Radio Group, or `mergeProps` of a family with no namespace. */
function nameIn(namespace: string | null, entry: string): string {
  return namespace === null || entry === namespace ? entry : `${namespace}.${entry}`;
}

/** The pages of a better row: the families whose `upstreamPaths` have `dueWith`, and its `families`. */
export function pagesOfBetterRow(row: BetterRow, families: readonly FamilyFiles[]): string[] {
  const due = families.flatMap(({ name, family }) =>
    family && matchesAny(row.dueWith, family.upstreamPaths) ? [name] : [],
  );
  return [...due, ...(row.families ?? [])];
}

/**
 * The rows of the differences section of the page of `page`. The families of the page are `page`
 * and each family that `reference.homes` names. A part reads the rows of the family that ports it.
 */
export function buildBaseUiDifferences(
  page: string,
  reference: ApiReference,
  input: DifferencesInput,
): BaseUiDifferences {
  const byName = new Map(input.families.map((files) => [files.name, files]));
  const record = input.ownComponents.find(({ name }) => name === page)?.record;
  const pageFamilies = [page, ...reference.homes.map(({ family }) => family)].filter(
    (name, index, names) => names.indexOf(name) === index,
  );
  const behavior = input.better
    .filter((row) =>
      pagesOfBetterRow(row, input.families).some((name) => pageFamilies.includes(name)),
    )
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    .map(({ id, behavior: text, evidence }) => ({ id, behavior: text, evidence }));
  if (record) {
    return {
      release: null,
      own: { reason: record.reason, standard: record.standard },
      api: [],
      added: [],
      returnTypes: [],
      behavior,
    };
  }

  const entryRows = (family: string, entry: string) => {
    const files = byName.get(family);
    const namespace = namespaceOf(files, family);
    return (files?.family?.exceptions ?? []).flatMap((row) =>
      row.entry === entry
        ? [{ baseUi: nameIn(namespace, entry), prop: row.prop ?? null, vaseUi: row.reason }]
        : [],
    );
  };
  const functions = byName.get(page)?.extract?.surface.flatMap((file) => file.functions) ?? [];
  const api = [
    ...reference.homes.flatMap(({ part, family }) => entryRows(family, part)),
    ...functions.flatMap(({ name }) => entryRows(page, name)),
  ];
  const added = pageFamilies.flatMap((family) => {
    const namespace = namespaceOf(byName.get(family), family);
    return (byName.get(family)?.family?.surfaceAdditions ?? []).flatMap((row) =>
      row.nativeAttribute
        ? []
        : [{ part: nameIn(namespace, row.entry), ...memberOf(row), why: row.reason }],
    );
  });
  const returnTypes = pageFamilies.flatMap((family) => {
    const namespace = namespaceOf(byName.get(family), family);
    return (byName.get(family)?.family?.returnTypeDifferences ?? []).map((row) => ({
      name: nameIn(namespace, row.entry),
      returns: row.returns,
      why: row.reason,
    }));
  });
  return {
    release: input.release,
    own: null,
    api,
    added: added.map(({ part, kind, name, why }) => ({ part, kind, member: name, why })),
    returnTypes,
    behavior,
  };
}

/**
 * The problems of the `families` keys of the better rows. A row needs a page: a family with a
 * page whose `upstreamPaths` have its `dueWith`, or the key `families`. Each name of the key has a
 * page. `pages` are the families with a page.
 */
export function checkBetterRowPages(
  better: readonly BetterRow[],
  families: readonly FamilyFiles[],
  pages: ReadonlySet<string>,
): string[] {
  const withPage = families.filter(({ name }) => pages.has(name));
  return better.flatMap((row) => {
    const place = `parity/better/${row.id}.json`;
    if (row.families === undefined) {
      return pagesOfBetterRow(row, withPage).length > 0
        ? []
        : [
            `${place}: no family with a page has ${row.dueWith}. Add "families" with the families whose page shows the row, or [] for a row of no one component.`,
          ];
    }
    return row.families.flatMap((name) =>
      pages.has(name)
        ? []
        : [`${place}: "families" names ${name}, which has no page. Name a family with a page.`],
    );
  });
}

/**
 * Returns a function from a family and its API reference to the rows of the differences section of
 * its page. It reads the files of `parity` one time.
 */
export function createBaseUiDifferencesReader(
  root = REPOSITORY_ROOT,
): (family: string, reference: ApiReference) => BaseUiDifferences {
  let input: DifferencesInput | undefined;
  return (family, reference) => {
    if (!input) {
      const read = readParityFiles(root, { readExtracts: true });
      if (read.problems.length > 0 || !read.upstream) {
        throw new Error(
          `${read.problems.join('\n')}\nCorrect these files, then build the site again.`,
        );
      }
      input = { ...read, release: read.upstream.release };
    }
    return buildBaseUiDifferences(family, reference, input);
  };
}
