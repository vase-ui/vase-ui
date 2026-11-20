/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { h } from 'vue';
import type { Component, CSSProperties } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  mockToday,
  screen,
  waitFor,
  waitForLaterMillisecond,
  within,
} from '#test-utils';
// The package has no dependency on the font of the site, so the path names the copy in
// `docs/node_modules`.
import '../../../docs/node_modules/@fontsource-variable/hanken-grotesk/index.css';
import DemoFrame from '../../../docs/.vitepress/components/DemoFrame.vue';
import '../../../docs/.vitepress/theme/tokens.css';
import '../../../docs/.vitepress/theme/look.css';
import '../../../docs/demos/tailwind.css';
import { Field } from '../src/field';
import { rgbaOf } from './rgbaOf';

// A component of Vase UI's own has a record in `parity/own`. The test reads the names of the
// records and of the demo folders, so a new component or a new demo needs no change here.
const ownComponents = new Set(
  Object.keys(import.meta.glob('../../../parity/own/*.json')).map(
    (path) => /([^/]+)\.json$/.exec(path)![1],
  ),
);
const modules = import.meta.glob<{ default: Component }>(
  '../../../docs/demos/*/*/{css-modules,tailwind}/index.vue',
);
const demos = [
  ...new Set(
    Object.keys(modules).flatMap((path) => {
      const [, demo, component] = /\/demos\/(([^/]+)\/[^/]+)\//.exec(path)!;
      return ownComponents.has(component) ? [demo] : [];
    }),
  ),
].toSorted();
// The source of a demo says which parts it has, so a case for one part finds its demos by itself.
const sources = import.meta.glob<string>('../../../docs/demos/*/*/css-modules/index.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
});

type Variant = 'css-modules' | 'tailwind';
const VARIANTS: Variant[] = ['css-modules', 'tailwind'];

/**
 * The states that a part has from data attributes that only a pointer or a layout gives. The test
 * writes each set of the attributes on each element of the selector.
 */
const ATTRIBUTE_STATES: Record<string, { selector: string; attributes: string[] } | undefined> = {
  resizable: {
    selector: '[role="separator"]',
    attributes: ['data-at-min', 'data-at-max', 'data-crossing'],
  },
};

/** The step that shows each part of a demo that hides a part at rest. */
const SHOW_EACH_PART: Record<string, (() => Promise<void>) | undefined> = {
  'resizable/conditional': async () => {
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Show the preview' }));
    await waitFor(() => {
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });
  },
};

// The root of `resizable/conditional` is a `<div>`, and `Resizable.Root` reads no field.
const DEMOS_WITHOUT_DISABLED_STATE = new Set(['resizable/conditional']);

function subsets(items: string[]): string[][] {
  return items.reduce<string[][]>(
    (sets, item) => [...sets, ...sets.map((set) => [...set, item])],
    [[]],
  );
}

function bytesOf(color: string) {
  return rgbaOf(color).join(',');
}

/**
 * One value of a list of a transition for each property of `transition-property`. The engine
 * repeats a list that has fewer values than the properties, so `0.2s` and `0.2s, 0.2s` are one
 * look for two properties.
 */
function valueOfEachProperty(list: string, properties: number) {
  // A comma between the parentheses of a curve does not start a value.
  const values = list.split(/,\s*(?![^(]*\))/);
  return Array.from({ length: properties }, (_, index) => values[index % values.length]).join(', ');
}

function lookOf(element: Element): Record<string, string> {
  const style = getComputedStyle(element);
  // The clip of a hidden input of a part leaves nothing to paint. The reset of Tailwind changes the
  // colors of the input, and the frame of a CSS-module demo has no reset.
  if (style.clipPath === 'inset(50%)') {
    return {};
  }
  const look: Record<string, string> = {
    cursor: style.cursor,
    'text-decoration-line': style.textDecorationLine,
  };
  // A transition with no property changes nothing. `transition: none` of a style sheet also sets
  // its duration to zero, and `transition-none` of Tailwind keeps the duration.
  if (style.transitionProperty !== 'none') {
    const properties = style.transitionProperty.split(',').length;
    look['transition-duration'] = valueOfEachProperty(style.transitionDuration, properties);
    look['transition-timing-function'] = valueOfEachProperty(
      style.transitionTimingFunction,
      properties,
    );
  }
  // The engine paints a native checkbox, and it paints none of these colors.
  if (style.appearance === 'auto' && element.matches('input[type=checkbox]')) {
    return look;
  }
  look.color = bytesOf(style.color);
  look['background-color'] = bytesOf(style.backgroundColor);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    // A border side with no width has a color, and it paints nothing.
    if (parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0) {
      look[`border-${side}-color`] = bytesOf(style.getPropertyValue(`border-${side}-color`));
    }
  }
  if (element.matches(':placeholder-shown')) {
    look['placeholder color'] = bytesOf(getComputedStyle(element, '::placeholder').color);
  }
  return look;
}

