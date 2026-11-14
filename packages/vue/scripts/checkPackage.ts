import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildPackage } from 'tsdown';
import { build as bundle } from 'vite';
import { TEMPORAL_REFERENCE, buildOptions, familyEntries, writeBarrel } from './build.ts';

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

async function bundleConsumerFile(file: string): Promise<string> {
  const result = await bundle({
    configFile: false,
    logLevel: 'silent',
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
  await buildPackage({ ...buildOptions(entry, DIST_DIRECTORY, SOURCE_ROOTS), config: false });
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

  console.log('[3/10] Check which declarations name Temporal');
  const barrelDeclarations = reachedDeclarations('index.d.ts');
  for (const [file, code] of barrelDeclarations) {
    assert.ok(
      !TEMPORAL_TYPE.test(code) && !code.includes('esnext.temporal'),
      `${file} is reachable from the barrel and names Temporal. Without the reference line, a TypeScript 5 consumer of the barrel fails on it. Start the index.ts of the entry with the reference line, so that the barrel leaves the entry out.`,
    );
  }
  console.log(`  index.d.ts: ${barrelDeclarations.size} declaration files, none names Temporal`);
  const temporalEntries: string[] = [];
  for (const file of entryFiles.filter((name) => name !== 'index.js')) {
    const declaration = file.replace(/\.js$/, '.d.ts');
    const declarations = reachedDeclarations(declaration);
    if (namesTemporal(declarations)) {
      temporalEntries.push(file);
      assert.ok(
        declarations.get(declaration)?.startsWith(TEMPORAL_REFERENCE),
        `${declaration} reaches a declaration that names Temporal, so it must start with ${TEMPORAL_REFERENCE} Without the line, a consumer fails with TS2503 until it sets "lib" itself.`,
      );
      console.log(`  ${declaration}: starts with the reference line`);
    }
  }
  assert.ok(
    temporalEntries.includes('temporal-part/index.js'),
    'The fixture temporal-part must name Temporal in its declarations. Without it, this step checks nothing.',
  );

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
  execFileSync(process.execPath, [join(CONSUMER_DIRECTORY, 'node.mjs')], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
}

main().catch((error: unknown) => {
  console.error(`check:package failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
