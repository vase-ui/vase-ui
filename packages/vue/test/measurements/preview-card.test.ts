// Measurements for PreviewCard, with native elements, plain Vue and Floating UI, and no code of the
// library. Each one states what the browser or Vue does, so that the family has code only where
// they do not do it. Where the browsers differ, the measurement states each one.
//
// P3. The window loses the focus and gets it back while a link has the focus: Playwright keeps each
// page in the focused state, so no event reaches the page, and no test can make the case.
//
// P9. Safari on macOS: the focus is in the address bar, and Tab (Option+Tab with the default system
// setting) moves it to a link of the page. A script cannot start the focus in the UI of the browser
// (P3), so a person reads `:focus-visible` in the `focusin` listener of the link. Not read yet.
import { computePosition, inline, type Middleware } from '@floating-ui/vue';
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureKeyedLink from '../fixtures/MeasureKeyedLink.vue';
import MeasureRemovedLink from '../fixtures/MeasureRemovedLink.vue';
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

const activeId = () => document.activeElement?.id || document.activeElement?.localName;

/** A link in a box 140 px wide. Each line of the link is 18 px high, in a line box of 24 px. */
const wrapped = (id: string, content: string) =>
  `<div style="width: 140px; font: 16px/24px sans-serif; margin: 20px"><a id="${id}" href="#${id}">${content}</a></div>`;

/** The count of lines: the count of different tops of the rectangles. */
function linesOf(target: Element) {
  return new Set([...target.getClientRects()].map((rect) => Math.round(rect.top))).size;
}

describe('the rectangles of a link that wraps (P1)', () => {
  test('one rectangle for each line of plain text; more than one for a line with elements in Chromium, and with text of two directions in Chromium and Firefox', () => {
    html(
      wrapped('plain', 'This is a long text that wraps across more lines') +
        wrapped('nested', 'This is <b>a long text</b> that wraps <i>across more</i> lines') +
        wrapped('bidi', 'This is שלום עולם a long text مرحبا بالعالم that wraps'),
    );
    const extra = (id: string) => element(id).getClientRects().length - linesOf(element(id));
    expect(linesOf(element('plain'))).toBeGreaterThan(2);
    expect({ plain: extra('plain'), nested: extra('nested') > 0, bidi: extra('bidi') > 0 }).toEqual(
      {
        plain: 0,
        nested: server.browser === 'chromium',
        bidi: server.browser !== 'webkit',
      },
    );
  });
});

describe(':focus-visible of a link in its `focusin` listener (P2)', () => {
  function recordFocusin() {
    const log: boolean[] = [];
    element('link').addEventListener('focusin', () =>
      log.push(element('link').matches(':focus-visible')),
    );
    return log;
  }
  const scene = `<button id="before">Before</button> <a id="link" href="#x" style="display: inline-block; padding: 10px">Link</a>`;
  // WebKit moves Tab to a link only with Option, by the default setting of macOS.
  const tab = server.browser === 'webkit' ? '{Alt>}{Tab}{/Alt}' : '{Tab}';

  test('is true after Tab from an element', async () => {
    html(scene);
    const log = recordFocusin();
    element('before').focus();
    await userEvent.keyboard(tab);
    expect(activeId()).toBe('link');
    expect(log).toEqual([true]);
  });

  test('is true after a key that moves the focus from no element, with no related target', async () => {
    html(
      `<div id="start" style="height: 20px"></div><a id="link" href="#x" style="display: inline-block; padding: 10px">Link</a>`,
    );
    const log: string[] = [];
    element('link').addEventListener('focusin', (event) =>
      log.push(`${element('link').matches(':focus-visible')} ${event.relatedTarget === null}`),
    );
    await userEvent.click(element('start'));
    expect(activeId()).toBe('body');
    await userEvent.keyboard(tab);
    expect(log).toEqual(['true true']);
  });

  test('of focus() follows the last input: true after a key, false after a mouse press', async () => {
    html(scene);
    const log = recordFocusin();
    element('before').focus();
    await userEvent.keyboard('{Shift}');
    element('link').focus();
    element('link').blur();
    await userEvent.click(element('before'));
    element('link').focus();
    expect(log).toEqual([true, false]);
  });

  test('a mouse click on the link moves the focus to it with no :focus-visible in Chromium and Firefox, and moves no focus in WebKit', async () => {
    html(scene);
    const log = recordFocusin();
    await userEvent.click(element('link'));
    expect(log).toEqual(server.browser === 'webkit' ? [] : [false]);
  });
});

