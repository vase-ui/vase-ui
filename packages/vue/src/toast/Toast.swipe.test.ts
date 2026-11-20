import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { UseToastManagerReturnValue } from '@vase-ui/vue/toast';
import ToastParts from '../../test/fixtures/ToastParts.vue';
import { touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

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

/** Moves the real mouse with its button down through the points from the start of the toast. */
async function drag(root: HTMLElement, moves: { x: number; y: number }[], release = true) {
  const start = startOf(root);
  await userEvent.pointer({ coords: start, keys: '[MouseLeft>]' });
  for (const move of moves) {
    await userEvent.pointer({ coords: { x: start.x + move.x, y: start.y + move.y } });
  }
  if (release) await userEvent.pointer({ keys: '[/MouseLeft]' });
}

const down = (...ys: number[]) => ys.map((y) => ({ x: 0, y }));

describe('the swipe (B8)', () => {
  test('a mouse drag of more than 40 px down closes the toast; it leaves with `data-swipe-direction` and the variables, and with no inline transform', async () => {
    style('.toast-leave-active { transition: opacity 300ms } .toast-leave-to { opacity: 0 }');
    const { manager, root } = await mountToast();
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    await drag(root, down(20, 40, 60), false);
    expect(root).toHaveAttribute('data-swiping');
    expect(root).toHaveAttribute('data-swipe-direction', 'down');
    expect(root.style.transition).toBe('none');
    expect(root.style.transform).toBe('translateX(0px) translateY(60px) scale(1)');
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('60px');
    expect(root.style.userSelect).toBe('none');
    await userEvent.pointer({ keys: '[/MouseLeft]' });
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
    await drag(root, down(-50, -100), false);
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('-10px');
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await nextTick();
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('with directions on the two axes, the first move locks its axis', async () => {
    const { manager, root } = await mountToast();
    await drag(
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
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
    expect(root).toHaveAttribute('data-swipe-direction', 'right');
  });

  test('a move back of 10 px cancels the close; a move of more than 40 px in the direction permits it again', async () => {
    const { manager, root } = await mountToast({ swipeDirection: 'down' });
    await drag(root, down(20, 40, 60, 50));
    await nextTick();
    expect(manager.toasts.value).toHaveLength(1);
    await drag(root, down(20, 40, 60, 50, 95));
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('a press on a button or on an element with `data-vase-ui-swipe-ignore` starts no swipe', async () => {
    const { root } = await mountToast();
    const title = root.querySelector('h2')!;
    title.setAttribute('data-vase-ui-swipe-ignore', '');
    await drag(root, down(20), false);
    expect(root).not.toHaveAttribute('data-swiping');
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    const close = root.querySelector('button')!.getBoundingClientRect();
    await userEvent.pointer({
      coords: { x: close.left + 2, y: close.top + 2 },
      keys: '[MouseLeft>]',
    });
    await userEvent.pointer({ coords: { x: close.left + 2, y: close.top + 30 } });
    expect(root).not.toHaveAttribute('data-swiping');
    await userEvent.pointer({ keys: '[/MouseLeft]' });
  });

  test('a capture that the root loses in a swipe ends it with no close', async () => {
    const { manager, root } = await mountToast();
    let pointerId = 0;
    root.addEventListener('pointerdown', (event) => (pointerId = event.pointerId));
    await drag(root, down(20, 60), false);
    expect(root).toHaveAttribute('data-swiping');
    root.releasePointerCapture(pointerId);
    // The browser sends `lostpointercapture` before the next pointer event.
    const start = startOf(root);
    await userEvent.pointer({ coords: { x: start.x + 1, y: start.y + 61 } });
    await waitFor(() => expect(root).not.toHaveAttribute('data-swiping'));
    expect(root.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await nextTick();
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('a drag selects no text (T19)', async () => {
    const { root } = await mountToast({ swipeDirection: 'down' });
    getSelection()?.removeAllRanges();
    await drag(root, [
      { x: 20, y: 10 },
      { x: 60, y: 20 },
      { x: 100, y: 30 },
    ]);
    expect(String(getSelection())).toBe('');
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
    'N1: a touch drag of more than 40 px down closes the toast with no `pointercancel`',
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
});
