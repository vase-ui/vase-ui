// Measurements for the popup layer, with native elements, plain Vue and Floating UI, and no code of
// the library. Each one states what the browser or Vue does, so that the layer has code only where
// they do not do it. Where the browsers differ, the measurement states each one. Vue does not patch
// an element that leaves in a `<Transition>`: see `tabs.test.ts`.
import { afterEach, describe, expect, inject, onTestFinished, test } from 'vitest';
import { page, server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureFirstFrame from '../fixtures/MeasureFirstFrame.vue';
import MeasurePortalOrder from '../fixtures/MeasurePortalOrder.vue';
import MeasureTransitionMount from '../fixtures/MeasureTransitionMount.vue';
import MeasureTransitionReopen from '../fixtures/MeasureTransitionReopen.vue';
import { createScrollDocument } from '../fixtures/scrollDocument';
import { holdPress, stopFling, touchDrag } from '../pointer';
import { mount } from '../render';
import { tabbables } from '../../src/popup/focus';

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

function record(target: EventTarget, types: string[]) {
  const log: string[] = [];
  for (const type of types) {
    target.addEventListener(
      type,
      (event) =>
        log.push(`${type} ${(event.target as Element).id || (event.target as Element).localName}`),
      true,
    );
  }
  return log;
}

async function nextFrame() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

function centerOf(target: Element) {
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('Tab after a key listener moved the focus', () => {
  test('goes on from the element that has the focus: a listener on Tab that moves the focus and lets the key go on sends the focus past that element', async () => {
    html(`<input id="trigger" aria-label="Trigger"><input id="after" aria-label="After">
      <div id="popup"><input id="first" aria-label="First"><input id="last" aria-label="Last"></div>`);
    element('popup').addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && !event.shiftKey) element('trigger').focus();
    });
    element('last').focus();
    await userEvent.keyboard('{Tab}');
    expect(activeId()).toBe('after');
  });
});

describe('inert', () => {
  test('a press on inert content has the element under it that is not inert as its target, and no listener of the content runs', async () => {
    html(
      `<div id="page" inert style="height: 200px"><button id="covered" style="width: 100px; height: 40px">Covered</button></div>`,
    );
    root!.id = 'under';
    const log = record(document, ['pointerdown', 'pointerup', 'click']);
    const covered: string[] = [];
    element('covered').addEventListener('click', () => covered.push('click'));
    await userEvent.pointer({ coords: centerOf(element('covered')), keys: '[MouseLeft]' });
    expect(log).toEqual(['pointerdown under', 'pointerup under', 'click under']);
    expect(covered).toEqual([]);
  });

  test('Tab from the last control of the content that stays in use goes to <body>, then to the first control in Chromium and WebKit, and to the last in Firefox', async () => {
    html(`<div inert><input id="outside" aria-label="Outside"></div>
      <div id="popup"><input id="first" aria-label="First"><input id="last" aria-label="Last"></div>`);
    element('last').focus();
    const order: (string | undefined)[] = [];
    for (let index = 0; index < 2; index += 1) {
      await userEvent.keyboard('{Tab}');
      order.push(activeId());
    }
    expect(order).toEqual(['body', server.browser === 'firefox' ? 'last' : 'first']);
  });
});

describe('a press in a same-origin frame', () => {
  test('sends `focusout` with no related target to a focused control of the page, and the frame is the active element one task later; no pointer event reaches the page', async () => {
    html(`<input id="control" aria-label="Control">
      <iframe id="frame" style="width: 200px; height: 100px" srcdoc="<button style='width: 150px; height: 60px'>In</button>"></iframe>`);
    const frame = element<HTMLIFrameElement>('frame');
    await new Promise((resolve) => {
      if (
        frame.contentDocument?.readyState === 'complete' &&
        frame.contentDocument.body?.firstChild
      )
        resolve(null);
      else frame.addEventListener('load', resolve, { once: true });
    });
    const log: string[] = [];
    element('control').focus();
    document.addEventListener(
      'focusout',
      (event) => log.push(`focusout ${event.relatedTarget === null ? 'null' : 'element'}`),
      true,
    );
    document.addEventListener('pointerdown', () => log.push('pointerdown'), true);
    await userEvent.pointer({ coords: centerOf(frame), keys: '[MouseLeft]' });
    await new Promise((resolve) => setTimeout(resolve));
    expect(log).toEqual(['focusout null']);
    expect(document.activeElement).toBe(frame);
  });
});

