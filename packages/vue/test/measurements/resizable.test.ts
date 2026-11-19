// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it. Where the
// browsers differ, the measurement states each one.
import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureFlexMount from '../fixtures/MeasureFlexMount.vue';
import MeasureServerSiblings from '../fixtures/MeasureServerSiblings.vue';
import MeasureStyleHydration from '../fixtures/MeasureStyleHydration.vue';
import { touchDrag } from '../pointer';
import { takeReportedMessages } from '../reportedMessages';
import { hydrate, mount, renderOnServer } from '../render';

let root: HTMLElement | undefined;

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

afterEach(() => {
  root?.remove();
  root = undefined;
});

function frame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function frames(count: number) {
  for (let index = 0; index < count; index += 1) await frame();
}

function center(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Releases the main button at the end of the test, outside the page. */
function releaseAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: -1, y: -1 }, keys: '[/MouseLeft]' });
  });
}

/** Gives the listed events of each element, in order, as `type@id`. */
function recordEvents(types: string[], ...targets: EventTarget[]) {
  const log: string[] = [];
  for (const target of targets) {
    for (const type of types) {
      target.addEventListener(type, (event) => {
        const at = event.currentTarget;
        log.push(`${type}@${at instanceof Element ? at.id : 'document'}`);
      });
    }
  }
  return log;
}

describe('M1: the server render of siblings', () => {
  test('the first of three siblings has the names of all only with onServerPrefetch', async () => {
    const plain = await renderOnServer('MeasureServerSiblings', { showNames: true });
    const names = (element: Element) =>
      [...element.querySelectorAll('p')].map((p) => p.dataset.names);
    expect(names(plain)).toEqual(['a', 'a b', 'a b c']);
    const deferred = await renderOnServer('MeasureServerSiblings', {
      showNames: true,
      prefetch: true,
    });
    expect(names(deferred)).toEqual(['a b c', 'a b c', 'a b c']);
  });

  test('useId gives a component with onServerPrefetch and its child the same ids on the server and the client', async () => {
    const container = await renderOnServer('MeasureServerSiblings', { prefetch: true });
    const ids = () => [...container.querySelectorAll('[id]')].map((element) => element.id);
    const serverIds = ids();
    expect(new Set(serverIds).size).toBe(6);
    hydrate(MeasureServerSiblings, { prefetch: true }, container);
    await nextTick();
    expect(ids()).toEqual(serverIds);
  });
});

describe('M2: a hydration with other values', () => {
  const serverState = {
    flex: '1 1 0px',
    label: 'Server',
    data: 'server',
    marker: 'server',
  };

  async function hydrateWith(server: object, client: object) {
    const container = await renderOnServer('MeasureStyleHydration', {
      state: { ...serverState, ...server },
    });
    const element = container.firstElementChild as HTMLElement;
    const state = reactive<Record<string, unknown>>({ ...serverState, ...client });
    hydrate(MeasureStyleHydration, { state }, container);
    await nextTick();
    return { element, state };
  }

  test('another style gives a message; with data-allow-mismatch="style" none, and the next render writes the style', async () => {
    await hydrateWith({}, { flex: '2 1 0px' });
    expect(takeReportedMessages().join('\n')).toMatch(/mismatch/i);

    const { element, state } = await hydrateWith({ allow: true }, { allow: true, flex: '2 1 0px' });
    expect(element.style.flex).toBe('1 1 0px');
    state.flex = '3 1 0px';
    await nextTick();
    expect(element.style.flex).toBe('3 1 0px');
  });

  test('another aria-* or data-* attribute gives no message, and the element keeps the server value', async () => {
    const { element } = await hydrateWith({}, { label: 'Client', data: 'client' });
    expect(element).toHaveAttribute('aria-label', 'Server');
    expect(element).toHaveAttribute('data-state', 'server');
  });

  test('an attribute of the server HTML stays when the first and the next render give undefined, and goes when the first gives null', async () => {
    const kept = await hydrateWith({}, { marker: undefined });
    kept.state.flex = '2 1 0px';
    await nextTick();
    expect(kept.element).toHaveAttribute('data-marker', 'server');
    takeReportedMessages();

    const removed = await hydrateWith({}, { marker: null });
    removed.state.marker = undefined;
    await nextTick();
    expect(removed.element).not.toHaveAttribute('data-marker');
    takeReportedMessages();
  });
});

