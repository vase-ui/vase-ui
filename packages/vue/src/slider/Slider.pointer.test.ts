import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  SliderRootChangeEventDetails,
  SliderRootCommitEventDetails,
} from '@vase-ui/vue/slider';
import SliderControlSwap from '../../test/fixtures/SliderControlSwap.vue';
import SliderParts from '../../test/fixtures/SliderParts.vue';
import { penDrag, touchDrag } from '../../test/pointer';
import { mount, settle } from '../../test/render';
import { waitSingleFrame } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Attrs = Record<string, unknown>;

/**
 * Mounts a slider whose control is 100 px long, so that one pixel is one percent. Each made
 * pointer event goes to the control or to a thumb. A browser refuses `setPointerCapture` for a
 * pointer that a script makes, so the control records the calls.
 */
async function mountSlider(
  props: { root?: Attrs; thumbs?: Attrs[]; control?: Attrs; field?: Attrs },
  madePointers = true,
) {
  const { root } = mount(SliderParts, props);
  await nextTick();
  const control = root.querySelector<HTMLElement>('[style*="touch-action"]')!;
  const captures: number[] = [];
  if (madePointers) control.setPointerCapture = (pointerId: number) => captures.push(pointerId);
  const inputs = () => [...root.querySelectorAll<HTMLInputElement>('input[type=range]')];
  const vertical = props.root?.orientation === 'vertical';
  /** The client point of a value on the axis, in the middle of the other axis. */
  const at = (value: number) => {
    const rect = control.getBoundingClientRect();
    return vertical
      ? { clientX: rect.left + rect.width / 2, clientY: rect.bottom - value }
      : { clientX: rect.left + value, clientY: rect.top + rect.height / 2 };
  };
  // A browser sends each pointer event in a task of its own, and Vue renders between two.
  async function fire(type: string, target: Element, init: PointerEventInit) {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      ...init,
    });
    target.dispatchEvent(event);
    await nextTick();
    return event;
  }
  return {
    root,
    control,
    captures,
    inputs,
    values: () => inputs().map((input) => input.valueAsNumber),
    thumb: (index = 0) => inputs()[index]!.parentElement!,
    group: root.querySelector<HTMLElement>('[role=group]')!,
    at,
    down: (value: number, init: PointerEventInit = {}, target: Element = control) =>
      fire('pointerdown', target, { ...at(value), ...init }),
    move: (value: number, init: PointerEventInit = {}) =>
      fire('pointermove', control, { ...at(value), ...init }),
    up: (value: number, init: PointerEventInit = {}) =>
      fire('pointerup', control, { ...at(value), ...init }),
    cancel: (init: PointerEventInit = {}) => fire('pointercancel', control, init),
  };
}

/** Props of `Slider.Root` with `v-model`, which write each event in `log`. */
function sliderModel(log: string[], modelValue: unknown) {
  const root = reactive<Attrs>({
    modelValue,
    onValueChange: (value: unknown, details: SliderRootChangeEventDetails) =>
      log.push(`change ${String(value)} ${details.reason} ${details.activeThumbIndex}`),
    onValueCommitted: (value: unknown, details: SliderRootCommitEventDetails) =>
      log.push(`commit ${String(value)} ${details.reason} ${details.event.type}`),
  });
  root['onUpdate:modelValue'] = (value: unknown) => (root.modelValue = value);
  return root;
}

async function key(input: HTMLInputElement) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await nextTick();
}

