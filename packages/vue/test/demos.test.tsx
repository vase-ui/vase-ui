/// <reference types="vite/client" />
import { describe, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, expectNoAxeViolations, hydrate, renderOnServer } from '#test-utils';

const modules = import.meta.glob<{ default: Component }>(
  ['../../../docs/demos/*/*/css-modules/index.vue', '../../../docs/examples/*/demos/*/index.vue'],
  { eager: true },
);

const demos = Object.entries(modules).map(([path, { default: Demo }]) => ({
  name: /\/docs\/(?:demos\/)?(.+?)(?:\/css-modules)?\/index\.vue$/.exec(path)![1],
  // The server command takes a path from the root of this package. A key of the glob is relative
  // to this file.
  file: path.replace(/^\.\.\//, ''),
  Demo,
}));

describe.each(demos)('$name', ({ file, Demo }) => {
  const { render } = createRenderer();

  it('mounts with no Vue warning and has no axe violation', async () => {
    // Do not write JSX here. The dependency scan of Vite cannot parse JSX in a file that has
    // `import.meta.glob`.
    const { container } = await render(h(Demo));

    await expectNoAxeViolations(container);
  });

  it('hydrates the server render with no mismatch', async () => {
    const serverHtml = await renderOnServer(file);

    await hydrate(Demo, { serverHtml });
  });
});
