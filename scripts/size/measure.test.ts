import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { measurePackage } from './measure.ts';
import { sizeReport } from './report.ts';

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'size-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  function write(file: string, content: string): void {
    const path = join(directory, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return { directory, write };
}

test('measures the packed release and each public browser import', async (t) => {
  const { directory, write } = fixture(t);
  write(
    'package.json',
    JSON.stringify({
      name: '@fixture/ui',
      version: '1.0.0',
      type: 'module',
      files: ['dist', 'NOTICE'],
      exports: {
        '.': {
          types: './dist/index.d.ts',
          browser: './dist/client.js',
          default: './dist/index.js',
        },
        './nuxt': './dist/nuxt.js',
        './*': {
          types: './dist/*/index.d.ts',
          browser: { production: './dist/*/index.js', default: './dist/*/dev.js' },
          default: './dist/*/server.js',
        },
        './package.json': './package.json',
      },
      peerDependencies: { vue: '*', '@fixture/peer': '*' },
      dependencies: { runtime: '1.0.0' },
      scripts: { prepack: 'node release.mjs' },
    }),
  );
  write(
    'release.mjs',
    "import { writeFileSync } from 'node:fs'; writeFileSync('NOTICE', 'notice');",
  );
  write('dist/index.js', "export const target = 'server';");
  write('dist/client.js', "export * from './dialog/index.js';");
  write(
    'dist/dialog/index.js',
    "import 'vue'; import '@fixture/peer/client'; export const dialog = 1;",
  );
  write('dist/chunks/internal.js', 'export const privateValue = 0;');
  write('dist/nuxt.js', "import { existsSync } from 'node:fs'; export const exists = existsSync;");
  write('dist/server-only/server.js', 'export const server = true;');
  write(
    'dist/unstable-button/index.js',
    [
      "import { value } from 'runtime';",
      "if (process.env.NODE_ENV === 'production') console.log(  value  );",
      "else console.log('development only');",
    ].join('\n'),
  );
  write(
    'node_modules/runtime/package.json',
    JSON.stringify({
      name: 'runtime',
      type: 'module',
      exports: {
        browser: { production: './client.js', default: './dev.js' },
        default: './server.js',
      },
    }),
  );
  write('node_modules/runtime/client.js', "export const value = '茶';");
  write('node_modules/runtime/dev.js', "export const value = 'development';");
  write('node_modules/runtime/server.js', "export const value = 'server';");

  const base = await measurePackage(directory);
  assert.deepEqual(Object.keys(base.entries).sort(), [
    '@fixture/ui',
    '@fixture/ui/dialog',
    '@fixture/ui/nuxt',
    '@fixture/ui/unstable-button',
  ]);
  assert.deepEqual(base.entries['@fixture/ui'], base.entries['@fixture/ui/dialog']);
  const minified = 'console.log(`茶`);';
  assert.deepEqual(base.entries['@fixture/ui/unstable-button'], {
    raw: Buffer.byteLength(minified),
    gzip: gzipSync(minified).length,
    brotli: brotliCompressSync(minified).length,
  });

  const [pack]: { filename: string; files: { path: string; size: number }[] }[] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--ignore-scripts'], {
      cwd: directory,
      encoding: 'utf8',
    }),
  );
  assert.ok(pack.files.some((file) => file.path === 'NOTICE'));
  assert.equal(base.packed, statSync(join(directory, pack.filename)).size);
  assert.equal(
    base.unpacked,
    pack.files.reduce((sum, file) => sum + file.size, 0),
  );

  write(
    'dist/dialog/index.js',
    "import 'vue'; import '@fixture/peer/client'; export const dialog = 'a new export value';",
  );
  const merge = await measurePackage(directory);
  const [changes, unchanged] = sizeReport(base, merge).split('<details>');
  assert.match(changes, /\| `@fixture\/ui` \| Raw \|/);
  assert.match(changes, /\| `@fixture\/ui\/dialog` \| Raw \|/);
  assert.match(unchanged, /\| `@fixture\/ui\/unstable-button` \|/);

  write('dist/client.js', "export { missing } from 'missing-runtime';");
  await assert.rejects(measurePackage(directory), /missing-runtime/);
});

test('rejects imports that exist only in the checkout', async (t) => {
  const { directory, write } = fixture(t);
  write(
    'package.json',
    JSON.stringify({
      name: '@fixture/ui',
      version: '1.0.0',
      type: 'module',
      files: ['dist'],
      exports: { '.': './dist/index.js' },
      devDependencies: { 'dev-only': '1.0.0' },
    }),
  );
  write('private.js', 'export const value = 1;');
  write('dist/index.js', "export { value } from '../private.js';");
  await assert.rejects(measurePackage(directory), /private\.js/);

  write(
    'node_modules/dev-only/package.json',
    '{"name":"dev-only","type":"module","exports":"./index.js"}',
  );
  write('node_modules/dev-only/index.js', 'export const value = 2;');
  write('dist/index.js', "export { value } from 'dev-only';");
  await assert.rejects(measurePackage(directory), /dev-only/);
});