describe('a focused element that leaves', () => {
  test('leaves the focus on <body>; only Chromium sends `focusout` at the removal; the next Tab goes on after its place', async () => {
    html(
      `<input id="first" aria-label="First"><div id="list"><input id="a" aria-label="A"><input id="b" aria-label="B"><input id="c" aria-label="C"></div><input id="last" aria-label="Last">`,
    );
    const log: string[] = [];
    element('list').addEventListener('focusout', () => log.push('focusout'));
    element('b').focus();
    element('b').remove();
    expect(activeId()).toBe('body');
    expect(log).toEqual(server.browser === 'chromium' ? ['focusout'] : []);
    await userEvent.keyboard('{Tab}');
    expect(activeId()).toBe('c');
  });
});

describe('the scroll of the page', () => {
  test('`overflow: hidden` on the element that scrolls the view stops the wheel', async () => {
    const { win, html: page } = await createScrollDocument();
    page.style.overflow = 'hidden';
    await userEvent.wheel(win.frameElement!, { delta: { y: 300 } });
    await nextFrame();
    expect(win.scrollY).toBe(0);
  });

  test('`overflow: hidden` removes a scrollbar that takes room, and the content gets wider by its width', async () => {
    const {
      win,
      html: page,
      body,
    } = await createScrollDocument({
      css: '::-webkit-scrollbar { width: 12px; height: 12px }',
    });
    const scrollbar = win.innerWidth - page.clientWidth;
    const before = body.getBoundingClientRect().width;
    page.style.overflow = 'hidden';
    expect(body.getBoundingClientRect().width - before).toBe(scrollbar);
  });

  test('a smooth `scroll-behavior` animates a write of `scrollTop`: the offset is not there at once', async () => {
    const { html: page } = await createScrollDocument({ css: 'html { scroll-behavior: smooth }' });
    page.scrollTop = 300;
    expect(page.scrollTop).toBeLessThan(300);
  });
});

describe('focus()', () => {
  test('with `preventScroll` scrolls nothing', () => {
    html(`<div style="height: 3000px"></div><input id="far" aria-label="Far">`);
    element('far').focus({ preventScroll: true });
    expect(window.scrollY).toBe(0);
  });

  test('from a key listener after a press gives :focus-visible in Chromium and WebKit, and in Firefox only with `focusVisible: true`', async () => {
    html(`<button id="target">Target</button><button id="start">Start</button>`);
    const visible: boolean[] = [];
    for (const options of [undefined, { focusVisible: true } as FocusOptions]) {
      // WebKit gives a pressed button no focus.
      await userEvent.click(element('start'));
      element('start').focus();
      element('start').addEventListener('keydown', () => element('target').focus(options), {
        once: true,
      });
      await userEvent.keyboard('{Escape}');
      visible.push(element('target').matches(':focus-visible'));
    }
    expect(visible).toEqual([server.browser !== 'firefox', true]);
  });
});

describe('a press', () => {
  test('that drags across the edge of a box gives `pointerdown` and `pointerup` the element under the pointer, and `click` the common ancestor', async () => {
    html(`<div id="outside" style="position: fixed; left: 0; top: 0; width: 100px; height: 100px"></div>
      <div id="popup" style="position: fixed; left: 200px; top: 0; width: 100px; height: 100px"></div>`);
    const log = record(document, ['pointerdown', 'pointerup', 'click']);
    const { release } = await holdPress(element('popup'));
    await release(centerOf(element('outside')));
    expect(log).toEqual(['pointerdown popup', 'pointerup outside', 'click div']);
  });

  test('of the right button gives no `click`', async () => {
    html(`<div id="box" style="width: 100px; height: 100px"></div>`);
    element('box').addEventListener('contextmenu', (event) => event.preventDefault());
    const log = record(document, ['click']);
    await userEvent.click(element('box'), { button: 'right' });
    expect(log).toEqual([]);
  });
});

describe('two nested teleports to <body> that render in one update', () => {
  test.each([
    { afterMount: false, defer: false },
    { afterMount: false, defer: true },
    { afterMount: true, defer: false },
  ])('put the parent before the child: %o', async ({ afterMount, defer }) => {
    const scene = reactive({ open: false });
    mount(MeasurePortalOrder, { scene, afterMount, defer });
    scene.open = true;
    await nextTick();
    await nextTick();
    await nextTick();
    const order = [...document.body.children].map((child) => child.id).filter(Boolean);
    expect(order.filter((id) => id === 'parent' || id === 'child')).toEqual(['parent', 'child']);
  });
});

