import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildPackage } from 'tsdown';
import { build as bundle } from 'vite';
import {
  NUXT_MODULE_ENTRY,
  TEMPORAL_REFERENCE,
  buildOptions,
  familyEntries,
  writeBarrel,
  writeModuleManifest,
} from './build.ts';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const PACKAGE_DIRECTORY = '.package-check';
const DIST_DIRECTORY = `${PACKAGE_DIRECTORY}/dist`;
const CONSUMER_DIRECTORY = 'test/package-check/consumer';
const SOURCE_ROOTS = ['src', 'test/package-check/src'];
const PREPACK_FILES = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md'];
const DECLARATION_IMPORT = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;
const TEMPORAL_TYPE = /\bTemporal\./;

function runBin(name: string, args: string[]): void {
  execFileSync(join('node_modules', '.bin', name), args, { stdio: 'inherit' });
}

async function bundleConsumerFile(
  file: string,
  mode: 'production' | 'development' = 'production',
): Promise<string> {
  const result = await bundle({
    configFile: false,
    logLevel: 'silent',
    mode,
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
    root: CONSUMER_DIRECTORY,
    build: {
      write: false,
      minify: false,
      rolldownOptions: { input: file, external: ['vue'] },
    },
  });
  return [result]
    .flat()
    .flatMap((output) => ('output' in output ? output.output : []))
    .flatMap((chunk) => (chunk.type === 'chunk' ? [chunk.code] : []))
    .join('\n');
}

// The declaration file and each declaration file that it reaches by a relative import, as a map of
// the file name in `dist` to its text.
function reachedDeclarations(declaration: string): Map<string, string> {
  const files = new Map<string, string>();
  const pending = [declaration];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (!files.has(file)) {
      const code = readFileSync(join(DIST_DIRECTORY, file), 'utf8');
      files.set(file, code);
      for (const [, specifier] of code.matchAll(DECLARATION_IMPORT)) {
        pending.push(join(dirname(file), specifier.replace(/\.js$/, '.d.ts')));
      }
    }
  }
  return files;
}

function namesTemporal(declarations: Map<string, string>): boolean {
  return [...declarations.values()].some((code) => TEMPORAL_TYPE.test(code));
}

// TypeScript loads the `lib` of a reference line from each declaration file that a program loads.
// A line anywhere in the declarations that an entry reaches is thus enough for that entry.
function hasTemporalReference(declarations: Map<string, string>): boolean {
  return [...declarations.values()].some((code) => code.startsWith(TEMPORAL_REFERENCE));
}

function expectContent(file: string, code: string, text: string, expected: boolean): void {
  const found = code.includes(text);
  console.log(`  ${file}: ${found ? 'has' : 'has no'} ${text}`);
  assert.equal(found, expected, `${file} must ${expected ? 'contain' : 'not contain'} ${text}`);
}

