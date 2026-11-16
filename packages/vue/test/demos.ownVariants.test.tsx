/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, fireEvent, screen, waitFor } from '#test-utils';
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

type Variant = 'css-modules' | 'tailwind';
const VARIANTS: Variant[] = ['css-modules', 'tailwind'];

/**
 * The states that a part has from data attributes that only a pointer or a layout gives. The test
 * writes each set of the attributes on each element of the selector.
 */
const ATTRIBUTE_STATES: Record<string, { selector: string; attributes: string[] } | undefined> = {
  resizable: {
    selector: '[role="separator"], [data-vase-ui-resizable-edge]',
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

function lookOf(element: Element): Record<string, string> {
  const style = getComputedStyle(element);
  // The clip of a hidden input of a part leaves nothing to paint. The reset of Tailwind changes the
  // colors of the input, and the frame of a CSS-module demo has no reset.
  if (style.clipPath === 'inset(50%)') {
    return {};
  }
  const look: Record<string, string> = {
    cursor: style.cursor,
    'transition-timing-function': style.transitionTimingFunction,
    'transition-duration': style.transitionDuration,
    'text-decoration-line': style.textDecorationLine,
  };
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

function countDisabled(frame: Element) {
  return frame.querySelectorAll('[data-disabled]').length;
}

it("finds the demos of the components of Vase UI's own", () => {
  expect(demos).not.toHaveLength(0);
});

describe('look comparison', () => {
  const { render } = createRenderer();

  it.each([
    { name: 'transition-timing-function', first: 'ease', second: 'linear' },
    { name: 'transition-duration', first: '0.2s', second: '0.4s' },
    { name: 'text-decoration-line', first: 'none', second: 'underline' },
  ])('reports a difference in $name', async ({ name, first, second }) => {
    const cssModules = await render(<span style={{ [name]: first }}>Demo</span>);
    const tailwind = await render(<span style={{ [name]: second }}>Demo</span>);

    expect(differences(lookOfFrame(cssModules.container), lookOfFrame(tailwind.container))).toEqual(
      [`<span> "Demo" ${name}: ${first} in the CSS-module demo, ${second} in the Tailwind demo`],
    );
  });
});

describe.each(demos)('%s', (demo) => {
  const { render } = createRenderer();
  const states = ATTRIBUTE_STATES[demo.slice(0, demo.indexOf('/'))];

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  async function mount(variant: Variant, disabled: boolean) {
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
    const { container, unmount } = await render(
      h(
        'div',
        { class: 'Layout' },
        h(DemoFrame, null, variant === 'tailwind' ? { tailwind: content } : { default: content }),
      ),
    );
    await SHOW_EACH_PART[demo]?.();
    return { frame: container.querySelector('.demo-frame')!, unmount };
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

  describe.each(['light', 'dark'] as const)('%s', (theme) => {
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
