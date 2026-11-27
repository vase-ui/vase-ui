import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const DOCS_ROOT = join(import.meta.dirname, '..', '..', 'docs');
const INCLUDE = /<!--\s*@include:\s*(.*?)\s*-->/g;
const NOT_PAGE_FOLDERS = new Set(['node_modules', 'public']);

const includes = readdirSync(DOCS_ROOT, { recursive: true, encoding: 'utf8' })
  .filter((page) => {
    const [folder = ''] = page.split(/[\\/]/);
    return page.endsWith('.md') && !folder.startsWith('.') && !NOT_PAGE_FOLDERS.has(folder);
  })
  .sort()
  .flatMap((page) =>
    [...readFileSync(join(DOCS_ROOT, page), 'utf8').matchAll(INCLUDE)].map(([, target = '']) => {
      const [file = '', region] = target.split('#');
      return { page, target, file, region };
    }),
  );

function linesOf(page: string, file: string): string[] {
  const path = join(DOCS_ROOT, dirname(page), file);
  assert.ok(existsSync(path), `${path} does not exist.`);
  return readFileSync(path, 'utf8').split(/\r?\n/);
}

test('the pages of the site include the home text, the donation text, the thanks and the release notes', () => {
  assert.deepEqual(
    includes.map(({ page, target }) => `${page}: ${target}`),
    [
      'community.md: ../README.md#donation',
      'community.md: ../THANKS.md#thanks',
      'index.md: ../README.md#home',
      'releases.md: ../CHANGELOG.md{3,}',
    ],
  );
});

for (const { page, target, file, region } of includes.filter((include) => include.region)) {
  test(`${page}: ${target} points to a file that has one start line and one end line of the region`, () => {
    const lines = linesOf(page, file).map((line) => line.trim());
    const startsAt = (marker: string) =>
      lines.flatMap((line, index) => (line === `<!-- #${marker} ${region} -->` ? [index] : []));
    const [start, ...otherStarts] = startsAt('region');
    const [end, ...otherEnds] = startsAt('endregion');
    assert.ok(
      start !== undefined && otherStarts.length === 0,
      `${file} must have one line "<!-- #region ${region} -->".`,
    );
    assert.ok(
      end !== undefined && otherEnds.length === 0,
      `${file} must have one line "<!-- #endregion ${region} -->".`,
    );
    assert.ok(start < end, `In ${file}, the end of ${region} comes before its start.`);
  });
}

// `{3,}` leaves out the title of `CHANGELOG.md` and the empty line below it.
test('the third line of CHANGELOG.md is the heading of its newest version', () => {
  const [title, empty, version] = linesOf('releases.md', '../CHANGELOG.md');
  assert.equal(title, '# Changelog');
  assert.equal(empty, '');
  assert.match(version ?? '', /^## \d{4}\.\d{1,2}\.\d+$/);
});

for (const { page, target } of includes.filter(({ page }) => page !== 'index.md')) {
  const lowered = target !== '../README.md#donation';
  test(`${page}: the headings of ${target} are ${lowered ? 'one level lower' : 'at their level'}`, () => {
    const text = readFileSync(join(DOCS_ROOT, page), 'utf8');
    const include = `<!--@include: ${target}-->`;
    assert.equal(
      text.includes(`<!-- lower-headings -->\n\n${include}\n\n<!-- /lower-headings -->`),
      lowered,
    );
    assert.ok(text.includes(include));
  });
}