describe('a <Transition> that mounts in the update of the open', () => {
  test.each([
    { appear: false, classes: '' },
    { appear: true, classes: 'm-enter-from m-enter-active' },
  ])(
    'with appear=$appear gives its element the classes "$classes"',
    async ({ appear, classes }) => {
      const scene = reactive({ open: false });
      mount(MeasureTransitionMount, { scene, appear });
      scene.open = true;
      await nextTick();
      const popup = document.querySelector('.popup')!;
      expect([...popup.classList].filter((name) => name.startsWith('m-')).join(' ')).toBe(classes);
    },
  );
});

describe('the first frame after an open', () => {
  test('shows the floating element at the place of Floating UI: it places in microtasks', async () => {
    const scene = reactive({ open: false });
    mount(MeasureFirstFrame, { scene });
    scene.open = true;
    await nextTick();
    const floating = page.getByTestId('floating').element();
    const first = await new Promise<DOMRect>((resolve) =>
      requestAnimationFrame(() => resolve(floating.getBoundingClientRect())),
    );
    await nextFrame();
    await nextFrame();
    expect(first.toJSON()).toEqual(floating.getBoundingClientRect().toJSON());
    expect(first.top).toBeGreaterThan(100);
  });
});

describe('the tab stops of a container', () => {
  // WebKit on macOS gives Tab a link only by a setting of the system, as it does for a button.
  test('are the stops of the Tab key of the browser; the Tab of WebKit on macOS skips the link', async () => {
    html(`<input id="start" aria-label="Start"><div id="box">
      <input id="radio-a" type="radio" name="group" aria-label="A"><input id="radio-b" type="radio" name="group" aria-label="B" checked>
      <details><summary id="summary">More</summary><input id="in-details" aria-label="In details"></details>
      <div style="display: none"><input id="hidden" aria-label="Hidden"></div>
      <fieldset disabled><input id="in-fieldset" aria-label="In fieldset"></fieldset>
      <input id="minus-one" tabindex="-1" aria-label="Minus one">
      <div id="host"></div>
      <div id="editable" contenteditable="true">Edit</div>
      <a id="link" href="#x">Link</a></div><input id="end" aria-label="End">`);
    const shadow = element('host').attachShadow({ mode: 'open' });
    const inShadow = document.createElement('input');
    inShadow.id = 'in-shadow';
    inShadow.ariaLabel = 'In shadow';
    shadow.append(inShadow);
    element('start').focus();
    const order: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      await userEvent.keyboard('{Tab}');
      const active = document.activeElement?.shadowRoot?.activeElement ?? document.activeElement;
      order.push(active?.id ?? '');
    }
    const stops = tabbables(element('box')).map((stop) => stop.id);
    expect(stops).toEqual(['radio-b', 'summary', 'in-shadow', 'editable', 'link']);
    expect(order).toEqual(
      server.browser === 'webkit' && server.platform === 'darwin'
        ? ['radio-b', 'summary', 'in-shadow', 'editable', 'end', '']
        : [...stops, 'end'],
    );
  });
});

describe('an open while the popup leaves', () => {
  test('mounts a second popup element beside the leaving one; the `<Transition>` of Vapor removes the leaving one', async () => {
    const scene = reactive({ open: true });
    const { root: app } = mount(MeasureTransitionReopen, { scene });
    await nextTick();
    scene.open = false;
    await nextTick();
    const leaving = app.querySelector('.popup');
    scene.open = true;
    await nextTick();
    const popups = [...app.querySelectorAll('.popup')].map((popup) => popup === leaving);
    expect(popups).toEqual(inject('app').startsWith('vapor') ? [false] : [true, false]);
  });
});

describe('a double click on a fixed element over text', () => {
  test('selects a word of the page in Firefox and WebKit, and nothing in Chromium; `user-select: none` on the element selects nothing', async () => {
    html(`<p style="font-size: 40px; margin: 0">Some text of the page</p>
      <div id="cover" style="position: fixed; inset: 0"></div>`);
    const selected: string[] = [];
    for (const style of ['', 'none']) {
      element('cover').style.userSelect = style;
      element('cover').style.setProperty('-webkit-user-select', style);
      document.getSelection()?.removeAllRanges();
      await userEvent.dblClick(element('cover'), { position: { x: 60, y: 20 } });
      selected.push(document.getSelection()?.toString().trim() ?? '');
    }
    expect(selected[0] !== '').toBe(server.browser !== 'chromium');
    expect(selected[1]).toBe('');
  });
});

