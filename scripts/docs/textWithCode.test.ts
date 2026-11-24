import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { SITE_HOMEPAGE, splitTextWithCode } from '../../docs/.vitepress/components/textWithCode.ts';
import { REPOSITORY_ROOT } from '../parity/repository.ts';

test('SITE_HOMEPAGE matches the homepage of the package', () => {
  const manifest: { homepage: string } = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, 'packages/vue/package.json'), 'utf8'),
  );
  assert.equal(SITE_HOMEPAGE, manifest.homepage);
});

test('splits code spans and leaves an address inside backticks as code', () => {
  assert.deepEqual(splitTextWithCode('See `aria-describedby` and `https://vase-ui.com/errors`.'), [
    { kind: 'text', text: 'See ' },
    { kind: 'code', text: 'aria-describedby' },
    { kind: 'text', text: ' and ' },
    { kind: 'code', text: 'https://vase-ui.com/errors' },
    { kind: 'text', text: '.' },
  ]);
});

test('turns a site address into a link by path and keeps punctuation after it as text', () => {
  assert.deepEqual(
    splitTextWithCode(
      'The page https://vase-ui.com/accessibility#errors tells how (see https://vase-ui.com/errors#3).',
    ),
    [
      { kind: 'text', text: 'The page ' },
      {
        kind: 'link',
        text: 'https://vase-ui.com/accessibility#errors',
        href: '/accessibility#errors',
      },
      { kind: 'text', text: ' tells how (see ' },
      { kind: 'link', text: 'https://vase-ui.com/errors#3', href: '/errors#3' },
      { kind: 'text', text: ').' },
    ],
  );
});

test('keeps the full address for another host, also when its host starts with the host of the site', () => {
  assert.deepEqual(
    splitTextWithCode('See https://vase-ui.community/accessibility, then https://example.com/a.'),
    [
      { kind: 'text', text: 'See ' },
      {
        kind: 'link',
        text: 'https://vase-ui.community/accessibility',
        href: 'https://vase-ui.community/accessibility',
      },
      { kind: 'text', text: ', then ' },
      { kind: 'link', text: 'https://example.com/a', href: 'https://example.com/a' },
      { kind: 'text', text: '.' },
    ],
  );
});