describe('a press on the control', () => {
  test.each(['mouse', 'pen', 'touch'])(
    '%s: moves the nearest thumb at once, then with each move; the end commits once; dragging is on for the whole press',
    async (pointerType) => {
      const log: string[] = [];
      const slider = await mountSlider({ root: sliderModel(log, [20, 60]), thumbs: [{}, {}] });
      const down = await slider.down(50, { pointerType, pointerId: 5 });
      expect(down.defaultPrevented).toBe(true);
      expect(slider.captures).toEqual([5]);
      expect(document.activeElement).toBe(slider.inputs()[1]);
      expect(slider.group).toHaveAttribute('data-dragging');
      await slider.move(55, { pointerType, pointerId: 5 });
      await slider.move(55.2, { pointerType, pointerId: 5 });
      await slider.up(55.2, { pointerType, pointerId: 5 });
      await nextTick();
      expect(slider.group).not.toHaveAttribute('data-dragging');
      expect(log).toEqual([
        'change 20,50 track-press 1',
        'change 20,55 drag 1',
        'commit 20,55 drag pointerup',
      ]);
    },
  );

  test.each(['horizontal', 'vertical'])(
    '%s: a press on a thumb changes no value, and the drag keeps the distance between the pointer and the centre of the thumb',
    async (orientation) => {
      const log: string[] = [];
      const root = sliderModel(log, 40);
      root.orientation = orientation;
      const slider = await mountSlider({ root });
      await slider.down(43, {}, slider.thumb());
      await slider.move(63);
      await slider.up(63);
      await nextTick();
      expect(log).toEqual(['change 60 drag 0', 'commit 60 drag pointerup']);
    },
  );

  test('a press with no accepted change commits nothing; pointercancel ends a press and commits', async () => {
    const log: string[] = [];
    const root = sliderModel(log, 40);
    const slider = await mountSlider({ root });
    await slider.down(40);
    await slider.up(40);
    expect(log).toEqual([]);
    await slider.down(70);
    await slider.cancel();
    expect(log).toEqual(['change 70 track-press 0', 'commit 70 track-press pointercancel']);
    expect(slider.group).not.toHaveAttribute('data-dragging');
    // The press is over: a later move and release change nothing.
    await slider.move(90);
    await slider.up(90);
    expect(log).toHaveLength(2);
    log.length = 0;
    root.onValueChange = (_: unknown, details: SliderRootChangeEventDetails) => details.cancel();
    await nextTick();
    await slider.down(10);
    await slider.move(20);
    await slider.up(20);
    expect(log).toEqual([]);
  });

  test('only the main button starts a press; a disabled slider, a disabled thumb and a second pointer start none and keep the native action', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [20, 60]);
    const thumbs = reactive<Attrs[]>([{ disabled: true }, {}]);
    const slider = await mountSlider({ root, thumbs });
    expect((await slider.down(50, { button: 2 })).defaultPrevented).toBe(false);
    expect((await slider.down(20, {}, slider.thumb(0))).defaultPrevented).toBe(false);
    await slider.down(50);
    expect((await slider.down(80, { pointerId: 2 })).defaultPrevented).toBe(false);
    await slider.move(80, { pointerId: 2 });
    await slider.up(80, { pointerId: 2 });
    await slider.move(55);
    await slider.up(55);
    expect(log).toEqual([
      'change 20,50 track-press 1',
      'change 20,55 drag 1',
      'commit 20,55 drag pointerup',
    ]);
    root.disabled = true;
    await nextTick();
    expect((await slider.down(10)).defaultPrevented).toBe(false);
    thumbs[1]!.disabled = true;
    root.disabled = false;
    await nextTick();
    expect((await slider.down(10)).defaultPrevented).toBe(false);
  });

  test('the press ends with no commit when the slider becomes disabled', async () => {
    const log: string[] = [];
    const root = sliderModel(log, 40);
    const control = reactive<Attrs>({});
    const slider = await mountSlider({ root, control });
    await slider.down(50);
    expect(document.activeElement).toBe(slider.inputs()[0]);
    root.disabled = true;
    await nextTick();
    // The browser takes the focus from a control that becomes disabled, at its next rendering.
    await waitFor(() => expect(document.activeElement).not.toBe(slider.inputs()[0]));
    root.disabled = false;
    await nextTick();
    await slider.move(60);
    await slider.up(60);
    expect(log).toEqual(['change 50 track-press 0']);
    expect(slider.group).not.toHaveAttribute('data-dragging');
  });

  test('a move with no button down ends the press and commits', async () => {
    const log: string[] = [];
    const slider = await mountSlider({ root: sliderModel(log, 40) });
    await slider.down(50);
    await slider.move(70, { buttons: 0 });
    await slider.move(80);
    expect(log).toEqual(['change 50 track-press 0', 'commit 50 track-press pointermove']);
  });

  test('a press on thumbs together at max takes the first enabled thumb of them', async () => {
    const log: string[] = [];
    const slider = await mountSlider({
      root: sliderModel(log, [100, 100, 100]),
      thumbs: [{}, { disabled: true }, {}],
    });
    await slider.down(100, {}, slider.thumb(2));
    await slider.move(90);
    await slider.up(90);
    expect(log).toEqual(['change 90,100,100 drag 0', 'commit 90,100,100 drag pointerup']);
  });

  test('a key during a press: the end commits only a change after the key', async () => {
    const log: string[] = [];
    const slider = await mountSlider({ root: sliderModel(log, 40) });
    await slider.down(50);
    await key(slider.inputs()[0]!);
    await slider.up(51);
    await slider.down(60);
    await key(slider.inputs()[0]!);
    await slider.move(70);
    await slider.up(70);
    expect(log).toEqual([
      'change 50 track-press 0',
      'change 51 keyboard 0',
      'commit 51 keyboard keydown',
      'change 60 track-press 0',
      'change 61 keyboard 0',
      'commit 61 keyboard keydown',
      'change 70 drag 0',
      'commit 70 drag pointerup',
    ]);
  });

  test('a mousedown on the control reaches the listeners of the page with its target, and changes nothing', async () => {
    const log: string[] = [];
    const slider = await mountSlider({ root: sliderModel(log, 0) });
    const targets: (EventTarget | null)[] = [];
    const record = (event: Event) => targets.push(event.target);
    document.addEventListener('mousedown', record);
    onTestFinished(() => document.removeEventListener('mousedown', record));
    slider.root.addEventListener('mousedown', record);
    slider.control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50 }));
    expect(targets).toEqual([slider.control, slider.control]);
    expect(log).toEqual([]);
  });

  test('a press on a control with no thumb changes nothing', async () => {
    const log: string[] = [];
    const slider = await mountSlider({ root: sliderModel(log, 20), thumbs: [] });
    const down = await slider.down(60);
    await slider.move(80);
    await slider.up(80);
    expect(down.defaultPrevented).toBe(false);
    expect(log).toEqual([]);
  });
});

