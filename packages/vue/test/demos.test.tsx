/// <reference types="vite/client" />
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
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
  waitFor,
} from '#test-utils';
import DemoFrame from '../../../docs/.vitepress/components/DemoFrame.vue';
import DemoSource from '../../../docs/.vitepress/components/DemoSource.vue';
import { demoVariant } from '../../../docs/.vitepress/components/demoVariant.ts';
import { DEMO_VARIANT_STORAGE_KEY } from '../../../docs/.vitepress/components/demoVariantStorageKey.ts';
import '../../../docs/demos/tailwind.css';

const modules = import.meta.glob<{ default: Component }>(
  [
    '../../../docs/demos/*/*/{css-modules,tailwind}/index.vue',
    '../../../docs/examples/*/demos/*/index.vue',
  ],
  { eager: true },
);

const demos = Object.entries(modules).map(([path, { default: Demo }]) => ({
  name: /\/docs\/(?:demos\/)?(.+?)(?:\/(?:css-modules|tailwind))?\/index\.vue$/.exec(path)![1],
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

// Vitest cuts a `$name` value after 40 characters. The variant has its own value, so the two titles
// of a long name stay different.
describe.each(demos)('$name ($variant)', ({ file, variant, Demo }) => {
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

  // The style sheet has `h-8` and `dark:text-white`, because the Button demo has them.
  it.each([
    {
      name: 'a frame gets utilities and preflight',
      vnode: () => h('div', { 'data-demo': 'tailwind' }, h(TailwindButton)),
      selector: 'button',
      expected: { height: '32px', 'padding-top': '0px' },
    },
    {
      name: 'a portal element gets utilities only',
      vnode: () => h('div', { 'data-vase-ui-portal': '' }, h('div', { class: 'h-8' })),
      selector: '.h-8',
      expected: { height: '32px', 'box-sizing': 'content-box' },
    },
    {
      name: 'a CSS-module frame gets nothing',
      vnode: () => h('div', { 'data-demo': 'css-modules' }, h('div', { class: 'h-8' })),
      selector: '.h-8',
      expected: { height: '0px', 'box-sizing': 'content-box' },
    },
    {
      name: 'dark: follows the class dark',
      vnode: () =>
        h('div', { class: 'dark' }, h('div', { 'data-demo': 'tailwind' }, h(TailwindButton))),
      selector: 'button',
      expected: { color: 'rgb(255, 255, 255)' },
    },
  ])('$name', async ({ vnode, selector, expected }) => {
    const { container } = await render(vnode());
    const style = getComputedStyle(container.querySelector(selector)!);

    expect(
      Object.fromEntries(Object.keys(expected).map((name) => [name, style.getPropertyValue(name)])),
    ).toEqual(expected);
  });
});

describe('the frame of a demo', () => {
  const { render } = createRenderer();

  afterEach(() => {
    demoVariant.value = 'css-modules';
    delete document.documentElement.dataset.demoVariant;
    localStorage.removeItem(DEMO_VARIANT_STORAGE_KEY);
    scrollTo(0, 0);
  });

  /** The last step of a selection is a call of `scrollBy`, so the test can wait for it. */
  function spyOnScroll() {
    const spy = vi.spyOn(window, 'scrollBy');
    onTestFinished(() => {
      spy.mockRestore();
    });
    return spy;
  }

  it('shows the other variant, keeps the choice and swaps the sources when the reader selects it', async () => {
    const scrollBy = spyOnScroll();
    const { container, getByRole, user } = await render(() =>
      h('div', [
        h(DemoFrame, null, { default: () => 'CSS Modules demo', tailwind: () => 'Tailwind demo' }),
        h(DemoSource, { variant: 'css-modules' }, () => 'CSS Modules source'),
        h(DemoSource, { variant: 'tailwind' }, () => 'Tailwind source'),
      ]),
    );
    const frame = container.querySelector('.demo-frame');
    const [cssSource, tailwindSource] = container.querySelectorAll('.demo-source');
    const select = getByRole('combobox', { name: 'Styling method' });
    expect(frame).toHaveAttribute('data-demo', 'css-modules');
    expect(frame).toHaveTextContent('CSS Modules demo');
    expect(select).toHaveValue('css-modules');
    expect(select).toHaveAttribute('autocomplete', 'off');
    expect(getComputedStyle(cssSource).display).toBe('block');
    expect(getComputedStyle(tailwindSource).display).toBe('none');

    await user.selectOptions(select, 'tailwind');
    await waitFor(() => expect(scrollBy).toHaveBeenCalledTimes(1));

    expect(frame).toHaveAttribute('data-demo', 'tailwind');
    expect(frame).toHaveTextContent('Tailwind demo');
    expect(document.documentElement.dataset.demoVariant).toBe('tailwind');
    expect(localStorage.getItem(DEMO_VARIANT_STORAGE_KEY)).toBe('tailwind');
    expect(getComputedStyle(cssSource).display).toBe('none');
    expect(getComputedStyle(tailwindSource).display).toBe('block');

    await user.selectOptions(select, 'css-modules');
    await waitFor(() => expect(scrollBy).toHaveBeenCalledTimes(2));

    expect(frame).toHaveAttribute('data-demo', 'css-modules');
    expect(document.documentElement.dataset.demoVariant).toBeUndefined();
    expect(localStorage.getItem(DEMO_VARIANT_STORAGE_KEY)).toBe('css-modules');
    expect(getComputedStyle(cssSource).display).toBe('block');
    expect(getComputedStyle(tailwindSource).display).toBe('none');
  });

  it('shows the stored variant after the mount, as the script in the head set it', async () => {
    document.documentElement.dataset.demoVariant = 'tailwind';

    const { container, getByRole } = await render(
      h(DemoFrame, null, { default: () => 'CSS Modules demo', tailwind: () => 'Tailwind demo' }),
    );

    const frame = container.querySelector('.demo-frame');
    expect(frame).toHaveAttribute('data-demo', 'tailwind');
    expect(frame).toHaveTextContent('Tailwind demo');
    expect(getByRole('combobox', { name: 'Styling method' })).toHaveValue('tailwind');
  });

  it.each([
    {
      name: 'only the default slot',
      slots: { default: () => 'CSS Modules demo' },
      variant: 'css-modules',
      text: 'CSS Modules demo',
    },
    {
      name: 'only the tailwind slot',
      slots: { tailwind: () => 'Tailwind demo' },
      variant: 'tailwind',
      text: 'Tailwind demo',
    },
  ])('shows its slot and no select with $name', async ({ slots, variant, text }) => {
    const { container, queryByRole } = await render(h(DemoFrame, null, slots));

    const frame = container.querySelector('.demo-frame');
    expect(frame).toHaveAttribute('data-demo', variant);
    expect(frame).toHaveTextContent(text);
    expect(queryByRole('combobox')).toBeNull();
  });

  it('keeps the select at its place in the window when the demo above it changes height', async () => {
    const scrollBy = spyOnScroll();
    const { container, getByRole, user } = await render(() =>
      h('div', [
        h('div', { style: { height: '2000px' } }),
        h(DemoFrame, null, {
          default: () => h('div', { style: { height: '100px' } }),
          tailwind: () => h('div', { style: { height: '400px' } }),
        }),
      ]),
    );
    const select = getByRole('combobox', { name: 'Styling method' });
    const frame = container.querySelector('.demo-frame')!;
    scrollTo(0, document.documentElement.scrollHeight);
    const top = select.getBoundingClientRect().top;
    const height = frame.getBoundingClientRect().height;

    await user.selectOptions(select, 'tailwind');
    await waitFor(() => expect(scrollBy).toHaveBeenCalledTimes(1));

    expect(frame.getBoundingClientRect().height).toBeGreaterThan(height + 200);
    expect(Math.abs(select.getBoundingClientRect().top - top)).toBeLessThan(1);
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
    const { Demo } = demos.find(({ name, variant }) => name === 'toast/promise' && variant === 'css-modules')!;
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
