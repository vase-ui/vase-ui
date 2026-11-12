import { matchesGlob } from 'node:path';

const MAPPED_ROOTS = [
  { upstream: 'packages/react/src/', vase: 'packages/vue/src/' },
  { upstream: 'packages/utils/src/', vase: 'packages/vue/src/common/' },
  { upstream: 'packages/react/test/', vase: 'packages/vue/test/' },
];

export const UPSTREAM_ROOTS = MAPPED_ROOTS.map(({ upstream }) => upstream);
export const VASE_SOURCE_ROOT = 'packages/vue/src';
export const VASE_ROOTS = [VASE_SOURCE_ROOT, 'packages/vue/test'];

export interface VaseFiles {
  paths: ReadonlySet<string>;
  folders: ReadonlySet<string>;
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

function mappedPath(upstreamPath: string): string | undefined {
  const root = MAPPED_ROOTS.find(({ upstream }) => upstreamPath.startsWith(upstream));
  return root && root.vase + upstreamPath.slice(root.upstream.length);
}

export function counterparts(upstreamPath: string, files: VaseFiles): string[] {
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

export function hasCounterpart(upstreamPath: string, files: VaseFiles): boolean {
  return counterparts(upstreamPath, files).length > 0;
}
