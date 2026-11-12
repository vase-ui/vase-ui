import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderStatusLine, replaceStatus } from './status.ts';

test('renderStatusLine writes the two numbers', () => {
  assert.equal(
    renderStatusLine({ done: 2, total: 38 }),
    'Status: 2 of 38 components. The guarantee starts with the first full release.',
  );
});

test('replaceStatus replaces the text between the markers and nothing else', () => {
  const readme = 'Before.\n\n<!-- status:start -->\n\nOld line.\n\n<!-- status:end -->\n\nAfter.\n';
  const updated = replaceStatus(readme, 'New line.');
  assert.equal(
    updated,
    'Before.\n\n<!-- status:start -->\n\nNew line.\n\n<!-- status:end -->\n\nAfter.\n',
  );
  assert.equal(replaceStatus(updated, 'New line.'), updated);
});

for (const { name, readme, message } of [
  { name: 'a README with no marker', readme: 'Text.\n', message: /no <!-- status:start -->/ },
  {
    name: 'a README with no end marker',
    readme: 'Text.\n\n<!-- status:start -->\n',
    message: /no <!-- status:end -->/,
  },
  {
    name: 'a README with the end marker first',
    readme: '<!-- status:end -->\n\n<!-- status:start -->\n',
    message: /<!-- status:end --> comes before <!-- status:start -->/,
  },
]) {
  test(`replaceStatus throws for ${name}`, () => {
    assert.throws(() => replaceStatus(readme, 'Line.'), message);
  });
}
