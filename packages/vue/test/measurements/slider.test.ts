// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does with a range input in a slider, so that `Slider` has code only where
// they do not do it. Where the browsers differ, the measurement states each one.
import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureRangeInput from '../fixtures/MeasureRangeInput.vue';
import { touchDrag } from '../pointer';
import { mount, settle } from '../render';

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

const chromium = server.browser === 'chromium';
const firefox = server.browser === 'firefox';
const webkit = server.browser === 'webkit';

function center(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// The input of a thumb: clipped, with the place and the size of the thumb.
const HIDDEN_INPUT =
  'position:absolute;top:0;left:0;width:100%;height:100%;margin:0;padding:0;border:0;overflow:hidden;white-space:nowrap;clip-path:inset(50%)';

type Focuser = 'pointerdown' | 'focus of the thumb';

/**
 * A control with one thumb and text after it. `focuser` gives the focus to the range input of the
 * thumb; `prevent` names the event whose default action a listener of the control prevents.
 */
function control(prevent: '' | 'mousedown' | 'pointerdown', focuser: Focuser = 'pointerdown') {
  html(`<input id="before" aria-label="Before">
    <div id="control" style="position:relative;width:200px;height:20px;touch-action:none">
      <div id="thumb" style="position:absolute;left:90px;top:0;width:20px;height:20px">
        <input id="range" type="range" aria-label="Volume" style="${HIDDEN_INPUT}">
      </div>
    </div>
    <p id="text">Some text that a drag can select.</p>`);
  const element = root!.querySelector<HTMLElement>('#control')!;
  const thumb = root!.querySelector<HTMLElement>('#thumb')!;
  const input = root!.querySelector<HTMLInputElement>('#range')!;
  const focusInput = () => input.focus({ preventScroll: true });
  if (focuser === 'pointerdown') element.addEventListener('pointerdown', focusInput);
  if (focuser === 'focus of the thumb') {
    thumb.tabIndex = -1;
    thumb.addEventListener('focus', focusInput);
  }
  if (prevent) element.addEventListener(prevent, (event) => event.preventDefault());
  return { element, thumb, input, text: root!.querySelector('#text')! };
}

/** The focused element, a text selection, and `:active` on `element`. */
function pressState(element: Element) {
  const focused = document.activeElement as HTMLElement;
  return {
    focus: focused.id || focused.localName,
    selected: getSelection()!.toString().length > 0,
    active: element.matches(':active'),
  };
}

/** Presses the real mouse at `from`. The press moves to `to` and ends there. */
async function mousePress(from: { x: number; y: number }, to = from) {
  let held = true;
  onTestFinished(async () => {
    if (held) await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
  });
  await userEvent.pointer({ coords: from, keys: '[MouseLeft>]' });
  return {
    move: () => userEvent.pointer({ coords: to }),
    release: async () => {
      held = false;
      await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
    },
  };
}

describe('S1: a pointerdown listener that focuses the input of a thumb', () => {
  test.each([
    { prevent: '', focus: 'body', selected: !chromium },
    { prevent: 'mousedown', focus: 'range', selected: false },
    { prevent: 'pointerdown', focus: 'range', selected: false },
  ] as const)(
    'mouse, with the default action of "$prevent" prevented: the focus is on $focus; the pressed control matches :active in each browser',
    async ({ prevent, focus, selected }) => {
      const { element, text } = control(prevent);
      const start = center(element);
      const press = await mousePress({ x: start.x - 60, y: start.y }, center(text));
      expect(pressState(element)).toEqual({ focus, selected: false, active: true });
      await press.move();
      expect(pressState(element)).toEqual({ focus, selected, active: true });
      await press.release();
    },
  );

  // A tap gives the compatibility `mousedown` after `pointerup`. A drag gives none.
  test.runIf(chromium).each([
    { prevent: '', tap: 'body' },
    { prevent: 'mousedown', tap: 'range' },
    { prevent: 'pointerdown', tap: 'range' },
  ] as const)(
    'touch in Chromium, with the default action of "$prevent" prevented: a tap leaves the focus on $tap, a drag on the input',
    async ({ prevent, tap }) => {
      const { element } = control(prevent);
      const start = center(element);
      const from = { x: start.x - 60, y: start.y };
      await touchDrag(from, from, 1);
      await settle();
      expect(pressState(element).focus).toBe(tap);
      (document.activeElement as HTMLElement).blur();
      await touchDrag(from, { x: from.x + 50, y: from.y });
      await settle();
      expect(pressState(element).focus).toBe('range');
    },
  );
});

describe('S2: :focus-visible of the input after a press', () => {
  test.each([false, true])(
    'a script focus in the press gives the input :focus-visible in each browser, also after the release and a key (Tab before the press: %s)',
    async (tab) => {
      const { element, input } = control('pointerdown');
      if (tab) {
        root!.querySelector<HTMLElement>('#before')!.focus();
        await userEvent.keyboard('{Tab}');
        root!.querySelector<HTMLElement>('#before')!.focus();
      }
      const press = await mousePress(center(element));
      expect(input.matches(':focus-visible')).toBe(true);
      await press.release();
      expect(input.matches(':focus-visible')).toBe(true);
      await userEvent.keyboard('{ArrowRight}');
      expect(input.matches(':focus-visible')).toBe(true);
    },
  );

  // A record: the browser gives the thumb the focus of the mouse, and a script focus from the
  // focus of the thumb has no ring. The thumb then needs a `tabindex`, and the press needs the
  // default action of `mousedown`, which selects text.
  test('a script focus from a thumb that the mouse focused gives no :focus-visible', async () => {
    const { thumb, input } = control('', 'focus of the thumb');
    const press = await mousePress(center(thumb));
    await press.release();
    expect(document.activeElement).toBe(input);
    expect(input.matches(':focus-visible')).toBe(false);
  });
});

describe('S3: pointer capture in pointerdown', () => {
  function captured() {
    html(`<div id="capture" style="width:100px;height:40px;touch-action:none"></div>
      <iframe id="frame" style="width:200px;height:100px;border:0"></iframe>
      <div id="away" style="width:100px;height:40px"></div>`);
    const element = root!.querySelector<HTMLElement>('#capture')!;
    const log: string[] = [];
    element.addEventListener('pointerdown', (event) => element.setPointerCapture(event.pointerId));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(type, () => log.push(`element ${type}`));
      document.addEventListener(type, (event) => {
        if (event.target !== element) log.push(`document ${type}`);
      });
    }
    return { element, log };
  }

  test.each(['away', 'frame'])(
    'a release over the element "%s" gives the capture element pointerup in each browser',
    async (where) => {
      const { element, log } = captured();
      const press = await mousePress(center(element), center(root!.querySelector(`#${where}`)!));
      await press.move();
      await press.release();
      await settle();
      expect(log).toEqual(['element pointerup', 'element lostpointercapture']);
    },
  );

  // The page of the tests gets no event outside its view in Firefox. The next move there has no
  // button down, so that move ends a press.
  test('a release outside the view gives pointerup in Chromium and WebKit; in Firefox the next move has buttons 0', async () => {
    const { element, log } = captured();
    element.addEventListener('pointermove', (event) => {
      if (event.buttons === 0) log.push('element move with no button');
    });
    const press = await mousePress(center(element), { x: -5, y: -5 });
    await press.move();
    await press.release();
    await userEvent.pointer({ coords: center(root!.querySelector('#away')!) });
    await settle();
    expect(log.filter((entry) => entry !== 'element move with no button')).toEqual(
      firefox ? [] : ['element pointerup', 'element lostpointercapture'],
    );
    if (firefox) expect(log).toContain('element move with no button');
  });

  test('a removed capture element gets no event; the document gets pointerup', async () => {
    const { element, log } = captured();
    const press = await mousePress(center(element), center(root!.querySelector('#away')!));
    element.remove();
    await press.move();
    await press.release();
    await settle();
    // The document gets `lostpointercapture` too in WebKit, and in Firefox in some runs.
    expect(log.filter((entry) => entry.startsWith('element'))).toEqual([]);
    expect(log).toContain('document pointerup');
  });

  test('setPointerCapture throws NotFoundError for a pointerdown that a script makes', () => {
    html('<div></div>');
    const element = root!.querySelector('div')!;
    let thrown = '';
    element.addEventListener('pointerdown', (event) => {
      try {
        element.setPointerCapture(event.pointerId);
      } catch (error) {
        thrown = (error as DOMException).name;
      }
    });
    element.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true }));
    expect(thrown).toBe('NotFoundError');
  });
});

