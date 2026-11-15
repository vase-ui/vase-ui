/// <reference types="vite/client" />
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import {
  createRenderer,
  expectNoAxeViolations,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
} from '#test-utils';

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

describe('toast/promise', () => {
  const { render } = createRenderer();

  it('handles the rejection of the promise that the manager returns', async () => {
    const reported: Promise<unknown>[] = [];
    const record = ({ promise }: PromiseRejectionEvent) => {
      reported.push(promise);
    };
    window.addEventListener('unhandledrejection', record);
    onTestFinished(() => window.removeEventListener('unhandledrejection', record));
    // The demo rejects its promise when this number is 0.3 or less.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });
    const { Demo } = demos.find(({ name }) => name === 'toast/promise')!;
    await render(h(Demo));

    await fireEvent.click(screen.getByRole('button', { name: 'Run promise' }));
    vi.advanceTimersByTime(2000);
    await flushMicrotasks();
    expect(screen.getByText('Error: operation failed')).toBeVisible();

    // The browser reports each rejection that has no handler in the sequence of the rejections:
    // https://html.spec.whatwg.org/multipage/webappapis.html#notify-about-rejected-promises
    // This rejection is later than the rejection of the demo, so its report is the last one.
    const last = Promise.reject(new Error('The last rejection of the case.'));
    await new Promise<void>((resolve) => {
      const resolveAtLast = ({ promise }: PromiseRejectionEvent) => {
        if (promise === last) {
          window.removeEventListener('unhandledrejection', resolveAtLast);
          resolve();
        }
      };
      window.addEventListener('unhandledrejection', resolveAtLast);
    });

    expect(reported.map((promise) => promise === last)).toEqual([true]);
    // Vitest writes a rejection to the console while a test has a listener for the report.
    expect(takeReportedMessages()).toEqual(['console.error: [object PromiseRejectionEvent]']);
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
