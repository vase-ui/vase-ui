import { join } from 'node:path';
import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';
import { checkTitleNames, isSuiteRow } from './cases.ts';
import type { TestRow } from './cases.ts';
import { checkFamily, matchCases } from './checkFamily.ts';
import type { FamilySummary, FileTally, RowTally, VaseTree } from './checkFamily.ts';
import { checkOwnComponent } from './checkOwn.ts';
import { checkSurface } from './checkSurface.ts';
import type { SurfaceSummary, Tally } from './checkSurface.ts';
import type { BetterRow, FamilyExtract, FamilyFile, UpstreamFile } from './parityFiles.ts';
import {
  directCounterparts,
  hasCounterpart,
  isTestFile,
  isTypeTestFile,
  matchesAny,
  relocationKind,
  VASE_SOURCE_ROOT,
} from './paths.ts';
import type { VaseFiles } from './paths.ts';
import {
  checkPathNames,
  extractCommand,
  extractFile,
  familyFile,
  readRepositoryFile,
  TRACK_COMMAND,
  UPSTREAM_FILE,
} from './repository.ts';
import type { FamilyFiles, ParityFiles } from './repository.ts';
import { readHiddenProps } from './vaseSurface.ts';
import type { VaseProject } from './vaseSurface.ts';

export interface BetterSummary {
  total: number;
  due: number;
}

export interface FamilyReport {
  name: string;
  summary: FamilySummary;
  surface?: SurfaceSummary;
}

export interface CheckResult {
  problems: string[];
  families: FamilyReport[];
  better: BetterSummary;
}

export interface CheckInput {
  parity: ParityFiles;
  files: VaseFiles;
  /** The absolute path of the repository root. */
  root: string;
  /** The rows of a Vase UI test file. It throws an error of one line that says what is wrong with the file. */
  rowsOf: (path: string) => TestRow[];
  project: () => VaseProject;
}

function checkCommits(name: string, family: FamilyFile, upstream: UpstreamFile): string[] {
  const problems: string[] = [];
  const shas = upstream.commits.map(({ sha }) => sha);
  const matched = shas.indexOf(family.matchedCommit);
  if (matched === -1) {
    problems.push(
      `${name}: matchedCommit ${family.matchedCommit} is not a commit of ${UPSTREAM_FILE}. Use a commit from that file, or run \`${TRACK_COMMAND}\`.`,
    );
  }
  family.notApplicableCommits.forEach(({ sha }, index) => {
    const place = `notApplicableCommits[${index}] (${sha})`;
    const position = shas.indexOf(sha);
    if (position === -1) {
      problems.push(
        `${name}: ${place}: the commit is not in ${UPSTREAM_FILE}. Use a commit from that file.`,
      );
    } else if (matched !== -1 && position > matched) {
      problems.push(
        `${name}: ${place}: the commit is after matchedCommit. Move matchedCommit forward first.`,
      );
    } else if (
      !upstream.commits[position].paths.some((path) => matchesAny(path, family.upstreamPaths))
    ) {
      problems.push(
        `${name}: ${place}: the commit changes no path of "upstreamPaths". Remove the row.`,
      );
    }
  });
  return problems;
}

function checkFreshExtract(name: string, files: FamilyFiles): string[] {
  const { family, extract } = files;
  if (!family || !extract) {
    return [];
  }
  const rerun = `Run \`${extractCommand(name)}\`.`;
  const problems: string[] = [];
  if (extract.commit !== family.matchedCommit) {
    problems.push(
      `${name}: ${extractFile(name)} was read at commit ${extract.commit}, but matchedCommit is ${family.matchedCommit}. ${rerun}`,
    );
  }
  if (JSON.stringify(extract.upstreamPaths) !== JSON.stringify(family.upstreamPaths)) {
    problems.push(
      `${name}: ${extractFile(name)} was read with other "upstreamPaths" than ${familyFile(name)}. ${rerun}`,
    );
  }
  return problems;
}

