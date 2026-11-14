import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, onMounted, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  firePointer,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import type { DialogStore } from '../../dialog/store/DialogStore';
import * as Drawer from '../index.parts';
import { useDrawerRootContext } from '../root/DrawerRootContext';

function setHeight(instance: unknown, getValue: () => number) {
  const element = (instance as { element?: HTMLElement | null } | null)?.element;
  if (element) {
    Object.defineProperty(element, 'offsetHeight', { configurable: true, get: getValue });
  }
}

const PopupHeightProbe = defineComponent({
  setup() {
    const { popupHeight, onNestedFrontmostHeightChange } = useDrawerRootContext();

    return () => (
      <>
        <output data-testid="popup-height">{popupHeight.value}</output>
        <button onClick={() => onNestedFrontmostHeightChange(200)}>Report nested height</button>
      </>
    );
  },
});

function stubResizeObserver() {
  const resizeCallbacks: ResizeObserverCallback[] = [];
  const OriginalResizeObserver = globalThis.ResizeObserver;

  globalThis.ResizeObserver = class ResizeObserverStub {
    constructor(callback: ResizeObserverCallback) {
      resizeCallbacks.push(callback);
    }

    observe() {}
    unobserve() {}
    disconnect() {}
  };
  onTestFinished(() => {
    globalThis.ResizeObserver = OriginalResizeObserver;
  });

  return resizeCallbacks;
}

