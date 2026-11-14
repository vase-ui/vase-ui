import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import postcss from 'postcss';
import type { AcceptedPlugin } from 'postcss';
import config from './config.ts';
import { postcssFollowSiteTheme } from './postcssFollowSiteTheme.ts';

const DOCS_ROOT = join(import.meta.dirname, '..');

async function transform(
  css: string,
  plugins: AcceptedPlugin[] = [postcssFollowSiteTheme()],
  from?: string,
) {
  const result = await postcss(plugins).process(css, { from });
  // The text has one space between its parts and no semicolon before a closing brace.
  return result.css
    .replaceAll(/;?\s*}\s*/g, ' } ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

const CASES = [
  {
    name: 'declarations in a top-level rule',
    css: '.a { color: black; @media (prefers-color-scheme: dark) { color: white; } }',
    expected: '.a { color: black } :where(.dark) .a { color: white }',
  },
  {
    name: 'a media rule with rules after it',
    css: '.a { @media (prefers-color-scheme: dark) { color: white; } &:hover { color: gray; } }',
    expected: ':where(.dark) .a { color: white } .a { &:hover { color: gray } }',
  },
  {
    name: 'a nested rule with the nesting selector',
    css: '.a { &:hover { top: 0; @media (prefers-color-scheme: dark) { color: white; } } }',
    expected: '.a { &:hover { top: 0 } :where(.dark) &:hover { color: white } }',
  },
  {
    name: 'a nested rule for a pseudo-element',
    css: '.a { &::before { @media (prefers-color-scheme: dark) { color: white; } } }',
    expected: '.a { :where(.dark) &::before { color: white } }',
  },
  {
    name: 'a nested rule with no nesting selector',
    css: '.a { .b { @media (prefers-color-scheme: dark) { color: white; } } }',
    expected: '.a { :where(.dark) & .b { color: white } }',
  },
  {
    name: 'a nested rule with & at its end',
    css: '.a { .b[data-highlighted] & { @media (prefers-color-scheme: dark) { color: white; } } }',
    expected: '.a { :where(.dark) .b[data-highlighted] & { color: white } }',
  },
  {
    name: 'each selector of a list',
    css: '.a { &[data-disabled], &:disabled { @media (prefers-color-scheme: dark) { color: white; } } }',
    expected: '.a { :where(.dark) &[data-disabled], :where(.dark) &:disabled { color: white } }',
  },
  {
    name: 'a media rule in an at-rule',
    css: '.a { @supports (top: 0) { top: 0; @media (prefers-color-scheme: dark) { color: white; } } }',
    expected:
      '.a { @supports (top: 0) { top: 0 } } :where(.dark) .a { @supports (top: 0) { color: white } }',
  },
  {
    name: 'a query in upper case',
    css: '.a { @media (PREFERS-COLOR-SCHEME: DARK) { color: white; } }',
    expected: ':where(.dark) .a { color: white }',
  },
  {
    name: 'a media rule that holds a rule',
    css: '.a { @media (prefers-color-scheme: dark) { &::after { color: white; } } }',
    expected: ':where(.dark) .a { &::after { color: white } }',
  },
];

for (const { name, css, expected } of CASES) {
  test(`changes ${name} into a rule for the dark theme of the site`, async () => {
    assert.equal(await transform(css), expected);
  });
}

const REFUSED = [
  {
    name: 'the light scheme',
    css: '.a { @media (prefers-color-scheme: light) { color: black; } }',
  },
  {
    name: 'a second condition',
    css: '.a { @media (prefers-color-scheme: dark) and (hover: hover) { color: white; } }',
  },
  {
    name: 'no style rule above it',
    css: '@media (prefers-color-scheme: dark) { .a { color: white; } }',
  },
];

for (const { name, css } of REFUSED) {
  test(`refuses a color-scheme query with ${name}`, async () => {
    await assert.rejects(transform(css), /follows the color scheme of the system/);
  });
}

// The plugins are those of the site, so the case fails when the site does not use the plugin.
test('no style sheet of a demo follows the color scheme of the system on the site', async () => {
  const postcssOptions = config.vite?.css?.postcss;
  assert.ok(typeof postcssOptions === 'object' && postcssOptions.plugins);
  const styleSheets = globSync(['demos/**/*.css', 'examples/**/*.css'], { cwd: DOCS_ROOT });
  assert.notEqual(styleSheets.length, 0);

  for (const file of styleSheets) {
    const path = join(DOCS_ROOT, file);
    const source = readFileSync(path, 'utf8');
    const css = await transform(source, postcssOptions.plugins, path);

    assert.ok(!css.includes('prefers-color-scheme'), file);
    assert.equal(css.includes(':where(.dark)'), source.includes('prefers-color-scheme'), file);
  }
});
