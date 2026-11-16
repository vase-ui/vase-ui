import { execFileSync } from 'node:child_process';

const TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
];
const TITLE = new RegExp(`^(?:${TYPES.join('|')})(?:\\([a-z\\d]+(?:-[a-z\\d]+)*\\))?!?: \\S`);

/** `title` is the title of a pull request, or the first line of a commit. */
export function titleProblem(title: string): string | undefined {
  if (TITLE.test(title)) {
    return undefined;
  }
  return `"${title}" is not a Conventional Commit. Write it as "type(scope): description", such as "feat(separator): add Separator". The scope is optional. It has lower-case letters and digits, and it can have single hyphens between them. The types are ${TYPES.join(', ')}.`;
}

function run(command: string, ...args: string[]): string[] {
  return execFileSync(command, args, { encoding: 'utf8' })
    .split('\n')
    .filter((line) => line !== '');
}

function main(): void {
  const { GITHUB_REPOSITORY: repository = '', PULL_REQUEST: pullRequest = '' } = process.env;
  // A new run of a job gets the event of the first run, with the title of that time. The API gives
  // the title of this moment, so the author can change the title and run the job again.
  // A merge group has no pull request. Its commits go to `main` as they are, so each one is read.
  const titles =
    pullRequest === ''
      ? run('git', 'log', '--format=%s', 'origin/main..HEAD')
      : run('gh', 'api', `repos/${repository}/pulls/${pullRequest}`, '--jq', '.title');
  if (titles.length === 0) {
    throw new Error('Found no title and no commit that is not on `main`.');
  }
  const problems = titles.flatMap((title) => titleProblem(title) ?? []);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    if (pullRequest !== '') {
      console.error('Change the title of the pull request. Then run this job again.');
    }
    process.exitCode = 1;
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
