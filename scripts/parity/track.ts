import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { UpstreamFile } from './parityFiles.ts';
import { DOCS_FOLDER_PREFIX } from './paths.ts';
import { readUpstreamFile, REPOSITORY_ROOT, TRACK_COMMAND, UPSTREAM_FILE } from './repository.ts';
import {
  countCommitsSince,
  isAncestor,
  listCommitsAfter,
  listFiles,
  nearestReleaseTag,
  readCommit,
  resolveCommit,
} from './upstreamClone.ts';

/** The names of the folders that hold the docs of one component each, sorted. */
export function componentFolders(files: readonly string[], commit: string): string[] {
  const root = `${DOCS_FOLDER_PREFIX}components/`;
  const names = new Set<string>();
  for (const file of files) {
    const end = file.indexOf('/', root.length);
    if (file.startsWith(root) && end !== -1) {
      names.add(file.slice(root.length, end));
    }
  }
  if (names.size === 0) {
    throw new Error(
      `Commit ${commit} has no folder under ${root}. Correct DOCS_FOLDER_PREFIX in scripts/parity/paths.ts.`,
    );
  }
  return [...names].sort();
}

export function buildUpstream(
  clone: string,
  revision: string,
  current: UpstreamFile,
): UpstreamFile {
  const commit = resolveCommit(clone, revision);
  const currentCommit = resolveCommit(clone, current.commit);
  if (!isAncestor(clone, currentCommit, commit)) {
    throw new Error(
      `Commit ${commit} is not the tracked commit ${currentCommit} or a descendant of it. The tracked commit moves forward only.`,
    );
  }
  const start = current.commits[0].sha;
  const commits = [start, ...listCommitsAfter(clone, start, commit)].map((sha) =>
    readCommit(clone, sha),
  );
  const tag = nearestReleaseTag(clone, commit);
  const count = countCommitsSince(clone, tag, commit);
  return {
    commit,
    describe: count === 0 ? tag : `${tag}-${count}-g${commit.slice(0, 8)}`,
    release: tag.replace(/^v/, ''),
    components: componentFolders(listFiles(clone, commit), commit),
    commits,
  };
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { upstream: { type: 'string' } },
  });
  if (positionals.length !== 1) {
    throw new Error(`Pass one commit: ${TRACK_COMMAND}.`);
  }
  if (values.upstream === undefined) {
    throw new Error('Pass --upstream <path>, the path of a local clone of Base UI.');
  }
  const { upstream, problems } = readUpstreamFile(REPOSITORY_ROOT);
  if (!upstream) {
    throw new Error(
      `${problems.join('\n')}\nCorrect ${UPSTREAM_FILE}, then run this command again.`,
    );
  }
  const updated = buildUpstream(resolve(values.upstream), positionals[0], upstream);
  writeFileSync(join(REPOSITORY_ROOT, UPSTREAM_FILE), `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`Wrote ${UPSTREAM_FILE} for commit ${updated.commit} (${updated.describe}).`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