/** The look of each element of the frame, in the sequence of the document. */
function lookOfFrame(frame: Element) {
  return [...frame.querySelectorAll('*')].map((element) => ({
    tag: element.tagName.toLowerCase(),
    text: element.textContent.trim().slice(0, 20),
    look: lookOf(element),
  }));
}

type FrameLook = ReturnType<typeof lookOfFrame>;

function differences(cssModules: FrameLook, tailwind: FrameLook): string[] {
  expect(tailwind.map(({ tag }) => tag)).toEqual(cssModules.map(({ tag }) => tag));
  return cssModules.flatMap(({ tag, text, look }, index) => {
    const other = tailwind[index].look;
    return [...new Set([...Object.keys(look), ...Object.keys(other)])]
      .filter((name) => look[name] !== other[name])
      .map(
        (name) =>
          `<${tag}> "${text}" ${name}: ${look[name]} in the CSS-module demo, ${other[name]} in the Tailwind demo`,
      );
  });
}

const SEGMENT = 'input[role="spinbutton"]';
const SITE_FONT = "'Hanken Grotesk Variable'";

// Input scrollWidth excludes placeholders and adds two pixels in WebKit. Measure the text
// against the content box.
function segmentsWithCutText(frame: Element, state: string): string[] {
  const ruler = document.createElement('span');
  ruler.style.cssText = 'position: absolute; visibility: hidden; white-space: pre;';
  frame.append(ruler);
  const found = [...frame.querySelectorAll<HTMLInputElement>(SEGMENT)].flatMap((segment) => {
    const style = getComputedStyle(segment);
    // The `font` of a computed style is empty in Firefox when a part of it has no place in the
    // shorthand, such as `tabular-nums`.
    for (const name of [
      'fontFamily',
      'fontSize',
      'fontStretch',
      'fontStyle',
      'fontVariantNumeric',
      'fontWeight',
      'letterSpacing',
    ] as const) {
      ruler.style[name] = style[name];
    }
    const text = segment.value || segment.placeholder;
    ruler.textContent = text;
    const textWidth = ruler.getBoundingClientRect().width;
    const room =
      segment.getBoundingClientRect().width -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight) -
      parseFloat(style.borderLeftWidth) -
      parseFloat(style.borderRightWidth);
    return textWidth > room + 0.5
      ? [
          `${state}: "${text}" of the segment ${segment.dataset.type} is ${textWidth.toFixed(2)} px wide in ${room.toFixed(2)} px`,
        ]
      : [];
  });
  ruler.remove();
  return found;
}

async function pressInEachSegment(frame: Element, key: string, type?: string) {
  for (const segment of frame.querySelectorAll<HTMLInputElement>(SEGMENT)) {
    if (type === undefined || segment.dataset.type === type) {
      await fireEvent.keyDown(segment, { key });
    }
  }
  await flushMicrotasks();
}

function countDisabled(frame: Element) {
  return frame.querySelectorAll('[data-disabled]').length;
}

it("finds the demos of the components of Vase UI's own", () => {
  expect(demos).not.toHaveLength(0);
});