/** Checks each due row of `parity/better` for a test with its id. A row is due when its `dueWith` path has a counterpart. */
export function checkBetter(
  rows: BetterRow[],
  files: VaseFiles,
  testRows: () => TestRow[],
): { problems: string[]; summary: BetterSummary } {
  const due = rows.filter((row) => hasCounterpart(row.dueWith, files));
  const problems: string[] = [];
  if (due.length > 0) {
    const titles = testRows().flatMap((row) =>
      isSuiteRow(row) ? [] : [[...row.describe, row.title]],
    );
    for (const row of due) {
      const word = new RegExp(`(?<![\\w-])${row.id}(?![\\w-])`);
      if (!titles.some((list) => list.some((title) => word.test(title)))) {
        problems.push(
          `parity/better/${row.id}.json: due row has no test. Vase UI has the counterpart of ${row.dueWith}. Put ${row.id} in the title of a test or of its describe block.`,
        );
      }
    }
  }
  return { problems, summary: { total: rows.length, due: due.length } };
}

/**
 * Checks each SFC of the package source for a top-level name of a script block that is also a prop.
 * The API reference does not list such a prop. The SFC of a test is not in the API reference.
 */
function checkHiddenProps(files: VaseFiles, root: string): string[] {
  return [...files.paths]
    .filter(
      (path) =>
        path.startsWith(`${VASE_SOURCE_ROOT}/`) &&
        path.endsWith('.vue') &&
        !/\.(test|spec)\.vue$/.test(path),
    )
    .sort()
    .flatMap((path) =>
      readHiddenProps(readRepositoryFile(root, path), join(root, path)).map(
        (name) =>
          `${path}: \`<script>\` or \`<script setup>\` declares or imports the name \`${name}\` at the top level, and \`${name}\` is also a prop. The bindings of the SFC compiler then have no prop \`${name}\`, and the API reference does not list it. Give the declaration or the import another name.`,
      ),
    );
}

interface CurrentFamily {
  name: string;
  family: FamilyFile;
  extract: FamilyExtract;
}

