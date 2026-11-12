/// <reference types="vite/client" />
import { describe, expect, it, vi } from 'vitest';
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

describe.each(demos)('$name', ({ name, Demo }) => {
  const { render } = createRenderer();

  it('mounts with no Vue warning and has no axe violation', async () => {
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');

    // Do not write JSX here. The dependency scan of Vite cannot parse JSX in a file that has
    // `import.meta.glob`.
    const { container } = await render(h(Demo));

    await expectNoAxeViolations(container);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('hydrates the server render with no mismatch', async () => {
    const serverHtml = await renderOnServer(`../../docs/demos/${name}/css-modules/index.vue`);

    await hydrate(Demo, { serverHtml });
  });
});
