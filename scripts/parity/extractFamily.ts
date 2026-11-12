import { isSuiteRow, readTestRows } from './cases.ts';
import type { FamilyExtract, FamilyFile } from './parityFiles.ts';
import {
  isDeclarationFile,
  isScriptFile,
  isTestFile,
  isTypeTestFile,
  isUnderMappedRoot,
  matchesAny,
} from './paths.ts';
import { readTypesMd } from './typesMd.ts';

/** A path exists when it is a file, or a folder with a file in it. */
export function pathExists(files: readonly string[], path: string): boolean {
  return files.includes(path) || files.some((file) => file.startsWith(`${path}/`));
}

export function missingPaths(
  commit: string,
  files: readonly string[],
  paths: { place: string; path: string }[],
): string[] {
  return paths
    .filter(({ path }) => !pathExists(files, path))
    .map(
      ({ place, path }) =>
        `${place}: "${path}" does not exist in Base UI at commit ${commit}. Correct the path.`,
    );
}

export function buildExtract(
  family: FamilyFile,
  files: readonly string[],
  read: (path: string) => string,
): FamilyExtract {
  for (const glob of family.upstreamPaths) {
    if (!files.some((file) => matchesAny(file, [glob]))) {
      throw new Error(
        `The glob "${glob}" matches no file at commit ${family.matchedCommit}. Correct "upstreamPaths" in the family file.`,
      );
    }
  }
  const matched = files.filter((file) => matchesAny(file, family.upstreamPaths));
  const mapped = matched.filter(isUnderMappedRoot);
  const withCases = mapped
    .filter((file) => isScriptFile(file) && !isTypeTestFile(file) && !isDeclarationFile(file))
    .sort()
    .map((file) => ({ file, rows: readTestRows(file, read(file)) }))
    .filter(({ rows }) => rows.length > 0);
  return {
    commit: family.matchedCommit,
    upstreamPaths: family.upstreamPaths,
    sources: mapped.filter((file) => !isTestFile(file) && !isTypeTestFile(file)).sort(),
    typeTests: mapped.filter(isTypeTestFile).sort(),
    cases: withCases,
    surface: matched
      .filter((file) => file.endsWith('/types.md'))
      .sort()
      .map((file) => readTypesMd(file, read(file))),
  };
}

export interface Counts {
  components: SurfaceCounts;
  utils: SurfaceCounts;
  tests: {
    testFiles: number;
    caseRows: number;
    suiteCalls: number;
    otherFiles: number;
    otherCaseRows: number;
    otherSuiteCalls: number;
    typeTests: number;
  };
}

export interface SurfaceCounts {
  files: number;
  entries: number;
  distinctParts: number;
  propRows: number;
  dataAttributes: number;
  cssVariables: number;
  changeEventReasons: number;
}

function countSurface(surface: FamilyExtract['surface']): SurfaceCounts {
  const parts = surface.flatMap((file) => file.parts);
  const distinct = (values: string[]): number => new Set(values).size;
  return {
    files: surface.length,
    entries: parts.length,
    distinctParts: distinct(parts.flatMap((part) => (part.state ? [part.state.name] : []))),
    propRows: parts.reduce((total, part) => total + (part.props?.length ?? 0), 0),
    dataAttributes: distinct(parts.flatMap((part) => part.dataAttributes.map(({ name }) => name))),
    cssVariables: distinct(parts.flatMap((part) => part.cssVariables.map(({ name }) => name))),
    changeEventReasons: distinct(parts.flatMap((part) => part.changeEventReason?.values ?? [])),
  };
}

/** Counts the facts of the whole Base UI tree at one commit, to repeat the acceptance of the reader. */
export function countTree(files: readonly string[], read: (path: string) => string): Counts {
  const surfaceFiles = (folder: string): FamilyExtract['surface'] =>
    files
      .filter((file) =>
        new RegExp(`^docs/src/app/\\(docs\\)/react/${folder}/[^/]+/types\\.md$`).test(file),
      )
      .sort()
      .map((file) => readTypesMd(file, read(file)));
  const mapped = files.filter(isUnderMappedRoot);
  const tests = {
    testFiles: 0,
    caseRows: 0,
    suiteCalls: 0,
    otherFiles: 0,
    otherCaseRows: 0,
    otherSuiteCalls: 0,
    typeTests: 0,
  };
  for (const file of mapped) {
    if (isTypeTestFile(file)) {
      tests.typeTests += 1;
    } else if (isScriptFile(file) && !isDeclarationFile(file)) {
      const rows = readTestRows(file, read(file));
      const suiteCalls = rows.filter(isSuiteRow).length;
      if (isTestFile(file)) {
        tests.testFiles += 1;
        tests.caseRows += rows.length - suiteCalls;
        tests.suiteCalls += suiteCalls;
      } else if (rows.length > 0) {
        tests.otherFiles += 1;
        tests.otherCaseRows += rows.length - suiteCalls;
        tests.otherSuiteCalls += suiteCalls;
      }
    }
  }
  return {
    components: countSurface(surfaceFiles('components')),
    utils: countSurface(surfaceFiles('utils')),
    tests,
  };
}

export function formatCounts(commit: string, counts: Counts): string {
  const { components, utils, tests } = counts;
  const number = (value: number): string => value.toLocaleString('en-US');
  return [
    `Base UI at commit ${commit}`,
    '',
    `Components (${components.files} types.md files)`,
    `  Entries (parts): ${number(components.entries)}`,
    `  Distinct parts (distinct state.name): ${number(components.distinctParts)}`,
    `  Prop rows: ${number(components.propRows)}`,
    `  Distinct data attributes (names in the part tables): ${number(components.dataAttributes)}`,
    `  Distinct CSS variables (names in the part tables): ${number(components.cssVariables)}`,
    `  Distinct ChangeEventReason strings: ${number(components.changeEventReasons)}`,
    '',
    `Utils (${utils.files} types.md files), on their own`,
    `  Entries: ${number(utils.entries)}`,
    `  Prop rows: ${number(utils.propRows)}`,
    '',
    'Tests under the three mapped roots',
    `  Test files: ${number(tests.testFiles)}`,
    `  Case rows in test files: ${number(tests.caseRows)}`,
    `  Suite calls in test files: ${number(tests.suiteCalls)}`,
    `  Other files with rows: ${number(tests.otherFiles)}`,
    `  Case rows in those files: ${number(tests.otherCaseRows)}`,
    `  Suite calls in those files: ${number(tests.otherSuiteCalls)}`,
    `  Type tests: ${number(tests.typeTests)}`,
  ].join('\n');
}
