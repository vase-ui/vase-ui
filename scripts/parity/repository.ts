import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join, relative } from 'node:path';
import {
  FAMILY_NAME,
  validateBetterRow,
  validateExtract,
  validateFamilyFile,
  validateOwnComponent,
  validateUpstreamFile,
} from './parityFiles.ts';
import type {
  BetterRow,
  FamilyExtract,
  FamilyFile,
  OwnComponent,
  UpstreamFile,
} from './parityFiles.ts';
import { toVaseName, VASE_ROOTS } from './paths.ts';

export const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');

export const UPSTREAM_FILE = 'parity/upstream.json';
export const FAMILIES_FOLDER = 'parity/families';
export const OWN_FOLDER = 'parity/own';
export const BETTER_FOLDER = 'parity/better';

export function familyFile(name: string): string {
  return `${FAMILIES_FOLDER}/${name}.json`;
}

export function ownFile(name: string): string {
  return `${OWN_FOLDER}/${name}.json`;
}

export function extractFile(name: string): string {
  return `${FAMILIES_FOLDER}/${name}.upstream.json`;
}

export function extractCommand(name: string): string {
  return `pnpm parity:extract --upstream <path> ${name}`;
}

export const TRACK_COMMAND = 'pnpm parity:track <sha> --upstream <path>';

export interface FamilyFiles {
  name: string;
  family?: FamilyFile;
  extract?: FamilyExtract;
  hasFamilyFile: boolean;
  hasExtract: boolean;
}

/** The record of a component that Base UI does not have, with the name of the component. */
export interface OwnComponentFile {
  name: string;
  record: OwnComponent;
}

export interface ParityFiles {
  upstream?: UpstreamFile;
  families: FamilyFiles[];
  ownComponents: OwnComponentFile[];
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

function checkFamilyName(path: string, name: string, problems: string[]): boolean {
  if (FAMILY_NAME.test(name)) {
    return true;
  }
  problems.push(`${path}: the family name "${name}" must match ${FAMILY_NAME}. Rename the file.`);
  return false;
}

export function readUpstreamFile(root: string): { upstream?: UpstreamFile; problems: string[] } {
  const problems: string[] = [];
  if (!existsSync(join(root, UPSTREAM_FILE))) {
    problems.push(`${UPSTREAM_FILE}: the file does not exist. Restore it from git.`);
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
    if (!checkFamilyName(path, name, problems)) {
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

  const ownComponents = listJson(root, OWN_FOLDER).flatMap((file): OwnComponentFile[] => {
    const name = file.slice(0, -'.json'.length);
    const path = `${OWN_FOLDER}/${file}`;
    if (!checkFamilyName(path, name, problems)) {
      return [];
    }
    if (names.get(name)?.hasFamilyFile) {
      problems.push(
        `${path}: ${familyFile(name)} exists too. A component is a port or a component of Vase UI's own, not both. Delete one file.`,
      );
      return [];
    }
    const record = readJson<OwnComponent>(root, path, validateOwnComponent, problems);
    return record ? [{ name, record }] : [];
  });

  const better = listJson(root, BETTER_FOLDER).flatMap((file) => {
    const row = readJson<BetterRow>(root, `${BETTER_FOLDER}/${file}`, validateBetterRow, problems);
    return row ? [row] : [];
  });
  return { upstream, families: [...names.values()], ownComponents, better, problems };
}

function listPaths(root: string, folders: string[], include: (entry: Dirent) => boolean): string[] {
  return folders.flatMap((folder) => {
    const path = join(root, folder);
    if (!existsSync(path)) {
      return [];
    }
    return readdirSync(path, { recursive: true, withFileTypes: true })
      .filter(include)
      .map((item) => relative(root, join(item.parentPath, item.name)))
      .filter((file) => !file.split('/').includes('node_modules'));
  });
}

export function listVaseFiles(root: string): string[] {
  return listPaths(root, VASE_ROOTS, (entry) => entry.isFile());
}

export function checkPathNames(root: string): string[] {
  return listPaths(
    root,
    [...VASE_ROOTS, 'docs/demos'],
    (entry) => entry.name !== toVaseName(entry.name),
  )
    .sort()
    .map((path) => `${path}: rename to ${toVaseName(path)}.`);
}

export function readRepositoryFile(root: string, path: string): string {
  return readFileSync(join(root, path), 'utf8');
}
