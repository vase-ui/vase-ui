// Measurements for Drawer, with native elements and plain Vue, and no code of the library. Each one
// states what the browser or Vue does, so that the drawer has code only where they do not do it.
// Where the browsers differ, the measurement states each one. A real touch runs only in Chromium.
import { afterEach, describe, expect, inject, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { defineComponent, h, nextTick, reactive, shallowRef, Transition, type PropType } from 'vue';
import { touchDrag } from '../pointer';
import { mount } from '../render';
import { wait } from '../wait';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
  getSelection()?.removeAllRanges();
});

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function record(target: EventTarget, types: string[], log: string[] = []) {
  for (const type of types) {
    target.addEventListener(
      type,
      (event) => {
        const buttons = type.startsWith('pointer') ? ` ${(event as PointerEvent).buttons}` : '';
        const entry = `${type}${buttons}`;
        // Many moves with the same buttons are one entry.
        if (type !== 'pointermove' || log.at(-1) !== entry) log.push(entry);
      },
      true,
    );
  }
  return log;
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const translateY = (target: Element) =>
  Math.round(new DOMMatrixReadOnly(getComputedStyle(target).transform).m42);
const selected = () => String(getSelection()).length;

/** A mouse drag from the point in 8 moves of (12, 15). */
async function mouseDrag(x: number, y: number, keys = true) {
  await userEvent.pointer({ coords: { x, y } });
  if (keys) await userEvent.pointer({ keys: '[MouseLeft>]' });
  for (let step = 1; step <= 8; step += 1) {
    await userEvent.pointer({ coords: { x: x + step * 12, y: y + step * 15 } });
  }
  if (keys) await userEvent.pointer({ keys: '[/MouseLeft]' });
}

const BOX = `<p id="outside">Text outside the box that a drag can select too.</p>
  <div id="box" style="position: fixed; left: 100px; top: 100px; width: 300px; height: 200px">
    <p>Some text in the box that a drag can select, on more than one line of the box.</p>
    <input id="field" aria-label="Field" value="value">
  </div>`;

describe('a mouse drag on text in a box with pointer capture (M1)', () => {
  function captureAtPress(onPress: (event: PointerEvent) => void = () => {}) {
    html(BOX);
    const box = element('box');
    box.addEventListener('pointerdown', (event) => {
      box.setPointerCapture(event.pointerId);
      onPress(event);
    });
    element('field').focus();
    return box;
  }

  test('selects text in the three browsers', async () => {
    captureAtPress();
    await mouseDrag(150, 125);
    expect(selected()).toBeGreaterThan(0);
  });

  test('selects no text with `user-select: none` and its `-webkit-` form written at `pointerdown`', async () => {
    captureAtPress((event) => {
      const box = event.currentTarget as HTMLElement;
      box.style.setProperty('user-select', 'none');
      box.style.setProperty('-webkit-user-select', 'none');
    });
    await mouseDrag(150, 125);
    expect(selected()).toBe(0);
  });

  test('with `preventDefault()` at `pointerdown`, keeps the focus, and WebKit still selects text', async () => {
    captureAtPress((event) => event.preventDefault());
    await mouseDrag(150, 125);
    expect(document.activeElement).toBe(element('field'));
    expect(selected() > 0).toBe(server.browser === 'webkit');
  });

  test('selects no text with the pair at `pointerdown` and the capture at the first `pointermove`', async () => {
    html(BOX);
    const box = element('box');
    box.addEventListener('pointerdown', () => {
      box.style.setProperty('user-select', 'none');
      box.style.setProperty('-webkit-user-select', 'none');
    });
    box.addEventListener('pointermove', (event) => {
      if (event.buttons === 1 && !box.hasPointerCapture(event.pointerId)) {
        box.setPointerCapture(event.pointerId);
      }
    });
    await mouseDrag(150, 125);
    expect(selected()).toBe(0);
  });

  test('selects no text outside an element with the pair, also with `preventDefault()` at `pointerdown`', async () => {
    html(`<p id="text" style="position: fixed; left: 0; top: 200px; width: 600px">
        Text of the page under the drag, on one line, and with more text after it.</p>
      <div id="area" style="position: fixed; left: 0; top: 100px; width: 600px; height: 40px;
        user-select: none; -webkit-user-select: none"></div>`);
    element('area').addEventListener('pointerdown', (event) => {
      element('area').setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    await mouseDrag(50, 120);
    expect(selected()).toBe(0);
  });
});

describe('a press of the right button in a mouse drag with capture (M2)', () => {
  test('sends `contextmenu` in the three browsers; then Chromium sends no `pointerup`, and Firefox and WebKit send it at the release of the left button', async () => {
    html(
      `<div id="box" style="position: fixed; left: 100px; top: 100px; width: 100px; height: 100px"></div>`,
    );
    const box = element('box');
    box.addEventListener('pointerdown', (event) => {
      if (event.button === 0) box.setPointerCapture(event.pointerId);
    });
    box.addEventListener('contextmenu', (event) => event.preventDefault());
    const log = record(box, ['pointerdown', 'pointerup', 'lostpointercapture', 'contextmenu']);
    await userEvent.pointer({ coords: { x: 150, y: 150 } });
    await userEvent.pointer({ keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: 160, y: 200 } });
    await userEvent.pointer({ keys: '[MouseRight]' });
    const upAtRightButton = log.some((entry) => entry.startsWith('pointerup'));
    await userEvent.pointer({ coords: { x: 170, y: 260 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect({ upAtRightButton, log }).toEqual(
      {
        chromium: {
          upAtRightButton: false,
          log: ['pointerdown 1', 'contextmenu', 'lostpointercapture'],
        },
        firefox: {
          upAtRightButton: false,
          log: ['pointerdown 1', 'contextmenu', 'pointerup 0', 'lostpointercapture'],
        },
        webkit: {
          upAtRightButton: false,
          log: ['pointerdown 1', 'contextmenu', 'pointerup 0', 'lostpointercapture'],
        },
      }[server.browser],
    );
  });
});

/** The hooks of the `<Transition>` of `Sheet`, in their order. */
let hooks: string[] = [];

// The cases that mount a component write it with render functions, and a Vapor app mounts no such
// component. The setups of a virtual DOM app run them.
const vdomApp = !inject('app').startsWith('vapor');

const Sheet = defineComponent({
  props: {
    scene: {
      type: Object as PropType<{ open: boolean; tick: number }>,
      required: true,
    },
    children: { type: Number, default: 0 },
  },
  setup(props) {
    return () =>
      h(
        Transition,
        {
          name: 'sheet',
          appear: true,
          onAfterEnter: () => hooks.push('after-enter'),
          onAfterLeave: () => hooks.push('after-leave'),
        },
        () =>
          props.scene.open
            ? h(
                'div',
                { id: 'sheet', class: 'sheet', 'data-tick': props.scene.tick },
                Array.from({ length: props.children }, (_, index) => h('span', index)),
              )
            : null,
      );
  },
});

const SHEET_STYLE = `<style>
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; height: 200px;
    transition: transform 400ms linear; transform: translateY(var(--y)); }
  .sheet-enter-from, .sheet-leave-to { transform: translateY(100%) !important; }
  .sheet-leave-active { transition-duration: calc(var(--strength) * 400ms) !important; }
</style>`;

function mountSheet() {
  html(SHEET_STYLE);
  hooks = [];
  const scene = reactive({ open: false, tick: 0 });
  mount(Sheet, { scene });
  return { scene, sheet: () => element('sheet') };
}

describe.runIf(vdomApp)(
  'a script that writes a variable, `transition: none` and an attribute to an element in a <Transition> (M3)',
  () => {
    test('keeps them through a render; the leave starts at the place of the drag and reads the variable written before the close', async () => {
      const { scene, sheet } = mountSheet();
      scene.open = true;
      await nextTick();
      await wait(450);
      sheet().style.transition = 'none';
      sheet().style.setProperty('--y', '80px');
      sheet().setAttribute('data-swiping', '');
      scene.tick += 1;
      await nextTick();
      expect([translateY(sheet()), sheet().hasAttribute('data-swiping')]).toEqual([80, true]);

      const leaving = sheet();
      leaving.style.transition = '';
      leaving.style.setProperty('--strength', '0.5');
      leaving.setAttribute('data-swipe-dismiss', '');
      scene.open = false;
      await nextTick();
      expect([translateY(leaving), leaving.hasAttribute('data-swipe-dismiss')]).toEqual([80, true]);
      await nextFrame();
      await nextFrame();
      expect(getComputedStyle(leaving).transitionDuration).toBe('0.2s');
      await wait(400);
      expect(hooks).toContain('after-leave');
    });
  },
);

describe('a variable that is not set (M4)', () => {
  test('gives `transform: none` and an opacity of 1', () => {
    html(`<div id="target" style="transform: translateY(var(--drawer-swipe-movement-y));
      opacity: calc(0.2 * (1 - var(--drawer-swipe-progress)))">Target</div>`);
    const style = getComputedStyle(element('target'));
    expect([style.transform, style.opacity]).toEqual(['none', '1']);
  });
});

describe.runIf(vdomApp)('an element that mounts in <Transition appear> (M5)', () => {
  test('has the enter classes and the place of the enter class at its mount; with `transition: none` it goes to the place of its variable, and with its transition again it goes back', async () => {
    const { scene, sheet } = mountSheet();
    scene.open = true;
    await nextTick();
    expect([sheet().className, translateY(sheet())]).toEqual([
      'sheet sheet-enter-from sheet-enter-active',
      200,
    ]);
    sheet().style.transition = 'none';
    sheet().style.setProperty('--y', '150px');
    await nextFrame();
    await nextFrame();
    await nextFrame();
    expect([sheet().className, translateY(sheet()), hooks]).toEqual([
      'sheet',
      150,
      ['after-enter'],
    ]);
    sheet().style.transition = '';
    sheet().style.setProperty('--y', '0px');
    await wait(500);
    expect(translateY(sheet())).toBe(0);
  });
});

/** A sheet with a head and a vertical scroller, fixed at the bottom of a page that scrolls. */
function touchSheet() {
  html(`<div style="height: 3000px"></div>
    <div id="sheet" style="position: fixed; left: 0; right: 0; bottom: 0; height: 400px">
      <div id="head" style="height: 60px">Head</div>
      <div id="scroller" style="height: 340px; overflow-y: auto"><div style="height: 1500px">Long</div></div>
    </div>`);
  const log: string[] = [];
  const sheet = element('sheet');
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    sheet.addEventListener(type, () => log.at(-1) !== type && log.push(type));
  }
  return { sheet, log };
}

function centerOf(target: Element) {
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('a real touch on a sheet (M6, M7)', () => {
  test.skipIf(server.browser !== 'chromium')(
    'gives the drag to the browser after a `touchmove` that no listener prevents, also when nothing scrolls',
    async () => {
      const { log } = touchSheet();
      const start = centerOf(element('head'));
      await touchDrag(start, { x: start.x, y: start.y + 80 }, 8);
      await wait(50);
      expect(log).toEqual(['pointerdown', 'pointermove', 'pointercancel']);
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'keeps the pointer events to `pointerup` with `preventDefault()` at each `touchmove`, and scrolls nothing',
    async () => {
      const { sheet, log } = touchSheet();
      sheet.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
      const start = centerOf(element('scroller'));
      await touchDrag(start, { x: start.x, y: start.y - 80 }, 8);
      await wait(50);
      expect([log, element('scroller').scrollTop, scrollY]).toEqual([
        ['pointerdown', 'pointermove', 'pointerup'],
        0,
        0,
      ]);
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'sends the first `pointermove` at 1 px and the first `touchmove` near 16 px',
    async () => {
      const { sheet } = touchSheet();
      element('scroller').scrollTop = 200;
      const first: Record<string, number> = {};
      let startY = 0;
      for (const type of ['pointerdown', 'pointermove', 'touchmove']) {
        sheet.addEventListener(
          type,
          (event) => {
            const y =
              'touches' in event
                ? (event as TouchEvent).touches[0]!.clientY
                : (event as PointerEvent).clientY;
            if (type === 'pointerdown') startY = y;
            first[type] ??= Math.round(y - startY);
          },
          { passive: true },
        );
      }
      const start = centerOf(element('scroller'));
      await touchDrag(start, { x: start.x, y: start.y + 40 }, 40);
      await wait(50);
      expect(first.pointermove).toBe(1);
      expect(first.touchmove).toBeGreaterThanOrEqual(10);
    },
  );
});

describe('a real touch on an element with `touch-action: pan-y` (M8)', () => {
  function area() {
    html(`<div style="height: 3000px"></div><div id="area" style="position: fixed; left: 0;
      top: 100px; width: 40px; height: 300px; touch-action: pan-y"></div>`);
    const log: string[] = [];
    const targets = new Set<string>();
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      document.addEventListener(type, (event) => {
        if (log.at(-1) !== type) log.push(type);
        targets.add((event.target as Element).id);
      });
    }
    return { log, targets };
  }

  test.skipIf(server.browser !== 'chromium')(
    'gives the pointer events of a drag on the other axis to `pointerup`, with the start element as their target after the finger leaves it',
    async () => {
      const { log, targets } = area();
      await touchDrag({ x: 20, y: 200 }, { x: 220, y: 200 }, 10);
      await wait(50);
      expect([log, [...targets]]).toEqual([['pointerdown', 'pointermove', 'pointerup'], ['area']]);
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'gives a drag on its own axis to the browser',
    async () => {
      const { log } = area();
      await touchDrag({ x: 20, y: 300 }, { x: 20, y: 220 }, 8);
      await wait(50);
      expect(log.at(-1)).toBe('pointercancel');
    },
  );
});

describe('an element that gets `inert` in a drag that started on it (M9)', () => {
  function area() {
    html(`<div id="wrap"><div id="area" style="position: fixed; left: 0; top: 100px; width: 100px;
      height: 100px; touch-action: none"></div></div>`);
    const area = element('area');
    area.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') area.setPointerCapture(event.pointerId);
    });
    area.addEventListener('pointermove', (event) => {
      if (event.buttons === 1) element('wrap').setAttribute('inert', '');
    });
    return record(area, ['pointerdown', 'pointermove', 'pointerup']);
  }

  test('keeps its mouse events to `pointerup`', async () => {
    const log = area();
    await userEvent.pointer({ coords: { x: 50, y: 150 } });
    await userEvent.pointer({ keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: 60, y: 160 } });
    await userEvent.pointer({ coords: { x: 300, y: 300 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    // The first move of the pointer onto the area has no button.
    expect(log.slice(1)).toEqual(['pointerdown 1', 'pointermove 1', 'pointerup 0']);
  });

  test.skipIf(server.browser !== 'chromium')(
    'keeps the events of a touch to `pointerup`',
    async () => {
      const log = area();
      await touchDrag({ x: 50, y: 150 }, { x: 300, y: 300 }, 6);
      await wait(50);
      expect(log).toEqual(['pointerdown 1', 'pointermove 1', 'pointerup 0']);
    },
  );
});

describe.runIf(vdomApp)('`transition: none` on a sheet while its enter runs (N2)', () => {
  test('moves the sheet from its place in the enter to the end of the enter', async () => {
    const { scene, sheet } = mountSheet();
    scene.open = true;
    await nextTick();
    await wait(100);
    const before = translateY(sheet());
    sheet().style.transition = 'none';
    expect(before - translateY(sheet())).toBeGreaterThan(2);
  });
});

describe.runIf(vdomApp)(
  'an update of a style bound to a ref, on a component with 2,000 elements in its slot (N4)',
  () => {
    test('takes less than 2 ms', async () => {
      const movement = shallowRef(0);
      const Popup = defineComponent({
        setup(_, { slots }) {
          return () => h('div', { style: { '--y': `${movement.value}px` } }, slots.default?.());
        },
      });
      const Content = defineComponent({
        setup() {
          return () =>
            h(Popup, null, {
              default: () =>
                Array.from({ length: 2000 }, (_, index) =>
                  h('span', { class: 'item' }, `${index}`),
                ),
            });
        },
      });
      mount(Content);
      const times: number[] = [];
      for (let index = 1; index <= 60; index += 1) {
        const start = performance.now();
        movement.value = index;
        await nextTick();
        times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      expect(times[30]).toBeLessThan(2);
    });
  },
);

describe.runIf(vdomApp)('a style that a script writes on an element of a component (N6)', () => {
  const Scroller = defineComponent({
    props: {
      scene: { type: Object as PropType<{ tick: number; own: boolean }>, required: true },
    },
    setup(props) {
      return () =>
        h('div', {
          id: 'scroller',
          'data-tick': props.scene.tick,
          style: props.scene.own ? { paddingBottom: '4px', color: 'red' } : { color: 'red' },
        });
    },
  });

  test.each([
    { own: false, after: '120px' },
    { own: true, after: '4px' },
  ])(
    'stays through a render unless the `:style` of the component has that property: own=$own',
    async ({ own, after }) => {
      const scene = reactive({ tick: 0, own });
      mount(Scroller, { scene });
      element('scroller').style.paddingBottom = '120px';
      scene.tick += 1;
      await nextTick();
      expect(element('scroller').style.paddingBottom).toBe(after);
    },
  );
});