describe('S4: a touch drag in a page that scrolls on the axis of the drag', () => {
  test.runIf(chromium).each([
    { axis: 'x', touchAction: '', end: 'pointercancel' },
    { axis: 'x', touchAction: 'none', end: 'pointerup' },
    { axis: 'y', touchAction: '', end: 'pointercancel' },
    { axis: 'y', touchAction: 'none', end: 'pointerup' },
  ])(
    'axis $axis, touch-action "$touchAction": the drag ends with $end',
    async ({ axis, touchAction, end }) => {
      const horizontal = axis === 'x';
      html(`<div style="width:300px;height:300px;overflow:auto">
        <div style="${horizontal ? 'width:3000px;height:100px' : 'width:100px;height:3000px'}">
          <div id="target" style="width:200px;height:200px;touch-action:${touchAction || 'auto'}"></div>
        </div>
      </div>`);
      const target = root!.querySelector<HTMLElement>('#target')!;
      const log: string[] = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
        target.addEventListener(type, () => {
          if (log.at(-1) !== type) log.push(type);
        });
      }
      const from = center(target);
      const to = horizontal ? { x: from.x - 80, y: from.y } : { x: from.x, y: from.y - 80 };
      await touchDrag(from, to, 8);
      await settle();
      expect(log).toEqual(['pointerdown', 'pointermove', end]);
    },
  );
});