describe('a press and the values of the parent', () => {
  test.each([
    { name: 'removes a value', first: [10, 20, 30], next: [10, 20] },
    { name: 'adds a value', first: [10, 20], next: [10, 20, 30] },
  ])(
    'a parent that $name during a press: the end commits nothing, and the next press works',
    async ({ first, next }) => {
      const log: string[] = [];
      const root = sliderModel(log, first);
      const thumbs = reactive<Attrs[]>(first.map(() => ({})));
      const slider = await mountSlider({ root, thumbs });
      await slider.down(20, {}, slider.thumb(1));
      await slider.move(25);
      expect(log).toEqual([`change 10,25${first.length > 2 ? ',30' : ''} drag 1`]);
      log.length = 0;
      root.modelValue = next;
      thumbs.splice(0, thumbs.length, ...next.map(() => ({})));
      await nextTick();
      await slider.up(25);
      expect(log).toEqual([]);
      await slider.down(80);
      await slider.up(80);
      expect(log.at(-1)).toMatch(/^commit .*80 track-press pointerup$/);
    },
  );

  test('a parent removes a value during a drag: no error, and the next press works', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [20, 60]);
    const slider = await mountSlider({ root, thumbs: [{}, {}] });
    await slider.down(60, {}, slider.thumb(1));
    root.modelValue = [20];
    await nextTick();
    await slider.move(80);
    await slider.up(80);
    await slider.down(30);
    await slider.up(30);
    expect(log).toEqual(['change 30 track-press 0', 'commit 30 track-press pointerup']);
  });

  test('a move after a parent adds a value during a press: the end commits the values of that move', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [10, 20]);
    const thumbs = reactive<Attrs[]>([{}, {}]);
    const slider = await mountSlider({ root, thumbs });
    await slider.down(20, {}, slider.thumb(1));
    await slider.move(25);
    root.modelValue = [10, 20, 30];
    thumbs.push({});
    await nextTick();
    log.length = 0;
    await slider.move(27);
    await slider.up(27);
    expect(log).toEqual(['change 10,27,30 drag 1', 'commit 10,27,30 drag pointerup']);
  });

  test('a single value in an array stays an array after a press', async () => {
    const updates: unknown[] = [];
    const root = reactive<Attrs>({ defaultValue: [25] });
    root['onUpdate:modelValue'] = (value: unknown) => updates.push(value);
    root.onValueCommitted = (value: unknown) => updates.push(value);
    const slider = await mountSlider({ root });
    await slider.down(50);
    await slider.up(50);
    expect(updates).toEqual([[50], [50]]);
  });

  test('a drag from a value of the parent out of the range gives values in the range', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [19, 41]);
    Object.assign(root, { min: 20, max: 40 });
    const slider = await mountSlider({ root, thumbs: [{}, {}] });
    expect(slider.values()).toEqual([20, 40]);
    await slider.down(100, {}, slider.thumb(1));
    await slider.move(20);
    await slider.up(20);
    for (const value of slider.values()) {
      expect(value).toBeGreaterThanOrEqual(20);
      expect(value).toBeLessThanOrEqual(40);
    }
    expect(log.at(-1)).toMatch(/^commit /);
  });
});

