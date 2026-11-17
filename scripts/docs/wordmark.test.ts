import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
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
const logo = config.themeConfig?.logo;
const logoImages =
  typeof logo === 'object' && typeof logo.light === 'string' && typeof logo.dark === 'string'
    ? [logo.light, logo.dark]
    : [];

function pathsOf(file: string): string[] {
  return [...read(file).matchAll(/<path\b[^>]*?\sd="([^"]*)"/g)].map(([, outline]) => outline);
}

// The first two paths of the wordmark are the mark. The other path is the words.
const markPaths = pathsOf('docs/public/wordmark-light.svg').slice(0, 2);

test('the mark is the two leaf paths', () => {
  assert.deepEqual(markPaths, [
    'M134 146C200 165.8 250 190 250 249.4V366C184 366 134 325.3 134 258.2Z',
    'M378 146C312 165.8 262 190 262 249.4V366C328 366 378 325.3 378 258.2Z',
  ]);
});

test('the favicon holds the same two leaf paths', () => {
  assert.deepEqual(pathsOf('docs/public/favicon.svg'), markPaths);
});

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;

function sizeKeyword(width: number, height: number): string {
  return `${String(width)}x${String(height)}`;
}

// The size of each image in a PNG or ICO file, as a keyword of the `sizes` attribute. A PNG file
// holds one image, and its first chunk has the width and the height. An ICO file starts with the
// numbers 0 and 1 and the count of images. It then has an entry of 16 bytes for each image. The
// entry starts with the width and the height, where 0 means 256.
function sizeKeywordsOf(path: string): string[] {
  const bytes = readFileSync(join(PUBLIC_ROOT, path));
  if (bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return [sizeKeyword(bytes.readUInt32BE(16), bytes.readUInt32BE(20))];
  }
  assert.deepEqual([bytes.readUInt16LE(0), bytes.readUInt16LE(2)], [0, 1], `${path} is no ICO.`);
  return Array.from({ length: bytes.readUInt16LE(4) }, (_, index) => {
    const entry = ICO_HEADER_BYTES + index * ICO_ENTRY_BYTES;
    return sizeKeyword(bytes.readUInt8(entry) || 256, bytes.readUInt8(entry + 1) || 256);
  });
}

const iconLinks = (config.head ?? []).flatMap(([tag, attributes]) =>
  tag === 'link' && ['icon', 'apple-touch-icon'].includes(attributes.rel ?? '') ? [attributes] : [],
);

const RASTER_EXTENSIONS = ['.ico', '.png'];

test('docs/.vitepress/config.ts links the ICO, the SVG and an Apple touch icon, the SVG after each raster icon', () => {
  const extensions = iconLinks
    .filter(({ rel }) => rel === 'icon')
    .map(({ href = '' }) => extname(href));
  const svg = extensions.indexOf('.svg');
  assert.ok(extensions.includes('.ico'), 'No icon link names an ICO file.');
  assert.notEqual(svg, -1, 'No icon link names an SVG file.');
  assert.ok(
    extensions.findLastIndex((extension) => RASTER_EXTENSIONS.includes(extension)) < svg,
    'The SVG icon link must follow each ICO and PNG icon link.',
  );
  assert.ok(
    iconLinks.some(({ rel }) => rel === 'apple-touch-icon'),
    'No link names an Apple touch icon.',
  );
});

for (const path of new Set([...logoImages, ...iconLinks.map(({ href = '' }) => href)])) {
  test(`docs/.vitepress/config.ts: ${path} is a file of docs/public`, () => {
    assert.ok(existsSync(join(PUBLIC_ROOT, path)), `docs/public${path} does not exist.`);
  });
}

for (const { href = '', sizes = '' } of iconLinks) {
  // `any` stands for a scalable image. Each other keyword must name an image that the file has.
  const keywords = sizes.split(/\s+/).filter((keyword) => keyword !== '' && keyword !== 'any');
  if (keywords.length > 0) {
    test(`docs/.vitepress/config.ts: ${href} has an image of each size that its link names`, () => {
      const available = sizeKeywordsOf(href);
      for (const keyword of keywords) {
        assert.ok(available.includes(keyword), `${href} has no image of ${keyword}.`);
      }
    });
  }
}

test('docs/public/favicon.ico holds images of 16, 32 and 48 pixels', () => {
  assert.deepEqual(sizeKeywordsOf('favicon.ico').toSorted(), ['16x16', '32x32', '48x48']);
});

test('the heading of README.md and the navigation bar each name two images', () => {
  assert.equal(headingImages.length, 2, 'README.md');
  assert.equal(logoImages.length, 2, 'themeConfig.logo must name a light and a dark image.');
});

for (const url of headingImages) {
  test(`README.md: ${url} is a file of the repository on main`, () => {
    assert.ok(url.startsWith(RAW_MAIN), `The address must start with ${RAW_MAIN}.`);
    const path = url.slice(RAW_MAIN.length);
    assert.ok(existsSync(join(REPOSITORY_ROOT, path)), `${path} does not exist.`);
  });
}

for (const path of logoImages) {
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
