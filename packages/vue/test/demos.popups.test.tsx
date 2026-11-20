/// <reference types="vite/client" />
import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import {
  createRenderer,
  expectNoAxeViolations,
  fireEvent,
  firePointer,
  flushMicrotasks,
  mockToday,
  waitFor,
  waitForLaterMillisecond,
  within,
} from '#test-utils';
import DemoFrame from '../../../docs/.vitepress/components/DemoFrame.vue';
// The site gives a popup, which is outside the frame of its demo, the base layer of VitePress and
// the rules of `look.css`. The package has no dependency on VitePress, so the first path names the
// copy in `docs/node_modules`.
import '../../../docs/node_modules/vitepress/dist/client/theme-default/styles/base.css';
import '../../../docs/.vitepress/theme/tokens.css';
import '../../../docs/.vitepress/theme/look.css';
import '../../../docs/demos/tailwind.css';

// The case checks each popup in its open state, not its motion. A wait for the transitions of the
// style sheets makes the file five times slower.
const noMotionStyle = document.createElement('style');
noMotionStyle.textContent =
  '*, *::before, *::after { transition: none !important; animation: none !important; }';
document.head.append(noMotionStyle);

const modules = import.meta.glob<{ default: Component }>(
  [
    '../../../docs/demos/*/*/{css-modules,tailwind}/index.vue',
    '../../../docs/examples/*/demos/*/index.vue',
  ],
  { eager: true },
);

const sources = import.meta.glob<string>(
  ['../../../docs/demos/**/*.{vue,ts}', '../../../docs/examples/*/demos/**/*.{vue,ts}'],
  { query: '?raw', import: 'default', eager: true },
);

// A demo has a popup when a file of its folder names a `Portal` part.
const demos = Object.entries(modules)
  .map(([path, { default: Demo }]) => ({
    name: /\/docs\/(?:demos\/)?(.+?)(?:\/(?:css-modules|tailwind))?\/index\.vue$/.exec(path)![1],
    variant: path.endsWith('/tailwind/index.vue') ? 'tailwind' : 'css-modules',
    folder: path.replace(/(?:(?:css-modules|tailwind)\/)?index\.vue$/, ''),
    Demo,
  }))
  .filter(({ folder }) =>
    Object.entries(sources).some(
      ([path, source]) => path.startsWith(folder) && /\.Portal\b/.test(source),
    ),
  );

type Render = ReturnType<typeof createRenderer>['render'];
type User = Awaited<ReturnType<Render>>['user'];

interface Trigger {
  element: HTMLElement;
  open: (user: User) => Promise<unknown>;
}

function click(element: HTMLElement) {
  return (user: User) => user.click(element);
}

function focus(element: HTMLElement) {
  return () => {
    element.focus();
    return Promise.resolve();
  };
}

/** The triggers of `root` that a part marks with an attribute and that have no open popup. */
function markedTriggers(root: ParentNode): Trigger[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      '[aria-haspopup], [data-vase-ui-navigation-menu-trigger], [data-vase-ui-tooltip-trigger]',
    ),
  ]
    .filter((element) =>
      element.matches(
        ':not(:disabled, [aria-disabled="true"], [data-disabled], [data-popup-open], [aria-expanded="true"])',
      ),
    )
    .map((element) => {
      if (element.matches('[data-vase-ui-tooltip-trigger]')) {
        return { element, open: focus(element) };
      }
      if (element.matches('input')) {
        return {
          element,
          // A click opens the list of a combobox. The list of an autocomplete opens at the first
          // letter.
          open: async (user: User) => {
            await user.click(element);
            if (element.getAttribute('aria-expanded') !== 'true') {
              await user.keyboard('a');
            }
          },
        };
      }
      return { element, open: click(element) };
    });
}

async function swipeLeft(element: HTMLElement) {
  const { left, top } = element.getBoundingClientRect();
  const init = { pointerId: 1, pointerType: 'mouse', clientY: top + 20 };
  await firePointer.down(element, {
    ...init,
    button: 0,
    buttons: 1,
    clientX: left + 5,
    timeStamp: 1,
  });
  await flushMicrotasks();
  await firePointer.move(element, { ...init, buttons: 1, clientX: left + 4, timeStamp: 17 });
  await flushMicrotasks();
  await firePointer.move(element, { ...init, buttons: 1, clientX: left - 195, timeStamp: 33 });
  await flushMicrotasks();
  await firePointer.up(element, { ...init, clientX: left - 195, timeStamp: 49 });
}

/**
 * The triggers that no attribute marks. `depth` is 0 for the demo and 1 for its first popup.
 */