describe('the end of a press', () => {
  test.each([
    { name: 'one thumb', model: 20, thumbs: [{}], committed: '40' },
    { name: 'a range', model: [20, 80], thumbs: [{}, {}], committed: '40,80' },
  ])(
    '$name: the end commits the last accepted change when a later move is cancelled, also at another place',
    async ({ model, thumbs, committed }) => {
      const log: string[] = [];
      const root = sliderModel(log, model);
      let cancel = false;
      const record = root.onValueChange as (
        value: unknown,
        details: SliderRootChangeEventDetails,
      ) => void;
      root.onValueChange = (value: unknown, details: SliderRootChangeEventDetails) => {
        record(value, details);
        if (cancel) details.cancel();
      };
      const slider = await mountSlider({ root, thumbs });
      await slider.down(20, {}, slider.thumb(0));
      await slider.move(40);
      cancel = true;
      await slider.move(60);
      await slider.up(70);
      expect(log.at(-1)).toBe(`commit ${committed} drag pointerup`);
      expect(slider.values().join(',')).toBe(committed);
    },
  );
});

describe('the element of the control', () => {
  test.each([
    { name: 'gets another element', change: (scene: { tag: string }) => (scene.tag = 'section') },
    { name: 'unmounts', change: (scene: { shown: boolean }) => (scene.shown = false) },
  ])('a press ends with no commit when the control $name', async ({ change }) => {
    const log: string[] = [];
    const scene = reactive({ tag: 'div', shown: true });
    const { root } = mount(SliderControlSwap, { root: sliderModel(log, 40), scene });
    await nextTick();
    const control = root.querySelector<HTMLElement>('[style*="touch-action"]')!;
    control.setPointerCapture = () => {};
    const rect = control.getBoundingClientRect();
    const init = {
      bubbles: true,
      pointerId: 1,
      buttons: 1,
      clientX: rect.left + 70,
      clientY: rect.top + 5,
    };
    control.dispatchEvent(new PointerEvent('pointerdown', init));
    await nextTick();
    const group = root.querySelector('[role=group]')!;
    expect(group).toHaveAttribute('data-dragging');
    change(scene as never);
    await nextTick();
    expect(group).not.toHaveAttribute('data-dragging');
    control.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    expect(log).toEqual(['change 70 track-press 0']);
  });
});

describe('thumbs that meet in a drag', () => {
  test('push: the thumb pushes its neighbour; a pushed thumb stays when the drag goes back', async () => {
    const log: string[] = [];
    const slider = await mountSlider({ root: sliderModel(log, [20, 40]), thumbs: [{}, {}] });
    await slider.down(20, {}, slider.thumb(0));
    await slider.move(65);
    await slider.move(30);
    await slider.up(30);
    expect(slider.values()).toEqual([30, 65]);
  });

  test('push: a disabled thumb is a wall; a part of a step as the least distance keeps whole steps', async () => {
    const walled = await mountSlider({
      root: { defaultValue: [20, 40, 60] },
      thumbs: [{}, {}, { disabled: true }],
    });
    await walled.down(20, {}, walled.thumb(0));
    await walled.move(90);
    await walled.up(90);
    expect(walled.values()).toEqual([60, 60, 60]);
    const spaced = await mountSlider({
      root: { defaultValue: [0, 5, 10], minStepsBetweenValues: 0.5 },
      thumbs: [{}, {}, {}],
    });
    await spaced.down(10, {}, spaced.thumb(2));
    await spaced.move(0);
    await spaced.up(0);
    expect(spaced.values()).toEqual([0, 1, 2]);
  });

  test('none: the thumb stops at its neighbour', async () => {
    const slider = await mountSlider({
      root: { defaultValue: [20, 40], thumbCollisionBehavior: 'none' },
      thumbs: [{}, {}],
    });
    await slider.down(20, {}, slider.thumb(0));
    await slider.move(65);
    await slider.up(65);
    await nextTick();
    expect(slider.values()).toEqual([40, 40]);
  });

  test('swap: the drag goes on with the neighbour, and the focus with it; after a cancel the press and the focus stay', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [20, 40, 60]);
    Object.assign(root, { thumbCollisionBehavior: 'swap', minStepsBetweenValues: 10 });
    const slider = await mountSlider({ root, thumbs: [{}, {}, {}] });
    await slider.down(20, {}, slider.thumb(0));
    await slider.move(80);
    await nextTick();
    expect(slider.values()).toEqual([30, 50, 80]);
    expect(document.activeElement).toBe(slider.inputs()[2]);
    await slider.up(80);
    root.onValueChange = (_: unknown, details: SliderRootChangeEventDetails) => details.cancel();
    await nextTick();
    await slider.down(30, {}, slider.thumb(0));
    await slider.move(60);
    await nextTick();
    expect(document.activeElement).toBe(slider.inputs()[0]);
    root.onValueChange = undefined;
    await nextTick();
    await slider.move(45);
    await slider.up(45);
    expect(slider.values()).toEqual([40, 50, 80]);
    expect(log.at(-1)).toBe('commit 40,50,80 drag pointerup');
  });

  test('swap: a press on the track moves the nearest thumb, and the drag goes on with the neighbour and the focus', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [20, 40]);
    root.thumbCollisionBehavior = 'swap';
    const slider = await mountSlider({ root, thumbs: [{}, {}] });
    await slider.down(20);
    await slider.move(70);
    expect(document.activeElement).toBe(slider.inputs()[1]);
    await slider.up(70);
    expect(log.slice(-2)).toEqual(['change 40,70 drag 1', 'commit 40,70 drag pointerup']);
  });

  test('swap: the drag keeps the distance from the pointer to the centre of the thumb, and 0 for a thumb with no element', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [20, 40]);
    root.thumbCollisionBehavior = 'swap';
    const slider = await mountSlider({ root });
    await slider.down(23, {}, slider.thumb(0));
    await slider.move(33);
    await slider.move(53);
    await slider.move(63);
    await slider.up(63);
    expect(log).toEqual([
      'change 30,40 drag 0',
      'change 40,50 drag 1',
      'change 40,63 drag 1',
      'commit 40,63 drag pointerup',
    ]);
  });
});

