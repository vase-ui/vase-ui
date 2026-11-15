/// <reference types="vite/client" />
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, holdPress, screen, waitFor } from '#test-utils';
import DemoFrame from '../../../docs/.vitepress/components/DemoFrame.vue';
import '../../../docs/.vitepress/theme/tokens.css';
import '../../../docs/.vitepress/theme/look.css';
import '../../../docs/demos/tailwind.css';

// Each demo of a row. A demo with a Tailwind file gets the cases of that file too.
const modules = import.meta.glob<{ default: Component }>(
  [
    '../../../docs/demos/alert-dialog/hero/{css-modules,tailwind}/index.vue',
    '../../../docs/demos/autocomplete/fuzzy-matching/{css-modules,tailwind}/index.vue',
    '../../../docs/demos/combobox/async-single/{css-modules,tailwind}/index.vue',
    '../../../docs/demos/combobox/input-inside-popup/{css-modules,tailwind}/index.vue',
    '../../../docs/demos/date-field/date-time/{css-modules,tailwind}/index.vue',
    '../../../docs/demos/navigation-menu/hero/{css-modules,tailwind}/index.vue',
    '../../../docs/demos/select/hero/{css-modules,tailwind}/index.vue',
    '../../../docs/demos/select/object-values/{css-modules,tailwind}/index.vue',
  ],
  { eager: true },
);

type Rgba = [number, number, number, number];

// A 2D canvas gives the sRGB bytes of each color form that an engine writes, `oklch()` included.
const canvasContext = document
  .createElement('canvas')
  .getContext('2d', { willReadFrequently: true })!;

function rgbaOf(color: string): Rgba {
  canvasContext.clearRect(0, 0, 1, 1);
  canvasContext.fillStyle = color;
  canvasContext.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = canvasContext.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a];
}

function blendOver([r1, g1, b1, a1]: Rgba, [r2, g2, b2]: Rgba): Rgba {
  const alpha = a1 / 255;
  return [
    r1 * alpha + r2 * (1 - alpha),
    g1 * alpha + g2 * (1 - alpha),
    b1 * alpha + b2 * (1 - alpha),
    255,
  ];
}