describe('<Drawer.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport>{node}</Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );
    },
  }));

  it('warns in development when not rendered within a viewport', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Popup>Drawer</Drawer.Popup>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Vase UI: <Drawer.Popup> expected to be rendered within <Drawer.Viewport>. ' +
          'Omitting the viewport disables drawer swipe handling and touch scroll locking. ' +
          'Wrap <Drawer.Popup> in <Drawer.Viewport>.',
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('defaults initial focus to the popup element', async () => {
    await render(
      <div>
        <input />
        <Drawer.Root modal={false}>
          <Drawer.Trigger>Open</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">
                <input data-testid="popup-input" />
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>,
    );

    screen.getByRole('button', { name: 'Open' }).click();
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
    expect(screen.getByTestId('popup-input')).not.toHaveFocus();
  });

  it('leaves focus on the trigger when initial focus is disabled', async () => {
    const { user } = await render(
      <Drawer.Root modal={false}>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup initialFocus={false}>Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });
    expect(trigger).toHaveFocus();
  });

  it('stops composite navigation keys from escaping the popup', async () => {
    // The popup is in a portal, and a Vue listener on an element of the template does not get the
    // events of a portal. The listener is thus on the document.
    const handleKeyDown = vi.fn();
    document.addEventListener('keydown', handleKeyDown);
    onTestFinished(() => document.removeEventListener('keydown', handleKeyDown));

    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <input aria-label="Field" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const field = screen.getByRole('textbox', { name: 'Field' });
    field.focus();
    await fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(handleKeyDown).not.toHaveBeenCalled();

    await fireEvent.keyDown(field, { key: 'a' });
    expect(handleKeyDown).toHaveBeenCalled();
  });

  it('applies a negative snap point offset to upward drawers', async () => {
    await render(
      <Drawer.Root
        defaultSnapPoint="100px"
        open
        modal={false}
        snapPoints={['100px', '300px']}
        swipeDirection="up"
      >
        <Drawer.Portal>
          <Drawer.Viewport style={{ height: '400px' }}>
            <Drawer.Popup data-testid="popup" style={{ height: '300px' }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('popup').style.getPropertyValue('--drawer-snap-point-offset')).toBe(
        '-200px',
      );
    });
    expect(screen.getByTestId('popup')).toHaveAttribute('data-swipe-direction', 'up');
  });

  it('keeps the last measured popup height while nested content stretches it', async () => {
    const resizeCallbacks = stubResizeObserver();
    let popupHeight = 100;

    const { user } = await render(
      <Drawer.Root open modal={false}>
        <PopupHeightProbe />
        <Drawer.Portal>
          <Drawer.Viewport style={{ height: '400px' }}>
            <Drawer.Popup ref={(instance: unknown) => setHeight(instance, () => popupHeight)}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('popup-height').textContent).toBe('100');
    });

    await user.click(screen.getByRole('button', { name: 'Report nested height' }));
    popupHeight = 150;
    resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
    await flushMicrotasks();

    expect(screen.getByTestId('popup-height').textContent).toBe('100');
  });

  it('does not throw when a popup render function produces no element', async () => {
    await expect(
      render(
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup v-slots={{ render: () => null }} />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      ),
    ).resolves.toBeDefined();

    // A development build warns that the part has no element.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('The `#render` slot gave no element to the part.'),
    ]);
  });

  it('ignores a queued measurement after the popup unmounts', async () => {
    const resizeCallbacks = stubResizeObserver();
    const showPopup = shallowRef(true);

    await render(() => (
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            {showPopup.value && <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>}
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    expect(screen.getByTestId('popup')).toBeVisible();
    const callbacks = resizeCallbacks.slice();

    showPopup.value = false;
    await flushMicrotasks();
    expect(screen.queryByTestId('popup')).toBe(null);

    callbacks.forEach((callback) => callback([], {} as ResizeObserver));
    await flushMicrotasks();
  });

  it('includes border size in frontmost height CSS variable for nested drawers', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup
                      data-testid="child-popup"
                      style={{
                        height: '100px',
                        borderTop: '2px solid transparent',
                        borderBottom: '2px solid transparent',
                      }}
                    >
                      <div style={{ height: '10px' }}>Child drawer</div>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');

    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--drawer-frontmost-height')).toBe(
        `${childPopup.offsetHeight}px`,
      );
    });
    expect(childPopup.offsetHeight).toBeGreaterThan(childPopup.scrollHeight);
  });

  it('reports nested presence and frontmost height before passive effects', async () => {
    let taskAfterOpenRan = false;
    let heightReportedBeforeTask: boolean | null = null;
    let presenceReportedBeforeTask: boolean | null = null;

    const ChildDrawerMethodProbe = defineComponent({
      setup() {
        const context = useDrawerRootContext();
        const notifyParentFrontmostHeight = context.notifyParentFrontmostHeight;
        const notifyParentHasNestedDrawer = context.notifyParentHasNestedDrawer;

        context.notifyParentFrontmostHeight = (height) => {
          if (height > 0 && heightReportedBeforeTask === null) {
            heightReportedBeforeTask = !taskAfterOpenRan;
          }
          notifyParentFrontmostHeight?.(height);
        };
        context.notifyParentHasNestedDrawer = (present) => {
          if (present && presenceReportedBeforeTask === null) {
            presenceReportedBeforeTask = !taskAfterOpenRan;
          }
          notifyParentHasNestedDrawer?.(present);
        };

        return () => null;
      },
    });

    const childOpen = shallowRef(false);
    await render(() => (
      <Drawer.Root defaultOpen modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open={childOpen.value} modal={false}>
                <ChildDrawerMethodProbe />
                <Drawer.Portal keepMounted>
                  <Drawer.Viewport>
                    <Drawer.Popup
                      initialFocus={false}
                      ref={(instance: unknown) => setHeight(instance, () => 100)}
                    >
                      Child drawer
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    childOpen.value = true;
    setTimeout(() => {
      taskAfterOpenRan = true;
    });
    await flushMicrotasks();

    expect(heightReportedBeforeTask).toBe(true);
    expect(presenceReportedBeforeTask).toBe(true);
    const parentPopup = screen.getByTestId('parent-popup');
    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');
    expect(parentPopup.style.getPropertyValue('--drawer-frontmost-height')).toBe('100px');
  });

  it('keeps the parent nested state when a closed handle-backed nested drawer mounts', async () => {
    const handle = Drawer.createHandle();

    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open modal={false}>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup>Open child</Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
              <Drawer.Root handle={handle} modal={false}>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup>Closed child</Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    await waitFor(() => {
      expect(parentPopup).toHaveAttribute('data-nested-drawer-open');
    });
    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
  });

  it('clears parent nested drawer state as soon as a nested drawer closes', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root modal={false}>
                <Drawer.Trigger>Open nested drawer</Drawer.Trigger>
                <Drawer.Portal keepMounted>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <Drawer.Close>Close nested drawer</Drawer.Close>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');

    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');

    screen.getByRole('button', { name: 'Open nested drawer' }).click();
    await flushMicrotasks();

    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');

    screen.getByRole('button', { name: 'Close nested drawer' }).click();
    await flushMicrotasks();

    expect(childPopup).toBeInTheDocument();
    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');
  });

  it('clears parent nested drawer state when a nested drawer starts closing before unmount', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const style = `
      @keyframes test-drawer-exit {
        to {
          opacity: 0;
        }
      }

      .animation-test-child-popup[data-ending-style] {
        animation: test-drawer-exit 100ms;
      }
    `;

    await render(
      <div>
        <style>{style}</style>
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="parent-popup">
                <Drawer.Root defaultOpen modal={false}>
                  <Drawer.Portal>
                    <Drawer.Viewport>
                      <Drawer.Popup class="animation-test-child-popup" data-testid="child-popup">
                        <Drawer.Close>Close nested drawer</Drawer.Close>
                      </Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>,
    );

    const parentPopup = screen.getByTestId('parent-popup');

    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');

    screen.getByRole('button', { name: 'Close nested drawer' }).click();
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('child-popup')).toHaveAttribute('data-ending-style');
    });
    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');

    await waitFor(() => {
      expect(screen.queryByTestId('child-popup')).toBe(null);
    });
  });

  it('keeps a fixed height applied while a nested drawer closes', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const style = `
      @keyframes test-drawer-exit {
        to {
          opacity: 0;
        }
      }

      .animation-test-parent-popup {
        height: var(--drawer-height, auto);
        overflow: hidden;
        transition: height 100ms linear;
      }

      .animation-test-parent-popup[data-nested-drawer-open] {
        height: var(--drawer-frontmost-height, var(--drawer-height));
      }

      .animation-test-parent-content {
        display: block;
        height: 160px;
      }

      .animation-test-child-content {
        display: block;
        height: 64px;
      }

      .animation-test-child-popup[data-ending-style] {
        animation: test-drawer-exit 100ms;
      }
    `;

    await render(
      <div>
        <style>{style}</style>
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup class="animation-test-parent-popup" data-testid="parent-popup">
                <div class="animation-test-parent-content" />
                <Drawer.Root modal={false}>
                  <Drawer.Trigger>Open nested drawer</Drawer.Trigger>
                  <Drawer.Portal>
                    <Drawer.Viewport>
                      <Drawer.Popup class="animation-test-child-popup" data-testid="child-popup">
                        <div class="animation-test-child-content" />
                        <Drawer.Close>Close nested drawer</Drawer.Close>
                      </Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    screen.getByRole('button', { name: 'Open nested drawer' }).click();
    await flushMicrotasks();

    await waitFor(() => {
      expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');
    });
    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--drawer-height')).not.toBe('');
    });

    const mutations: Array<{ hasNested: boolean; drawerHeight: string }> = [];
    const observer = new MutationObserver(() => {
      mutations.push({
        hasNested: parentPopup.hasAttribute('data-nested-drawer-open'),
        drawerHeight: parentPopup.style.getPropertyValue('--drawer-height'),
      });
    });

    observer.observe(parentPopup, {
      attributeFilter: ['data-nested-drawer-open', 'style'],
      attributes: true,
    });

    screen.getByRole('button', { name: 'Close nested drawer' }).click();
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('child-popup')).toHaveAttribute('data-ending-style');
    });
    await waitFor(() => {
      expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');
    });
    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--drawer-height')).not.toBe('');
    });
    await waitFor(() => {
      expect(
        mutations.some((mutation) => !mutation.hasNested && mutation.drawerHeight !== ''),
      ).toBe(true);
    });

    observer.disconnect();

    await waitFor(() => {
      expect(screen.queryByTestId('child-popup')).toBe(null);
    });
  });

  it('restores a fixed height before nested state when reopening a nested drawer', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const style = `
      .animation-test-parent-popup {
        height: var(--drawer-height, auto);
        overflow: hidden;
        transition: height 100ms linear;
      }

      .animation-test-parent-popup[data-nested-drawer-open] {
        height: var(--drawer-frontmost-height, var(--drawer-height));
      }

      .animation-test-parent-content {
        display: block;
        height: 160px;
      }

      .animation-test-child-content {
        display: block;
        height: 64px;
      }
    `;

    await render(
      <div>
        <style>{style}</style>
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup class="animation-test-parent-popup" data-testid="parent-popup">
                <div class="animation-test-parent-content" />
                <Drawer.Root modal={false}>
                  <Drawer.Trigger>Open nested drawer</Drawer.Trigger>
                  <Drawer.Portal>
                    <Drawer.Viewport>
                      <Drawer.Popup data-testid="child-popup">
                        <div class="animation-test-child-content" />
                        <Drawer.Close>Close nested drawer</Drawer.Close>
                      </Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    screen.getByRole('button', { name: 'Open nested drawer' }).click();
    await flushMicrotasks();

    await waitFor(() => {
      expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');
    });

    screen.getByRole('button', { name: 'Close nested drawer' }).click();
    await flushMicrotasks();

    await waitFor(() => {
      expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('child-popup')).toBe(null);
    });

    const mutations: Array<{ hasNested: boolean; drawerHeight: string }> = [];
    const observer = new MutationObserver(() => {
      mutations.push({
        hasNested: parentPopup.hasAttribute('data-nested-drawer-open'),
        drawerHeight: parentPopup.style.getPropertyValue('--drawer-height'),
      });
    });

    observer.observe(parentPopup, {
      attributeFilter: ['data-nested-drawer-open', 'style'],
      attributes: true,
    });

    screen.getByRole('button', { name: 'Open nested drawer' }).click();
    await flushMicrotasks();

    await waitFor(() => {
      expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');
    });
    await waitFor(() => {
      expect(mutations.find((mutation) => mutation.hasNested)?.drawerHeight).not.toBe('');
    });
    observer.disconnect();
  });

  describe('modal', () => {
    it('BUG-4678: hides the page outside a modal drawer, and keeps the internal backdrop out of the marks', async () => {
      let store!: DialogStore<unknown>;
      await render(
        <div>
          <button>Outside</button>
          <Drawer.Root open>
            <DialogStoreProbe
              onStore={(dialogStore) => {
                store = dialogStore;
              }}
            />
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup>Drawer</Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        </div>,
      );

      const outside = screen.getByRole('button', { name: 'Outside', hidden: true });
      await waitFor(() => {
        expect(outside.closest('[inert]')).not.toBe(null);
      });
      const internalBackdrop = store.context.internalBackdropRef.value;
      expect(internalBackdrop).not.toBe(null);
      expect(internalBackdrop).not.toHaveAttribute('inert');
    });
  });

  describe('swipe', () => {
    it('keeps the drag over the transform of the consumer when the popup renders during a swipe', async () => {
      const label = shallowRef('first');
      await render(() => (
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup
                data-testid="popup"
                data-label={label.value}
                style={{ transform: 'translateY(5px)', height: '200px' }}
              >
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const popup = screen.getByTestId('popup');
      const { left, top } = popup.getBoundingClientRect();
      const pointer = { pointerType: 'mouse', pointerId: 1, clientX: left + 10 };
      await firePointer.down(popup, {
        ...pointer,
        button: 0,
        buttons: 1,
        clientY: top + 10,
        timeStamp: 1,
      });
      await firePointer.move(popup, { ...pointer, buttons: 1, clientY: top + 40, timeStamp: 17 });
      await firePointer.move(popup, { ...pointer, buttons: 1, clientY: top + 70, timeStamp: 33 });
      expect(popup).toHaveAttribute('data-swiping', '');
      const dragTransform = popup.style.transform;
      expect(dragTransform).not.toBe('translateY(5px)');

      label.value = 'second';
      await flushMicrotasks();

      expect(popup).toHaveAttribute('data-label', 'second');
      expect(popup.style.transform).toBe(dragTransform);
      expect(popup.style.transition).toBe('none');

      await firePointer.up(popup, {
        ...pointer,
        button: 0,
        buttons: 0,
        clientY: top + 70,
        timeStamp: 49,
      });
    });

    it('renders the swipe progress of a nested drawer that the store holds', async () => {
      const NestedProgressReport = defineComponent({
        setup() {
          const { onNestedSwipeProgressChange } = useDrawerRootContext();
          onMounted(() => onNestedSwipeProgressChange(0.5));
          return () => null;
        },
      });
      const label = shallowRef('first');
      await render(() => (
        <Drawer.Root open modal={false}>
          <NestedProgressReport />
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup" data-label={label.value}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const popup = screen.getByTestId('popup');
      expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');

      label.value = 'second';
      await flushMicrotasks();

      expect(popup).toHaveAttribute('data-label', 'second');
      expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
    });
  });

  describe('KeepAlive', () => {
    it('VUE-5: clears the nested state of the drawer above while KeepAlive holds a nested drawer, and gives it back at the activation', async () => {
      const shown = shallowRef(true);
      const Held = defineComponent({
        name: 'Held',
        setup: () => () => (
          <Drawer.Root open modal={false}>
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup
                  initialFocus={false}
                  ref={(instance: unknown) => setHeight(instance, () => 100)}
                >
                  Child drawer
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        ),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });

      await render(() => (
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup
                data-testid="parent-popup"
                ref={(instance: unknown) => setHeight(instance, () => 50)}
              >
                <KeepAlive>{shown.value ? <Held key="held" /> : <Other key="other" />}</KeepAlive>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const parentPopup = screen.getByTestId('parent-popup');
      await waitFor(() => {
        expect(parentPopup.style.getPropertyValue('--drawer-frontmost-height')).toBe('100px');
      });
      expect(parentPopup.style.getPropertyValue('--drawer-height')).not.toBe('');

      shown.value = false;
      await flushMicrotasks();

      expect(parentPopup.style.getPropertyValue('--drawer-frontmost-height')).not.toBe('100px');
      expect(parentPopup.style.getPropertyValue('--drawer-height')).toBe('');

      shown.value = true;
      await flushMicrotasks();

      await waitFor(() => {
        expect(parentPopup.style.getPropertyValue('--drawer-frontmost-height')).toBe('100px');
      });
      expect(parentPopup.style.getPropertyValue('--drawer-height')).not.toBe('');
    });
  });
});