describe('the geometry', () => {
  test.each([
    { name: 'vertical', root: { orientation: 'vertical' } },
    { name: 'right-to-left', root: { dir: 'rtl' } },
    {
      name: 'a border and a padding',
      control: { style: 'border: 5px solid; padding: 0 10px; box-sizing: content-box' },
    },
  ])('$name: a point gives the value under it', async ({ root, control }) => {
    const slider = await mountSlider({ root: { defaultValue: 0, ...root }, control });
    const rect = slider.control.getBoundingClientRect();
    const point =
      root?.orientation === 'vertical'
        ? { clientX: rect.left + 5, clientY: rect.bottom - 30 }
        : root?.dir === 'rtl'
          ? { clientX: rect.right - 30, clientY: rect.top + 5 }
          : { clientX: rect.left + 15 + 30, clientY: rect.top + 10 };
    await slider.down(0, point);
    await slider.up(0, point);
    await nextTick();
    expect(slider.values()).toEqual([30]);
  });

  test('a control that moves during a drag keeps the thumb at the pointer', async () => {
    const control = reactive<Attrs>({});
    const slider = await mountSlider({ root: { defaultValue: 0 }, control });
    await slider.down(10);
    const before = slider.at(50);
    control.style = 'margin-left: 20px';
    await nextTick();
    await slider.move(0, before);
    await slider.up(0, before);
    await nextTick();
    expect(slider.values()).toEqual([30]);
  });

  test('a control with no room changes nothing', async () => {
    const log: string[] = [];
    const slider = await mountSlider({
      root: sliderModel(log, 40),
      control: { style: 'width: 0' },
    });
    await slider.down(20);
    await slider.move(30);
    await slider.up(30);
    await slider.down(40, {}, slider.thumb());
    await slider.move(30);
    await slider.up(30);
    expect(log).toEqual([]);
  });
});

