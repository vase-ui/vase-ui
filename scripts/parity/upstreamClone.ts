import { execFileSync } from 'node:child_process';

const MAX_BUFFER = 64 * 1024 * 1024;

function git(clone: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', clone, ...args], {
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim() || String(error);
    throw new Error(`git ${args.join(' ')} failed in ${clone}: ${detail}`, { cause: error });
  }
}

function exitsWithZero(clone: string, args: string[]): boolean {
  try {
    execFileSync('git', ['-C', clone, ...args], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// The clone is read through its git objects, never through its files, so its working tree does not matter.
export function resolveCommit(clone: string, revision: string): string {
  if (!exitsWithZero(clone, ['rev-parse', '--git-dir'])) {
    throw new Error(
      `${clone} is not a git clone. Pass the path of a local clone of Base UI in --upstream.`,
    );
  }
  if (!exitsWithZero(clone, ['cat-file', '-e', `${revision}^{commit}`])) {
    throw new Error(
      `The clone ${clone} has no commit ${revision}. Run \`git fetch\` in the clone, then run this command again.`,
    );
  }
  return git(clone, ['rev-parse', `${revision}^{commit}`]).trim();
}

export function listFiles(clone: string, commit: string): string[] {
  return git(clone, ['ls-tree', '-r', '-z', '--name-only', commit]).split('\0').filter(Boolean);
}

export function readFileAt(clone: string, commit: string, path: string): string {
  return git(clone, ['show', `${commit}:${path}`]);
}

export function isAncestor(clone: string, ancestor: string, descendant: string): boolean {
  return exitsWithZero(clone, ['merge-base', '--is-ancestor', ancestor, descendant]);
}

/** The commits after `start`, up to `end`, on the first-parent line, oldest first. */
export function listCommitsAfter(clone: string, start: string, end: string): string[] {
  return git(clone, ['rev-list', '--reverse', '--first-parent', `${start}..${end}`])
    .split('\n')
    .filter(Boolean);
}

export interface CommitFacts {
  sha: string;
  date: string;
  subject: string;
  paths: string[];
}

export function readCommit(clone: string, sha: string): CommitFacts {
  const [date = '', subject = ''] = git(clone, [
    'show',
    '--no-patch',
    '--no-show-signature',
    '--format=%cI%n%s',
    sha,
  ])
    .trimEnd()
    .split('\n');
  const paths = git(clone, [
    'diff-tree',
    '--name-only',
    '-r',
    '--no-renames',
    '-z',
    `${sha}^1`,
    sha,
  ])
    .split('\0')
    .filter(Boolean);
  return { sha, date, subject, paths };
}

export function nearestReleaseTag(clone: string, commit: string): string {
  try {
    return git(clone, ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', commit]).trim();
  } catch (error) {
    throw new Error(
      `No release tag (v<number>…) is reachable from ${commit} in ${clone}. Run \`git fetch --tags\` in the clone.`,
      { cause: error },
    );
  }
}

export function countCommitsSince(clone: string, tag: string, commit: string): number {
  return Number(git(clone, ['rev-list', '--count', `${tag}..${commit}`]).trim());
}