function luminance([r, g, b]: Rgba): number {
  const [x, y, z] = [r, g, b].map((byte) => {
    const value = byte / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * x + 0.7152 * y + 0.0722 * z;
}

// The layers behind a text: the background of its element and of each ancestor, and the background
// of an absolute `::before` or `::after` of each. A sheet paints the highlight of an item with such
// a pseudo-element. The walk stops at the first opaque background.
function backgroundOf(element: Element): Rgba {
  const layers: Rgba[] = [];
  for (let node: Element | null = element; node; node = node.parentElement) {
    for (const pseudo of ['::after', '::before']) {
      const style = getComputedStyle(node, pseudo);
      if (style.content !== 'none' && style.content !== 'normal' && style.position === 'absolute') {
        const color = rgbaOf(style.backgroundColor);
        if (color[3] > 0) {
          layers.push(color);
        }
      }
    }
    const color = rgbaOf(getComputedStyle(node).backgroundColor);
    if (color[3] > 0) {
      layers.push(color);
    }
    if (color[3] === 255) {
      break;
    }
  }
  return layers.reduceRight<Rgba>((below, layer) => blendOver(layer, below), [255, 255, 255, 255]);
}

// The colors of the text of an element and of the background behind it. The selected text of the
// focused input keeps its own color, and the highlight of `::selection` goes over the background.
// Chromium reports another color for a `::selection` that has a rule and no color.
function paintOf(element: Element) {
  const background = backgroundOf(element);
  const color = getComputedStyle(element).color;
  if (
    element instanceof HTMLInputElement &&
    element === document.activeElement &&
    element.selectionStart !== element.selectionEnd
  ) {
    const highlight = rgbaOf(getComputedStyle(element, '::selection').backgroundColor);
    return { text: color, background: blendOver(highlight, background) };
  }
  return { text: color, background };
}

/** The text of `root` that has the lowest WCAG contrast against the background behind it. */
function lowestContrastIn(root: Element) {
  const readings = [root, ...root.querySelectorAll('*')]
    .filter((element) =>
      element instanceof HTMLInputElement
        ? element.value !== ''
        : [...element.childNodes].some(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          ),
    )
    .map((element) => {
      const paint = paintOf(element);
      const text = luminance(blendOver(rgbaOf(paint.text), paint.background));
      const behind = luminance(paint.background);
      return {
        text: element instanceof HTMLInputElement ? element.value : element.textContent.trim(),
        ratio: (Math.max(text, behind) + 0.05) / (Math.min(text, behind) + 0.05),
      };
    });
  expect(readings).not.toHaveLength(0);
  return readings.reduce((lowest, reading) => (reading.ratio < lowest.ratio ? reading : lowest));
}

function demoPath(demo: string, variant: string) {
  return `../../../docs/demos/${demo}/${variant}/index.vue`;
}

function highlightedItem() {
  return waitFor(() => {
    const item = document.querySelector('[data-vase-ui-portal] [data-highlighted]');
    expect(item).toBeInTheDocument();
    return item!;
  });
}

async function hover(element: Element) {
  await userEvent.hover(element);
  await waitFor(() => {
    expect(element.matches(':hover')).toBe(true);
  });
  return element;
}

async function press(element: Element) {
  await holdPress(element);
  await waitFor(() => {
    expect(element.matches(':active')).toBe(true);
  });
  return element;
}

async function typeInto(input: HTMLElement, text: string) {
  input.focus();
  await userEvent.keyboard(text);
  await waitFor(() => {
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });
}

// Each row gives the element whose text the case measures, in the state of its name. A real press
// gives the document the input modality of a mouse, so the rows with a press come after the rows
// that use the keyboard.
const rows: { name: string; demo: string; reach: () => Promise<Element> }[] = [
  {
    name: 'placeholder of Select on hover',
    demo: 'select/hero',
    reach: () => hover(screen.getByRole('combobox')),
  },
  {
    name: 'placeholder of Combobox on hover',
    demo: 'combobox/input-inside-popup',
    reach: () => hover(screen.getByRole('combobox')),
  },
  {
    name: 'description of a highlighted item',
    demo: 'autocomplete/fuzzy-matching',
    async reach() {
      await typeInto(screen.getByRole('combobox'), 'a');
      await userEvent.keyboard('{ArrowDown}');
      return highlightedItem();
    },
  },
  {
    name: 'subtitle of a highlighted item',
    demo: 'combobox/async-single',
    async reach() {
      // The demo fails a search 1 time in 100 at random, and a failed search shows no item.
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      onTestFinished(() => {
        random.mockRestore();
      });
      await typeInto(screen.getByRole('combobox'), 'a');
      await userEvent.keyboard('{ArrowDown}');
      return highlightedItem();
    },
  },
  {
    name: 'description in a dark highlight',
    demo: 'select/object-values',
    async reach() {
      screen.getByRole('combobox').focus();
      await userEvent.keyboard('{ArrowDown}');
      return highlightedItem();
    },
  },
  {
    name: 'selected text of a focused segment',
    demo: 'date-field/date-time',
    async reach() {
      const segment = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
      segment.focus();
      await waitFor(() => {
        expect(segment.selectionEnd).toBeGreaterThan(0);
      });
      return segment;
    },
  },
  {
    name: 'link description on hover',
    demo: 'navigation-menu/hero',
    async reach() {
      await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
      const link = await waitFor(() => {
        const element = document.querySelector('[data-vase-ui-portal] a[href]');
        expect(element).toBeInTheDocument();
        return element!;
      });
      return hover(link);
    },
  },
  {
    name: 'placeholder of a pressed open trigger',
    demo: 'combobox/input-inside-popup',
    async reach() {
      const trigger = screen.getByRole('combobox');
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
      // The press of the open trigger closes the popup. The sheet gives the color of `data-pressed`
      // to an open trigger, and that color wins over the color of `:active`.
      await press(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
      return trigger;
    },
  },
  {
    name: 'red button in the frame while pressed',
    demo: 'alert-dialog/hero',
    reach: () => press(screen.getByRole('button', { name: 'Discard draft' })),
  },
  {
    name: 'red button in a popup while pressed',
    demo: 'alert-dialog/hero',
    async reach() {
      await userEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
      const button = await waitFor(() => screen.getByRole('button', { name: 'Discard' }));
      return press(button);
    },
  },
];

const cases = rows.flatMap((row) =>
  (['css-modules', 'tailwind'] as const)
    .filter((variant) => variant === 'css-modules' || modules[demoPath(row.demo, variant)])
    .flatMap((variant) =>
      (['light', 'dark'] as const).map((theme) => ({
        ...row,
        variant,
        theme,
        Demo: modules[demoPath(row.demo, variant)]!.default,
      })),
    ),
);

describe('the text of a demo has a contrast of 4.5:1 or more', () => {
  const { render } = createRenderer();

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it.each(cases)('$name ($variant, $theme)', async (row) => {
    document.documentElement.classList.toggle('dark', row.theme === 'dark');
    await render(
      h(
        'div',
        { class: 'Layout' },
        h(
          DemoFrame,
          null,
          row.variant === 'tailwind'
            ? { tailwind: () => h(row.Demo) }
            : { default: () => h(row.Demo) },
        ),
      ),
    );

    const lowest = lowestContrastIn(await row.reach());

    expect(lowest.ratio, lowest.text).toBeGreaterThanOrEqual(4.5);
  });
});
