import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ownFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import { listFamilyPages } from './familyPages.ts';
import { checkPageSections, hasPageTemplate } from './pageSections.ts';

const PATH = 'docs/components/sample.md';

function page(...sections: [title: string, body?: string][]): string {
  return [
    '# Sample',
    '',
    'One sentence.',
    ...sections.flatMap(([title, body = 'Text.']) => ['', `## ${title}`, '', body]),
  ].join('\n');
}

const MODEL: [string, string?][] = [
  ['Anatomy', '<<< ./sample/Anatomy.vue'],
  ['Examples', '### One example\n\nText.'],
  [
    'API reference',
    '<ApiReference />\n\n### createHandle\n\n<ApiReference name="Sample.createHandle" :heading-level="4" />',
  ],
  ['Differences from Base UI', '<BaseUiDifferences />'],
];

test('a page in the order of the template has no problem', () => {
  assert.deepEqual(checkPageSections(PATH, 'sample', false, page(...MODEL)), []);
  assert.deepEqual(
    checkPageSections(PATH, 'sample', false, page(['Usage guidelines'], ...MODEL)),
    [],
  );
});

test('a section that the template lacks, and a section out of its place, are problems', () => {
  const [anatomy, examples, ...rest] = MODEL;
  assert.match(
    checkPageSections(PATH, 'sample', false, page(anatomy, ['Styling'], examples, ...rest)).join(),
    /"## Styling" is not a section of the page template/,
  );
  assert.match(
    checkPageSections(PATH, 'sample', false, page(examples, anatomy, ...rest)).join(),
    /"## Anatomy" is out of place/,
  );
});

test('a topic section is in its place only on the page of its family', () => {
  const [anatomy, examples, ...rest] = MODEL;
  const withTopic = page(anatomy, ['Positioning'], examples, ...rest);
  assert.deepEqual(checkPageSections(PATH, 'select', false, withTopic), []);
  assert.match(checkPageSections(PATH, 'tooltip', false, withTopic).join(), /"## Positioning"/);
  assert.deepEqual(
    checkPageSections(
      PATH,
      'navigation-menu',
      false,
      page(anatomy, examples, ['Closing animations'], ...rest),
    ),
    [],
  );
  assert.match(
    checkPageSections(
      PATH,
      'navigation-menu',
      false,
      page(anatomy, ['Closing animations'], examples, ...rest),
    ).join(),
    /"## Examples" is out of place/,
  );
});

test('Keyboard is a section only of a component of Vase UI own', () => {
  const [anatomy, examples, ...rest] = MODEL;
  const withKeys = page(anatomy, examples, ['Keyboard', '| Key | Action |'], ...rest);
  assert.deepEqual(checkPageSections(PATH, 'calendar', true, withKeys), []);
  assert.match(
    checkPageSections(PATH, 'slider', false, withKeys).join(),
    /only on the page of a component of Vase UI's own/,
  );
});

test('the page has API reference with one ApiReference with no name, and Differences from Base UI is last with only its tag', () => {
  const [anatomy, examples, , differences] = MODEL;
  assert.match(
    checkPageSections(
      PATH,
      'sample',
      false,
      page(anatomy, examples, ['API reference', 'Text.'], differences),
    ).join(),
    /needs one <ApiReference \/>/,
  );
  assert.match(
    checkPageSections(
      PATH,
      'sample',
      false,
      page(
        anatomy,
        examples,
        ['API reference', '<ApiReference />'],
        ['Differences from Base UI', '<BaseUiDifferences />\n\nMore text.'],
      ),
    ).join(),
    /the last section must be "## Differences from Base UI"/,
  );
  assert.match(
    checkPageSections(PATH, 'sample', false, page(anatomy, examples)).join(),
    /the last section must be/,
  );
  assert.deepEqual(checkPageSections(PATH, 'sample', false, page(anatomy, examples, differences)), [
    `${PATH}: the page has no "## API reference". Write it before "## Differences from Base UI", with <ApiReference /> in it.`,
  ]);
});

test('a heading in a code block is no section', () => {
  const [anatomy, , ...rest] = MODEL;
  const code: [string, string] = ['Examples', '```md\n## Styling\n```'];
  assert.deepEqual(checkPageSections(PATH, 'sample', false, page(anatomy, code, ...rest)), []);
});

test('each family page with the tag of the differences section has the sections of the template', () => {
  const docs = join(REPOSITORY_ROOT, 'docs');
  const pages = listFamilyPages(docs).flatMap(({ path, family }) => {
    const text = readFileSync(join(docs, path), 'utf8');
    return hasPageTemplate(text) ? [{ path: `docs/${path}`, family, text }] : [];
  });
  assert.ok(pages.some(({ family }) => family === 'collapsible'));
  assert.deepEqual(
    pages.flatMap(({ path, family, text }) =>
      checkPageSections(path, family, existsSync(join(REPOSITORY_ROOT, ownFile(family))), text),
    ),
    [],
  );
});
