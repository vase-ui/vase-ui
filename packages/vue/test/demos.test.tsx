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
  mockBrowserToday,
  mockToday,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
  within,
} from '#test-utils';
import DemoFrame from '../../../docs/.vitepress/components/DemoFrame.vue';
import DemoSource from '../../../docs/.vitepress/components/DemoSource.vue';
import { demoVariant } from '../../../docs/.vitepress/components/demoVariant.ts';
import { DEMO_VARIANT_STORAGE_KEY } from '../../../docs/.vitepress/components/demoVariantStorageKey.ts';
import '../../../docs/demos/tailwind.css';
import VeeValidateRules from '../../../docs/examples/forms/VeeValidateRules.vue';
import { platform } from '../src/common/platform';

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

// Vitest cuts a `$name` value after 40 characters, so two long names can get one title. A `%s`
// value is not cut.
describe.each(demos.map((demo) => [`${demo.name} (${demo.variant})`, demo] as const))(
  '%s',
  (_title, { file, variant, Demo }) => {
    const { render } = createRenderer();

    it('mounts with no Vue warning and has no axe violation', async () => {
      mockToday('2026-11-14');
      // Do not write JSX here. The dependency scan of Vite cannot parse JSX in a file that has
      // `import.meta.glob`.
      const { container } = await render(h('div', { 'data-demo': variant }, h(Demo)));
      // Axe checks the page as the first frame paints it. A scroll area measures its viewport in
      // that frame, and the viewport becomes a tab stop.
      await waitSingleFrame();
      await waitSingleFrame();

      await expectNoAxeViolations(container);
    });

    it('hydrates the server render with no mismatch', async () => {
      const serverHtml = await renderOnServer(file);
      // A reader opens the site on another day than the day of its build.
      mockBrowserToday('month');
      // A calendar page that follows the clock mounts again for the day of the browser, so Vue
      // gives its caption a new id.
      await hydrate(Demo, { serverHtml, renumberIds: serverHtml.includes('data-vase-ui-today') });
    });
  },
);

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

  // The part renders no cursor in WebKit.
  it.skipIf(platform.engine.webkit)(
    'the scrub area cursor gets the utilities of its classes',
    async () => {
      const pointerLock = vi
        .spyOn(document.body, 'requestPointerLock')
        .mockImplementation(() => Promise.resolve());
      onTestFinished(() => {
        pointerLock.mockRestore();
      });
      const TailwindNumberField =
        modules['../../../docs/demos/number-field/hero/tailwind/index.vue'].default;
      const { container } = await render(
        h('div', { 'data-demo': 'tailwind' }, h(TailwindNumberField)),
      );

      container
        .querySelector('[role="presentation"]')!
        .dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }),
        );
      await flushMicrotasks();

      const cursor = [...document.querySelectorAll('[role="presentation"][data-scrubbing]')].find(
        (element) => !container.contains(element),
      )!;
      const frame = container.appendChild(document.createElement('div'));
      frame.dataset.demo = 'tailwind';
      const reference = frame.appendChild(document.createElement('span'));
      reference.className = cursor.className;
      const { filter } = getComputedStyle(reference);

      expect(filter).not.toBe('none');
      expect(getComputedStyle(cursor).filter).toBe(filter);
    },
  );
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
    const { Demo } = demos.find(
      ({ name, variant }) => name === 'toast/promise' && variant === 'css-modules',
    )!;
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

describe('the form library demos of the Forms page', () => {
  const { render } = createRenderer();

  it('updates the VeeValidate field only when the control emits a model update', async () => {
    await render(h(VeeValidateRules));
    const input = screen.getByRole('textbox', { name: 'Username' });

    await fireEvent.change(input, { target: { value: 'x' } });
    expect(input).not.toHaveAttribute('data-dirty');
    expect(screen.queryByText('Too short')).toBeNull();

    await fireEvent.input(input, { target: { value: 'y' } });
    await waitFor(() => expect(screen.getByText('Too short')).toBeVisible());
    expect(input).toHaveAttribute('data-dirty');
    await fireEvent.blur(input);
    expect(input).toHaveAttribute('data-touched');
  });

  it.each([{ name: 'handbook-forms/vee-validate' }, { name: 'handbook-forms/tanstack-form' }])(
    '$name: a failed submit moves the focus to the first invalid control',
    async ({ name }) => {
      const [Hero, Demo] = ['handbook-forms/hero', name].map(
        (demoName) => demos.find((demo) => demo.name === demoName)!.Demo,
      );
      // The page has the first demo above this demo, and the fields of both demos have the same
      // names. After a failed submit of the first demo, a search in the document finds its
      // controls first.
      const { user } = await render(
        h('div', { 'data-demo': 'tailwind' }, [
          h('div', { 'data-testid': 'hero' }, h(Hero)),
          h('div', { 'data-testid': 'demo' }, h(Demo)),
        ]),
      );
      const hero = within(screen.getByTestId('hero'));
      const demo = within(screen.getByTestId('demo'));
      const submit = demo.getByRole('button', { name: 'Launch server' });
      await user.click(hero.getByRole('button', { name: 'Launch server' }));
      await waitFor(() => expect(hero.getByRole('textbox', { name: 'Server name' })).toHaveFocus());

      await user.click(submit);

      await waitFor(() => expect(demo.getByRole('textbox', { name: 'Server name' })).toHaveFocus());

      await user.keyboard('api-server-01');
      await user.click(submit);

      // In the VeeValidate demo, the element named `region` is a hidden input. It moves the focus
      // to the combobox.
      await waitFor(() => expect(demo.getByRole('combobox', { name: 'Region' })).toHaveFocus());
    },
  );
});

describe.each([
  { page: 'Toast', family: 'toast' },
  { page: 'Navigation Menu', family: 'navigation-menu' },
  { page: 'Forms', family: 'handbook-forms' },
])('the demos of the $page page', ({ family }) => {
  const { render } = createRenderer();
  const pageDemos = demos.filter(({ name }) => name.startsWith(`${family}/`));
  const methods = [...new Set(pageDemos.map(({ variant }) => variant))];

  it.each(methods.map((method) => ({ method })))(
    'have no axe violation when the page shows them together ($method)',
    async ({ method }) => {
      // The frame shows the other variant of a demo that does not have the selected one.
      const shown = pageDemos.filter(
        ({ name, variant }) =>
          variant === method ||
          !pageDemos.some((other) => other.name === name && other.variant === method),
      );
      await render(
        h(
          'div',
          shown.map(({ variant, Demo }) => h('div', { 'data-demo': variant }, h(Demo))),
        ),
      );

      // axe compares the landmarks of the demos only when it reads them together. The viewport of
      // a toast provider is a landmark in a portal, outside the element of the render.
      await expectNoAxeViolations(document.body);
    },
  );
});

describe('calendar/hero', () => {
  const { render } = createRenderer();

  it('marks the day of the clock as today', async () => {
    mockToday('2027-03-05');
    const { Demo } = demos.find(
      ({ name, variant }) => name === 'calendar/hero' && variant === 'css-modules',
    )!;
    const { container } = await render(h(Demo));

    expect([...container.querySelectorAll('[aria-current="date"]')]).toEqual([
      screen.getByRole('button', { name: /March 5, 2027/ }),
    ]);
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

  it('give no calendar a fixed today', () => {
    expect(sourcesThatMatch(/[\s:]today=/)).toEqual([]);
  });
});
