import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

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
  return [...read(file).matchAll(/<path d="([^"]*)"/g)].map(([, outline]) => outline);
}
// The first two paths of the wordmark are the mark. The other path is the words.
const markPaths = pathsOf('docs/public/wordmark-light.svg').slice(0, 2);

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
