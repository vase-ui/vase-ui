import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  FAMILY_NAME,
  validateBetterRow,
  validateExtract,
  validateFamilyFile,
  validateUpstreamFile,
} from './parityFiles.ts';
import type { BetterRow, FamilyExtract, FamilyFile, UpstreamFile } from './parityFiles.ts';
import { VASE_ROOTS } from './paths.ts';

export const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');

export const UPSTREAM_FILE = 'parity/upstream.json';
export const FAMILIES_FOLDER = 'parity/families';
export const BETTER_FOLDER = 'parity/better';

export function familyFile(name: string): string {
  return `${FAMILIES_FOLDER}/${name}.json`;
}

export function extractFile(name: string): string {
  return `${FAMILIES_FOLDER}/${name}.upstream.json`;
}

export interface FamilyFiles {
  name: string;
  family?: FamilyFile;
  extract?: FamilyExtract;
  hasFamilyFile: boolean;
  hasExtract: boolean;
}

export interface ParityFiles {
  upstream?: UpstreamFile;
  families: FamilyFiles[];
  better: BetterRow[];
  problems: string[];
}

function listJson(root: string, folder: string): string[] {
  const path = join(root, folder);
  return existsSync(path)
    ? readdirSync(path)
        .filter((name) => name.endsWith('.json'))
        .sort()
    : [];
}

function readJson<T>(
  root: string,
  file: string,
  validate: (file: string, value: unknown) => string[],
  problems: string[],
): T | undefined {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch (error) {
    problems.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  const found = validate(file, value);
  problems.push(...found);
  return found.length === 0 ? (value as T) : undefined;
}

export function readUpstreamFile(root: string): { upstream?: UpstreamFile; problems: string[] } {
  const problems: string[] = [];
  if (!existsSync(join(root, UPSTREAM_FILE))) {
    problems.push(`${UPSTREAM_FILE}: the file does not exist. Run \`pnpm parity:track\`.`);
    return { problems };
  }
  const upstream = readJson<UpstreamFile>(root, UPSTREAM_FILE, validateUpstreamFile, problems);
  return { upstream, problems };
}

export function readParityFiles(root: string, options: { readExtracts: boolean }): ParityFiles {
  const { upstream, problems } = readUpstreamFile(root);

  const names = new Map<string, FamilyFiles>();
  const entry = (name: string): FamilyFiles => {
    let found = names.get(name);
    if (!found) {
      found = { name, hasFamilyFile: false, hasExtract: false };
      names.set(name, found);
    }
    return found;
  };
  for (const file of listJson(root, FAMILIES_FOLDER)) {
    const isExtract = file.endsWith('.upstream.json');
    const name = file.slice(0, -(isExtract ? '.upstream.json' : '.json').length);
    const path = `${FAMILIES_FOLDER}/${file}`;
    if (!FAMILY_NAME.test(name)) {
      problems.push(
        `${path}: the family name "${name}" must match ${FAMILY_NAME}. Rename the file.`,
      );
      continue;
    }
    const found = entry(name);
    if (isExtract) {
      found.hasExtract = true;
      // The command that writes the extracts must work when an extract is wrong, so it does not read them.
      if (options.readExtracts) {
        found.extract = readJson<FamilyExtract>(root, path, validateExtract, problems);
      }
    } else {
      found.hasFamilyFile = true;
      found.family = readJson<FamilyFile>(root, path, validateFamilyFile, problems);
    }
  }

  const better = listJson(root, BETTER_FOLDER).flatMap((file) => {
    const row = readJson<BetterRow>(root, `${BETTER_FOLDER}/${file}`, validateBetterRow, problems);
    return row ? [row] : [];
  });
  return { upstream, families: [...names.values()], better, problems };
}

export function listVaseFiles(root: string): string[] {
  return VASE_ROOTS.flatMap((folder) => {
    const path = join(root, folder);
    if (!existsSync(path)) {
      return [];
    }
    return readdirSync(path, { recursive: true, withFileTypes: true })
      .filter((item) => item.isFile())
      .map((item) => relative(root, join(item.parentPath, item.name)))
      .filter((file) => !file.split('/').includes('node_modules'));
  });
}

export function readRepositoryFile(root: string, path: string): string {
  return readFileSync(join(root, path), 'utf8');
}
