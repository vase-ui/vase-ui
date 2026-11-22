import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { UseToastManagerReturnValue } from '@vase-ui/vue/toast';
import ToastParts from '../../test/fixtures/ToastParts.vue';
import { touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;
type Point = { x: number; y: number };

const toastRoot = (id: string) => document.querySelector<HTMLElement>(`[data-id="${id}"]`);

function style(css: string) {
  const element = document.head.appendChild(document.createElement('style'));
  element.textContent = css;
  onTestFinished(() => element.remove());
}

async function mountToast(root: Props = {}) {
  // The toast is far from the edges of the view, so a drag stays in it.
  style('[data-testid="viewport"] { position: fixed; left: 200px; top: 200px; width: 300px }');
  const { exposed } = mount(ToastParts, { list: { root } });
  await nextTick();
  const manager = exposed.manager as UseToastManagerReturnValue;
  manager.add({ id: 'a', title: 'A title to press', timeout: 0 });
  await waitFor(() => expect(toastRoot('a')).not.toBe(null));
  return { manager, root: toastRoot('a')! };
}

/** The point on the title of the toast, away from its buttons. */
function startOf(root: HTMLElement) {
  const rect = root.querySelector('h2')!.getBoundingClientRect();
  return { x: rect.left + 4, y: rect.top + 4 };
}

/**
 * Presses the real mouse at `start` and moves it through the points from there. With `release`, the
 * button goes up at the last point. Else the result lets it go, at the last point or at the point
 * that it gets, and a case that does not call it gets the release when it ends.
 */
async function press(start: Point, moves: Point[], release = true) {
  let point = start;
  let held = true;
  const letGo = async (at: Point = point) => {
    held = false;
    await userEvent.pointer({ coords: at, keys: '[/MouseLeft]' });
  };
  onTestFinished(async () => {
    if (held) await letGo();
  });
  await userEvent.pointer({ coords: start, keys: '[MouseLeft>]' });
  for (const move of moves) {
    point = { x: start.x + move.x, y: start.y + move.y };
    await userEvent.pointer({ coords: point });
  }
  if (release) await letGo();
  return letGo;
}

/** A drag from the title of the toast. */
function drag(root: HTMLElement, moves: Point[], release = true) {
  return press(startOf(root), moves, release);
}

const down = (...ys: number[]): Point[] => ys.map((y) => ({ x: 0, y }));

/** The id of the mouse of the browser: Firefox gives it 0, Chromium and WebKit 1. */
async function mousePointerId(at: Point) {
  let id = -1;
  const read = (event: PointerEvent) => (id = event.pointerId);
  document.addEventListener('pointermove', read, { once: true });
  await userEvent.pointer({ coords: { x: at.x + 1, y: at.y + 1 } });
  return id;
}

/**
 * Dispatches a press of the mouse at `from` and its moves down by `ys`. A move to `noButton` with no
 * button down follows, and no `pointerup`: Firefox does so for a release outside its view, and a
 * fast flick on a trackpad does so before its `pointerup`.
 */
function dragWithNoRelease(
  target: Element,
  from: Point,
  pointerId: number,
  ys: number[],
  noButton: number,
) {
  const send = (type: string, y: number, buttons: number) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        composed: true,
        pointerId,
        pointerType: 'mouse',
        clientX: from.x,
        clientY: from.y + y,
        buttons,
      }),
    );
  send('pointerdown', 0, 1);
  for (const y of ys) send('pointermove', y, 1);
  send('pointermove', noButton, 0);
}