describe('the places of the thumbs and of the indicator', () => {
  /** The center of each thumb and the two ends of the indicator, in px from the start of the control. */
  function places(slider: Awaited<ReturnType<typeof mountSlider>>) {
    const control = slider.control.getBoundingClientRect();
    const indicator = slider.control
      .querySelector<HTMLElement>('[style*="inherit"]')!
      .getBoundingClientRect();
    const fromStart = (x: number) => Math.round(x - control.left);
    return {
      thumbs: slider.inputs().map((input) => {
        const thumb = input.parentElement!.getBoundingClientRect();
        return fromStart(thumb.left + thumb.width / 2);
      }),
      indicator: [fromStart(indicator.left), fromStart(indicator.right)],
    };
  }

  test('a thumb is at its value after a drag and after a change of the parent, also a change out of the range', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [20, 40]);
    const slider = await mountSlider({ root, thumbs: [{}, {}] });
    expect(places(slider)).toEqual({ thumbs: [20, 40], indicator: [20, 40] });
    await slider.down(40, {}, slider.thumb(1));
    await slider.move(70);
    await slider.up(70);
    expect(places(slider)).toEqual({ thumbs: [20, 70], indicator: [20, 70] });
    root.modelValue = [33, 72];
    await nextTick();
    expect(places(slider)).toEqual({ thumbs: [33, 72], indicator: [33, 72] });
    root.modelValue = [-7.31, 119.9];
    await nextTick();
    expect(places(slider)).toEqual({ thumbs: [0, 100], indicator: [0, 100] });
  });

  test.each([
    { name: 'one thumb', model: 30, thumbs: [{}], indicator: [0, 30] },
    { name: 'a range', model: [30, 70], thumbs: [{}, {}], indicator: [30, 70] },
  ])(
    '$name: the indicator goes from the start of the axis, or from the first thumb, to the last thumb, in each direction and on each axis',
    async ({ model, thumbs, indicator }) => {
      const rtl = await mountSlider({ root: { defaultValue: model, dir: 'rtl' }, thumbs });
      const box = rtl.control.getBoundingClientRect();
      const bar = rtl.control.querySelector('[style*="inherit"]')!.getBoundingClientRect();
      expect([box.right - bar.right, box.right - bar.left].map(Math.round)).toEqual(indicator);
      const vertical = await mountSlider({
        root: { defaultValue: model, orientation: 'vertical' },
        thumbs,
      });
      const column = vertical.control.getBoundingClientRect();
      const fill = vertical.control.querySelector('[style*="inherit"]')!.getBoundingClientRect();
      expect([column.bottom - fill.bottom, column.bottom - fill.top].map(Math.round)).toEqual(
        indicator,
      );
    },
  );
});