function unmarkedTriggers(name: string, depth: number, root: HTMLElement): Trigger[] {
  const family = name.split('/')[0];
  if (depth === 0 && family === 'context-menu') {
    const element = within(root).getByText('Right click here');
    return [
      {
        element,
        open: () => {
          const { left, top } = element.getBoundingClientRect();
          return fireEvent.contextMenu(element, {
            clientX: left + 10,
            clientY: top + 10,
            button: 2,
          });
        },
      },
    ];
  }
  if (depth === 0 && family === 'preview-card') {
    return [...root.querySelectorAll<HTMLElement>('a')].map((element) => ({
      element,
      // A preview card opens 600 ms after a focus with `:focus-visible`, and `focus()` after a key
      // has it. The case moves a fake clock by that time.
      open: async (user: User) => {
        await user.keyboard('{Shift}');
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        element.focus();
        vi.advanceTimersByTime(600);
        vi.useRealTimers();
      },
    }));
  }
  if (depth === 0 && family === 'toast') {
    return [...root.querySelectorAll<HTMLElement>('button')].map((element) => ({
      element,
      open: click(element),
    }));
  }
  if (depth === 0 && name === 'drawer/swipe-area') {
    const element = within(root).getByText('Swipe here').parentElement!;
    return [{ element, open: () => swipeLeft(element) }];
  }
  if (depth === 1 && name.endsWith('/open-from-menu')) {
    const element = within(root).getByRole('menuitem', { name: /…$/ });
    return [{ element, open: click(element) }];
  }
  return [];
}

// A portal of `utils/popups` has an element of its own. A portal of the popup layer moves each part
// to `<body>`, so each child of `<body>` outside the demo is a portal there.
function portals() {
  const moved = [...document.body.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      !child.matches('script, style') &&
      !child.querySelector('.demo-frame'),
  );
  return [
    ...new Set([...document.querySelectorAll<HTMLElement>('[data-vase-ui-portal]'), ...moved]),
  ];
}

// A closed popup that stays in the DOM is `hidden`. A preview card has no role and no attribute of
// its open state, so its positioner in `<body>` counts while a link of the demo has
// `data-popup-open`.
function openPopups(name: string) {
  const cards =
    name.startsWith('preview-card/') && document.querySelector('.demo-frame [data-popup-open]')
      ? portals().filter((portal) => portal.matches('[data-side]'))
      : [];
  return [
    ...cards,
    ...portals().flatMap((portal) => [
      ...portal.querySelectorAll<HTMLElement>(
        '[data-open], [role="dialog"]:not([hidden]), [role="alertdialog"]:not([hidden])',
      ),
    ]),
  ];
}

/** The animations that run and that end. A demo can animate its popup with a script. */
function runningAnimations() {
  return document
    .getAnimations()
    .filter(
      (animation) =>
        animation.playState === 'running' &&
        Number.isFinite(animation.effect?.getComputedTiming().endTime),
    );
}

/**
 * The triggers at `depth`. The triggers of an earlier popup are in `portalElementsBeforeOpen`, so
 * they are not in the list.
 */
function triggersAt(
  name: string,
  depth: number,
  frame: HTMLElement,
  portalElementsBeforeOpen: Set<Element>,
) {
  if (depth === 0) {
    return [...markedTriggers(frame), ...unmarkedTriggers(name, depth, frame)];
  }
  const outside = portals().filter((portal) => !frame.contains(portal));
  return [
    ...outside.flatMap((portal) => markedTriggers(portal)),
    ...(outside.length > 0 ? unmarkedTriggers(name, depth, document.body) : []),
  ].filter(
    (trigger) =>
      !portalElementsBeforeOpen.has(trigger.element) &&
      outside.some((portal) => portal.contains(trigger.element)),
  );
}

// What axe reports and a user does not meet. Each row is a rule and the elements that are correct.
const ACCEPTED: Record<string, (element: Element) => boolean> = {
  // In WebKit on an Apple system, a focus guard is a button. A menu has the guards of its submenu
  // triggers as children, and a menubar has the guards of its menus.
  'aria-required-children': (element) => {
    const buttons = [...element.querySelectorAll('[role="button"]')];
    return (
      element.matches('[role="menu"], [role="menubar"]') &&
      buttons.length > 0 &&
      buttons.every((button) => button.matches('[data-vase-ui-focus-guard]'))
    );
  },
  // In WebKit, VoiceOver needs `aria-selected` on the highlighted item of a menu that has an input.
  'aria-allowed-attr': (element) => element.matches('[role="menuitem"][aria-selected="true"]'),
  // The arrow keys of the input move the highlight of a list, and the list scrolls to it.
  'scrollable-region-focusable': (element) => element.matches('[role="listbox"] *'),
};