describe('the swipe', () => {
  test('a mouse drag of more than 40 px down closes the toast; it leaves with `data-swipe-direction` and the variables, and with no inline transform', async () => {
    // The leave lasts until a toast with the same id comes and ends it, so the case reads the toast
    // that leaves.
    style('.toast-leave-active { transition: opacity 100s } .toast-leave-to { opacity: 0 }');
    const { manager, root } = await mountToast();
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    const release = await drag(root, down(20, 40, 60), false);
    expect(root).toHaveAttribute('data-swiping');
    expect(root).toHaveAttribute('data-swipe-direction', 'down');
    expect(root.style.transition).toBe('none');
    expect(root.style.transform).toBe('translateX(0px) translateY(60px) scale(1)');
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('60px');
    expect(root.style.userSelect).toBe('none');
    await release();
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
    expect(root.isConnected).toBe(true);
    expect(root).not.toHaveAttribute('data-swiping');
    expect(root).toHaveAttribute('data-swipe-direction', 'down');
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('60px');
    expect(root.style.transform).toBe('');
    expect(root.style.transition).toBe('');
    manager.add({ id: 'a', title: 'Again', timeout: 0 });
    await waitFor(() => expect(root.isConnected).toBe(false));
    const again = toastRoot('a')!;
    expect(again).not.toHaveAttribute('data-swipe-direction');
    expect(again.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
  });

  test('a drag of 40 px or less gives back the variables `0px` and no direction; the toast stays', async () => {
    const { manager, root } = await mountToast();
    await drag(root, down(20, 40));
    expect(root).not.toHaveAttribute('data-swiping');
    expect(root).not.toHaveAttribute('data-swipe-direction');
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    expect(root.style.transform).toBe('');
    await nextTick();
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('a move against the allowed directions is damped with the square root', async () => {
    const { manager, root } = await mountToast({ swipeDirection: 'down' });
    const release = await drag(root, down(-50, -100), false);
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('-10px');
    await release();
    await nextTick();
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('with directions on the two axes, the first move locks its axis', async () => {
    const { manager, root } = await mountToast();
    const release = await drag(
      root,
      [
        { x: 20, y: 4 },
        { x: 40, y: 30 },
        { x: 60, y: 30 },
      ],
      false,
    );
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    expect(root.style.getPropertyValue('--toast-swipe-movement-x')).toBe('60px');
    await release();
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
    expect(root).toHaveAttribute('data-swipe-direction', 'right');
  });

  test.each([
    { swipeDirection: 'down', moves: down(20, 40, 60, 50), again: down(20, 40, 60, 50, 95) },
    { swipeDirection: 'up', moves: down(-1, -90, -50), again: down(-1, -90, -50, -95) },
    {
      swipeDirection: 'right',
      moves: [1, 90, 50].map((x) => ({ x, y: 0 })),
      again: [1, 90, 50, 95].map((x) => ({ x, y: 0 })),
    },
  ])(
    'VUE-204: a move back after 10 px or more in the direction cancels the close of a swipe $swipeDirection, also after a first move of 1 px, with no direction and no movement after it; a move of more than 40 px in the direction permits it again',
    async ({ swipeDirection, moves, again }) => {
      const { manager, root } = await mountToast({ swipeDirection });
      await drag(root, moves);
      await nextTick();
      expect(manager.toasts.value).toHaveLength(1);
      expect(root).not.toHaveAttribute('data-swipe-direction');
      expect(root.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
      await drag(root, again);
      await waitFor(() => expect(manager.toasts.value).toEqual([]));
      expect(root).toHaveAttribute('data-swipe-direction', swipeDirection);
    },
  );

  test('a press on a button or on an element with `data-vase-ui-swipe-ignore` starts no swipe', async () => {
    const { root } = await mountToast();
    const title = root.querySelector('h2')!;
    title.setAttribute('data-vase-ui-swipe-ignore', '');
    const release = await drag(root, down(20), false);
    expect(root).not.toHaveAttribute('data-swiping');
    await release();
    const close = root.querySelector('button')!.getBoundingClientRect();
    const releaseClose = await press({ x: close.left + 2, y: close.top + 2 }, down(28), false);
    expect(root).not.toHaveAttribute('data-swiping');
    await releaseClose();
  });

  test('a capture that the root loses in a swipe ends it with no close; the stack stays expanded while the pointer stays on the toast', async () => {
    // The toast is tall, so the pointer stays on it.
    style('[data-id] { height: 200px }');
    const { manager, root } = await mountToast();
    let pointerId = 0;
    root.addEventListener('pointerdown', (event) => (pointerId = event.pointerId));
    const release = await drag(root, down(20, 60), false);
    expect(root).toHaveAttribute('data-swiping');
    root.releasePointerCapture(pointerId);
    // The browser sends `lostpointercapture` before the next pointer event.
    const start = startOf(root);
    await userEvent.pointer({ coords: { x: start.x + 1, y: start.y + 61 } });
    await waitFor(() => expect(root).not.toHaveAttribute('data-swiping'));
    expect(document.querySelector('[data-testid="viewport"]')).toHaveAttribute('data-expanded');
    expect(root).not.toHaveAttribute('data-swipe-direction');
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    expect(root.style.transform).toBe('');
    expect(root.style.transition).toBe('');
    await release();
    await nextTick();
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('a drag selects no text', async () => {
    const { root } = await mountToast({ swipeDirection: 'down' });
    getSelection()?.removeAllRanges();
    await drag(root, [
      { x: 20, y: 10 },
      { x: 60, y: 20 },
      { x: 100, y: 30 },
    ]);
    expect(String(getSelection())).toBe('');
  });

  const STEP: Record<string, Point> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  /** A drag of `by` px in `direction`, after a first move of 1 px. */
  const toward = (direction: string, by: number) =>
    [1, by].map((length) => ({ x: STEP[direction]!.x * length, y: STEP[direction]!.y * length }));

  test.each(['up', 'down', 'left', 'right'])(
    'a drag of 45 px %s closes a toast that allows only that direction',
    async (swipeDirection) => {
      const { manager, root } = await mountToast({ swipeDirection });
      await drag(root, toward(swipeDirection, 45));
      await waitFor(() => expect(manager.toasts.value).toEqual([]));
      expect(root).toHaveAttribute('data-swipe-direction', swipeDirection);
    },
  );

  test.each(
    [
      ['up', 'right'],
      ['right', 'left'],
      ['up', 'down'],
    ].flatMap((pair) => pair.map((direction) => ({ pair, direction }))),
  )(
    'with the directions $pair, a drag of 50 px $direction closes the toast',
    async ({ pair, direction }) => {
      const { manager, root } = await mountToast({ swipeDirection: pair });
      await drag(root, toward(direction, 50));
      await waitFor(() => expect(manager.toasts.value).toEqual([]));
      expect(root).toHaveAttribute('data-swipe-direction', direction);
    },
  );

  test('a drag of 50 px across the allowed axis, or against it, keeps the toast', async () => {
    const { manager, root } = await mountToast({ swipeDirection: 'up' });
    await drag(root, toward('right', 50));
    await drag(root, toward('down', 50));
    await nextTick();
    expect(manager.toasts.value).toHaveLength(1);
    expect(root).not.toHaveAttribute('data-swipe-direction');
  });

  test.each([
    {
      axis: 'horizontal',
      start: [
        { x: -5, y: -2 },
        { x: -10, y: -2 },
        { x: 0, y: -2 },
      ],
      far: { x: 10, y: 120 },
      end: { x: 60, y: 120 },
      direction: 'right',
    },
    {
      axis: 'vertical',
      start: [
        { x: -2, y: -5 },
        { x: -2, y: -10 },
        { x: -2, y: 0 },
      ],
      far: { x: 120, y: 10 },
      end: { x: 120, y: 60 },
      direction: 'down',
    },
  ])(
    'a drag that starts on the $axis axis keeps it: a move toward a direction that does not close arms nothing, and a far move off the axis arms $direction',
    async ({ start, far, end, direction }) => {
      const { manager, root } = await mountToast({ swipeDirection: ['down', 'right'] });
      const release = await drag(root, start, false);
      expect(root).not.toHaveAttribute('data-swipe-direction');
      const origin = startOf(root);
      await userEvent.pointer({ coords: { x: origin.x + far.x, y: origin.y + far.y } });
      expect(root).toHaveAttribute('data-swipe-direction', direction);
      const last = { x: origin.x + end.x, y: origin.y + end.y };
      await userEvent.pointer({ coords: last });
      await release(last);
      await waitFor(() => expect(manager.toasts.value).toEqual([]));
    },
  );

  test('a press with another button than the main one starts no swipe', async () => {
    const { manager, root } = await mountToast({ swipeDirection: 'right' });
    const start = startOf(root);
    await userEvent.pointer({ coords: start, keys: '[MouseRight>]' });
    try {
      expect(root).not.toHaveAttribute('data-swiping');
      await userEvent.pointer({ coords: { x: start.x + 100, y: start.y } });
      expect(root).not.toHaveAttribute('data-swiping');
    } finally {
      await userEvent.pointer({ coords: { x: start.x + 100, y: start.y }, keys: '[/MouseRight]' });
    }
    await nextTick();
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('a far drag against the directions that ends outside the toast gives back each style; a later swipe closes the toast', async () => {
    const { manager, root } = await mountToast();
    // The default directions are `down` and `right`.
    await drag(root, [
      { x: -1, y: 0 },
      { x: -190, y: 0 },
    ]);
    expect(root).not.toHaveAttribute('data-swiping');
    expect(root).not.toHaveAttribute('data-swipe-direction');
    expect(root.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    expect(root.style.transition).toBe('');
    expect(root.style.transform).toBe('');
    await drag(root, toward('right', 50));
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('a drag of a toast that has an anchor starts no swipe', async () => {
    const { manager, root } = await mountToast();
    manager.update('a', { positionerProps: { anchor: document.body } });
    await nextTick();
    const release = await drag(root, toward('down', 60), false);
    expect(root).not.toHaveAttribute('data-swiping');
    await release();
    await nextTick();
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('the viewport stays expanded while a drag leaves it, and the release outside it collapses the viewport', async () => {
    const { manager, root } = await mountToast();
    const viewport = document.querySelector('[data-testid="viewport"]')!;
    // The default directions are `down` and `right`, so a move up keeps the toast.
    const release = await drag(
      root,
      [
        { x: 0, y: -1 },
        { x: 0, y: -60 },
        { x: 0, y: -150 },
      ],
      false,
    );
    expect(root).toHaveAttribute('data-swiping');
    expect(viewport).toHaveAttribute('data-expanded');
    await release();
    await waitFor(() => expect(viewport).not.toHaveAttribute('data-expanded'));
    expect(manager.toasts.value).toHaveLength(1);
  });

  test.each([
    { name: 'horizontal directions', swipeDirection: ['left', 'right'], touchAction: 'pan-y' },
    { name: 'vertical directions', swipeDirection: 'up', touchAction: 'pan-x' },
    { name: 'two axes', swipeDirection: ['up', 'right'], touchAction: 'none' },
    { name: 'no direction', swipeDirection: [], touchAction: '' },
  ])('the root has the `touch-action` of its $name', async ({ swipeDirection, touchAction }) => {
    const root = reactive<Props>({ swipeDirection });
    const { root: element } = await mountToast(root);
    expect(element.style.touchAction).toBe(touchAction);
  });

  test.skipIf(server.browser !== 'chromium')(
    'a touch drag of more than 40 px down closes the toast with no `pointercancel`',
    async () => {
      const { manager, root } = await mountToast();
      const cancels: string[] = [];
      root.addEventListener('pointercancel', () => cancels.push('pointercancel'));
      const start = startOf(root);
      await touchDrag(start, { x: start.x, y: start.y + 80 }, 8);
      await waitFor(() => expect(manager.toasts.value).toEqual([]));
      expect(cancels).toEqual([]);
    },
  );

  test.each([
    { name: 'ends a drag of 16 px with no close', ys: [12], noButton: 16, closes: false },
    { name: 'closes the toast after a drag of 100 px', ys: [100], noButton: 100, closes: true },
    {
      name: 'takes its own place for the release, and 100 px close the toast',
      ys: [35],
      noButton: 100,
      closes: true,
    },
  ])('a move with no button is the release: it $name', async ({ ys, noButton, closes }) => {
    const { manager, root } = await mountToast({ swipeDirection: 'down' });
    const start = startOf(root);
    const id = await mousePointerId(start);
    dragWithNoRelease(root.querySelector('h2')!, start, id, ys, noButton);
    if (closes) {
      await waitFor(() => expect(manager.toasts.value).toEqual([]));
      expect(root).toHaveAttribute('data-swipe-direction', 'down');
      return;
    }
    await nextTick();
    expect(root).not.toHaveAttribute('data-swiping');
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    // A later move with no button moves nothing.
    root.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: id,
        pointerType: 'mouse',
        clientX: start.x,
        clientY: start.y + 60,
        buttons: 0,
      }),
    );
    await nextTick();
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('the inline `transform` and `transition` of the developer stay after a swipe that does not close', async () => {
    const { root } = await mountToast({
      style: 'transform: scale(0.9); transition: opacity 200ms ease',
    });
    const { transform, transition } = root.style;
    expect(transform).toBe('scale(0.9)');
    await drag(root, down(12, 16));
    await nextTick();
    expect(root.style.transform).toBe(transform);
    expect(root.style.transition).toBe(transition);
  });

  test('VUE-228: a `pointerdown` listener of the developer that calls `preventDefault()` does not stop the swipe', async () => {
    const { manager, root } = await mountToast({ swipeDirection: 'down' });
    root.querySelector('h2')!.addEventListener('pointerdown', (event) => event.preventDefault());
    await drag(root, down(20, 40, 60));
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });
});
