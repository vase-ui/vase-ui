import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import config from '../../docs/.vitepress/config.ts';

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');
const PUBLIC_ROOT = join(REPOSITORY_ROOT, 'docs', 'public');
const RAW_MAIN = 'https://raw.githubusercontent.com/vase-ui/vase-ui/main/';

function read(path: string): string {
  return readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
}

const heading = /<h1>.*?<\/h1>/s.exec(read('README.md'))?.[0] ?? '';
const headingImages = [...heading.matchAll(/\bsrc(?:set)?="([^"]*)"/g)].map(([, url]) => url);
const logo = /\blogo: \{(.*?)\}/s.exec(read('docs/.vitepress/config.ts'))?.[1] ?? '';
const logoImages = [...logo.matchAll(/'(\/[^']*)'/g)].map(([, path]) => path);

function pathsOf(file: string): string[] {
  return [...read(file).matchAll(/<path\b[^>]*?\sd="([^"]*)"/g)].map(([, outline]) => outline);
}

// The first two paths of the wordmark are the mark. The other path is the words.
const markPaths = pathsOf('docs/public/wordmark-light.svg').slice(0, 2);

test('the mark has the two supplied leaf paths', () => {
  assert.deepEqual(markPaths, [
    'M134 146C200 165.8 250 190 250 249.4V366C184 366 134 325.3 134 258.2Z',
    'M378 146C312 165.8 262 190 262 249.4V366C328 366 378 325.3 378 258.2Z',
  ]);
});

test('the favicon holds the same two leaf paths', () => {
  assert.deepEqual(pathsOf('docs/public/favicon.svg'), markPaths);
});

test('the site declares SVG and PNG icons at their native sizes', () => {
  const links = (config.head ?? []).filter(
    ([tag, attributes]) =>
      tag === 'link' && ['icon', 'apple-touch-icon'].includes(attributes.rel ?? ''),
  );
  assert.deepEqual(links, [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
  ]);
  for (const [file, size] of [
    ['favicon.png', 32],
    ['apple-touch-icon.png', 180],
  ] as const) {
    const png = readFileSync(join(PUBLIC_ROOT, file));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), file);
    assert.equal(png.toString('ascii', 12, 16), 'IHDR', file);
    assert.equal(png.readUInt32BE(16), size, `${file}: width`);
    assert.equal(png.readUInt32BE(20), size, `${file}: height`);
  }
});

test('the heading of README.md and the navigation bar each name two images', () => {
  assert.equal(headingImages.length, 2, 'README.md');
  assert.equal(logoImages.length, 2, 'docs/.vitepress/config.ts');
});

for (const url of headingImages) {
  test(`README.md: ${url} is a file of the repository on main`, () => {
    assert.ok(url.startsWith(RAW_MAIN), `The address must start with ${RAW_MAIN}.`);
    const path = url.slice(RAW_MAIN.length);
    assert.ok(existsSync(join(REPOSITORY_ROOT, path)), `${path} does not exist.`);
  });
}

for (const path of logoImages) {
  test(`docs/.vitepress/config.ts: ${path} is a file of docs/public`, () => {
    assert.ok(existsSync(join(PUBLIC_ROOT, path)), `docs/public${path} does not exist.`);
  });

  test(`docs/.vitepress/config.ts: ${path} holds the mark and no words`, () => {
    assert.deepEqual(pathsOf(`docs/public${path}`), markPaths);
  });
}

for (const name of ['wordmark', 'mark']) {
  test(`the dark ${name} is the light ${name} with white ink`, () => {
    const light = read(`docs/public/${name}-light.svg`);
    assert.equal(light.split('#000000').length, 2, 'The light file must name its ink one time.');
    assert.equal(read(`docs/public/${name}-dark.svg`), light.replace('#000000', '#ffffff'));
  });
}
