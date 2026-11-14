/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, expectNoAxeViolations, hydrate, renderOnServer } from '#test-utils';

const modules = import.meta.glob<{ default: Component }>(
  '../../../docs/demos/*/*/css-modules/index.vue',
  { eager: true },
);

const demos = Object.entries(modules).map(([path, { default: Demo }]) => ({
  name: /\/docs\/demos\/(.+)\/css-modules\/index\.vue$/.exec(path)![1],
  Demo,
}));

const sources = import.meta.glob<string>('../../../docs/demos/**/*.{vue,ts}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function sourcesThatMatch(pattern: RegExp) {
  expect(Object.keys(sources)).not.toHaveLength(0);
  return Object.entries(sources)
    .filter(([, source]) => pattern.test(source))
    .map(([path]) => path);
}

describe.each(demos)('$name', ({ name, Demo }) => {
  const { render } = createRenderer();

  it('mounts with no Vue warning and has no axe violation', async () => {
    // Do not write JSX here. The dependency scan of Vite cannot parse JSX in a file that has
    // `import.meta.glob`.
    const { container } = await render(h(Demo));

    await expectNoAxeViolations(container);
  });

  it('hydrates the server render with no mismatch', async () => {
    const serverHtml = await renderOnServer(`../../docs/demos/${name}/css-modules/index.vue`);

    await hydrate(Demo, { serverHtml });
  });
});

describe('demos', () => {
  it('have no name of Base UI or React in their text or their links', () => {
    expect(sourcesThatMatch(/Base UI|BaseUI|base-ui|\bReact\b|\/react\//)).toEqual([]);
  });

  // VitePress adds no base path to a link in a demo. A link that starts with `/` then misses the page.
  it('start the path of each link to this site with the base path', () => {
    expect(sourcesThatMatch(/\bhref(?:="|:\s*['"])\/(?!\/)/)).toEqual([]);
  });
});
