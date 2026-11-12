import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const DOCS_ROOT = join(import.meta.dirname, '..', '..', 'docs');
const INCLUDE = /<!--\s*@include:\s*(.*?)\s*-->/g;

const includes = [...readFileSync(join(DOCS_ROOT, 'index.md'), 'utf8').matchAll(INCLUDE)].map(
  ([, target]) => {
    const [file, region] = target.split('#');
    return { target, file, region };
  },
);

for (const { target, file, region } of includes) {
  test(`${target} points to a file that has one start line and one end line of the region`, () => {
    assert.notEqual(region, undefined, `${target} has no region name.`);
    const path = join(DOCS_ROOT, file);
    assert.ok(existsSync(path), `${path} does not exist. VitePress then keeps the comment.`);
    const lines = readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim());
    const startsAt = (marker: string) =>
      lines.flatMap((line, index) => (line === `<!-- #${marker} ${region} -->` ? [index] : []));
    const starts = startsAt('region');
    const ends = startsAt('endregion');
    assert.equal(starts.length, 1, `${file} must have one line "<!-- #region ${region} -->".`);
    assert.equal(ends.length, 1, `${file} must have one line "<!-- #endregion ${region} -->".`);
    assert.ok(starts[0] < ends[0], `In ${file}, the end of ${region} comes before its start.`);
  });
}

for (const region of ['home', 'donation']) {
  test(`docs/index.md includes the region ${region} of README.md`, () => {
    assert.ok(includes.some((include) => include.target === `../README.md#${region}`));
  });
}