describe('a mouse press on a scrollbar that takes room', () => {
  test('sends `pointerdown`, `mousedown`, `pointerup`, in WebKit also `mouseup`, with a point outside the client box of the element that scrolls, and no `click`', async ({
    skip,
  }) => {
    html(`<style>#scroller::-webkit-scrollbar { width: 12px }</style>
      <div id="scroller" style="width: 200px; height: 100px; overflow: auto"><div style="height: 400px"></div></div>`);
    const scroller = element('scroller');
    const width = scroller.offsetWidth - scroller.clientWidth;
    skip(width === 0, 'The scrollbar of this browser takes no room.');
    const log: string[] = [];
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      document.addEventListener(
        type,
        (event) => log.push(`${type} ${(event as MouseEvent).offsetX > scroller.clientWidth}`),
        true,
      );
    }
    const box = scroller.getBoundingClientRect();
    await userEvent.pointer({
      coords: { x: box.right - width / 2, y: box.top + 50 },
      keys: '[MouseLeft]',
    });
    expect(log).toEqual([
      'pointerdown true',
      'mousedown true',
      'pointerup true',
      ...(server.browser === 'chromium' ? [] : ['mouseup true']),
    ]);
  });
});

describe('a real touch outside', () => {
  // The protocol injects a touch with no long press, so a rest is a tap
  // (https://chromium.googlesource.com/chromium/src/+/main/content/browser/renderer_host/input/touch_emulator_impl.cc).
  // On Linux, Windows and ChromeOS, a touch that stops a fling sends no `click`
  // (https://chromium.googlesource.com/chromium/src/+/main/ui/events/gesture_detection/gesture_configuration_aura.cc).
  // The drag ends with a fling, so the rest comes before the drag.
  test.skipIf(server.browser !== 'chromium')(
    'sends `pointerdown`, `pointerup` and `click` for a tap and for a rest of 1.5 s, and `pointercancel` for a drag on a page that scrolls',
    async () => {
      html(`<div id="page" style="height: 3000px"></div>`);
      const log: string[] = [];
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) {
        document.addEventListener(type, () => log.push(type), true);
      }
      const start = { x: 100, y: 200 };
      await touchDrag(start, start, 1);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const tap = log.splice(0);
      await touchDrag(start, start, 0, 1500);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const rest = log.splice(0);
      await touchDrag(start, { x: 100, y: 100 }, 6);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect({ tap, rest, drag: log }).toEqual({
        tap: ['pointerdown', 'pointerup', 'click'],
        rest: ['pointerdown', 'pointerup', 'click'],
        drag: ['pointerdown', 'pointercancel'],
      });
    },
  );
});

describe('a real touch that starts outside a native popover', () => {
  /** The pointer events with `click`, and the touch events, each with no repeat. */
  function recordTouch() {
    const log = { pointer: [] as string[], touch: [] as string[] };
    let start = { x: 0, y: 0 };
    const controller = new AbortController();
    onTestFinished(() => controller.abort());
    const add = (list: string[], entry: string) => list.at(-1) !== entry && list.push(entry);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click']) {
      document.addEventListener(
        type,
        (event) => {
          const { clientX, clientY } = event as PointerEvent;
          if (type === 'pointerdown') start = { x: clientX, y: clientY };
          const far = Math.hypot(clientX - start.x, clientY - start.y) > 10;
          add(log.pointer, type === 'pointermove' && far ? 'pointermove past 10 px' : type);
        },
        { capture: true, signal: controller.signal },
      );
    }
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      document.addEventListener(type, () => add(log.touch, type), {
        capture: true,
        passive: true,
        signal: controller.signal,
      });
    }
    return log;
  }

  // Playwright can only tap in WebKit, so the case runs in Chromium. A measurement by hand in Safari
  // on iOS 26.5, in the iPhone 17 Simulator, gives these results:
  // - A swipe of 150 px that scrolls the page sends `pointermove` at 10 px and at 20 px, then
  //   `pointercancel`, and no `click`. The popover stays open.
  // - A move of 20 px sends `click`.
  // - A drag of 60 px on `touch-action: none` sends `pointerup` and no `click`. The popover closes
  //   at that `pointerup`.
  test.skipIf(server.browser !== 'chromium')(
    'closes at the `click` of a tap and of a move of 8 px; a drag of 40 px on `touch-action: none` sends `pointerup` and no `click`, and a touch that scrolls the page sends `pointercancel` after moves past 10 px; neither closes it',
    async () => {
      html(`<div style="height: 3000px"></div>
        <div id="surface" style="position: fixed; left: 0; bottom: 0; width: 200px; height: 100px; touch-action: none"></div>
        <div id="popup" popover style="inset: 0 auto auto 0; margin: 0">Popup</div>`);
      onTestFinished(() => scrollTo(0, 0));
      const popover = element('popup');
      const log = recordTouch();
      const surface = centerOf(element('surface'));
      const results: unknown[] = [];
      for (const [from, to, steps] of [
        [surface, surface, 0],
        [surface, { x: surface.x + 8, y: surface.y }, 2],
        [surface, { x: surface.x + 40, y: surface.y }, 4],
        [{ x: 100, y: 300 }, { x: 100, y: 150 }, 25],
      ] as const) {
        popover.showPopover();
        await touchDrag(from, to, steps);
        await new Promise((resolve) => setTimeout(resolve, 50));
        const open = popover.matches(':popover-open');
        results.push({ ...log, open, scrolled: scrollY > 0 });
        log.pointer = [];
        log.touch = [];
        if (open) popover.hidePopover();
      }
      await stopFling();
      const touch = ['touchstart', 'touchmove', 'touchend'];
      expect(results).toEqual([
        {
          pointer: ['pointerdown', 'pointerup', 'click'],
          touch: ['touchstart', 'touchend'],
          open: false,
          scrolled: false,
        },
        {
          pointer: ['pointerdown', 'pointermove', 'pointerup', 'click'],
          touch: ['touchstart', 'touchend'],
          open: false,
          scrolled: false,
        },
        {
          pointer: ['pointerdown', 'pointermove', 'pointermove past 10 px', 'pointerup'],
          touch,
          open: true,
          scrolled: false,
        },
        {
          pointer: ['pointerdown', 'pointermove', 'pointermove past 10 px', 'pointercancel'],
          touch,
          open: true,
          scrolled: true,
        },
      ]);
    },
  );
});

