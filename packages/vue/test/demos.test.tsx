/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, expectNoAxeViolations, hydrate, renderOnServer } from '#test-utils';
import '../../../docs/demos/tailwind.css';

const modules = import.meta.glob<{ default: Component }>(
  [
    '../../../docs/demos/*/*/{css-modules,tailwind}/index.vue',
    '../../../docs/examples/*/demos/*/index.vue',
  ],
  { eager: true },
);

const demos = Object.entries(modules).map(([path, { default: Demo }]) => ({
  name: /\/docs\/(?:demos\/)?(.+)\/index\.vue$/.exec(path)![1],
  variant: path.endsWith('/tailwind/index.vue') ? 'tailwind' : 'css-modules',
  // The server command takes a path from the root of this package. A key of the glob is relative
  // to this file.
  file: path.replace(/^\.\.\//, ''),
  Demo,
}));

const sources = import.meta.glob<string>(
  ['../../../docs/demos/**/*.{vue,ts}', '../../../docs/examples/*/demos/**/*.{vue,ts}'],
  { query: '?raw', import: 'default', eager: true },
);

function sourcesThatMatch(pattern: RegExp) {
  expect(Object.keys(sources)).not.toHaveLength(0);
  return Object.entries(sources)
    .filter(([, source]) => pattern.test(source))
    .map(([path]) => path);
}

describe.each(demos)('$name', ({ file, variant, Demo }) => {
  const { render } = createRenderer();

  it('mounts with no Vue warning and has no axe violation', async () => {
    // Do not write JSX here. The dependency scan of Vite cannot parse JSX in a file that has
    // `import.meta.glob`.
    const { container } = await render(h('div', { 'data-demo': variant }, h(Demo)));

    await expectNoAxeViolations(container);
  });

  it('hydrates the server render with no mismatch', async () => {
    const serverHtml = await renderOnServer(file);

    await hydrate(Demo, { serverHtml });
  });
});

describe('the style sheet of the Tailwind demos', () => {
  const { render } = createRenderer();
  const TailwindButton = modules['../../../docs/demos/button/hero/tailwind/index.vue'].default;

  // `h-8` is a class of the Button demo.
  it.each([
    {
      name: 'a frame gets utilities and preflight',
      vnode: () => h('div', { 'data-demo': 'tailwind' }, h(TailwindButton)),
      selector: 'button',
      expected: { height: '32px', 'padding-top': '0px' },
    },
    {
      name: 'a portal element gets utilities',
      vnode: () => h('div', { 'data-vase-ui-portal': '' }, h('div', { class: 'h-8' })),
      selector: '.h-8',
      expected: { height: '32px' },
    },
    {
      name: 'a CSS-module frame gets nothing',
      vnode: () => h('div', { 'data-demo': 'css-modules' }, h('div', { class: 'h-8' })),
      selector: '.h-8',
      expected: { height: '0px' },
    },
  ])('$name', async ({ vnode, selector, expected }) => {
    const { container } = await render(vnode());
    const style = getComputedStyle(container.querySelector(selector)!);

    expect(
      Object.fromEntries(Object.keys(expected).map((name) => [name, style.getPropertyValue(name)])),
    ).toEqual(expected);
  });
});

describe('demos', () => {
  it('have no name of Base UI or React in their text or their links', () => {
    expect(sourcesThatMatch(/Base UI|BaseUI|base-ui|\bReact\b|\/react\//)).toEqual([]);
  });

  // VitePress adds no base path to a link in a demo. With a base path other than `/`, a link that
  // starts with `/` misses the page.
  it('start the path of each link to this site with the base path', () => {
    expect(sourcesThatMatch(/\bhref(?:="['`]?|:\s*['"`])\/(?!\/)/)).toEqual([]);
  });
});