async function main(): Promise<void> {
  console.log(`[1/10] Remove ${PACKAGE_DIRECTORY} and the files that prepack copies`);
  rmSync(PACKAGE_DIRECTORY, { recursive: true, force: true });
  // A copy from an earlier run can make npm pack a file that "prepack" does not copy.
  for (const file of PREPACK_FILES) {
    rmSync(file, { force: true });
  }

  console.log('[2/10] Build the package with the fixture families');
  writeBarrel('test/package-check/index.ts', SOURCE_ROOTS);
  const entry = {
    index: 'test/package-check/index.ts',
    ...familyEntries('src'),
    ...familyEntries('test/package-check/src'),
  };
  await buildPackage({
    ...buildOptions({ ...entry, ...NUXT_MODULE_ENTRY }, DIST_DIRECTORY, SOURCE_ROOTS),
    config: false,
  });
  await writeModuleManifest(DIST_DIRECTORY);
  const builtFiles = readdirSync(DIST_DIRECTORY, { encoding: 'utf8', recursive: true }).filter(
    (file) => file.endsWith('.js'),
  );
  const entryFiles = builtFiles.filter((file) => basename(file) === 'index.js').sort();
  assert.deepEqual(
    entryFiles,
    Object.keys(entry)
      .map((name) => `${name}.js`)
      .sort(),
    `Each index.js in dist must be the barrel or a family. Found: ${entryFiles.join(', ')}`,
  );

  console.log('[3/10] Check the declarations that name Temporal');
  const barrelDeclarations = reachedDeclarations('index.d.ts');
  for (const [file, code] of barrelDeclarations) {
    assert.ok(
      !TEMPORAL_TYPE.test(code) && !code.includes('esnext.temporal'),
      `${file} is reachable from the barrel and names Temporal. A consumer on TypeScript 5 fails on it. Start the index.ts of each date entry with the reference line, so that the barrel leaves the entry out. Import no date entry in another family.`,
    );
  }
  console.log(`  index.d.ts: ${barrelDeclarations.size} declaration files, none names Temporal`);
  const temporalEntries: string[] = [];
  for (const file of entryFiles.filter((name) => name !== 'index.js')) {
    const declarations = reachedDeclarations(file.replace(/\.js$/, '.d.ts'));
    if (namesTemporal(declarations)) {
      temporalEntries.push(file);
      assert.ok(
        hasTemporalReference(declarations),
        `The declarations of ${file} name Temporal, and none of them starts with ${TEMPORAL_REFERENCE}. Without the line, a consumer fails with TS2503 until it sets "lib" itself. Check that the patch of rolldown-plugin-dts is applied.`,
      );
      console.log(
        `  ${file}: names Temporal, and a declaration that it reaches starts with the reference line`,
      );
    }
  }
  for (const fixture of ['temporal-part/index.js', 'temporal-reexport/index.js']) {
    assert.ok(
      temporalEntries.includes(fixture),
      `The fixture ${fixture} must name Temporal in its declarations. Without it, this step checks nothing.`,
    );
  }

  console.log(`[4/10] Write the manifest into ${PACKAGE_DIRECTORY}`);
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  delete manifest.scripts;
  delete manifest.devDependencies;
  writeFileSync(`${PACKAGE_DIRECTORY}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('[5/10] Pack the package folder as a release does, through prepack');
  const [pack]: { files: { path: string }[] }[] = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json', '--foreground-scripts=false'], {
      encoding: 'utf8',
    }),
  );
  const packedPaths = pack.files.map((file) => file.path);
  for (const file of PREPACK_FILES) {
    assert.ok(
      packedPaths.includes(file),
      `${file} must be in the packed files. Copy it in "prepack". If npm does not pack it by default, list it in "files".`,
    );
    console.log(`  ${file}: packed`);
  }
  const moduleManifest = JSON.parse(readFileSync(`${DIST_DIRECTORY}/module.json`, 'utf8'));
  assert.ok(
    packedPaths.includes('dist/module.json') &&
      moduleManifest.compatibility?.nuxt &&
      moduleManifest.docs,
    'dist/module.json must be packed, with the Nuxt versions and the address of the documentation. The module list of nuxt.com reads them.',
  );
  console.log('  dist/module.json: packed, with the Nuxt versions and the documentation');

  console.log('[6/10] Run publint');
  runBin('publint', ['run', '--strict', '--pack', 'npm', PACKAGE_DIRECTORY]);

  console.log('[7/10] Run Are the Types Wrong');
  runBin('attw', [
    '--pack',
    PACKAGE_DIRECTORY,
    '--profile',
    'esm-only',
    '--exclude-entrypoints',
    'package.json',
    '--include-entrypoints',
    'nuxt',
    ...entryFiles.filter((file) => file !== 'index.js').map((file) => dirname(file)),
  ]);

  console.log('[8/10] Link the package into the consumer project');
  const link = join(CONSUMER_DIRECTORY, 'node_modules/@vase-ui/vue');
  rmSync(link, { recursive: true, force: true });
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(resolve(PACKAGE_DIRECTORY), link, 'dir');

  console.log('[9/10] Type-check the consumer project');
  runBin('tsc', ['-p', CONSUMER_DIRECTORY]);

  console.log('[10/10] Bundle the consumer files and load the package in Node');
  const singlePart = await bundleConsumerFile('singlePart.ts');
  const multiPartRoot = await bundleConsumerFile('multiPartRoot.ts');
  const scriptedPart = await bundleConsumerFile('scriptedPart.ts');
  const popupHandles = await bundleConsumerFile('popupHandles.ts');
  const popupHandlesDevelopment = await bundleConsumerFile('popupHandles.ts', 'development');
  expectContent('singlePart.ts', singlePart, 'data-single-part', true);
  expectContent('singlePart.ts', singlePart, 'data-multi-part', false);
  expectContent('multiPartRoot.ts', multiPartRoot, 'data-multi-part-root', true);
  expectContent('multiPartRoot.ts', multiPartRoot, 'data-single-part', false);
  expectContent('scriptedPart.ts', scriptedPart, 'data-scripted-part', true);
  expectContent('scriptedPart.ts', scriptedPart, 'data-scripted-part-ran', false);
  console.log(
    `  multiPartRoot.ts: ${multiPartRoot.includes('data-multi-part-item') ? 'has' : 'has no'} data-multi-part-item (not asserted)`,
  );
  const builtCode = builtFiles
    .map((file) => readFileSync(join(DIST_DIRECTORY, file), 'utf8'))
    .join('\n');
  expectContent('dist', builtCode, 'process.env.NODE_ENV', true);
  expectContent('singlePart.ts', singlePart, 'package-check development marker', false);
  expectContent('multiPartRoot.ts', multiPartRoot, 'package-check development marker', false);
  // The text of an error, of a warning and of a symbol is for a development build only.
  for (const text of [
    'must be inside',
    'found no mounted root',
    'found no trigger',
    'dialog portal',
  ]) {
    expectContent('popupHandles.ts', popupHandles, text, false);
    expectContent('popupHandles.ts in development', popupHandlesDevelopment, text, true);
  }
  execFileSync(process.execPath, [join(CONSUMER_DIRECTORY, 'node.mjs')], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
}

main().catch((error: unknown) => {
  console.error(`check:package failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
