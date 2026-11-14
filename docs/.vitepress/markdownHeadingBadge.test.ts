import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createMarkdownRenderer, disposeMdItInstance } from 'vitepress';
import config from './config.ts';

// The renderer has the options of the site, so a case fails when the site does not use the plugin.
const md = await createMarkdownRenderer(import.meta.dirname, config.markdown, config.base);
after(disposeMdItInstance);

const render = (source: string) => md.renderAsync(source);
const badgeHtml = (word: string) => `<span class="heading-badge ignore-header">${word}</span>`;

test('shows a trailing Preview tag as a badge, and keeps it out of the slug and the permalink label', async () => {
  const html = await render('### Filtering [Preview]\n');

  assert.match(html, /<h3 id="filtering" tabindex="-1">Filtering <span/);
  assert.ok(html.includes(badgeHtml('Preview')));
  assert.ok(html.includes('href="#filtering" aria-label="Permalink to “Filtering”"'));
  assert.ok(!html.includes('[Preview]'));
});

test('lifts only the last trailing tag', async () => {
  const html = await render('### Chip [New] [Preview]\n');

  assert.ok(html.includes(`Chip [New] ${badgeHtml('Preview')}`));
  assert.ok(!html.includes(badgeHtml('New')));
});

for (const heading of ['Use [value]', 'Already [Preview] inside']) {
  test(`leaves brackets that are not a trailing tag in the heading text: ${heading}`, async () => {
    const html = await render(`### ${heading}\n`);

    assert.ok(html.includes(`>${heading} <a class="header-anchor"`));
    assert.ok(!html.includes('heading-badge'));
  });
}

test('strips a tag that follows other inline content', async () => {
  const html = await render('### **FilterProvider** [Preview]\n');

  assert.ok(html.includes(`<strong>FilterProvider</strong> ${badgeHtml('Preview')}`));
  assert.match(html, /<h3 id="filterprovider"/);
});

test('leaves a tag on an h1 in the heading text', async () => {
  const html = await render('# Menu [New]\n\n## Menu [New]\n');

  assert.match(html, /<h1 id="menu-new" tabindex="-1">Menu \[New\] </);
  assert.ok(html.includes(`<h2 id="menu" tabindex="-1">Menu ${badgeHtml('New')}`));
});

test('does not strip a heading that is only a tag', async () => {
  const html = await render('### [Preview]\n');

  assert.match(html, /\[Preview\] <a class="header-anchor"/);
  assert.ok(!html.includes('heading-badge'));
});

// The attributes plugin removes one space before the braces, so two spaces leave a trailing space.
test('strips a tag before an id in braces', async () => {
  const html = await render('### Filtering [Preview]  {#search}\n');

  assert.ok(html.includes(`<h3 id="search" tabindex="-1">Filtering ${badgeHtml('Preview')}`));
});

// The outline is made in the browser, so no case here can read it. The default theme leaves out of
// an outline entry each element with a class that its `ignoreRE` matches.
test('the outline of the default theme leaves out the badge', async () => {
  const outline = readFileSync(
    fileURLToPath(
      import.meta.resolve('vitepress/dist/client/theme-default/composables/outline.js'),
    ),
    'utf8',
  );
  const ignorePattern = /const ignoreRE = \/(.+)\/;/.exec(outline)?.[1];
  const badgeClass = /<span class="([^"]+)">Preview<\/span>/.exec(
    await render('### Filtering [Preview]\n'),
  )?.[1];

  assert.ok(ignorePattern, 'The outline of the default theme has no `ignoreRE`.');
  assert.ok(badgeClass, 'The heading has no badge.');
  assert.match(badgeClass, new RegExp(ignorePattern));
});