function retainedMembers(path: string, source: string): Set<string> {
  const names = new Set<string>();
  function visit(node: ts.Node): void {
    if (
      ts.isDeclarationStatement(node) ||
      ts.isVariableDeclaration(node) ||
      ts.isBindingElement(node) ||
      ts.isParameter(node) ||
      ts.isClassElement(node) ||
      ts.isTypeElement(node) ||
      ts.isObjectLiteralElementLike(node) ||
      ts.isEnumMember(node)
    ) {
      const name =
        node.name && ts.isComputedPropertyName(node.name) ? node.name.expression : node.name;
      if (
        name &&
        (ts.isStringLiteralLike(name) ||
          ts.isNumericLiteral(name) ||
          (name === node.name && (ts.isIdentifier(name) || ts.isPrivateIdentifier(name))))
      ) {
        names.add(name.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  if (path.endsWith('.vue')) {
    const { script, scriptSetup } = parse(source, { filename: path }).descriptor;
    for (const block of [script, scriptSetup]) {
      if (block) {
        visit(
          ts.createSourceFile(
            `script.${block.lang ?? 'js'}`,
            block.content,
            ts.ScriptTarget.Latest,
          ),
        );
      }
    }
  } else {
    visit(ts.createSourceFile(path, source, ts.ScriptTarget.Latest));
  }
  return names;
}

function resolveRelocations(
  families: CurrentFamily[],
  input: CheckInput,
  rowsOf: VaseTree['rowsOf'],
  problems: string[],
): VaseFiles {
  const { files, root } = input;
  const relocations = new Map<string, string[]>();
  const owners = new Map<string, string>();
  const members = new Map<string, Set<string>>();
  let typeTests: Set<string> | undefined;
  function compiled(path: string): boolean {
    if (!typeTests) {
      const folder = join(root, 'packages/vue');
      const configPath = join(folder, 'tsconfig.test.json');
      const config = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file));
      typeTests = new Set(
        config.error
          ? []
          : ts.parseJsonConfigFileContent(
              config.config,
              ts.sys,
              folder,
              undefined,
              configPath,
              undefined,
              [{ extension: '.vue', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }],
            ).fileNames,
      );
    }
    return typeTests.has(join(root, path));
  }
  for (const { name, family, extract } of families) {
    const paths = new Set([
      ...extract.sources,
      ...extract.typeTests,
      ...extract.cases.map(({ file }) => file),
    ]);
    for (const path of paths) {
      const owner = owners.get(path);
      if (owner) {
        problems.push(
          `${name}: ${path} also belongs to ${owner}. Keep one family per upstream file.`,
        );
      }
      owners.set(path, name);
    }
    for (const [index, row] of (family.relocations ?? []).entries()) {
      const before = problems.length;
      const report = (message: string) =>
        problems.push(`${name}: relocations[${index}] (${row.upstream}): ${message}`);
      if (!paths.has(row.upstream)) {
        report('the family extract has no such file.');
      }
      const targets = [row, ...(row.additional ?? [])];
      const destinations = new Set(targets.map(({ destination }) => destination));
      const direct = directCounterparts(row.upstream, files).filter(
        (path) => destinations.size === 1 || !destinations.has(path),
      );
      if (direct.length) {
        report(`the direct counterpart ${direct.join(', ')} exists. Remove the conflict.`);
      }
      const { witness } = row;
      const typeWitness = isTypeTestFile(witness) || witness.endsWith('.spec.vue');
      if (!files.paths.has(witness) || !(isTestFile(witness) || typeWitness)) {
        report(`the witness ${witness} must name a test file.`);
      } else if (typeWitness) {
        if (
          !compiled(witness) ||
          (!isTypeTestFile(row.upstream) && (row.behavior || isTestFile(row.upstream)))
        ) {
          report(`the witness ${witness} must cover the retained behavior or type.`);
        }
      } else if (
        !rowsOf(witness).some(
          ({ conditions }) => !conditions?.some((term) => term === 'skip' || term === 'todo'),
        )
      ) {
        report(`the witness ${witness} has no runnable case or suite call.`);
      }
      for (const { destination, member } of targets) {
        if (!files.paths.has(destination)) {
          report(`the destination ${destination} does not exist.`);
        } else if (relocationKind(destination) !== relocationKind(row.upstream)) {
          report(`${destination} must be a ${relocationKind(row.upstream)}.`);
        } else if (isTypeTestFile(destination) && !compiled(destination)) {
          report(`the test project does not include ${destination}.`);
        } else if (member) {
          if (!members.has(destination)) {
            members.set(
              destination,
              retainedMembers(destination, readRepositoryFile(root, destination)),
            );
          }
          if (!members.get(destination)?.has(member)) {
            report(`${destination} has no declaration for "${member}".`);
          }
        }
      }
      if (problems.length === before) {
        relocations.set(row.upstream, [...destinations]);
      }
    }
  }
  return { ...files, relocations };
}

export function checkRepository(input: CheckInput): CheckResult & { files: VaseFiles } {
  const { parity, root } = input;
  const problems = [...parity.problems, ...checkPathNames(root)];
  const families: FamilyReport[] = [];

  // One refused file must not hide the other problems. It gives one problem and has no rows.
  const refused = new Set<string>();
  const readTests = new Set<string>();
  const rowsOf = (path: string): TestRow[] => {
    if (refused.has(path)) {
      return [];
    }
    try {
      return input.rowsOf(path);
    } catch (error) {
      refused.add(path);
      problems.push(error instanceof Error ? error.message : String(error));
      return [];
    }
  };

  const current: CurrentFamily[] = [];
  for (const found of [...parity.families].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const { name, family, extract } = found;
    if (found.hasFamilyFile && !found.hasExtract) {
      problems.push(
        `${name}: ${extractFile(name)} does not exist. Run \`${extractCommand(name)}\`.`,
      );
    } else if (!found.hasFamilyFile) {
      problems.push(
        `${name}: ${familyFile(name)} does not exist, but ${extractFile(name)} does. Add the family file, or delete the extract.`,
      );
    }
    if (!family || !extract) {
      continue;
    }
    if (parity.upstream) {
      problems.push(...checkCommits(name, family, parity.upstream));
    }
    const stale = checkFreshExtract(name, found);
    problems.push(...stale);
    if (stale.length === 0) {
      current.push({ name, family, extract });
    }
  }
  const files = resolveRelocations(current, input, rowsOf, problems);
  const vase: VaseTree = {
    files,
    rowsOf(path) {
      readTests.add(path);
      return rowsOf(path);
    },
  };
  const matches = matchCases(current, vase);
  for (const { name, family, extract } of current) {
    const cases = checkFamily(name, family, extract, vase, matches);
    problems.push(...cases.problems);
    const report: FamilyReport = { name, summary: cases.summary };
    if (
      extract.surface.length > 0 ||
      family.surfaceAdditions.length > 0 ||
      family.returnTypeDifferences.length > 0 ||
      family.exceptions.some(({ entry }) => entry !== undefined)
    ) {
      const surface = checkSurface({ name, family, extract, files, root, project: input.project });
      problems.push(...surface.problems);
      report.surface = surface.summary;
    }
    families.push(report);
  }

  for (const { name, record } of parity.ownComponents) {
    problems.push(
      ...checkOwnComponent(name, record, {
        upstream: parity.upstream,
        files,
        root,
        project: input.project,
      }),
    );
  }

  const tests = [...files.paths].filter(isTestFile).sort();
  for (const path of tests) {
    if (!readTests.has(path)) {
      problems.push(...checkTitleNames(path, rowsOf(path)));
    }
  }
  const better = checkBetter(parity.better, files, () => tests.flatMap(rowsOf));
  problems.push(...better.problems);
  problems.push(...checkHiddenProps(files, root));
  return { problems, families, better: better.summary, files };
}

const EXCEPTION_KINDS = ['replaced', 'not-applicable', 'waits-on'] as const;
const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

function describeCounts(total: number, parts: [string, number][]): string {
  const shown = parts.filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}`);
  return shown.length > 0 ? `${total} (${shown.join(', ')})` : `${total}`;
}

function fileCounts(tally: FileTally): string {
  return describeCounts(tally.total, [
    ['ported', tally.ported],
    ...EXCEPTION_KINDS.map((kind): [string, number] => [kind, tally[kind]]),
  ]);
}

function rowCounts(tally: RowTally): string {
  return describeCounts(tally.total, [
    ['matched', tally.matched],
    ...EXCEPTION_KINDS.map((kind): [string, number] => [kind, tally[kind]]),
    ...ENGINES.map((engine): [string, number] => [`engine ${engine}`, tally.engine[engine]]),
  ]);
}

function surfaceCounts(tally: Tally): string {
  return describeCounts(tally.total, [
    ['matched', tally.matched],
    ['excepted', tally.excepted],
  ]);
}

export function formatSummary(result: CheckResult): string[] {
  const lines = result.families.map(({ name, summary, surface }) => {
    const segments = [
      `sources ${fileCounts(summary.sources)}`,
      `type tests ${fileCounts(summary.typeTests)}`,
      `cases ${rowCounts(summary.cases)}`,
      `suite calls ${rowCounts(summary.suiteCalls)}`,
      `${summary.rowsWithoutUpstream} Vase UI rows with no upstream row`,
      ...(surface
        ? [
            `entries ${surfaceCounts(surface.entries)}`,
            `prop rows ${surfaceCounts(surface.propRows)}`,
          ]
        : []),
    ];
    return `${name}: ${segments.join('; ')}`;
  });
  lines.push(`parity/better: ${result.better.total} rows, ${result.better.due} due`);
  return lines;
}
