import { execFileSync } from 'node:child_process';
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { version as viteVersion } from 'vite';
import { buildApp, emptyApp, libraryApp, librariesOf, type App } from './build.ts';
import { LIBRARIES, SCENARIOS, SETUPS } from './scenarios.ts';

interface Size {
  raw: number;
  gzip: number;
  brotli: number;
}

/**
 * Builds the app, then sums the bytes of each JavaScript and CSS file. The HTML file does not
 * count.
 */
async function sizeOf(app: App): Promise<Size> {
  await buildApp(app);
  const size = { raw: 0, gzip: 0, brotli: 0 };
  for (const file of globSync('**/*.{js,css}', { cwd: app.outDir })) {
    const bytes = readFileSync(join(app.outDir, file));
    size.raw += bytes.length;
    size.gzip += gzipSync(bytes).length;
    size.brotli += brotliCompressSync(bytes).length;
  }
  return size;
}

/** The name and the version in the manifest of an installed dependency of the benchmarks. */
function installed(name: string): { package: string; version: string } {
  const manifest = JSON.parse(
    readFileSync(join(import.meta.dirname, 'node_modules', name, 'package.json'), 'utf8'),
  ) as { name: string; version: string };
  return { package: manifest.name, version: manifest.version };
}

const emptyApps: Record<string, Size> = {};
for (const setup of SETUPS) {
  emptyApps[setup.id] = await sizeOf(emptyApp(setup));
}

const apps: Record<string, Record<string, Record<string, Size | null>>> = {};
for (const scenario of SCENARIOS) {
  const scenarioApps: Record<string, Record<string, Size | null>> = {};
  for (const setup of SETUPS) {
    const setupApps: Record<string, Size | null> = {};
    for (const library of librariesOf(setup)) {
      const app = libraryApp(setup, library, scenario);
      setupApps[library.id] = app === undefined ? null : await sizeOf(app);
    }
    scenarioApps[setup.id] = setupApps;
  }
  apps[scenario] = scenarioApps;
}

const results = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  libraries: Object.fromEntries(
    LIBRARIES.map((library) => [library.id, installed(library.package)]),
  ),
  setups: Object.fromEntries(SETUPS.map((setup) => [setup.id, installed(setup.frameworkPackage)])),
  // The compressed bytes depend on the zlib and the Brotli of Node.js.
  tools: {
    node: process.versions.node,
    zlib: process.versions.zlib,
    brotli: process.versions.brotli,
    vite: viteVersion,
  },
  size: { emptyApp: emptyApps, apps },
};
writeFileSync(join(import.meta.dirname, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
