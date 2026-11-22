import { describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import ContextMenuParts from '../../test/fixtures/ContextMenuParts.vue';
import MenubarParts from '../../test/fixtures/MenubarParts.vue';
import MenuParts from '../../test/fixtures/MenuParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const at = (x: number, y: number) => ({
  getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }),
});

async function placed(testId: string) {
  await waitFor(() => expect(byTestId(testId)?.style.visibility).toBe(''));
  return byTestId(testId)!;
}

/** A visual viewport of a pinch zoom: a part of the layout viewport at its top left. */
function pinchZoom() {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport')!;
  const visual = { width: 200, height: 300, offsetLeft: 0, offsetTop: 0, scale: 2 };
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: Object.assign(new EventTarget(), visual),
  });
  onTestFinished(() => {
    Object.defineProperty(window, 'visualViewport', descriptor);
  });
}

describe('the default collision avoidance', () => {
  test('a context menu with no room above or under its point stays above or under it', async () => {
    mount(ContextMenuParts, {
      root: { defaultOpen: true },
      positioner: { anchor: at(100, window.innerHeight / 2) },
      popup: { style: `width: 150px; height: ${Math.round(window.innerHeight * 0.8)}px` },
    });
    const positioner = await placed('positioner');
    expect(['top', 'bottom']).toContain(positioner.getAttribute('data-side'));
  });

  test('a menu of a menubar with no room above or under its trigger stays above or under it', async () => {
    mount(MenubarParts, {
      roots: { file: { defaultOpen: true } },
      positioners: { file: { style: 'height: 95vh' } },
    });
    const positioner = await placed('file-positioner');
    expect(['top', 'bottom']).toContain(positioner.getAttribute('data-side'));
  });

  test('a submenu with no room at either side of its trigger takes a side of the other axis', async () => {
    mount(MenuParts, {
      root: { defaultOpen: true },
      submenu: { root: { defaultOpen: true }, popup: { style: 'width: 95vw' } },
    });
    const positioner = await placed('sub-positioner');
    expect(['top', 'bottom']).toContain(positioner.getAttribute('data-side'));
  });
});

describe('the viewport of a context menu', () => {
  // The alignment shifts and does not flip, so that the case reads the boundary of the shift.
  test.each([{ align: 'shift' }, { side: 'flip', align: 'shift' }])(
    'the shift keeps a root context menu in the layout viewport, so a pinch zoom does not move it: %o',
    async (collisionAvoidance) => {
      pinchZoom();
      mount(ContextMenuParts, {
        root: { defaultOpen: true },
        positioner: { anchor: at(120, 100), collisionAvoidance },
        popup: { style: 'width: 150px; height: 100px' },
      });
      await placed('positioner');
      // With the visual viewport as its boundary, the shift would move the popup to 45 px.
      expect(byTestId('popup')!.getBoundingClientRect().left).toBeGreaterThan(100);
    },
  );

  test.each([false, true])(
    'a submenu of a context menu takes the visual viewport as its boundary: a pinch zoom %s',
    async (zoom) => {
      if (zoom) pinchZoom();
      mount(ContextMenuParts, {
        root: { defaultOpen: true },
        positioner: { anchor: at(20, 20) },
        popup: { style: 'width: 120px' },
        subPopup: { style: 'width: 120px' },
      });
      await placed('positioner');
      await userEvent.hover(item('sub'));
      const positioner = await placed('sub-positioner');
      // The layout viewport has room at the right of the trigger, and the visual viewport has none.
      if (zoom) expect(positioner).not.toHaveAttribute('data-side', 'inline-end');
      else expect(positioner).toHaveAttribute('data-side', 'inline-end');
    },
  );
});

describe('the anchor', () => {
  const anchorElement = () => document.getElementById('outside')!;

  test.each([
    { name: 'a part ref', anchor: () => ({ element: anchorElement() }) },
    { name: 'an element', anchor: () => anchorElement() },
    { name: 'a function that gives an element', anchor: () => () => anchorElement() },
  ])('a menu opens at $name', async ({ anchor }) => {
    const props = reactive<Props>({ anchor: null });
    mount(MenuParts, { root: { defaultOpen: true }, positioner: props });
    await nextTick();
    props.anchor = anchor();
    const positioner = await placed('positioner');
    await waitFor(() => expect(positioner).toHaveAttribute('data-side', 'top'));
    const box = positioner.getBoundingClientRect();
    const target = anchorElement().getBoundingClientRect();
    // The anchor is at the bottom right of the view, so the popup opens above it.
    expect(Math.round(box.bottom)).toBe(Math.round(target.top));
  });

  test('a menu follows an anchor that goes to the trigger and comes back', async () => {
    const positioner = reactive<Props>({ anchor: null });
    const { root } = mount(MenuParts, { root: { open: true }, positioner });
    await nextTick();
    const trigger = root.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    positioner.anchor = anchorElement();
    const element = await placed('positioner');
    const near = (target: Element) =>
      Math.abs(element.getBoundingClientRect().left - target.getBoundingClientRect().left) < 200;
    await waitFor(() => expect(element).toHaveAttribute('data-side', 'top'));
    expect(near(anchorElement())).toBe(true);
    positioner.anchor = undefined;
    await waitFor(() => expect(element).toHaveAttribute('data-side', 'bottom'));
    expect(Math.round(element.getBoundingClientRect().top)).toBe(
      Math.round(trigger.getBoundingClientRect().bottom),
    );
    positioner.anchor = anchorElement();
    await waitFor(() => expect(element).toHaveAttribute('data-side', 'top'));
    expect(near(anchorElement())).toBe(true);
  });
});
