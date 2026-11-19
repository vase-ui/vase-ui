import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { measurePackage } from './measure.ts';
import { sizeReport } from './report.ts';

test('measures the packed release and each public browser import', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'size-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  function write(file: string, content: string): void {
    const path = join(directory, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  write(
    'package.json',
    JSON.stringify({
      name: '@fixture/ui',
      version: '1.0.0',
      type: 'module',
      files: ['dist', 'NOTICE'],
      exports: {
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
        './*': { types: './dist/*/index.d.ts', default: './dist/*/index.js' },
        './package.json': './package.json',
      },
      peerDependencies: { vue: '*', '@fixture/peer': '*' },
      scripts: { prepack: 'node release.mjs' },
    }),
  );
  write(
    'release.mjs',
    "import { writeFileSync } from 'node:fs'; writeFileSync('NOTICE', 'notice');",
  );
  write('dist/index.js', "export * from './dialog/index.js';");
  write(
    'dist/dialog/index.js',
    "import 'vue'; import '@fixture/peer/client'; export const dialog = 1;",
  );
  write('dist/chunks/internal.js', 'export const privateValue = 0;');
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
      exports: { browser: './client.js', default: './server.js' },
    }),
  );
  write('node_modules/runtime/client.js', "export const value = '茶';");
  write('node_modules/runtime/server.js', "export const value = 'server';");

  const base = await measurePackage(directory);
  assert.deepEqual(Object.keys(base.entries).sort(), [
    '@fixture/ui',
    '@fixture/ui/dialog',
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

  write('dist/index.js', "export { missing } from 'missing-runtime';");
  await assert.rejects(measurePackage(directory), /missing-runtime/);
});
