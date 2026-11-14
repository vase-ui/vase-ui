import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  firePointer,
  fireTouch,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import type { VaseUIEvent } from '../../internals/types';
import * as Drawer from '../index.parts';

function stubElementFromPoint(root: Document | ShadowRoot, getElement: () => Element | null) {
  const originalElementFromPoint = root.elementFromPoint;
  root.elementFromPoint = getElement;
  onTestFinished(() => {
    root.elementFromPoint = originalElementFromPoint;
  });
}

function trackTouchMoveListeners() {
  const activeListeners = new Set<EventListenerOrEventListenerObject>();
  const addSpy = vi
    .spyOn(document, 'addEventListener')
    .mockImplementation(function addEventListener(this: Document, type, listener, options) {
      if (type === 'touchmove' && typeof options === 'object' && options.passive === false) {
        activeListeners.add(listener);
      }
      return EventTarget.prototype.addEventListener.call(this, type, listener, options);
    });
  const removeSpy = vi
    .spyOn(document, 'removeEventListener')
    .mockImplementation(function removeEventListener(this: Document, type, listener, options) {
      if (type === 'touchmove') {
        activeListeners.delete(listener);
      }
      return EventTarget.prototype.removeEventListener.call(this, type, listener, options);
    });
  onTestFinished(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  return activeListeners;
}

describe('<Drawer.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Drawer.Root open>
          <Drawer.Portal>{node}</Drawer.Portal>
        </Drawer.Root>,
      );
    },
  }));

  it('registers the non-passive document touchmove listener only while open', async () => {
    const activeListeners = trackTouchMoveListeners();
    const open = shallowRef(false);

    await render(() => (
      <Drawer.Root open={open.value}>
        <Drawer.Portal keepMounted>
          <Drawer.Viewport>
            <Drawer.Popup>Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    expect(activeListeners.size).toBe(0);

    open.value = true;
    await flushMicrotasks();
    expect(activeListeners.size).toBe(1);

    open.value = false;
    await flushMicrotasks();
    expect(activeListeners.size).toBe(0);
  });

  it('clears text selection on swipe start', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>
                <span data-testid="text">Selectable</span>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const text = screen.getByTestId('text');
    expect(text.firstChild).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);

    const popup = screen.getByTestId('popup');
    const viewport = screen.getByTestId('viewport');

    stubElementFromPoint(document, () => popup);
    await fireEvent.pointerDown(viewport, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: 'mouse',
    });

    expect(selection.rangeCount).toBe(0);
  });

  it('preserves text selection outside the popup when a swipe starts', async () => {
    await render(
      <div>
        <span data-testid="outside-text">Outside selection</span>
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>,
    );

    const outsideText = screen.getByTestId('outside-text');
    const textNode = outsideText.firstChild;
    const selection = window.getSelection();
    expect(textNode).not.toBeNull();
    expect(selection).not.toBeNull();
    if (!textNode || !selection) {
      return;
    }

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 7);
    selection.removeAllRanges();
    selection.addRange(range);

    const popup = screen.getByTestId('popup');
    stubElementFromPoint(document, () => popup);
    await fireEvent.pointerDown(screen.getByTestId('viewport'), {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: 'mouse',
    });

    expect(selection.rangeCount).toBe(1);
    // The page outside a modal drawer is inert, and `Selection.toString()` skips inert text.
    expect(selection.getRangeAt(0).toString()).toBe('Outside');
  });

  it('does not clear text selection on touch swipe start', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>
                <span data-testid="text">Selectable</span>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const text = screen.getByTestId('text');
    expect(text.firstChild).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);

    const popup = screen.getByTestId('popup');
    const viewport = screen.getByTestId('viewport');

    stubElementFromPoint(document, () => popup);
    await fireTouch.start(viewport, { touches: [{ clientX: 0, clientY: 0 }] });

    expect(selection.rangeCount).toBe(1);
  });

  it('starts touch swipes from interactive elements', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <button type="button" data-testid="button">
                Action
              </button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    stubElementFromPoint(document, () => button);
    await fireTouch.start(button, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(backdrop).toHaveAttribute('data-swiping', '');
  });

  it('uses shadow-root hit testing for touch swipe targets', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    onTestFinished(() => host.remove());

    await render(
      <Drawer.Root open>
        <Drawer.Portal container={shadowRoot}>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="target">Target</div>
              <div data-vase-ui-swipe-ignore data-testid="ignored">
                Ignore
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = shadowRoot.querySelector<HTMLElement>('[data-testid="target"]');
    const ignored = shadowRoot.querySelector<HTMLElement>('[data-testid="ignored"]');
    const backdrop = shadowRoot.querySelector<HTMLElement>('[data-testid="backdrop"]');
    expect(target).not.toBeNull();
    expect(ignored).not.toBeNull();
    expect(backdrop).not.toBeNull();
    if (!target || !ignored || !backdrop) {
      return;
    }

    // Returning an in-popup element from the document hit test would start the swipe if the
    // shadow root were not consulted, so this pins the shadow-root lookup rather than the
    // `contains()` rejection that a retargeted host would also trigger.
    stubElementFromPoint(document, () => target);
    let shadowTarget: Element = ignored;
    stubElementFromPoint(shadowRoot, () => shadowTarget);

    await fireTouch.start(ignored, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('data-swiping');

    await fireTouch.end(ignored, { changedTouches: [{ clientX: 0, clientY: 0 }] });
    shadowTarget = target;

    await fireTouch.start(target, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(backdrop).toHaveAttribute('data-swiping', '');
  });

  it('starts a swipe inside a shadow root using real hit testing', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    onTestFinished(() => host.remove());

    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal container={shadowRoot}>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup
              data-testid="popup"
              style={{ position: 'fixed', top: '0', left: '0', width: '200px', height: '200px' }}
            >
              Content
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const popup = shadowRoot.querySelector<HTMLElement>('[data-testid="popup"]');
    const backdrop = shadowRoot.querySelector<HTMLElement>('[data-testid="backdrop"]');
    expect(popup).not.toBeNull();
    expect(backdrop).not.toBeNull();
    if (!popup || !backdrop) {
      return;
    }

    // No `elementFromPoint` stubbing: a real document hit test retargets the popup content to
    // the shadow host, which fails the `contains()` check in the swipe `canStart` guard, so
    // this only engages when the hit test runs against the shadow root.
    await fireTouch.start(popup, { touches: [{ clientX: 100, clientY: 100 }] });
    await fireTouch.move(popup, { touches: [{ clientX: 100, clientY: 125 }] });

    await waitFor(() => {
      expect(backdrop).toHaveAttribute('data-swiping', '');
    });

    await fireTouch.end(popup, { changedTouches: [{ clientX: 100, clientY: 125 }] });
  });

  it('clears the backdrop data-swiping attribute when the drawer unmounts mid-swipe', async () => {
    const { unmount } = await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <button type="button" data-testid="button">
                Action
              </button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    stubElementFromPoint(document, () => button);
    await fireTouch.start(button, { touches: [{ clientX: 0, clientY: 0 }] });
    await flushMicrotasks();

    expect(backdrop).toHaveAttribute('data-swiping', '');

    unmount();
    await flushMicrotasks();

    // The detached node keeps its attributes, so this asserts the cleanup removed
    // `data-swiping` from the backdrop that was mounted while swiping.
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  describe('swipe', () => {
    it('closes the drawer with the reason swipe after a pointer swipe past half the popup', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Drawer.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup" style={{ height: '100px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const popup = screen.getByTestId('popup');
      const { left, top } = popup.getBoundingClientRect();
      const pointer = { pointerType: 'mouse', pointerId: 1, clientX: left + 10 };
      // The swipe starts at the first move, so the release is 55 px from it: more than half the
      // popup.
      await firePointer.down(popup, {
        ...pointer,
        button: 0,
        buttons: 1,
        clientY: top + 30,
        timeStamp: 1,
      });
      await firePointer.move(popup, { ...pointer, buttons: 1, clientY: top + 40, timeStamp: 101 });
      await firePointer.move(popup, { ...pointer, buttons: 1, clientY: top + 95, timeStamp: 201 });
      await firePointer.up(popup, {
        ...pointer,
        button: 0,
        buttons: 0,
        clientY: top + 95,
        timeStamp: 301,
      });

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      const [open, details] = handleOpenChange.mock.calls[0];
      expect(open).toBe(false);
      expect(details.reason).toBe(REASONS.swipe);
      expect(popup).toHaveAttribute('data-swipe-dismiss', '');
    });

    it('VUE-58: lets a pointer listener of the consumer stop the swipe of the viewport', async () => {
      let stopSwipe = true;
      const handlePointerDown = vi.fn((event: VaseUIEvent<PointerEvent>) => {
        if (stopSwipe) {
          event.preventVaseUIHandler();
        }
      });
      await render(
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport onPointerdown={handlePointerDown}>
              <Drawer.Popup data-testid="popup" style={{ height: '100px' }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const popup = screen.getByTestId('popup');
      const { left, top } = popup.getBoundingClientRect();
      const pointer = { pointerType: 'mouse', pointerId: 1, clientX: left + 10 };
      let timeStamp = 1;
      function nextEvent(buttons: number, offset: number) {
        timeStamp += 16;
        return { ...pointer, buttons, clientY: top + offset, timeStamp };
      }
      async function drag() {
        await firePointer.down(popup, { ...nextEvent(1, 10), button: 0 });
        await firePointer.move(popup, nextEvent(1, 20));
        await firePointer.move(popup, nextEvent(1, 30));
      }

      await drag();
      expect(handlePointerDown).toHaveBeenCalledTimes(1);
      expect(popup).not.toHaveAttribute('data-swiping');
      await firePointer.up(popup, { ...nextEvent(0, 30), button: 0 });

      stopSwipe = false;
      await drag();
      expect(handlePointerDown).toHaveBeenCalledTimes(2);
      expect(popup).toHaveAttribute('data-swiping', '');
      await firePointer.up(popup, { ...nextEvent(0, 30), button: 0 });
    });

    it('gives the viewport no nested dialog attribute while a nested drawer is open', async () => {
      await render(
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="parent-viewport">
              <Drawer.Popup data-testid="parent-popup">
                <Drawer.Root open modal={false}>
                  <Drawer.Portal>
                    <Drawer.Viewport>
                      <Drawer.Popup>Child drawer</Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-popup')).toHaveAttribute('data-nested-drawer-open', '');
      });
      expect(screen.getByTestId('parent-viewport')).not.toHaveAttribute('data-nested-dialog-open');
    });
  });

  describe('KeepAlive', () => {
    it('VUE-5: removes the document touchmove listener while KeepAlive holds the drawer, and adds it again at the activation', async () => {
      const activeListeners = trackTouchMoveListeners();
      const shown = shallowRef(true);
      const Held = defineComponent({
        name: 'Held',
        setup: () => () => (
          <Drawer.Root open modal={false}>
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup>Drawer</Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        ),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });

      await render(() => (
        <KeepAlive>{shown.value ? <Held key="held" /> : <Other key="other" />}</KeepAlive>
      ));
      await flushMicrotasks();
      expect(activeListeners.size).toBe(1);

      shown.value = false;
      await flushMicrotasks();
      expect(activeListeners.size).toBe(0);

      shown.value = true;
      await flushMicrotasks();
      expect(activeListeners.size).toBe(1);
    });
  });
});