describe('look comparison', () => {
  const { render } = createRenderer();

  async function differencesOfStyles(cssModules: CSSProperties, tailwind: CSSProperties) {
    const frames = [
      await render(h('span', { style: cssModules }, 'Demo')),
      await render(h('span', { style: tailwind }, 'Demo')),
    ];
    return differences(lookOfFrame(frames[0].container), lookOfFrame(frames[1].container));
  }

  it.each([
    { name: 'transition-timing-function', first: 'ease', second: 'linear' },
    { name: 'transition-duration', first: '0.2s', second: '0.4s' },
    { name: 'text-decoration-line', first: 'none', second: 'underline' },
  ])('reports a difference in $name', async ({ name, first, second }) => {
    expect(await differencesOfStyles({ [name]: first }, { [name]: second })).toEqual([
      `<span> "Demo" ${name}: ${first} in the CSS-module demo, ${second} in the Tailwind demo`,
    ]);
  });

  const curve = 'cubic-bezier(0.4, 0, 0.2, 1)';
  const shorthand = { transition: `opacity 0.2s ${curve}, translate 0.2s ${curve}` };
  const longhands = { transitionProperty: 'opacity, translate', transitionDuration: '0.2s' };

  it('reports no difference when one variant repeats the values of a transition', async () => {
    expect(
      await differencesOfStyles(shorthand, { ...longhands, transitionTimingFunction: curve }),
    ).toEqual([]);
  });

  it('reports a difference in the second property of a transition', async () => {
    expect(
      await differencesOfStyles(shorthand, {
        ...longhands,
        transitionTimingFunction: `${curve}, linear`,
      }),
    ).toEqual([
      `<span> "Demo" transition-timing-function: ${curve}, ${curve} in the CSS-module demo, ${curve}, linear in the Tailwind demo`,
    ]);
  });

  it('reports no difference between two transitions that have no property', async () => {
    expect(
      await differencesOfStyles(
        { transition: 'none' },
        { transitionProperty: 'none', transitionDuration: '0.2s', transitionTimingFunction: curve },
      ),
    ).toEqual([]);
  });
});