describe('thumbAlignment edge', () => {
  test('a thumb is in the control at min, in the middle and at max; the indicator ends at the centre of the thumb, also after the thumb gets another size', async () => {
    const root = reactive<Attrs>({ defaultValue: 0, thumbAlignment: 'edge' });
    const thumbs = reactive<Attrs[]>([{}]);
    const slider = await mountSlider({ root, thumbs });
    const indicator = slider.control.querySelector<HTMLElement>('[style*="inherit"]')!;
    const place = () => {
      const control = slider.control.getBoundingClientRect();
      const thumb = slider.thumb().getBoundingClientRect();
      return [thumb.left - control.left, thumb.right - control.left];
    };
    expect(place()).toEqual([0, 10]);
    root.defaultValue = undefined;
    root.modelValue = 50;
    await nextTick();
    expect(place()).toEqual([45, 55]);
    root.modelValue = 100;
    await nextTick();
    expect(place()).toEqual([90, 100]);
    root.modelValue = 30;
    await waitSingleFrame();
    await settle();
    expect(indicator.getBoundingClientRect().width).toBeCloseTo(32);
    thumbs[0]!.style = 'width: 20px; height: 10px';
    await waitSingleFrame();
    await settle();
    // The centre of a thumb of 20 px at 30 %: 10 + 0.3 × 80.
    expect(indicator.getBoundingClientRect().width).toBeCloseTo(34);
  });

  test.each([
    {
      name: 'right-to-left',
      root: { dir: 'rtl' },
      ends: (c: DOMRect, t: DOMRect) => [c.right - t.right, c.right - t.left],
    },
    {
      name: 'vertical',
      root: { orientation: 'vertical' },
      ends: (c: DOMRect, t: DOMRect) => [c.bottom - t.bottom, c.bottom - t.top],
    },
  ])('$name: a thumb is in the control at min and at max', async ({ root, ends }) => {
    const props = reactive<Attrs>({ ...root, thumbAlignment: 'edge', modelValue: 0 });
    const slider = await mountSlider({ root: props });
    const place = () =>
      ends(slider.control.getBoundingClientRect(), slider.thumb().getBoundingClientRect());
    expect(place()).toEqual([0, 10]);
    props.modelValue = 100;
    await nextTick();
    expect(place()).toEqual([90, 100]);
  });

  test('a range: each end of the indicator is at the centre of its thumb, also after the last thumb gets another size; with center, at the percent', async () => {
    const root = reactive<Attrs>({ defaultValue: [0, 100], thumbAlignment: 'edge' });
    const thumbs = reactive<Attrs[]>([{}, {}]);
    const slider = await mountSlider({ root, thumbs });
    const indicator = slider.control.querySelector<HTMLElement>('[style*="inherit"]')!;
    const ends = async () => {
      await waitSingleFrame();
      await settle();
      const control = slider.control.getBoundingClientRect();
      const rect = indicator.getBoundingClientRect();
      return [rect.left - control.left, rect.right - control.left];
    };
    expect(await ends()).toEqual([5, 95]);
    thumbs[1]!.style = 'width: 20px; height: 10px';
    expect(await ends()).toEqual([5, 90]);
    root.thumbAlignment = 'center';
    expect(await ends()).toEqual([0, 100]);
  });

  test('the indicator ends at the centre of the thumb after the slider shows, from a parent with display none', async () => {
    const hidden = document.body.appendChild(document.createElement('div'));
    hidden.style.display = 'none';
    onTestFinished(() => hidden.remove());
    const { root } = mount(
      SliderParts,
      { root: { defaultValue: 30, thumbAlignment: 'edge' } },
      hidden,
    );
    await settle();
    hidden.style.display = '';
    const indicator = root.querySelector<HTMLElement>('[style*="inherit"]')!;
    // The centre of a thumb of 10 px at 30 %: 5 + 0.3 × 90.
    await waitSingleFrame();
    await settle();
    expect(indicator.getBoundingClientRect().width).toBeCloseTo(32);
  });

  test.each([
    { name: 'the last thumb unmounts', next: ['a', 'b'], ends: [23, 50] },
    { name: 'the first thumb unmounts', next: ['b', 'c'], ends: [50, 77] },
  ])(
    'a range: when $name, each end of the indicator goes to the centre of the new end thumb',
    async ({ next, ends }) => {
      const values: Record<string, number> = { a: 20, b: 50, c: 80 };
      const root = reactive<Attrs>({ modelValue: [20, 50, 80], thumbAlignment: 'edge' });
      const thumbs = reactive<Attrs[]>([{ key: 'a' }, { key: 'b' }, { key: 'c' }]);
      const slider = await mountSlider({ root, thumbs });
      const indicator = slider.control.querySelector<HTMLElement>('[style*="inherit"]')!;
      const indicatorEnds = async () => {
        await waitSingleFrame();
        await settle();
        const control = slider.control.getBoundingClientRect();
        const rect = indicator.getBoundingClientRect();
        return [rect.left - control.left, rect.right - control.left].map(Math.round);
      };
      // The centre of a thumb of 10 px at a value: 5 + value × 0.9.
      expect(await indicatorEnds()).toEqual([23, 77]);
      root.modelValue = next.map((key) => values[key]!);
      thumbs.splice(0, 3, ...next.map((key) => ({ key })));
      expect(await indicatorEnds()).toEqual(ends);
    },
  );

  test('VUE-148: after a change to the vertical axis, the thumb and the end of the indicator use the size of the thumb on that axis', async () => {
    const root = reactive<Attrs>({ defaultValue: 30, thumbAlignment: 'edge' });
    const slider = await mountSlider({ root, thumbs: [{ style: 'width: 20px; height: 10px' }] });
    const indicator = slider.control.querySelector<HTMLElement>('[style*="inherit"]')!;
    const frame = async () => {
      await waitSingleFrame();
      await settle();
    };
    await frame();
    // The centre of a thumb of 20 px at 30 %: 10 + 0.3 × 80.
    expect(indicator.getBoundingClientRect().width).toBeCloseTo(34);
    root.orientation = 'vertical';
    await frame();
    const control = slider.control.getBoundingClientRect();
    // The thumb keeps its size, and it is 10 px on the new axis: 5 + 0.3 × 90.
    expect(control.bottom - slider.thumb().getBoundingClientRect().bottom).toBeCloseTo(27);
    expect(control.bottom - indicator.getBoundingClientRect().top).toBeCloseTo(32);
  });

  test('VUE-148: a press gives the value under the pointer, with half a thumb at each end; after a change of alignment, the press uses the whole control', async () => {
    const root = reactive<Attrs>({ defaultValue: 0, thumbAlignment: 'edge' });
    const slider = await mountSlider({ root });
    const rect = slider.control.getBoundingClientRect();
    const point = { clientX: rect.left + 5 + 27, clientY: rect.top + 5 };
    await slider.down(0, point);
    await slider.up(0, point);
    await nextTick();
    expect(slider.values()).toEqual([30]);
    root.thumbAlignment = 'center';
    await nextTick();
    await slider.down(0, point);
    await slider.up(0, point);
    await nextTick();
    expect(slider.values()).toEqual([32]);
  });

  test('vertical: a press gives the value under the pointer, with half a thumb at each end', async () => {
    const slider = await mountSlider({
      root: { defaultValue: 0, thumbAlignment: 'edge', orientation: 'vertical' },
      thumbs: [{ style: 'width: 10px; height: 20px' }],
    });
    const rect = slider.control.getBoundingClientRect();
    const point = { clientX: rect.left + 5, clientY: rect.bottom - 10 - 24 };
    await slider.down(0, point);
    await slider.up(0, point);
    await nextTick();
    expect(slider.values()).toEqual([30]);
  });
});