function expectNoViolationsInOpenState(element: Element) {
  return expectNoAxeViolations(element, {
    // An open popup gives `aria-hidden` to its focus guards. A modal popup, and the list of an
    // input that keeps the focus, also give it to the elements outside the popup. These elements
    // can take the focus. The mount case of `demos.test.tsx` keeps this rule for the closed demo.
    rules: { 'aria-hidden-focus': { enabled: false } },
    accept: (rule, node) => ACCEPTED[rule]?.(node) ?? false,
  });
}

/**
 * The options of the lists of `root` whose text is outside the box of the option, or outside the
 * part of the list that shows. The case does not compare `scrollWidth` of a list with its
 * `clientWidth`, because a scrollbar that takes room changes both.
 */
function optionsWithCutText(root: Element): string[] {
  return [...root.querySelectorAll('[role="listbox"] [role="option"]')].flatMap((option) => {
    const list = option.closest('[role="listbox"]')!;
    const range = document.createRange();
    range.selectNodeContents(option);
    const text = range.getBoundingClientRect();
    const optionBox = option.getBoundingClientRect();
    const shownLeft = list.getBoundingClientRect().left + list.clientLeft;
    const left = Math.max(optionBox.left, shownLeft);
    const right = Math.min(optionBox.right, shownLeft + list.clientWidth);
    // Less than half a pixel shows no cut.
    return option.scrollWidth > option.clientWidth ||
      text.left < left - 0.5 ||
      text.right > right + 0.5
      ? [
          `"${option.textContent.trim()}" is ${text.width.toFixed(2)} px wide in ${(right - left).toFixed(2)} px`,
        ]
      : [];
  });
}

function mount(render: Render, variant: string, Demo: Component) {
  // Do not write JSX here. The dependency scan of Vite cannot parse JSX in a file that has
  // `import.meta.glob`.
  return render(
    h(DemoFrame, null, { [variant === 'tailwind' ? 'tailwind' : 'default']: () => h(Demo) }),
  );
}

// Vitest cuts a `$name` value after 40 characters, so two long names can get one title. A `%s`
// value is not cut.
describe.each(demos.map((demo) => [`${demo.name} (${demo.variant})`, demo] as const))(
  '%s',
  (_title, { name, variant, Demo }) => {
    const { render } = createRenderer();

    it('opens each popup with no Vue warning, no axe violation and no cut option', async () => {
      mockToday('2026-11-14');
      // A path is the index of the trigger at each depth. The case opens each path in a new mount,
      // and it adds the triggers of the popup at the end of a path as new paths.
      const paths: number[][] = [];
      {
        const view = await mount(render, variant, Demo);
        const frame = view.container.querySelector<HTMLElement>('.demo-frame')!;
        triggersAt(name, 0, frame, new Set()).forEach((_, index) => paths.push([index]));
        view.unmount();
      }
      expect(paths, 'The case finds no trigger in a demo that has a Portal part.').not.toHaveLength(
        0,
      );

      const cut: string[] = [];
      for (const path of paths) {
        const view = await mount(render, variant, Demo);
        const frame = view.container.querySelector<HTMLElement>('.demo-frame')!;
        let portalElementsBeforeOpen = new Set<Element>();
        for (const [depth, index] of path.entries()) {
          const trigger = triggersAt(name, depth, frame, portalElementsBeforeOpen)[index]!;
          portalElementsBeforeOpen = new Set(
            portals().flatMap((portal) => [...portal.querySelectorAll('*')]),
          );
          const openBefore = new Set(openPopups(name));
          // The next open can click a trigger of this popup. Vue skips a listener for an event in
          // the millisecond in which Vue attached the listener.
          await waitForLaterMillisecond(async () => {
            await trigger.open(view.user);
            await waitFor(() => {
              expect(openPopups(name).filter((popup) => !openBefore.has(popup))).not.toHaveLength(
                0,
              );
            });
            // A popup has its starting style until the frame after its mount. A style sheet gives
            // that style `opacity: 0`, and axe gives no contrast for text that a reader cannot see.
            await waitFor(() => {
              expect([...document.querySelectorAll('[data-starting-style]')]).toEqual([]);
            });
            await waitFor(() => {
              expect(runningAnimations()).toEqual([]);
            });
          });
        }

        await expectNoViolationsInOpenState(frame);
        for (const portal of portals().filter((element) => !frame.contains(element))) {
          await expectNoViolationsInOpenState(portal);
          cut.push(...optionsWithCutText(portal));
        }

        if (path.length < 3) {
          triggersAt(name, path.length, frame, portalElementsBeforeOpen).forEach((_, index) =>
            paths.push([...path, index]),
          );
        }
        view.unmount();
        // Without a flush before the next mount, the file takes about a quarter more time.
        await flushMicrotasks();
      }
      expect(cut).toEqual([]);
    });
  },
);