describe('M3: flex items that get their final flex in the flush after the mount', () => {
  async function mountItems(props: { read?: boolean; transition?: string }) {
    const runs: number[] = [];
    const container = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => container.remove());
    container.addEventListener('transitionrun', () => runs.push(1), { capture: true });
    mount(MeasureFlexMount, props, container);
    return { container, runs };
  }

  test('no transition of flex-grow starts', async () => {
    const { runs } = await mountItems({ transition: 'flex-grow 1s' });
    await frames(3);
    expect(runs).toEqual([]);
  });

  test('a child that reads its width in onMounted starts a transition', async () => {
    const { runs } = await mountItems({ read: true, transition: 'flex-grow 1s' });
    await frames(3);
    expect(runs.length).toBeGreaterThan(0);
  });

  // The docs give a panel its transition in a class that the app adds in the first animation
  // frame after the mount.
  test('a transition class that the app adds after the mount starts none from the first animation frame', async () => {
    const results: Record<string, boolean> = {};
    for (const [name, wait] of [
      ['task', () => new Promise((resolve) => setTimeout(resolve))],
      ['first frame', () => frames(1)],
      ['second frame', () => frames(2)],
    ] as const) {
      const style = document.head.appendChild(document.createElement('style'));
      style.textContent = '.moves .item { transition: flex-grow 1s; }';
      const { container, runs } = await mountItems({ read: true });
      await wait();
      container.classList.add('moves');
      await frames(3);
      results[name] = runs.length > 0;
      container.remove();
      style.remove();
    }
    expect(results).toEqual({
      task: server.browser !== 'webkit',
      'first frame': false,
      'second frame': false,
    });
  });
});

