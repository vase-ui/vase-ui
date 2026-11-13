import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildPackage } from 'tsdown';
import { build as bundle } from 'vite';
import { buildOptions, familyEntries, writeBarrel } from './build.ts';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const PACKAGE_DIRECTORY = '.package-check';
const DIST_DIRECTORY = `${PACKAGE_DIRECTORY}/dist`;
const CONSUMER_DIRECTORY = 'test/package-check/consumer';
const SOURCE_ROOTS = ['src', 'test/package-check/src'];
const PREPACK_FILES = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md'];

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

function expectContent(file: string, code: string, text: string, expected: boolean): void {
  const found = code.includes(text);
  console.log(`  ${file}: ${found ? 'has' : 'has no'} ${text}`);
  assert.equal(found, expected, `${file} must ${expected ? 'contain' : 'not contain'} ${text}`);
}

async function main(): Promise<void> {
  console.log(`[1/9] Remove ${PACKAGE_DIRECTORY} and the files that prepack copies`);
  rmSync(PACKAGE_DIRECTORY, { recursive: true, force: true });
  // A copy from an earlier run can make npm pack a file that "prepack" does not copy.
  for (const file of PREPACK_FILES) {
    rmSync(file, { force: true });
  }

  console.log('[2/9] Build the package with the fixture families');
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

  console.log(`[3/9] Write the manifest into ${PACKAGE_DIRECTORY}`);
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  delete manifest.scripts;
  delete manifest.devDependencies;
  writeFileSync(`${PACKAGE_DIRECTORY}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('[4/9] Pack the package folder as a release does, through prepack');
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

  console.log('[5/9] Run publint');
  runBin('publint', ['run', '--strict', '--pack', 'npm', PACKAGE_DIRECTORY]);

  console.log('[6/9] Run Are the Types Wrong');
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

  console.log('[7/9] Link the package into the consumer project');
  const link = join(CONSUMER_DIRECTORY, 'node_modules/@vase-ui/vue');
  rmSync(link, { recursive: true, force: true });
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(resolve(PACKAGE_DIRECTORY), link, 'dir');

  console.log('[8/9] Type-check the consumer project');
  runBin('tsc', ['-p', CONSUMER_DIRECTORY]);

  console.log('[9/9] Bundle the consumer files and load the package in Node');
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
