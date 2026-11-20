// Measurements for Tooltip, with native elements and plain Vue, and no code of the library. Each
// one states what the browser or Vue does, so that Tooltip has code only where they do not do it.
// Where the browsers differ, the measurement states each one.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureTooltipLeave from '../fixtures/MeasureTooltipLeave.vue';
import { touchDrag } from '../pointer';
import { mount } from '../render';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
});

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

/** The types of the events that reach `target`, each one time, in their order. */
function record(target: EventTarget, types: string[]) {
  const log: string[] = [];
  for (const type of types) {
    target.addEventListener(type, () => {
      if (!log.includes(type)) log.push(type);
    });
  }
  return log;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const BOX = 'display: block; width: 120px; height: 40px';

describe('a mouse on a disabled control (T1)', () => {
  test.each([
    ['a <button disabled>', `<button id="t" disabled style="${BOX}">x</button>`],
    [
      'a <button> in <fieldset disabled>',
      `<fieldset disabled style="border: 0; margin: 0; padding: 0"><button id="t" style="${BOX}">x</button></fieldset>`,
    ],
    ['an <input disabled>', `<input id="t" disabled style="${BOX}">`],
  ])('%s gets each pointer event of a hover, and no click', async (_, markup) => {
    html(`<div id="parent">${markup}</div><button id="away">Away</button>`);
    const types = ['pointerover', 'pointerenter', 'pointermove', 'pointerleave', 'click'];
    const own = record(element('t'), types);
    const bubbled: string[] = [];
    element('parent').addEventListener('pointerover', (event) => {
      if (event.target === element('t')) bubbled.push('pointerover');
    });
    await userEvent.hover(element('t'));
    await userEvent.click(element('t'), { force: true });
    await userEvent.hover(element('away'));
    expect(own).toEqual(['pointerover', 'pointerenter', 'pointermove', 'pointerleave']);
    expect(bubbled).toEqual(['pointerover']);
  });
});

describe('`:focus-visible` at `focusin` (T2, T3, T9)', () => {
  test('a Tab to a control gives it `:focus-visible` at `focusin`', async () => {
    html(
      `<button id="start">Start</button><input id="input" aria-label="Input"><span id="span" tabindex="0">x</span><button id="button">x</button>`,
    );
    const log: string[] = [];
    for (const id of ['input', 'span', 'button']) {
      element(id).addEventListener('focusin', () =>
        log.push(`${id} ${element(id).matches(':focus-visible')}`),
      );
    }
    element('start').focus();
    await userEvent.keyboard('{Tab}');
    await userEvent.keyboard('{Tab}');
    await userEvent.keyboard('{Tab}');
    expect(log).toEqual(['input true', 'span true', 'button true']);
  });

  test('a press gives a `<button>`, a link and a `<span tabindex="0">` no `:focus-visible`, and an `<input>` gets it; `pointerdown` comes before `focusin`', async () => {
    html(`<button id="button" style="${BOX}">x</button><a id="link" href="#x" style="${BOX}">x</a>
      <span id="span" tabindex="0" style="${BOX}">x</span><input id="input" aria-label="Input" style="${BOX}">`);
    const log: string[] = [];
    for (const id of ['button', 'link', 'span', 'input']) {
      element(id).addEventListener('pointerdown', () => log.push(`${id} pointerdown`));
      element(id).addEventListener('focusin', () =>
        log.push(`${id} focusin ${element(id).matches(':focus-visible')}`),
      );
      element(id).addEventListener('click', (event) => event.preventDefault());
      await userEvent.click(element(id));
    }
    // WebKit on macOS gives a button and a link no focus at a press, and WebKit on Linux gives it.
    const focusOfLink = (entry: string) => /^(button|link) focusin/.test(entry);
    expect(log.filter((entry) => !focusOfLink(entry))).toEqual([
      'button pointerdown',
      'link pointerdown',
      'span pointerdown',
      'span focusin false',
      'input pointerdown',
      'input focusin true',
    ]);
    for (const id of ['button', 'link']) {
      const next = log[log.indexOf(`${id} pointerdown`) + 1];
      if (next !== undefined && focusOfLink(next)) expect(next).toBe(`${id} focusin false`);
    }
  });
});

describe('a tap (T9)', () => {
  // Only Chromium has the protocol of a real touch in the test browsers.
  test.skipIf(server.browser !== 'chromium')(
    'a tap on an <input> gives `pointerdown` before `focusin`, and the input matches `:focus-visible`',
    async () => {
      html(`<input id="t" aria-label="T" style="${BOX}">`);
      const log: string[] = [];
      element('t').addEventListener('pointerdown', (event) =>
        log.push(`pointerdown ${event.pointerType}`),
      );
      element('t').addEventListener('focusin', () =>
        log.push(`focusin ${element('t').matches(':focus-visible')}`),
      );
      const rect = element('t').getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      await touchDrag(center, center, 0);
      await sleep(50);
      expect(log).toEqual(['pointerdown touch', 'focusin true']);
    },
  );
});

describe('a trigger in a trigger (T4)', () => {
  test('`pointerover` and `focusin` reach the inner element first and the outer one with the same event object, also across an open shadow root; the outer gets no `pointerleave` while the pointer is on the inner one', async () => {
    html(`<div id="outer" tabindex="-1" style="display: block; width: 300px; height: 80px"><span id="host" style="display: inline-block; width: 100px; height: 80px"></span></div>
      <button id="away">Away</button>`);
    const inner = element('host').attachShadow({ mode: 'open' });
    inner.innerHTML =
      '<button id="inner" style="display: block; width: 100px; height: 80px">x</button>';
    const innerButton = inner.getElementById('inner')!;
    const marked = new WeakSet<Event>();
    const log: string[] = [];
    for (const type of ['pointerover', 'focusin']) {
      innerButton.addEventListener(type, (event) => marked.add(event));
    }
    for (const type of ['pointerover', 'pointerleave', 'focusin']) {
      element('outer').addEventListener(type, (event) =>
        log.push(`${type} ${(event.target as Element).id} ${marked.has(event)}`),
      );
    }
    await userEvent.hover(element('outer'), { position: { x: 250, y: 40 } });
    log.length = 0;
    await userEvent.hover(innerButton);
    innerButton.focus();
    await userEvent.hover(element('outer'), { position: { x: 250, y: 40 } });
    await userEvent.hover(element('away'));
    expect(log).toEqual([
      'pointerover host true',
      'focusin host true',
      'pointerover outer false',
      'pointerleave outer false',
    ]);
  });
});

describe('a key on a focused button (T5)', () => {
  test('Enter and Space give one `click` each with `detail` 0, and no `pointerdown`', async () => {
    html('<button id="t">x</button>');
    const log: string[] = [];
    element('t').addEventListener('pointerdown', () => log.push('pointerdown'));
    element('t').addEventListener('click', (event) => log.push(`click ${event.detail}`));
    element('t').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(log).toEqual(['click 0', 'click 0']);
  });
});

describe('a press after the focus (T6)', () => {
  test('a press on an element with no tab stop gives `focusout` with no related target and leaves the focus on <body>; with `tabindex="-1"`, the element is the related target', async () => {
    html(
      `<input id="t" aria-label="T"><div id="text" style="${BOX}">text</div><div id="popup" tabindex="-1" style="${BOX}">text</div>`,
    );
    const log: string[] = [];
    element('t').addEventListener('focusout', (event) =>
      log.push((event.relatedTarget as Element | null)?.id ?? 'null'),
    );
    element('t').focus();
    await userEvent.click(element('text'));
    expect(document.activeElement).toBe(document.body);
    element('t').focus();
    await userEvent.click(element('popup'));
    expect(log).toEqual(['null', 'popup']);
    expect(document.activeElement).toBe(element('popup'));
  });
});

describe('`data-instant` and a leave of Vue (T7, T8)', () => {
  test.each(['fade', 'spin'] as const)(
    '%s: an attribute that is on the element before the leave gives a leave of no time',
    async (name) => {
      const scene = reactive({ open: true, portal: true, name });
      mount(MeasureTooltipLeave, { scene });
      await nextTick();
      const tip = document.querySelector<HTMLElement>('.measure-tip')!;
      tip.setAttribute('data-instant', 'delay');
      scene.open = false;
      await nextTick();
      await sleep(500);
      expect(tip.isConnected).toBe(false);
    },
  );

  test('an attribute that comes in the leave of a CSS animation shows the element again, and Vue removes it only at the end of its timer', async () => {
    const scene = reactive({ open: true, portal: true, name: 'spin' as const });
    mount(MeasureTooltipLeave, { scene });
    await nextTick();
    const tip = document.querySelector<HTMLElement>('.measure-tip')!;
    scene.open = false;
    await nextTick();
    await sleep(200);
    tip.setAttribute('data-instant', 'delay');
    await sleep(300);
    expect(getComputedStyle(tip).opacity).toBe('1');
    expect(tip.isConnected).toBe(true);
  });

  test('a `v-if` that removes the `<Teleport>` removes the element that leaves in that update', async () => {
    const scene = reactive({ open: true, portal: true, name: 'fade' as const });
    mount(MeasureTooltipLeave, { scene });
    await nextTick();
    const tip = document.querySelector<HTMLElement>('.measure-tip')!;
    scene.open = false;
    await nextTick();
    await sleep(100);
    expect(tip.isConnected).toBe(true);
    scene.portal = false;
    await nextTick();
    expect(tip.isConnected).toBe(false);
    expect(document.querySelector('.measure-positioner')).toBe(null);
  });
});

describe('the window that loses the focus (TN1)', () => {
  // A window that loses the focus needs a headed browser with two windows. The test browsers run
  // headless, and each page keeps the focus, so `Tooltip.test.ts` sends the events of that case.
  test('a headless browser keeps the focus of the page', () => {
    html('<button id="t">x</button>');
    element('t').focus();
    expect(document.hasFocus()).toBe(true);
    expect(document.activeElement).toBe(element('t'));
  });
});