describe('inline() of Floating UI (P4)', () => {
  const round = (rect: { x: number; y: number; width: number; height: number }) =>
    [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(',');

  async function anchorOf(
    reference: Element | { getBoundingClientRect(): DOMRect; getClientRects?(): DOMRect[] },
    placement: 'bottom' | 'top' | 'left' | 'right',
    point?: { x: number; y: number },
  ) {
    let rect = '';
    let runs = 0;
    const probe: Middleware = {
      name: 'probe',
      fn(state) {
        runs += 1;
        rect = round(state.rects.reference);
        return {};
      },
    };
    await computePosition(reference as Element, element('floating'), {
      placement,
      middleware: [inline(point), probe],
    });
    return { rect, runs };
  }

  const floating = `<div id="floating" style="position: absolute; left: 0; top: 0; width: 80px; height: 40px"></div>`;
  const centerOfLine = (rect: DOMRect) => ({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });
  const join = (first: DOMRect, last: DOMRect, from: DOMRect) =>
    round({ x: from.left, y: first.top, width: from.width, height: last.bottom - first.top });

  test('gives the side rectangle of a link of more lines, and a point on the second line changes nothing', async () => {
    html(wrapped('three', 'This is a long text that wraps across more lines') + floating);
    const lines = [...element('three').getClientRects()];
    const first = lines[0]!;
    const last = lines.at(-1)!;
    for (const point of [undefined, centerOfLine(lines[1]!)]) {
      expect((await anchorOf(element('three'), 'bottom', point)).rect).toBe(
        join(first, last, last),
      );
      expect((await anchorOf(element('three'), 'top', point)).rect).toBe(join(first, last, first));
    }
  });

  test('gives the side rectangle of a link of two lines that overlap on the x axis, with a point on the second line', async () => {
    html(
      `<div style="width: 300px; font: 16px/24px sans-serif; margin: 20px">Some words <a id="two" href="#two">a link of two lines that overlap on the x axis because it is long</a> and the rest.</div>${floating}`,
    );
    const [first, second] = [...element('two').getClientRects()];
    expect(linesOf(element('two'))).toBe(2);
    expect(first!.left).toBeLessThan(second!.right);
    expect((await anchorOf(element('two'), 'bottom', centerOfLine(second!))).rect).toBe(
      join(first!, second!, second!),
    );
  });

  test('selects the part of a link of two parts that do not overlap by the point', async () => {
    html(
      `<div style="width: 300px; font: 16px/24px sans-serif; margin: 20px">Some words that fill the line <a id="parts" href="#parts">a link of two parts</a> and the rest of the text.</div>${floating}`,
    );
    const [first, second] = [...element('parts').getClientRects()];
    expect(first!.left).toBeGreaterThan(second!.right);
    expect((await anchorOf(element('parts'), 'bottom', centerOfLine(second!))).rect).toBe(
      round(second!),
    );
  });

  test('takes the one line of a virtual anchor, resets nothing for a link of one line, and gives no error for a virtual anchor with no getClientRects()', async () => {
    html(
      wrapped('three', 'This is a long text that wraps across more lines') +
        `<a id="one" href="#one" style="margin: 50px; display: inline-block">One line</a>${floating}`,
    );
    const second = element('three').getClientRects()[1]!;
    const virtual = {
      getBoundingClientRect: () => element('three').getBoundingClientRect(),
      getClientRects: () => [second],
    };
    expect((await anchorOf(virtual, 'bottom')).rect).toBe(round(second));
    expect((await anchorOf(element('one'), 'bottom')).runs).toBe(1);
    await expect(
      anchorOf({ getBoundingClientRect: () => element('one').getBoundingClientRect() }, 'bottom'),
    ).resolves.toBeTruthy();
  });
});

describe('a mouse that moves down a wrapped link (P5)', () => {
  test('leaves the link in the space between two lines, and enters it again at the next line, with the pointer type `mouse`', async () => {
    html(wrapped('link', 'This is a long text that wraps across more lines'));
    const log: string[] = [];
    for (const type of ['pointerenter', 'pointerleave']) {
      element('link').addEventListener(type, (event) =>
        log.push(`${type} ${(event as PointerEvent).pointerType}`),
      );
    }
    const [first, second] = [...element('link').getClientRects()];
    const x = first!.left + 10;
    const points = [];
    for (let y = first!.top + 4; y <= second!.top + 4; y += 1) points.push({ coords: { x, y } });
    await userEvent.pointer(points);
    expect(second!.top - first!.bottom).toBeGreaterThan(0);
    expect(log.filter((entry, index) => entry !== log[index - 1])).toEqual([
      'pointerenter mouse',
      'pointerleave mouse',
      'pointerenter mouse',
    ]);
  });
});

describe('a mouse press on text of a box while a link has the focus (P6)', () => {
  test.each([
    { tabindex: false, related: 'null', after: 'body' },
    { tabindex: true, related: 'card', after: 'card' },
  ])(
    'with tabindex="-1" $tabindex: `focusout` of the link has the related target $related, the active element in the listener is <body>, and after it $after',
    async ({ tabindex, related, after }) => {
      html(`<a id="link" href="#x">Link</a>
        <div id="card" ${tabindex ? 'tabindex="-1"' : ''} style="position: fixed; left: 100px; top: 100px; width: 200px; height: 100px">Some text of the card</div>`);
      element('link').focus();
      const log: string[] = [];
      element('link').addEventListener('focusout', (event) =>
        log.push(`${(event.relatedTarget as Element | null)?.id ?? 'null'} ${activeId()}`),
      );
      await userEvent.pointer({ coords: { x: 150, y: 120 }, keys: '[MouseLeft]' });
      expect(log).toEqual([`${related} body`]);
      expect(activeId()).toBe(after);
    },
  );
});

describe('pointerenter while a mouse moves in one element (P7)', () => {
  test('comes one time in Firefox and WebKit, and can come again at each move in Chromium', async () => {
    html(
      `<a id="link" href="#x" style="position: fixed; left: 100px; top: 100px; display: block; width: 200px; height: 40px">Link</a>`,
    );
    await userEvent.pointer({ coords: { x: 90, y: 120 } });
    let enters = 0;
    element('link').addEventListener('pointerenter', () => (enters += 1));
    await userEvent.pointer([100, 110, 120, 130, 140, 150].map((x) => ({ coords: { x, y: 120 } })));
    if (server.browser === 'chromium') expect(enters).toBeGreaterThanOrEqual(1);
    else expect(enters).toBe(1);
  });
});

describe('the point of pointerenter on a wrapped link (P8)', () => {
  test.each(['above', 'below', 'left', 'right'] as const)(
    'from %s is in the rectangle of its line, with no tolerance',
    async (from) => {
      html(wrapped('link', 'This is a long text that wraps across more lines'));
      const lines = [...element('link').getClientRects()];
      const index = from === 'above' ? 0 : from === 'below' ? lines.length - 1 : 1;
      const line = lines[index]!;
      const middle = line.top + line.height / 2;
      const path = {
        above: [
          { x: line.left + 10, y: line.top - 6 },
          { x: line.left + 10, y: line.top + 6 },
        ],
        below: [
          { x: line.left + 10, y: line.bottom + 6 },
          { x: line.left + 10, y: line.bottom - 6 },
        ],
        left: [
          { x: line.left - 6, y: middle },
          { x: line.left + 6, y: middle },
        ],
        right: [
          { x: line.right + 6, y: middle },
          { x: line.right - 6, y: middle },
        ],
      }[from];
      const points: { x: number; y: number }[] = [];
      for (let step = 0; step <= 12; step += 1) {
        points.push({
          x: path[0]!.x + ((path[1]!.x - path[0]!.x) * step) / 12,
          y: path[0]!.y + ((path[1]!.y - path[0]!.y) * step) / 12,
        });
      }
      const entered: number[] = [];
      element('link').addEventListener(
        'pointerenter',
        (event) => {
          entered.push(
            lines.findIndex(
              (rect) =>
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom,
            ),
          );
        },
        { once: true },
      );
      await userEvent.pointer(points.map((coords) => ({ coords })));
      expect(entered).toEqual([index]);
    },
  );
});

describe('a link that a `v-if` with a new `key` replaces in one update (Q1)', () => {
  test('a `flush: post` watcher of "a mounted link has the id" reads no `false`; the removal of the link gives `false`', async () => {
    const scene = reactive({ shown: true, key: 0 });
    const log: boolean[] = [];
    mount(MeasureKeyedLink, { scene, log: { add: (value: boolean) => log.push(value) } });
    await nextTick();
    expect(log).toEqual([true]);
    log.length = 0;
    scene.key += 1;
    await nextTick();
    await nextTick();
    expect(log).toEqual([]);
    scene.shown = false;
    await nextTick();
    expect(log).toEqual([false]);
  });
});

describe('a kept element that leaves with CSS (Q2)', () => {
  test('a transition on [hidden] gives a running animation during the exit', async () => {
    html(`<style>
      #kept { transition: opacity 300ms }
      #kept[hidden] { display: block; opacity: 0 }
    </style><div id="kept">Kept</div>`);
    element('kept').getBoundingClientRect();
    element('kept').hidden = true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(
      element('kept')
        .getAnimations()
        .map((animation) => animation.playState),
    ).toEqual(['running']);
  });

  test('an animation that fills forwards is in getAnimations() after its end, and it is not running', async () => {
    html(`<style>
      @keyframes out { to { opacity: 0 } }
      #kept[hidden] { display: block; animation: out 50ms forwards }
    </style><div id="kept" hidden>Kept</div>`);
    const [animation] = element('kept').getAnimations();
    expect(animation?.playState).toBe('running');
    await animation!.finished;
    expect(
      element('kept')
        .getAnimations()
        .map((each) => each.playState),
    ).toEqual(['finished']);
  });
});

describe('a focused link that Vue removes (Q3)', () => {
  test('gets `focusout` only in Chromium, after the scope of its component stopped, while it is in the document; one task later it is out of the document', async () => {
    const scene = reactive({ shown: true });
    const log: string[] = [];
    mount(MeasureRemovedLink, { scene, log: { add: (entry: string) => log.push(entry) } });
    element('removed').focus();
    scene.shown = false;
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(log).toEqual([
      'scope stopped',
      ...(server.browser === 'chromium'
        ? ['focusout connected=true', 'a task later connected=false']
        : []),
    ]);
  });
});
