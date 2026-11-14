/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, expectNoAxeViolations, hydrate, renderOnServer } from '#test-utils';
import { mark } from './probeMarks';

// PROBE: the bounds of each test. The gap from `test-finished` to the next `test-start` holds the
// `onTestFinished` hooks of `test/setup.ts` and `test/reportedMessages.ts`.
// PROBE: at `test-finished`, one task of each kind (a 0 ms timer, a port message, a frame) marks
// when it runs. A late timer with an early message is a held timer; both late is a busy page.
beforeEach((context) => {
  let topVisibility: string | undefined;
  try {
    topVisibility = window.top === window ? 'self' : window.top?.document.visibilityState;
  } catch {
    topVisibility = 'cross-origin';
  }
  mark('test-start', {
    test: context.task.name,
    suite: context.task.suite?.name,
    visibility: document.visibilityState,
    topVisibility,
    focus: document.hasFocus(),
    readyState: document.readyState,
  });
  onTestFinished(() => {
    mark('test-finished');
    setTimeout(() => mark('probe-timer-0'), 0);
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      mark('probe-message');
      channel.port1.close();
    };
    channel.port2.postMessage(0);
    requestAnimationFrame(() => mark('probe-frame'));
  });
});
afterEach(() => mark('after-each'));

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

describe('demos', () => {
  it('have no name of Base UI or React in their text or their links', () => {
    expect(sourcesThatMatch(/Base UI|BaseUI|base-ui|\bReact\b|\/react\//)).toEqual([]);
  });

  // VitePress adds no base path to a link in a demo. A link that starts with `/` then misses the page.
  it('start the path of each link to this site with the base path', () => {
    expect(sourcesThatMatch(/\bhref(?:="['`]?|:\s*['"`])\/(?!\/)/)).toEqual([]);
  });
});
