import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
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
  exports: Record<string, string | { default: string }>;
  peerDependencies?: Record<string, string>;
}

function publicEntries(manifest: Manifest, files: { path: string }[]): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, target] of Object.entries(manifest.exports)) {
    if (key === './package.json') continue;
    const name = manifest.name + key.slice(1);
    const path = (typeof target === 'string' ? target : target.default).slice(2);
    const [prefix, suffix] = path.split('*');
    if (suffix === undefined) {
      entries.set(name, path);
      continue;
    }
    for (const file of files) {
      if (!file.path.startsWith(prefix) || !file.path.endsWith(suffix)) continue;
      const folder = file.path.slice(prefix.length, file.path.length - suffix.length);
      if (!folder) continue;
      entries.set(
        name.replace('*', () => folder),
        file.path,
      );
    }
  }
  return entries;
}

export async function measurePackage(directory: string): Promise<PackageSize> {
  // The prepack hook builds the package and copies its release files.
  const [pack]: { size: number; unpackedSize: number; files: { path: string }[] }[] = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json', '--foreground-scripts=false'], {
      cwd: directory,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }),
  );
  const manifest: Manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const peers = Object.keys(manifest.peerDependencies ?? {});
  const entries: Record<string, EntrySize> = {};
  for (const [name, file] of publicEntries(manifest, pack.files)) {
    const { output } = await Rolldown.build({
      input: resolve(directory, file),
      cwd: resolve(directory),
      platform: 'browser',
      external: (id) => peers.some((peer) => id === peer || id.startsWith(`${peer}/`)),
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
