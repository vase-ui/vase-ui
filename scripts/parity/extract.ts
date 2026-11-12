import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildExtract, countTree, formatCounts, missingPaths } from './extractFamily.ts';
import { extractFile, familyFile, readParityFiles, REPOSITORY_ROOT } from './repository.ts';
import { listFiles, readFileAt, resolveCommit } from './upstreamClone.ts';

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      upstream: { type: 'string' },
      check: { type: 'boolean' },
      counts: { type: 'boolean' },
    },
  });
  if (values.upstream === undefined) {
    throw new Error('Pass --upstream <path>, the path of a local clone of Base UI.');
  }
  if (values.counts && (values.check || positionals.length > 0)) {
    throw new Error('--counts takes no family name and no other option.');
  }
  const clone = resolve(values.upstream);
  const parity = readParityFiles(REPOSITORY_ROOT, { readExtracts: false });
  if (parity.problems.length > 0 || !parity.upstream) {
    throw new Error(
      `${parity.problems.join('\n')}\nCorrect these files, then run this command again.`,
    );
  }

  const upstreamCommit = resolveCommit(clone, parity.upstream.commit);
  const upstreamFiles = listFiles(clone, upstreamCommit);
  const dueWithProblems = missingPaths(
    upstreamCommit,
    upstreamFiles,
    parity.better.map((row) => ({ place: `parity/better/${row.id}.json`, path: row.dueWith })),
  );
  if (dueWithProblems.length > 0) {
    throw new Error(dueWithProblems.join('\n'));
  }

  if (values.counts) {
    const counts = countTree(upstreamFiles, (path) => readFileAt(clone, upstreamCommit, path));
    console.log(formatCounts(upstreamCommit, counts));
    return;
  }

  const wanted =
    positionals.length > 0
      ? positionals
      : parity.families.filter(({ hasFamilyFile }) => hasFamilyFile).map(({ name }) => name);
  for (const name of wanted) {
    const family = parity.families.find((item) => item.name === name)?.family;
    if (!family) {
      throw new Error(`There is no family file ${familyFile(name)}.`);
    }
    const commit = resolveCommit(clone, family.matchedCommit);
    const files = listFiles(clone, commit);
    const waitsOnProblems = missingPaths(
      commit,
      files,
      family.exceptions.flatMap(({ waitsOn }, index) =>
        waitsOn === undefined
          ? []
          : [{ place: `${familyFile(name)}: exceptions[${index}]`, path: waitsOn }],
      ),
    );
    if (waitsOnProblems.length > 0) {
      throw new Error(waitsOnProblems.join('\n'));
    }
    const text = `${JSON.stringify(
      buildExtract(family, files, (path) => readFileAt(clone, commit, path)),
      null,
      2,
    )}\n`;
    const path = extractFile(name);
    if (!values.check) {
      writeFileSync(join(REPOSITORY_ROOT, path), text);
      console.log(`Wrote ${path}.`);
    } else if (!existsSync(join(REPOSITORY_ROOT, path))) {
      console.error(`${path} does not exist. Run \`pnpm parity:extract ${name}\`.`);
      process.exitCode = 1;
    } else if (readFileSync(join(REPOSITORY_ROOT, path), 'utf8') !== text) {
      console.error(`${path} differs from a fresh extract. Run \`pnpm parity:extract ${name}\`.`);
      process.exitCode = 1;
    }
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
