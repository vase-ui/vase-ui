import { execFileSync } from 'node:child_process';
import {
  globSync,
  mkdirSync,
  mkdtempDisposableSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { resolveExports } from 'resolve-pkg-maps';
import type { PathConditionsMap } from 'resolve-pkg-maps';
import { Rolldown } from 'tsdown';

export interface EntrySize {
  raw: number;
  gzip: number;
  brotli: number;
}

export interface PackageSize {
  packed: number;
  unpacked: number;
  entries: Record<string, EntrySize>;
}

interface Manifest {
  name: string;
  exports: PathConditionsMap;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function publicEntries(manifest: Manifest, files: { path: string }[]): Set<string> {
  const entries = new Set<string>();
  for (const key of Object.keys(manifest.exports)) {
    if (key === './package.json') continue;
    const name = manifest.name + key.slice(1);
    if (!key.includes('*')) {
      entries.add(name);
      continue;
    }
    const [pattern] = resolveExports(manifest.exports, key.slice(2), [
      'browser',
      'import',
      'production',
    ]);
    const [prefix, suffix] = pattern.slice(2).split('*');
    for (const file of files) {
      if (!file.path.startsWith(prefix) || !file.path.endsWith(suffix)) continue;
      const folder = file.path.slice(prefix.length, file.path.length - suffix.length);
      if (!folder) continue;
      entries.add(name.replace('*', () => folder));
    }
  }
  return entries;
}

export async function measurePackage(directory: string): Promise<PackageSize> {
  using temporary = mkdtempDisposableSync(join(tmpdir(), 'vase-size-'));
  // The prepack hook builds the package and copies its release files.
  const [pack]: {
    filename: string;
    size: number;
    unpackedSize: number;
    files: { path: string }[];
  }[] = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--pack-destination', temporary.path, '--json', '--foreground-scripts=false'],
      {
        cwd: directory,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    ),
  );
  execFileSync('tar', ['-xzf', join(temporary.path, pack.filename), '-C', temporary.path]);
  const packedDirectory = join(temporary.path, 'package');
  const manifest: Manifest = JSON.parse(
    readFileSync(join(packedDirectory, 'package.json'), 'utf8'),
  );
  const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies };
  const installed = resolve(directory, 'node_modules');
  for (const name of globSync(['*', '@*/*'], { cwd: installed })) {
    if (!Object.hasOwn(dependencies, name.replaceAll(sep, '/'))) continue;
    const link = join(temporary.path, 'node_modules', name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(installed, name), link, 'junction');
  }
  const peers = Object.keys(manifest.peerDependencies ?? {});
  const entries: Record<string, EntrySize> = {};
  for (const name of publicEntries(manifest, pack.files)) {
    const { output } = await Rolldown.build({
      input: name,
      cwd: packedDirectory,
      platform: 'browser',
      resolve: { conditionNames: ['production'] },
      // The Nuxt module imports the built-in modules of Node.js.
      external: (id) =>
        id.startsWith('node:') || peers.some((peer) => id === peer || id.startsWith(`${peer}/`)),
      transform: { define: { 'process.env.NODE_ENV': '"production"' } },
      onLog(level, log, handle) {
        handle(log.code === 'UNRESOLVED_IMPORT' ? 'error' : level, log);
      },
      output: { format: 'esm', minify: true, codeSplitting: false },
      write: false,
    });
    const size = { raw: 0, gzip: 0, brotli: 0 };
    for (const part of output) {
      const bytes = Buffer.from(part.type === 'chunk' ? part.code : part.source);
      size.raw += bytes.length;
      size.gzip += gzipSync(bytes).length;
      size.brotli += brotliCompressSync(bytes).length;
    }
    entries[name] = size;
  }
  return { packed: pack.size, unpacked: pack.unpackedSize, entries };
}

if (import.meta.main) {
  const [directory, destination] = process.argv.slice(2);
  writeFileSync(destination, JSON.stringify(await measurePackage(directory)));
}
