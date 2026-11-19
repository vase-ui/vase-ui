import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { posix } from 'node:path';

/** One line of `git diff --name-status --no-renames`. */
export interface Change {
  /** The status letter of git, such as `A`, `M` or `D`. */
  status: string;
  /** The path from the root of the repository. */
  path: string;
}

export interface Selection {
  /**
   * `all`: each test job runs each test file.
   * `related`: each test job runs the test files that load one of the files in `related`.
   * `none`: no job runs a test file of `packages/vue`.
   */
  tests: 'all' | 'related' | 'none';
  /** Paths from the root of the repository. Empty unless `tests` is `related`. */
  related: string[];
  /** `true` when the job of the fixtures, `test-nuxt`, must run. */
  fixtures: boolean;
}

const PACKAGE = 'packages/vue/';
const TEST_ROOTS = [`${PACKAGE}src`, `${PACKAGE}test`];
const FIXTURES = 'fixtures/';

/** A change of one of these files can change the result of each test file. */
const RUN_EACH_TEST = [
  /^\.github\//,
  /^scripts\/ci\//,
  /(?:^|\/)package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^patches\//,
  /^\.node-version$/,
  /(?:^|\/)tsconfig[^/]*\.json$/,
  /^packages\/vue\/vitest\.[^/]*config\.ts$/,
  // The configurations read the list of the folders whose tests run with Vue 3.6.
  /^packages\/vue\/test\/refactoredFolders\.ts$/,
  // The module graph misses two files of `test/server`: `renderOnServer` loads `renderToHtml.ts` by
  // a path, and a test runs `printSegmentLayouts.ts` in a child process. The configuration starts
  // the shell script.
  /^packages\/vue\/test\/server\//,
  /^packages\/vue\/test\/[^/]+\.sh$/,
  // `test/demos.ownVariants.test.tsx` reads the names of these records with `import.meta.glob`.
  // Vitest selects no test file for a record.
  /^parity\/own\//,
];

/**
 * No test file of `packages/vue` and no fixture reads these files. The jobs `check` and
 * `docs-axe` read them, and they run for each pull request.
 */
const READ_BY_NO_TEST = [
  /^[^/]+\.md$/,
  /^LICENSE$/,
  /^parity\//,
  /^scripts\//,
  /^eslint\.config(?:\.test)?\.js$/,
  /^prettier\.config\.js$/,
  /^docs\/public\//,
  /^docs\/.+\.md$/,
];

/** A test file can load one of these files. Vitest then finds the test file. */
const LOADED_BY_TESTS = [/^packages\/vue\/(?:src|test|scripts)\//, /^docs\//];

/** A file with `.test` or `.spec` before its extension. The build of the package does not read it. */
const TEST_OR_TYPE_TEST = /\.(?:test|spec)\.[^/.]+$/;
const TEST_FILE = /\.test\.tsx?$/;

/**
 * The paths of a test job go in one environment variable. Linux limits one variable to 128 KiB,
 * and a step with a longer one fails with `Argument list too long`.
 */
export const MAX_RELATED_PATHS = 500;

/** A path with white space splits the command of a test job, and a line break adds a job output. */
const SAFE_PATH = /^[\w@.+/-]+$/;

const matches = (patterns: readonly RegExp[], path: string) =>
  patterns.some((pattern) => pattern.test(path));

/** `test-nuxt` builds the package, so a file that the build can read can change its result. */
function isReadByBuild(path: string): boolean {
  return (
    path.startsWith(PACKAGE) && !path.startsWith(`${PACKAGE}test/`) && !TEST_OR_TYPE_TEST.test(path)
  );
}

/**
 * The test files in the folder of `path` and in each folder above it, up to `src` or `test` of the
 * package. A test can read a file by a path at run time, as the server render of a fixture does.
 * The module graph does not hold such a file.
 */
function testFilesAbove(path: string, testFiles: readonly string[]): string[] {
  const root = TEST_ROOTS.find((folder) => path.startsWith(`${folder}/`));
  if (root === undefined) {
    return [];
  }
  const folders = new Set<string>();
  for (let folder = posix.dirname(path); folder.startsWith(root); folder = posix.dirname(folder)) {
    folders.add(folder);
  }
  return testFiles.filter((file) => folders.has(posix.dirname(file)));
}

/**
 * `changes` are the files that a pull request changes. `packageFiles` are the files of
 * `packages/vue/src` and `packages/vue/test` with the pull request applied.
 */
export function selectTests(
  changes: readonly Change[],
  packageFiles: readonly string[],
): Selection {
  const all: Selection = { tests: 'all', related: [], fixtures: true };
  const paths = changes.map((change) => change.path);

  const hasRule = (path: string) =>
    matches(READ_BY_NO_TEST, path) || path.startsWith(FIXTURES) || matches(LOADED_BY_TESTS, path);
  if (paths.some((path) => matches(RUN_EACH_TEST, path) || !hasRule(path))) {
    return all;
  }
  // `import.meta.glob` in a test file reads the folders of the demos. The module graph of that
  // test file does not hold a file that is gone.
  if (
    changes.some(
      (change) =>
        change.status === 'D' &&
        change.path.startsWith('docs/') &&
        !matches(READ_BY_NO_TEST, change.path),
    )
  ) {
    return all;
  }

  const fixtures = paths.some((path) => path.startsWith(FIXTURES) || isReadByBuild(path));
  const loadedPaths = paths.filter(
    (path) => matches(LOADED_BY_TESTS, path) && !matches(READ_BY_NO_TEST, path),
  );
  if (loadedPaths.length === 0) {
    return { tests: 'none', related: [], fixtures };
  }

  const testFiles = packageFiles.filter((file) => TEST_FILE.test(file));
  const related = new Set(loadedPaths);
  for (const path of loadedPaths) {
    // No test reads a test file by a path.
    if (!TEST_FILE.test(path)) {
      for (const file of testFilesAbove(path, testFiles)) {
        related.add(file);
      }
    }
  }
  if (related.size > MAX_RELATED_PATHS || [...related].some((path) => !SAFE_PATH.test(path))) {
    return all;
  }
  return { tests: 'related', related: [...related].sort(), fixtures };
}

/** The arguments of `vitest` for a selection. The paths are relative to `packages/vue`. */
export function vitestCommand(selection: Selection): string {
  if (selection.tests !== 'related') {
    return 'run';
  }
  const paths = selection.related.map((path) => posix.relative(PACKAGE, path));
  return ['related', '--run', ...paths].join(' ');
}

function git(...args: string[]): string[] {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: Infinity })
    .split('\0')
    .filter((part) => part !== '');
}

function main(): void {
  const output = process.env.GITHUB_OUTPUT;
  if (output === undefined) {
    throw new Error(
      'GITHUB_OUTPUT is not set. This script runs in a step of a GitHub Actions job.',
    );
  }
  // The checkout of a pull request is the merge commit of GitHub. Its first parent is the base.
  const status = git('diff', '--name-status', '--no-renames', '-z', 'HEAD^1', 'HEAD');
  const changes: Change[] = [];
  for (let index = 0; index + 1 < status.length; index += 2) {
    changes.push({ status: status[index], path: status[index + 1] });
  }
  const selection = selectTests(changes, git('ls-files', '-z', ...TEST_ROOTS));
  appendFileSync(
    output,
    `tests=${selection.tests}\nfixtures=${selection.fixtures}\nvitest-command=${vitestCommand(selection)}\n`,
  );
  console.log(
    `${changes.length} changed files. tests=${selection.tests}, fixtures=${selection.fixtures}, ${selection.related.length} related files.`,
  );
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