describe('S5: a focused range input that becomes disabled', () => {
  test('keeps the focus in the task of the change, and has no focus after a frame in each browser', async () => {
    html('<input type="range" aria-label="Volume">');
    const input = root!.querySelector('input')!;
    input.focus();
    input.disabled = true;
    expect(document.activeElement).toBe(input);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settle();
    expect(document.activeElement).not.toBe(input);
    expect(input.matches(':focus')).toBe(false);
  });
});

describe('S6: Vue and a range input with min, max and value in one object for v-bind', () => {
  function mountInput(state: { max: number; value: number; accept: boolean }) {
    const model = reactive({
      min: 0,
      ...state,
      write(value: number) {
        if (model.accept) model.value = value;
      },
    });
    const input = mount(MeasureRangeInput, { model }).root.querySelector('input')!;
    return { model, input };
  }

  test('the element keeps a value that the parent refuses', async () => {
    const { input } = mountInput({ max: 100, value: 50, accept: false });
    input.focus();
    await userEvent.keyboard('{ArrowRight}');
    await settle();
    expect(input.value).toBe('51');
  });

  test('Vue writes value after max, also when value comes first: at the first render, and when max grows over the value', async () => {
    expect(mountInput({ max: 200, value: 150, accept: true }).input.value).toBe('150');
    const { model, input } = mountInput({ max: 100, value: 150, accept: true });
    expect(input.value).toBe('100');
    model.max = 200;
    await nextTick();
    expect(input.value).toBe('150');
  });
});

