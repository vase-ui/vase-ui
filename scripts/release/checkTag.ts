import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const MANIFEST = 'packages/vue/package.json';
const CALVER = /^\d{4}\.(?:[1-9]|1[0-2])\.(?:0|[1-9]\d*)$/;

export function releaseTagProblem(tag: string, version: string): string | undefined {
  if (!CALVER.test(version)) {
    return `The version "${version}" in ${MANIFEST} is not a CalVer version. Write it as YYYY.M.MICRO with no leading zero, such as 2026.11.0.`;
  }
  const expected = `v${version}`;
  if (tag !== expected) {
    return `The tag "${tag}" is not "v" plus the version "${version}" in ${MANIFEST}. The tag for this version is "${expected}".`;
  }
  return undefined;
}

function main(): void {
  const { positionals } = parseArgs({ allowPositionals: true });
  if (positionals.length !== 1) {
    throw new Error('Give one tag. Example: pnpm release:check-tag v2026.11.0');
  }
  const { version }: { version: string } = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', MANIFEST), 'utf8'),
  );
  const problem = releaseTagProblem(positionals[0], version);
  if (problem !== undefined) {
    console.error(problem);
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