describe('the press of a div with pointer capture', () => {
  function pressTarget({ preventMousedown = false } = {}) {
    const container = html(
      '<input id="start" aria-label="Start"><input id="before" aria-label="Before"><div id="target" tabindex="0" style="width: 40px; height: 40px; background: gray"></div><p id="text" style="width: 300px">Some text that a drag can select.</p>',
    );
    const target = container.querySelector<HTMLElement>('#target')!;
    target.addEventListener('pointerdown', (event) => target.setPointerCapture(event.pointerId));
    if (preventMousedown) target.addEventListener('mousedown', (event) => event.preventDefault());
    return { target, text: container.querySelector('p')! };
  }

  test('M4: a move across text selects it only in WebKit; with the default of mousedown prevented, nothing is selected and the div gets no focus', async () => {
    releaseAfterTest();
    const results: Record<string, string> = {};
    for (const preventMousedown of [false, true]) {
      const { target, text } = pressTarget({ preventMousedown });
      await userEvent.pointer({ coords: center(target), keys: '[MouseLeft>]' });
      const rect = text.getBoundingClientRect();
      await userEvent.pointer({ coords: { x: rect.right - 2, y: rect.top + 4 } });
      const selected = getSelection()!.toString() !== '';
      results[preventMousedown ? 'prevented' : 'plain'] =
        `${selected ? 'selected' : 'none'}, ${document.activeElement === target ? 'focus' : 'no focus'}`;
      await userEvent.pointer({ keys: '[/MouseLeft]' });
      getSelection()!.removeAllRanges();
      root!.remove();
    }
    expect(results).toEqual({
      plain: `${server.browser === 'webkit' ? 'selected' : 'none'}, focus`,
      prevented: 'none, no focus',
    });
  });

  // After the Tab key, each browser shows a ring for a focus that a script gives in a press.
  test('M5: focus() matches :focus-visible from pointerdown only after a Tab key, and from a prevented mousedown always', async () => {
    releaseAfterTest();
    const results: Record<string, boolean> = {};
    for (const listener of ['pointerdown', 'mousedown'] as const) {
      for (const afterTab of [false, true]) {
        const { target } = pressTarget({ preventMousedown: true });
        target.addEventListener(listener, () => target.focus({ preventScroll: true }));
        if (afterTab) {
          root!.querySelector<HTMLElement>('#start')!.focus();
          await userEvent.keyboard('{Tab}');
          expect(root!.querySelector('#before')).toHaveFocus();
        }
        await userEvent.pointer({ coords: center(target), keys: '[MouseLeft>]' });
        expect(target).toHaveFocus();
        results[`${listener}${afterTab ? ' after Tab' : ''}`] = target.matches(':focus-visible');
        await userEvent.pointer({ keys: '[/MouseLeft]' });
        root!.remove();
      }
    }
    expect(results).toEqual({
      pointerdown: false,
      'pointerdown after Tab': true,
      mousedown: true,
      'mousedown after Tab': true,
    });
  });

  test('M6: the release of a mouse drag that moved sends a click to the div', async () => {
    releaseAfterTest();
    const { target } = pressTarget();
    const log = recordEvents(['click'], target);
    const at = center(target);
    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: at.x + 15, y: at.y } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(log).toEqual(['click@target']);
  });

  test.skipIf(server.browser !== 'chromium')(
    'M6: the release of a touch drag that moved sends a click in Chromium',
    async () => {
      const { target } = pressTarget();
      target.style.touchAction = 'none';
      const log = recordEvents(['click', 'pointerup'], target);
      const at = center(target);
      await touchDrag(at, { x: at.x + 15, y: at.y });
      expect(log).toEqual(['pointerup@target', 'click@target']);
    },
  );

  test('M7: a capture element that goes during a drag gets no lostpointercapture; only WebKit sends one, to the document', async () => {
    releaseAfterTest();
    const { target } = pressTarget();
    const log = recordEvents(['lostpointercapture', 'pointerup'], target, document);
    await userEvent.pointer({ coords: center(target), keys: '[MouseLeft>]' });
    target.remove();
    await userEvent.pointer({ coords: { x: 300, y: 300 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(log).toEqual(
      server.browser === 'webkit'
        ? ['lostpointercapture@document', 'pointerup@document']
        : ['pointerup@document'],
    );
  });

  // Firefox sends nothing for the release outside the view. Its next move then has no button down.
  test('M8: the release of a drag with capture over an iframe reaches the div; outside the view, not in Firefox', async () => {
    releaseAfterTest();
    const results: string[][] = [];
    for (const place of ['frame', 'outside'] as const) {
      const { target } = pressTarget();
      const frameElement = root!.appendChild(document.createElement('iframe'));
      frameElement.srcdoc = '<p>Frame</p>';
      frameElement.style.cssText = 'width: 200px; height: 100px; border: 0';
      await new Promise((resolve) =>
        frameElement.addEventListener('load', resolve, { once: true }),
      );
      const log = recordEvents(['pointerup'], target);
      await userEvent.pointer({ coords: center(target), keys: '[MouseLeft>]' });
      await userEvent.pointer({
        coords: place === 'frame' ? center(frameElement) : { x: -20, y: -20 },
      });
      await userEvent.pointer({ keys: '[/MouseLeft]' });
      results.push(log);
      root!.remove();
    }
    expect(results).toEqual([
      ['pointerup@target'],
      server.browser === 'firefox' ? [] : ['pointerup@target'],
    ]);
  });
});

test('M9: a focused div that loses its tabindex loses the focus at the next rendering in each browser', async () => {
  const target = html('<div id="target" tabindex="0">Target</div>')
    .firstElementChild as HTMLElement;
  target.focus();
  expect(target).toHaveFocus();
  target.removeAttribute('tabindex');
  await frames(2);
  expect(document.activeElement).toBe(document.body);
});

describe('M10: an absolute child outside the box of its parent', () => {
  const markup = `
    <div id="first" style="position: absolute; left: 100px; top: 100px; width: 2px; height: 200px">
      <span id="first-target" style="position: absolute; top: 0; bottom: 0; left: 50%; width: 20px; translate: -50% 0"></span>
    </div>
    <div id="second" style="position: absolute; left: 0; top: 200px; width: 200px; height: 2px">
      <span id="second-target" style="position: absolute; left: 0; right: 0; top: 50%; height: 20px; translate: 0 -50%"></span>
    </div>`;

  test('is in elementsFromPoint, after a layer over it; two such children of different parents are both in the list', () => {
    const container = html(markup);
    const ids = (x: number, y: number) =>
      document
        .elementsFromPoint(x, y)
        .map((element) => element.id)
        .filter(Boolean);
    expect(ids(106, 150)).toEqual(['first-target']);
    expect(ids(106, 206).sort()).toEqual(['first-target', 'second-target']);
    const layer = container.appendChild(document.createElement('div'));
    layer.id = 'layer';
    layer.style.cssText = 'position: absolute; left: 0; top: 0; width: 300px; height: 300px';
    expect(ids(106, 150)[0]).toBe('layer');
  });

  test('a press on it reaches a pointerdown listener of the parent', async () => {
    const container = html(markup);
    const log = recordEvents(['pointerdown'], container.querySelector('#first')!);
    await userEvent.pointer({ coords: { x: 108, y: 150 }, keys: '[MouseLeft]' });
    expect(log).toEqual(['pointerdown@first']);
  });
});