describe('S7: the native keys of a range input', () => {
  async function valueAfter(key: string, options: { dir?: string; vertical?: boolean } = {}) {
    html(`<div dir="${options.dir ?? 'ltr'}">
      <input type="range" aria-label="Volume" min="0" max="100" value="50"
        style="writing-mode:${options.vertical ? 'vertical-lr' : 'horizontal-tb'}">
    </div>`);
    const input = root!.querySelector('input')!;
    input.focus();
    await userEvent.keyboard(key);
    root!.remove();
    return input.value;
  }

  test('Page Up and Page Down take 10 % of the range; right-to-left and a vertical input differ in WebKit and Chromium', async () => {
    const results: Record<string, string> = {};
    for (const key of ['ArrowRight', 'ArrowUp', 'PageUp', 'PageDown', 'Home', 'End']) {
      results[key] = await valueAfter(`{${key}}`);
    }
    results['rtl ArrowRight'] = await valueAfter('{ArrowRight}', { dir: 'rtl' });
    results['vertical ArrowUp'] = await valueAfter('{ArrowUp}', { vertical: true });
    results['vertical ArrowRight'] = await valueAfter('{ArrowRight}', { vertical: true });
    expect(results).toEqual({
      ArrowRight: '51',
      ArrowUp: '51',
      PageUp: '60',
      PageDown: '40',
      Home: '0',
      End: '100',
      'rtl ArrowRight': webkit ? '51' : '49',
      'vertical ArrowUp': chromium ? '49' : '51',
      'vertical ArrowRight': webkit ? '49' : '51',
    });
  });

  test('Ctrl, Alt and Meta with an arrow change the value in Chromium and WebKit, and not in Firefox; Shift with an arrow takes one step', async () => {
    const results: Record<string, string> = {};
    for (const modifier of ['Control', 'Alt', 'Meta', 'Shift']) {
      for (const key of ['ArrowRight', 'ArrowDown']) {
        results[`${modifier} ${key}`] = await valueAfter(`{${modifier}>}{${key}}{/${modifier}}`);
      }
    }
    const [up, down] = firefox ? ['50', '50'] : ['51', '49'];
    expect(results).toEqual({
      'Control ArrowRight': up,
      'Control ArrowDown': down,
      'Alt ArrowRight': up,
      'Alt ArrowDown': down,
      'Meta ArrowRight': up,
      'Meta ArrowDown': down,
      'Shift ArrowRight': '51',
      'Shift ArrowDown': '49',
    });
  });

  // WebKit runs with full keyboard access: the test setup turns it on in macOS.
  test('Tab reaches a range input in each browser', async () => {
    html(
      '<input id="before" aria-label="Before"><input id="range" type="range" aria-label="Volume">',
    );
    root!.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement?.id).toBe('range');
  });
});

describe('S8: a click on the label of a clipped range input', () => {
  test('gives the input the focus in Chromium and Firefox, and not in WebKit', async () => {
    html(`<label for="range" id="label">Volume</label>
      <div style="position:relative;width:20px;height:20px">
        <input id="range" type="range" style="${HIDDEN_INPUT}">
      </div>`);
    await userEvent.click(root!.querySelector('#label')!);
    expect(document.activeElement).toBe(webkit ? document.body : root!.querySelector('#range'));
  });
});

type AXNode = {
  name?: { value: string };
  value?: { value: unknown };
  properties?: { name: string; value: { value: unknown } }[];
};
type FrameTree = { frame: { id: string }; childFrames?: FrameTree[] };

describe('S9: the accessibility tree of Chromium', () => {
  // Playwright reads the accessibility tree of Chromium only.
  test.runIf(chromium)(
    'a range input with no aria-valuenow has the value of the input; writing-mode gives it a vertical orientation, and aria-orientation does not',
    async () => {
      html(`<input type="range" aria-label="Plain" min="0" max="10" value="3">
        <input type="range" aria-label="Writing mode" value="3" style="writing-mode:vertical-lr">
        <input type="range" aria-label="ARIA" value="3" aria-orientation="vertical">`);
      const session = cdp();
      await session.send('Accessibility.enable');
      const { frameTree } = (await session.send('Page.getFrameTree')) as { frameTree: FrameTree };
      const found: Record<string, { value: unknown; orientation: unknown }> = {};
      const visit = async (tree: FrameTree) => {
        const { nodes } = (await session.send('Accessibility.getFullAXTree', {
          frameId: tree.frame.id,
        })) as { nodes: AXNode[] };
        for (const node of nodes) {
          const name = node.name?.value ?? '';
          if (['Plain', 'Writing mode', 'ARIA'].includes(name)) {
            const orientation = node.properties?.find((p) => p.name === 'orientation');
            found[name] = { value: node.value?.value, orientation: orientation?.value.value };
          }
        }
        for (const child of tree.childFrames ?? []) await visit(child);
      };
      await visit(frameTree);
      expect(found).toEqual({
        Plain: { value: 3, orientation: 'horizontal' },
        'Writing mode': { value: 3, orientation: 'vertical' },
        ARIA: { value: 3, orientation: 'horizontal' },
      });
    },
  );
});