describe('a real pointer', () => {
  test('a mouse press and drag move the thumb and give the input the focus', async () => {
    const log: string[] = [];
    const slider = await mountSlider({ root: sliderModel(log, 0) }, false);
    const rect = slider.control.getBoundingClientRect();
    const y = rect.top + 5;
    let held = true;
    onTestFinished(async () => {
      if (held) await userEvent.pointer({ keys: '[/MouseLeft]' });
    });
    await userEvent.pointer({ coords: { x: rect.left + 20, y }, keys: '[MouseLeft>]' });
    await userEvent.pointer({ coords: { x: rect.left + 60, y } });
    // A release outside the control: the control holds the pointer.
    await userEvent.pointer({ coords: { x: rect.left + 60, y: y + 200 } });
    held = false;
    await userEvent.pointer({ coords: { x: rect.left + 60, y: y + 200 }, keys: '[/MouseLeft]' });
    await settle();
    expect(document.activeElement).toBe(slider.inputs()[0]);
    expect(log[0]).toBe('change 20 track-press 0');
    expect(log.at(-1)).toBe('commit 60 drag pointerup');
  });

  test('a mouse press gives the input no focus ring; a key that changes the value shows it, with no focus event for the field and the listeners of the page', async () => {
    const events: string[] = [];
    const record = (part: string) => (event: FocusEvent) => events.push(`${part} ${event.type}`);
    const onDocument = record('document');
    for (const type of ['focusin', 'focusout'] as const) {
      document.addEventListener(type, onDocument, true);
      onTestFinished(() => document.removeEventListener(type, onDocument, true));
    }
    const slider = await mountSlider(
      {
        root: { defaultValue: 100, onFocusin: record('root'), onFocusout: record('root') },
        thumbs: [
          {
            onFocus: record('thumb'),
            onBlur: record('thumb'),
            onFocusCapture: record('thumb capture'),
            onBlurCapture: record('thumb capture'),
            onFocusin: record('thumb'),
            onFocusout: record('thumb'),
          },
        ],
        field: {},
      },
      false,
    );
    const input = slider.inputs()[0]!;
    const rect = slider.thumb().getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    let held = true;
    onTestFinished(async () => {
      if (held) await userEvent.pointer({ keys: '[/MouseLeft]' });
    });
    await userEvent.pointer({ coords: point, keys: '[MouseLeft>]' });
    expect(document.activeElement).toBe(input);
    expect(input.matches(':focus-visible')).toBe(false);
    held = false;
    await userEvent.pointer({ coords: point, keys: '[/MouseLeft]' });
    // A key at the end changes no value. WebKit shows the ring at a key.
    await userEvent.keyboard('{ArrowRight}');
    expect(input.matches(':focus-visible')).toBe(server.browser === 'webkit');
    await userEvent.keyboard('{ArrowLeft}');
    await settle();
    expect(slider.values()).toEqual([99]);
    expect(document.activeElement).toBe(input);
    expect(input.matches(':focus-visible')).toBe(true);
    expect(slider.group).not.toHaveAttribute('data-touched');
    expect(events).toEqual([
      'thumb capture focus',
      'thumb focus',
      'document focusin',
      'thumb focusin',
      'root focusin',
    ]);
  });

  test.runIf(server.browser === 'chromium')(
    'a touch drag and a pen drag move the thumb in Chromium',
    async () => {
      const log: string[] = [];
      // Chromium can give a touch to an input near the point, so the control is high.
      const slider = await mountSlider(
        { root: sliderModel(log, 0), control: { style: 'height: 60px' } },
        false,
      );
      const rect = slider.control.getBoundingClientRect();
      const y = rect.top + 30;
      await touchDrag({ x: rect.left + 20, y }, { x: rect.left + 70, y });
      await settle();
      expect(log.at(-1)).toBe('commit 70 drag pointerup');
      await penDrag({ x: rect.left + 70, y }, { x: rect.left + 40, y });
      await settle();
      expect(log.at(-1)).toBe('commit 40 drag pointerup');
    },
  );
});