describe.each(demos)('%s', (demo) => {
  const { render } = createRenderer();
  const states = ATTRIBUTE_STATES[demo.slice(0, demo.indexOf('/'))];

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  async function mount(variant: Variant, disabled: boolean) {
    // 2026-11-14 is a Saturday, so `calendar/disabled-dates` has a disabled today.
    mockToday('2026-11-14');
    const Demo = (await modules[`../../../docs/demos/${demo}/${variant}/index.vue`]()).default;
    // The root of some demos is a `<div>`, so `disabled` on the demo reaches no part. The parts read
    // the field instead, so the demo also goes inside a disabled field. The field has no box, so
    // the demo keeps its place in the frame.
    const content = disabled
      ? () =>
          h(Field.Root, { disabled: true, style: { display: 'contents' } }, () =>
            h(Demo, { disabled: true }),
          )
      : () => h(Demo);
    // As on a page, the frame is in `.Layout`.
    const { container, unmount, user } = await render(
      h(
        'div',
        { class: 'Layout' },
        h(DemoFrame, null, variant === 'tailwind' ? { tailwind: content } : { default: content }),
      ),
    );
    await SHOW_EACH_PART[demo]?.();
    return { frame: container.querySelector<HTMLElement>('.demo-frame')!, unmount, user };
  }

  /** The differences between the looks of the two variants. `prepare` changes each frame first. */
  async function differencesOf(disabled: boolean, prepare: (frame: Element) => void) {
    const looks: FrameLook[] = [];
    for (const variant of VARIANTS) {
      const { frame, unmount } = await mount(variant, disabled);
      prepare(frame);
      looks.push(lookOfFrame(frame));
      unmount();
    }
    return differences(looks[0], looks[1]);
  }

  // A root reads its size after the mount, and a handle then gets `data-at-min` or `data-at-max`.
  // Each case thus writes its own set, also the empty set of the state at rest.
  function writeAttributes(frame: Element, present: string[]) {
    if (states === undefined) {
      return;
    }
    const parts = frame.querySelectorAll(states.selector);
    expect(parts).not.toHaveLength(0);
    for (const part of parts) {
      for (const name of states.attributes) {
        part.toggleAttribute(name, present.includes(name));
      }
    }
  }

  function hasPart(part: string) {
    return sources[`../../../docs/demos/${demo}/css-modules/index.vue`]!.includes(`<${part}`);
  }

  /** Opens the popup of a demo that has one. */
  async function openPopupOf(frame: Element) {
    const trigger = frame.querySelector<HTMLElement>('[aria-haspopup]');
    if (trigger) {
      await fireEvent.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    }
  }

  /** Runs `check` on each variant of the demo, in a page that is `width` pixels wide. */
  async function inEachVariantAt(
    width: number,
    check: (frame: HTMLElement, variant: Variant) => Promise<void> | void,
  ) {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(width, 900);
    try {
      for (const variant of VARIANTS) {
        const { frame, unmount } = await mount(variant, false);
        await check(frame, variant);
        unmount();
      }
    } finally {
      await page.viewport(viewport.width, viewport.height);
    }
  }

  // The site shows the fallback font until its own font loads, and each has its own widths.
  // The third row has the letter spacing of WCAG 1.4.12, which a reader can set.
  it.each([
    { name: 'the font of the site', family: SITE_FONT, letterSpacing: 'normal' },
    { name: 'the fallback font', family: 'system-ui', letterSpacing: 'normal' },
    { name: 'wide letter spacing', family: SITE_FONT, letterSpacing: '0.12em' },
  ])('each segment has room for its text: $name', async ({ family, letterSpacing }) => {
    await document.fonts.load(`14px ${family}`);
    expect(document.fonts.check(`14px ${family}`)).toBe(true);
    const found: string[] = [];
    for (const variant of VARIANTS) {
      const { frame, unmount } = await mount(variant, false);
      Object.assign(frame.style, { fontFamily: family, letterSpacing });
      found.push(...segmentsWithCutText(frame, `${variant}, as mounted`));
      for (const hour of ['Home', 'End']) {
        await pressInEachSegment(frame, hour, 'hour');
        for (const step of ['first', 'second']) {
          await pressInEachSegment(frame, 'ArrowUp', 'dayPeriod');
          found.push(...segmentsWithCutText(frame, `${variant}, ${hour}, ${step} day period`));
        }
      }
      // A number has at most four digits, and each press removes one.
      for (let press = 0; press < 4; press += 1) {
        await pressInEachSegment(frame, 'Delete');
      }
      found.push(...segmentsWithCutText(frame, `${variant}, empty`));
      unmount();
    }

    expect(found).toEqual([]);
  });

  if (demo === 'date-picker/date-time') {
    it.each(VARIANTS)('keeps the other part of the date and time: %s', async (variant) => {
      const { frame, user } = await mount(variant, false);
      const group = within(frame).getByRole('group', { name: 'Meeting time' });
      const date = within(group).getByRole('group', { name: 'Date' });
      const time = within(group).getByRole('group', { name: 'Time' });
      const day = within(date).getByRole('spinbutton', { name: 'day' });
      const minute = within(time).getByRole('spinbutton', { name: 'minute' });
      const period = within(time).getByRole('spinbutton', { name: 'AM/PM' });
      const values = (root: Element) =>
        [...root.querySelectorAll<HTMLInputElement>(SEGMENT)].map((segment) => segment.value);

      expect(group).toHaveTextContent('Value: 2026-11-18T09:30:00');
      await fireEvent.keyDown(day, { key: 'ArrowUp' });
      expect(group).toHaveTextContent('Value: 2026-11-19T09:30:00');
      await fireEvent.keyDown(period, { key: 'ArrowUp' });
      expect(group).toHaveTextContent('Value: 2026-11-19T21:30:00');

      for (let press = 0; press < 2; press += 1) {
        await fireEvent.keyDown(day, { key: 'Delete' });
      }
      expect(group).toHaveTextContent('Value: none');
      expect(values(time)).toEqual(['9', '30', 'PM']);
      day.focus();
      await user.keyboard('21');
      expect(group).toHaveTextContent('Value: 2026-11-21T21:30:00');

      for (let press = 0; press < 2; press += 1) {
        await fireEvent.keyDown(minute, { key: 'Delete' });
      }
      expect(group).toHaveTextContent('Value: none');
      expect(values(date)).toEqual(['11', '21', '2026']);
      minute.focus();
      await user.keyboard('45');
      expect(group).toHaveTextContent('Value: 2026-11-21T21:45:00');

      const triggers = [...group.querySelectorAll<HTMLElement>('[aria-haspopup]')];
      expect(triggers).toHaveLength(2);
      await fireEvent.click(triggers[1]!);
      await waitFor(() => {
        expect(screen.getByRole('option', { name: '2:00 PM' })).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByRole('option', { name: '2:00 PM' }));
      expect(group).toHaveTextContent('Value: 2026-11-21T14:00:00');
      await fireEvent.click(triggers[0]!);
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Choose a meeting date' })).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByRole('button', { name: /November 25, 2026/ }));
      expect(group).toHaveTextContent('Value: 2026-11-25T14:00:00');
    });
  }

  if (hasPart('RangeCalendar.Root') || hasPart('DateRangePicker.Calendar')) {
    // A grid that is narrower than its month leaves a blank at one side of the days.
    it.each(VARIANTS)('each grid is as wide as its month: %s', async (variant) => {
      const { frame } = await mount(variant, false);
      await openPopupOf(frame);
      const grids = [...document.querySelectorAll('table')];
      expect(grids).not.toHaveLength(0);
      for (const grid of grids) {
        expect(grid.getBoundingClientRect().width).toBeCloseTo(
          grid.parentElement!.getBoundingClientRect().width,
          1,
        );
      }
    });
  }

  describe.each(['light', 'dark'] as const)('%s', (theme) => {
    if (demo === 'date-picker/date-time') {
      it.each([390, 1280])('the date is left of the time at %i px', async (width) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        await inEachVariantAt(width, (frame, variant) => {
          const date = within(frame).getByRole('group', { name: 'Date' }).getBoundingClientRect();
          const time = within(frame).getByRole('group', { name: 'Time' }).getBoundingClientRect();
          expect(date.top, variant).toBe(time.top);
          expect(date.right, variant).toBeLessThan(time.left);
        });
      });
    }

    if (hasPart('TimeClock.DayPeriod')) {
      it.each([390, 1280])('each day period has a whole border at %i px', async (width) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        await inEachVariantAt(width, async (frame, variant) => {
          await openPopupOf(frame);
          const buttons = ['AM', 'PM'].map((name) => screen.getByRole('button', { name }));
          for (const selected of buttons) {
            await fireEvent.click(selected);
            expect(selected).toHaveAttribute('aria-pressed', 'true');
            for (const button of buttons) {
              const style = getComputedStyle(button);
              for (const side of ['top', 'right', 'bottom', 'left']) {
                expect(
                  parseFloat(style.getPropertyValue(`border-${side}-width`)),
                  `${variant}: ${button.textContent} ${side} border`,
                ).toBeGreaterThan(0);
              }
            }
          }
        });
      });
    }

    if (hasPart('RangeCalendar.Root') || hasPart('DateRangePicker.Calendar')) {
      it.each([390, 1280])('the focus ring is above adjacent days at %i px', async (width) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        await inEachVariantAt(width, async (frame, variant) => {
          await waitForLaterMillisecond(() => openPopupOf(frame));
          const start = document.querySelector<HTMLButtonElement>('button[data-range-start]')!;
          const middle = document.querySelector<HTMLButtonElement>('button[data-range-middle]')!;
          start.focus();
          await userEvent.keyboard('{ArrowRight}');
          await waitFor(() => {
            expect(middle).toHaveFocus();
          });
          expect(middle.matches(':focus-visible'), variant).toBe(true);

          const style = getComputedStyle(middle);
          expect(style.position, variant).toBe('relative');
          expect(style.outlineStyle, variant).toBe('solid');
          expect(style.outlineWidth, variant).toBe('2px');
          expect(style.outlineOffset, variant).toBe('2px');
          const cell = middle.closest('td')!;
          const neighbours = [cell.previousElementSibling, cell.nextElementSibling];
          for (const neighbour of neighbours) {
            const button = neighbour!.querySelector('button')!;
            const zIndex = getComputedStyle(button).zIndex;
            expect(Number(style.zIndex), `${variant}: ${button.textContent}`).toBeGreaterThan(
              zIndex === 'auto' ? 0 : Number(zIndex),
            );
          }
        });
      });

      it.each([390, 1280])('the selected range has no gaps at %i px', async (width) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        await inEachVariantAt(width, async (frame, variant) => {
          await openPopupOf(frame);
          let pairs = 0;
          for (const row of document.querySelectorAll('tr')) {
            const middle = [...row.querySelectorAll('button[data-range-middle]')];
            for (const [index, button] of middle.entries()) {
              const next = middle[index + 1];
              if (!next) {
                continue;
              }
              pairs += 1;
              expect(
                Math.abs(button.getBoundingClientRect().right - next.getBoundingClientRect().left),
                `${variant}: ${button.textContent} to ${next.textContent}`,
              ).toBeLessThanOrEqual(0.1);
            }
          }
          expect(pairs).toBeGreaterThan(0);
        });
      });
    }

    it.each(
      subsets(states?.attributes ?? []).map((present) => ({
        present,
        name: present.join(' ') || 'at rest',
      })),
    )('the two variants have one look: $name', async ({ present }) => {
      document.documentElement.classList.toggle('dark', theme === 'dark');

      expect(await differencesOf(false, (frame) => writeAttributes(frame, present))).toEqual([]);
    });

    it('the two variants have one look: disabled', async () => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      const atRest = await mount('css-modules', false);
      const countAtRest = countDisabled(atRest.frame);
      atRest.unmount();
      const counts: number[] = [];

      const found = await differencesOf(true, (frame) => {
        counts.push(countDisabled(frame));
      });

      const hasDisabledState = !DEMOS_WITHOUT_DISABLED_STATE.has(demo);
      // The field of the case has `data-disabled` too.
      expect(counts.map((count) => count - 1 > countAtRest)).toEqual([
        hasDisabledState,
        hasDisabledState,
      ]);
      expect(found).toEqual([]);
    });
  });
});
