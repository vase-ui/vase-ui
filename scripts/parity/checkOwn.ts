import { join } from 'node:path';
import type { OwnComponent, UpstreamFile } from './parityFiles.ts';
import { VASE_SOURCE_ROOT } from './paths.ts';
import type { VaseFiles } from './paths.ts';
import { ownFile } from './repository.ts';
import type { ExportMatch, VaseProject } from './vaseSurface.ts';

export interface OwnContext {
  /** `undefined` when `parity/upstream.json` has a problem. */
  upstream: UpstreamFile | undefined;
  files: VaseFiles;
  /** The absolute path of the repository root. */
  root: string;
  project: () => VaseProject;
}

function inlineCode(text: string): string {
  return `\`${text}\``;
}

/**
 * Checks the record of a component that Base UI does not have against its entry point. The API
 * reference leaves out a name that has no export of the right kind, so each such name is a problem
 * here. Each problem says what to do.
 */
export function checkOwnComponent(
  name: string,
  record: OwnComponent,
  context: OwnContext,
): string[] {
  const problems: string[] = [];
  if (context.upstream?.components.includes(name)) {
    problems.push(
      `${name}: parity/upstream.json lists a Base UI component with this name. Add a family file and delete ${ownFile(name)}.`,
    );
  }
  const entryFile = `${VASE_SOURCE_ROOT}/${name}/index.ts`;
  if (!context.files.paths.has(entryFile)) {
    problems.push(
      `${name}: ${entryFile} does not exist. Add the entry point, or delete ${ownFile(name)}.`,
    );
    return problems;
  }
  const project = context.project();
  const entry = join(context.root, entryFile);
  const from = (kind: string): string => `from "${kind}s" in ${ownFile(name)}`;

  const findOne = (kind: string, title: string): ExportMatch | undefined => {
    const matches = project.findExports(entry, title);
    if (matches.length === 1) {
      return matches[0];
    }
    problems.push(
      matches.length === 0
        ? `${name}: ${kind} ${inlineCode(title)} has no export in ${entryFile}. Export it, or remove it ${from(kind)}.`
        : `${name}: ${kind} ${inlineCode(title)} matches more than one export (${matches.map(({ path }) => path).join(', ')}). Keep one.`,
    );
    return undefined;
  };

  for (const title of record.parts) {
    const match = findOne('part', title);
    if (match && !project.readComponent(match)) {
      problems.push(
        `${name}: part ${inlineCode(title)} is not a component. Move it to "functions" or "types", or remove it ${from('part')}.`,
      );
    }
  }
  for (const title of record.functions ?? []) {
    const match = findOne('function', title);
    if (!match) {
      continue;
    }
    if (project.readComponent(match)) {
      problems.push(
        `${name}: function ${inlineCode(title)} is a component. Move it to "parts", or remove it ${from('function')}.`,
      );
    } else if (!project.readFunction(match) && !project.readClass(match)) {
      problems.push(
        `${name}: function ${inlineCode(title)} is not a function or a class. Move it to "types", or remove it ${from('function')}.`,
      );
    }
  }
  for (const path of record.types ?? []) {
    const match = project.findExportAt(entry, path);
    if (!match) {
      problems.push(
        `${name}: type ${inlineCode(path)} has no export in ${entryFile}. Export it, or remove it ${from('type')}.`,
      );
    } else if (
      (project.readProperties(match) ?? []).length === 0 &&
      (project.readUnionValues(entry, path) ?? []).length === 0
    ) {
      problems.push(
        `${name}: type ${inlineCode(path)} has no property and is not a union of strings, so the API reference shows nothing for it. Remove it ${from('type')}.`,
      );
    }
  }
  return problems;
}
