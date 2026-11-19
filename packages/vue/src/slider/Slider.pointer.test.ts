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

type Attrs = Record<string, unknown>;

/**
 * Mounts a slider whose control is 100 px long, so that one pixel is one percent. Each made
 * pointer event goes to the control or to a thumb. A browser refuses `setPointerCapture` for a
 * pointer that a script makes, so the control records the calls.
 */
async function mountSlider(
  props: { root?: Attrs; thumbs?: Attrs[]; control?: Attrs },
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
    root.disabled = true;
    await nextTick();
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
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settle();
    expect(indicator.getBoundingClientRect().width).toBeCloseTo(32);
    thumbs[0]!.style = 'width: 20px; height: 10px';
    await new Promise((resolve) => requestAnimationFrame(resolve));
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
      await new Promise((resolve) => requestAnimationFrame(resolve));
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

  test('vertical: the indicator ends at the centre of the thumb on the vertical axis', async () => {
    const slider = await mountSlider({
      root: { defaultValue: 30, thumbAlignment: 'edge', orientation: 'vertical' },
      thumbs: [{ style: 'width: 10px; height: 20px' }],
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settle();
    const indicator = slider.control.querySelector<HTMLElement>('[style*="inherit"]')!;
    const control = slider.control.getBoundingClientRect();
    // The centre of a thumb of 20 px at 30 %: 10 + 0.3 × 80.
    expect(control.bottom - indicator.getBoundingClientRect().top).toBeCloseTo(34);
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
