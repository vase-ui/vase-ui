import { extname, matchesGlob } from 'node:path';

const MAPPED_ROOTS = [
  { upstream: 'packages/react/src/', vase: 'packages/vue/src/' },
  { upstream: 'packages/utils/src/', vase: 'packages/vue/src/common/' },
  { upstream: 'packages/react/test/', vase: 'packages/vue/test/' },
];

/** The folder of Base UI that holds one docs folder for each component and each utility. */
export const DOCS_FOLDER_PREFIX = 'docs/src/app/(docs)/react/';

export const UPSTREAM_ROOTS = MAPPED_ROOTS.map(({ upstream }) => upstream);
export const VASE_SOURCE_ROOT = 'packages/vue/src';
export const VASE_ROOTS = [VASE_SOURCE_ROOT, 'packages/vue/test'];

export interface VaseFiles {
  paths: ReadonlySet<string>;
  folders: ReadonlySet<string>;
  relocations?: ReadonlyMap<string, string[]>;
}

export function vaseFiles(paths: Iterable<string>): VaseFiles {
  const files = new Set(paths);
  const folders = new Set<string>();
  for (const path of files) {
    for (let end = path.lastIndexOf('/'); end > 0; end = path.lastIndexOf('/', end - 1)) {
      folders.add(path.slice(0, end));
    }
  }
  return { paths: files, folders };
}

export function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path);
}

export function isTypeTestFile(path: string): boolean {
  return /\.spec\.tsx?$/.test(path);
}

export function isDeclarationFile(path: string): boolean {
  return path.endsWith('.d.ts');
}

export function isScriptFile(path: string): boolean {
  return /\.tsx?$/.test(path);
}

export function isUnderMappedRoot(path: string): boolean {
  return UPSTREAM_ROOTS.some((root) => path.startsWith(root));
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => matchesGlob(path, glob));
}

export function toVaseName(text: string, kind: 'path' | 'title' = 'path'): string {
  const name = text.replaceAll(/BaseU([Ii])/g, 'VaseU$1').replaceAll(/base(U[Ii]|-ui)/g, 'vase$1');
  return kind === 'title' ? name.replaceAll('Base UI', 'Vase UI') : name;
}

function mappedPath(upstreamPath: string): string | undefined {
  const root = MAPPED_ROOTS.find(({ upstream }) => upstreamPath.startsWith(upstream));
  return root && root.vase + toVaseName(upstreamPath.slice(root.upstream.length));
}

export function counterparts(upstreamPath: string, files: VaseFiles): string[] {
  return files.relocations?.get(upstreamPath) ?? directCounterparts(upstreamPath, files);
}

export function directCounterparts(upstreamPath: string, files: VaseFiles): string[] {
  const mapped = mappedPath(upstreamPath);
  if (mapped === undefined) {
    return [];
  }
  if (!isScriptFile(upstreamPath)) {
    return files.paths.has(mapped) || files.folders.has(mapped) ? [mapped] : [];
  }
  const stem = mapped.replace(/\.tsx?$/, '');
  const isTest = isTestFile(upstreamPath) || isTypeTestFile(upstreamPath);
  const extensions = isTest ? ['.ts', '.tsx'] : ['.ts', '.tsx', '.vue'];
  return extensions.map((extension) => stem + extension).filter((path) => files.paths.has(path));
}

export function relocationKind(path: string): string {
  if (isTestFile(path)) {
    return /\.node\.test\.tsx?$/.test(path) ? 'node test' : 'browser test';
  }
  if (isTypeTestFile(path)) {
    return 'type test';
  }
  if (/\.(test|spec)\.vue$/.test(path)) {
    return 'test SFC';
  }
  if (isDeclarationFile(path)) {
    return 'declaration';
  }
  if (isScriptFile(path) || path.endsWith('.vue')) {
    return /^packages\/(react|vue)\/test\//.test(path) || /\.(test|spec)\.[^/]+$/.test(path)
      ? 'test helper'
      : 'source';
  }
  return extname(path);
}

export function hasCounterpart(upstreamPath: string, files: VaseFiles): boolean {
  return counterparts(upstreamPath, files).length > 0;
}
