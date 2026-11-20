// Measurements for Dialog and Alert Dialog, with native elements and plain Vue, and no code of the
// library unless the case names a part. Each one states what the browser or Vue does, so that a
// dialog has code only where they do not do it. Where the browsers differ, the measurement states
// each one. `popup.test.ts` holds the measurements of the popup layer.
import { afterEach, describe, expect, inject, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureHydratedAttribute from '../fixtures/MeasureHydratedAttribute.vue';
import MeasureDialogInComposite from '../fixtures/MeasureDialogInComposite.vue';
import MeasureLeaveInElement from '../fixtures/MeasureLeaveInElement.vue';
import MeasureMountOrder from '../fixtures/MeasureMountOrder.vue';
import MeasurePageSwap from '../fixtures/MeasurePageSwap.vue';
import { hydrate, mount, renderOnServer } from '../render';
import { takeReportedMessages } from '../reportedMessages';

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

/** The fixtures of the setup are Vapor components. */
const vaporFixtures = () => inject('app').startsWith('vapor');

const activeId = () => document.activeElement?.id || document.activeElement?.localName;

function record(types: string[]) {
  const log: string[] = [];
  for (const type of types) {
    document.addEventListener(
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

const BUTTON = 'position: fixed; left: 100px; top: 100px; width: 100px; height: 40px';

describe('an inert element that covers the page (D1)', () => {
  test('lets a press reach the element under it, and Tab does not go into it', async () => {
    html(`<button id="under" style="${BUTTON}">Under</button>
      <div inert><div id="cover" style="position: fixed; inset: 0"><input id="inside" aria-label="Inside"></div></div>`);
    const log = record(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    await userEvent.click(element('under'));
    expect(log).toEqual([
      'pointerdown under',
      'mousedown under',
      'pointerup under',
      'mouseup under',
      'click under',
    ]);
    await userEvent.keyboard('{Tab}');
    expect(activeId()).not.toBe('inside');
  });
});

describe('an element over a button that leaves at `pointerdown` (D2)', () => {
  test.each(['remove', 'display: none'])(
    'with %s gives the button no `click`; after a removal only Firefox sends `click`, to the common ancestor',
    async (how) => {
      html(`<button id="under" style="${BUTTON}">Under</button>
        <div id="cover" style="position: fixed; inset: 0"></div>`).id = 'page';
      const clicks: string[] = [];
      element('under').addEventListener('click', () => clicks.push('button'));
      element('cover').addEventListener('pointerdown', () => {
        if (how === 'remove') element('cover').remove();
        else element('cover').style.display = 'none';
      });
      const log = record(['click']);
      await userEvent.pointer({ coords: centerOf(element('under')), keys: '[MouseLeft]' });
      expect(clicks).toEqual([]);
      expect(log).toEqual(how === 'remove' && server.browser !== 'firefox' ? [] : ['click page']);
    },
  );
});

describe('a part in a `<Transition>` in an element (D3)', () => {
  test.each([
    { viewportStays: true, classes: 't-leave-from t-leave-active' },
    { viewportStays: false, classes: null },
  ])(
    'leaves with its classes only while the element stays: viewportStays=$viewportStays',
    async ({ viewportStays, classes }) => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const scene = reactive({ open: true });
      mount(MeasureLeaveInElement, { scene, viewportStays });
      await nextTick();
      scene.open = false;
      await nextTick();
      expect(element('popup')?.className ?? null).toBe(classes);
    },
  );
});

describe('the focused element gets `inert` (D4)', () => {
  test('gives the focus to <body> with `blur` and a `focusout` with no related target; the next Tab goes to the first control that is not inert', async () => {
    html(`<div id="page"><input id="before" aria-label="Before"><input id="trigger" aria-label="Trigger"></div>
      <div id="popup"><input id="first" aria-label="First"></div>`);
    const log: string[] = [];
    element('trigger').addEventListener('blur', () => log.push('blur'));
    element('trigger').addEventListener('focusout', (event) =>
      log.push(`focusout ${event.relatedTarget === null ? 'null' : 'element'}`),
    );
    element('trigger').focus();
    element('page').inert = true;
    await nextFrame();
    await nextFrame();
    expect(activeId()).toBe('body');
    expect(log).toEqual(['blur', 'focusout null']);
    await userEvent.keyboard('{Tab}');
    expect(activeId()).toBe('first');
  });
});

describe('a focus in the task that removes `inert` (D5)', () => {
  test('moves the focus to a control under the element that was inert', () => {
    html(`<div id="page" inert><input id="trigger" aria-label="Trigger"></div>
      <div id="popup"><input id="first" aria-label="First"></div>`);
    element('first').focus();
    element('trigger').focus();
    expect(activeId()).toBe('first');
    element('page').inert = false;
    element('trigger').focus();
    expect(activeId()).toBe('trigger');
  });
});

describe('a press over an inert popup below a fixed element (D6)', () => {
  test('has the fixed element as its target', async () => {
    html(`<div inert style="position: fixed; left: 0; top: 0; width: 300px; height: 300px">
        <button id="lower" style="width: 200px; height: 200px">Lower</button></div>
      <div id="block" style="position: fixed; inset: 0"></div>`);
    const log = record(['pointerdown', 'click']);
    await userEvent.pointer({ coords: { x: 100, y: 100 }, keys: '[MouseLeft]' });
    expect(log).toEqual(['pointerdown block', 'click block']);
  });
});

describe('a press on a fixed element that is not focusable (D7)', () => {
  test.each([
    { prevent: false, active: 'body', typed: '' },
    { prevent: true, active: 'field', typed: 'x' },
  ])(
    'with preventDefault() at mousedown=$prevent leaves the focus on $active, and the element gets `click`',
    async ({ prevent, active, typed }) => {
      html(`<div id="block" style="position: fixed; inset: 0"></div>
        <textarea id="field" aria-label="Field" style="position: fixed; left: 400px; top: 100px"></textarea>`);
      const clicks: string[] = [];
      element('block').addEventListener('click', () => clicks.push('click'));
      if (prevent)
        element('block').addEventListener('mousedown', (event) => event.preventDefault());
      element('field').focus();
      await userEvent.pointer({ coords: { x: 60, y: 300 }, keys: '[MouseLeft]' });
      expect(activeId()).toBe(active);
      expect(clicks).toEqual(['click']);
      await userEvent.keyboard('x');
      expect(element<HTMLTextAreaElement>('field').value).toBe(typed);
    },
  );

  test('with preventDefault() at mousedown, a double click selects no text of the page under it (N9 of popup.test.ts selects text with no listener)', async () => {
    html(`<p style="font-size: 40px; margin: 0">Some text of the page</p>
      <div id="block" style="position: fixed; inset: 0"></div>`);
    element('block').addEventListener('mousedown', (event) => event.preventDefault());
    document.getSelection()?.removeAllRanges();
    await userEvent.dblClick(element('block'), { position: { x: 60, y: 20 } });
    expect(document.getSelection()?.toString().trim()).toBe('');
  });
});

describe('a drag of a scrollbar that takes room, with preventDefault() at mousedown (D8)', () => {
  test('sends `mousedown` with a point outside the client box, and scrolls the element', async ({
    skip,
  }) => {
    html(`<style>#scroller::-webkit-scrollbar { width: 12px } #scroller::-webkit-scrollbar-thumb { background: gray }</style>
      <div id="scroller" style="position: fixed; left: 0; top: 0; width: 200px; height: 200px; overflow: auto"><div style="height: 2000px"></div></div>`);
    const scroller = element('scroller');
    // WebKit gives the scrollbar its style in a later frame.
    await nextFrame();
    await nextFrame();
    const width = scroller.offsetWidth - scroller.clientWidth;
    skip(width === 0, 'The scrollbar of this browser takes no room.');
    const log: string[] = [];
    scroller.addEventListener('mousedown', (event) => {
      log.push(`mousedown ${event.offsetX > scroller.clientWidth}`);
      event.preventDefault();
    });
    const x = 200 - width / 2;
    // WebKit drags a scrollbar only with a frame between the steps.
    for (const step of [
      { coords: { x, y: 8 } },
      '[MouseLeft>]',
      { coords: { x, y: 60 } },
      { coords: { x, y: 120 } },
      '[/MouseLeft]',
    ]) {
      await userEvent.pointer(step);
      await nextFrame();
    }
    expect(log).toEqual(['mousedown true']);
    expect(scroller.scrollTop).toBeGreaterThan(0);
  });
});

describe('the hooks of a component in a component (D9)', () => {
  test('`onMounted` runs for the child first; `onBeforeMount` runs for the parent first only in the virtual DOM', async () => {
    const log: string[] = [];
    mount(MeasureMountOrder, { depth: 1, log: { add: (entry: string) => log.push(entry) } });
    await nextTick();
    expect(log.filter((entry) => entry.startsWith('mounted'))).toEqual(['mounted 0', 'mounted 1']);
    expect(log.filter((entry) => entry.startsWith('beforeMount'))).toEqual(
      vaporFixtures() ? ['beforeMount 0', 'beforeMount 1'] : ['beforeMount 1', 'beforeMount 0'],
    );
  });
});

describe('a dialog in place in a composite (D10)', () => {
  test.each(['toolbar', 'tabs'])(
    'in a %s keeps the focus in the popup at the arrow keys, Home and End',
    async (host) => {
      mount(MeasureDialogInComposite, { host });
      await nextTick();
      const inside = [...document.querySelectorAll('button')].find(
        (button) => button.textContent === 'Inside',
      )!;
      inside.focus();
      for (const key of [
        '{ArrowDown}',
        '{ArrowRight}',
        '{ArrowUp}',
        '{ArrowLeft}',
        '{Home}',
        '{End}',
      ]) {
        await userEvent.keyboard(key);
        await nextTick();
        expect(document.activeElement).toBe(inside);
      }
    },
  );
});

describe('a component that replaces another one (D12)', () => {
  async function swap(wrapper: string, gates: Record<string, Promise<void>> = {}) {
    const log: string[] = [];
    const scene = reactive({ page: 'A' });
    mount(MeasurePageSwap, {
      wrapper,
      scene,
      gates,
      log: { add: (entry: string) => log.push(entry) },
    });
    await settle();
    log.length = 0;
    scene.page = 'B';
    await settle();
    return { log, scene };
  }

  async function settle() {
    for (let tick = 0; tick < 4; tick += 1) await nextTick();
  }

  const order = [
    'effect end A',
    'scope end A',
    'setup B',
    'unmounted A',
    'effect B',
    'child mounted B',
    'mounted B',
  ];

  test.each(['none', 'Transition', 'TransitionGroup'])(
    'with %s: the old one ends its effect and its scope, the new one runs `setup`, the old one unmounts, then the effect of the new one runs before `onMounted` of its child',
    async (wrapper) => {
      const { log } = await swap(wrapper);
      expect(log).toEqual(order);
    },
  );

  // Vue 3.6 runs no `<Suspense>` in a Vapor app with Vapor parts.
  describe.skipIf(inject('app') === 'vapor')('in a <Suspense>', () => {
    test('the new Vapor page has the order of no wrapper; else the new page runs `setup` first, and the old one unmounts last', async () => {
      const { log } = await swap('Suspense');
      expect(log).toEqual(
        vaporFixtures()
          ? order
          : [
              'setup B',
              'effect end A',
              'scope end A',
              'effect B',
              'child mounted B',
              'mounted B',
              'unmounted A',
            ],
      );
    });

    // In Vue 3.6, the async `setup` of a Vapor component does not make a `<Suspense>` wait.
    test.skipIf(vaporFixtures())(
      'the effect of a new page that waits runs after the wait, and never when the old page comes back',
      async () => {
        let open = () => {};
        const { log, scene } = await swap('Suspense', {
          B: new Promise<void>((resolve) => (open = resolve)),
          C: new Promise<void>(() => {}),
        });
        expect(log).toEqual(['setup B']);
        open();
        await settle();
        expect(log.slice(1)).toEqual([
          'effect end A',
          'scope end A',
          'effect B',
          'child mounted B',
          'mounted B',
          'unmounted A',
        ]);
        log.length = 0;
        scene.page = 'C';
        await settle();
        scene.page = 'B';
        await settle();
        expect(log).toEqual(['setup C', 'scope end C']);
      },
    );
  });
});

describe('a real pinch outside (D11)', () => {
  test.skipIf(server.browser !== 'chromium')(
    'sends a second `pointerdown` with `isPrimary` false',
    async () => {
      html(`<div id="page" style="position: fixed; inset: 0"></div>`);
      const log: string[] = [];
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) {
        document.addEventListener(
          type,
          (event) => log.push(`${type} ${(event as PointerEvent).isPrimary}`),
          true,
        );
      }
      const { cdp } = await import('vitest/browser');
      const session = cdp();
      const frame = window.frameElement!.getBoundingClientRect();
      const scale = frame.width / window.innerWidth || 1;
      const at = (x: number, y: number) => ({
        x: frame.left + x * scale,
        y: frame.top + y * scale,
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [at(100, 100)],
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [at(100, 100), at(200, 200)],
      });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(log.slice(0, 2)).toEqual(['pointerdown true', 'pointerdown false']);
      expect(log).not.toContain('click true');
    },
  );
});

describe('an attribute that the first client render changes (D13)', () => {
  test('Vue reports no message for `aria-expanded`; the virtual DOM keeps the value of the server HTML, and Vapor writes the value of the client', async () => {
    const root = await renderOnServer('MeasureHydratedAttribute', { expanded: false });
    hydrate(MeasureHydratedAttribute, { expanded: true }, root);
    await nextTick();
    expect(root.querySelector('button')).toHaveAttribute(
      'aria-expanded',
      vaporFixtures() ? 'true' : 'false',
    );
    expect(takeReportedMessages()).toEqual([]);
  });
});