describe('a mouse that moves from a trigger across a gap to a popup', () => {
  test('sends `pointerleave` of the trigger and `pointermove` of the element under the gap before the `pointerenter` of the popup, with the pointer type `mouse`', async () => {
    html(`<button id="trigger" style="position: fixed; left: 0; top: 0; width: 100px; height: 40px">Trigger</button>
      <div id="popup" style="position: fixed; left: 0; top: 80px; width: 200px; height: 100px"></div>`);
    root!.id = 'gap';
    const log: string[] = [];
    element('trigger').addEventListener('pointerleave', (event) =>
      log.push(`leave trigger ${event.pointerType}`),
    );
    element('popup').addEventListener('pointerenter', (event) =>
      log.push(`enter popup ${event.pointerType}`),
    );
    document.addEventListener('pointermove', (event) => {
      const id = (event.target as Element).id || (event.target as Element).localName;
      if (log.at(-1) !== `move ${id}`) log.push(`move ${id}`);
    });
    await userEvent.pointer([
      { coords: { x: 50, y: 20 } },
      { coords: { x: 50, y: 60 } },
      { coords: { x: 50, y: 120 } },
    ]);
    expect(log).toEqual([
      'move trigger',
      'leave trigger mouse',
      expect.stringMatching(/^move (?:gap|body|html)$/),
      'enter popup mouse',
      'move popup',
    ]);
  });
});

/** The first and the last column of dark pixels in a row of a picture of the element. */
async function darkColumns(target: Element, y: number) {
  const picture = (await page.screenshot({
    element: target,
    base64: true,
    save: false,
  } as never)) as unknown as string;
  const image = new Image();
  image.src = `data:image/png;base64,${picture}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const row = context.getImageData(0, y, image.width, 1).data;
  const columns: number[] = [];
  for (let x = 0; x < image.width; x += 1) if (row[x * 4]! < 128) columns.push(x);
  return [columns[0], columns.at(-1)];
}

describe('the variables of a positioner', () => {
  test('a box at a fractional place covers more pixels than a box of the same width at the place that Floating UI rounds to pixels; the width in pixels covers the same ones', async () => {
    html(`<div id="scene" style="position: fixed; left: 0; top: 0; width: 300px; height: 90px; background: white">
      <div style="position: absolute; left: 10.4px; top: 0; width: 100.3px; height: 20px; background: black"></div>
      <div style="position: absolute; left: 0; top: 30px; transform: translate(10px, 0); width: 100.3px; height: 20px; background: black"></div>
      <div style="position: absolute; left: 0; top: 60px; transform: translate(10px, 0); width: 101px; height: 20px; background: black"></div></div>`);
    const scene = element('scene');
    expect([
      await darkColumns(scene, 10),
      await darkColumns(scene, 40),
      await darkColumns(scene, 70),
    ]).toEqual([
      [10, 110],
      [10, 109],
      [10, 110],
    ]);
  });

  test('an unset variable makes a rule with `var()` invalid: the popup has no `max-height`', () => {
    html(`<div id="popup" style="max-height: min(200px, var(--available-height))">Popup</div>`);
    expect(getComputedStyle(element('popup')).maxHeight).toBe('none');
  });
});
