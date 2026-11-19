import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, onMounted, shallowRef, Teleport } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  createTransitionRunCounter,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  flushMicrotasks,
  nextEndingStyle,
  nextEvent,
  screen,
  waitFor,
} from '#test-utils';
import ToastTextList from '../../../test/fixtures/ToastTextList.vue';
import { Toast } from '@vase-ui/vue/toast';
import type { ToastManagerAddOptions } from '../useToastManager';
import { List, Button, ToastWithDialog } from '../../../test/toastTestUtils';
import { toastRootStateAttributesMapping } from './ToastRoot.vue';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

async function simulateSwipe(
  element: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  releaseTarget: HTMLElement | Document = element,
) {
  await fireEvent.pointerDown(element, {
    clientX: startX,
    clientY: startY,
    button: 0,
    bubbles: true,
    pointerId: 1,
  });

  // Fire an initial move event close to the start to trigger the isFirstPointerMove logic correctly.
  // This simulates the finger moving slightly before the main swipe movement is registered.
  await fireEvent.pointerMove(element, {
    clientX: startX + Math.sign(endX - startX),
    clientY: startY + Math.sign(endY - startY),
    bubbles: true,
    pointerId: 1,
  });

  // Fire the main move event to the end position.
  await fireEvent.pointerMove(element, {
    clientX: endX,
    clientY: endY,
    bubbles: true,
    pointerId: 1,
  });

  await fireEvent.pointerUp(releaseTarget, {
    clientX: endX,
    clientY: endY,
    bubbles: true,
    pointerId: 1,
  });
}

describe('<Toast.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Root toast={toast} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Toast.Provider>
          <Toast.Viewport>{node}</Toast.Viewport>
        </Toast.Provider>,
      );
    },
  }));

  async function renderToasts(providerProps: { limit?: number } = {}) {
    const manager = Toast.createToastManager();
    await render(
      <Toast.Provider toastManager={manager} {...providerProps}>
        <Toast.Viewport data-testid="viewport">
          <ToastTextList />
        </Toast.Viewport>
      </Toast.Provider>,
    );
    return { manager };
  }

  it('maps the active swipe direction to its data attribute', () => {
    expect(toastRootStateAttributesMapping.swipeDirection!('left')).toEqual({
      'data-swipe-direction': 'left',
    });
  });

  it('sets the vertical offset CSS variable', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'add' }));

    expect(screen.getByTestId('root').style.getPropertyValue('--toast-offset-y')).not.toBe('');
  });

  it('keeps dynamic title and description ids synchronized with mounted label parts', async () => {
    const App = defineComponent({
      setup() {
        const mode = shallowRef<'fallback' | 'explicit' | 'none' | 'restored'>('fallback');
        return () => {
          const showLabels = mode.value !== 'none';
          const explicit = mode.value === 'explicit';

          return (
            <Toast.Provider>
              <button type="button" onClick={() => (mode.value = 'explicit')}>
                explicit
              </button>
              <button type="button" onClick={() => (mode.value = 'none')}>
                none
              </button>
              <button type="button" onClick={() => (mode.value = 'restored')}>
                restore
              </button>
              <Toast.Viewport>
                <Toast.Root
                  toast={{ ...toast, description: 'Toast description' }}
                  data-testid="root"
                >
                  {showLabels && (
                    <>
                      <Toast.Title
                        data-testid="title"
                        v-slots={explicit ? { default: () => 'Explicit title' } : {}}
                      />
                      <Toast.Description
                        data-testid="description"
                        v-slots={explicit ? { default: () => 'Explicit description' } : {}}
                      />
                    </>
                  )}
                </Toast.Root>
              </Toast.Viewport>
            </Toast.Provider>
          );
        };
      },
    });

    const { user } = await render(<App />);
    const root = screen.getByTestId('root');

    expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('title').id);
    expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);

    await user.click(screen.getByRole('button', { name: 'explicit' }));
    expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('title').id);
    expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);
    expect(screen.getByTestId('title')).toHaveTextContent('Explicit title');
    expect(screen.getByTestId('description')).toHaveTextContent('Explicit description');

    await user.click(screen.getByRole('button', { name: 'none' }));
    expect(root).not.toHaveAttribute('aria-labelledby');
    expect(root).not.toHaveAttribute('aria-describedby');

    await user.click(screen.getByRole('button', { name: 'restore' }));
    expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('title').id);
    expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);
    expect(screen.getByTestId('title')).toHaveTextContent('Toast title');
    expect(screen.getByTestId('description')).toHaveTextContent('Toast description');
  });

  it('recalculates height when content mutates', async () => {
    const ToastList = defineComponent({
      setup() {
        const { toasts } = Toast.useToastManager();
        return () =>
          toasts.value.map((toastItem) => (
            <Toast.Root
              key={toastItem.id}
              toast={toastItem}
              data-testid="toast-root"
              style={{ width: '30px' }}
            >
              <Toast.Content>
                <Toast.Title />
                <Toast.Description />
              </Toast.Content>
            </Toast.Root>
          ));
      },
    });

    const App = defineComponent({
      setup() {
        const { add, update } = Toast.useToastManager();
        const toastId = shallowRef<string | null>(null);

        onMounted(() => {
          toastId.value = add({
            id: 'resizable-toast',
            title: 'Loading',
            description: 'Short',
          });
        });

        return () => (
          <div>
            <button
              type="button"
              onClick={() => {
                if (!toastId.value) {
                  return;
                }
                update(toastId.value, {
                  title: 'Success',
                  description:
                    'This content is longer than before and should cause the height to increase',
                });
              }}
            >
              update
            </button>
            <Toast.Viewport>
              <ToastList />
            </Toast.Viewport>
          </div>
        );
      },
    });

    await render(
      <Toast.Provider>
        <App />
      </Toast.Provider>,
    );

    const toastRoot = await screen.findByTestId('toast-root');

    await waitFor(() => {
      const height = toastRoot.style.getPropertyValue('--toast-height');
      expect(height).not.toBe('');
    });

    const initialHeight = parseInt(toastRoot.style.getPropertyValue('--toast-height'), 10);

    await fireEvent.click(screen.getByRole('button', { name: 'update' }));

    await waitFor(() => {
      const newHeight = parseInt(toastRoot.style.getPropertyValue('--toast-height'), 10);
      expect(newHeight).toBeGreaterThan(initialHeight);
    });
  });

  it('clears the starting state and restores the height when re-adding an ending toast', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const App = defineComponent({
      setup() {
        const { add, close, toasts } = Toast.useToastManager();

        return () => (
          <>
            <style>
              {`
              [data-testid="toast-root"] {
                opacity: 1;
                transition: opacity 10s;
              }

              [data-testid="toast-root"][data-ending-style] {
                opacity: 0;
              }
            `}
            </style>
            <button type="button" onClick={() => add({ id: 'save', title: 'Saved', timeout: 0 })}>
              add
            </button>
            <button type="button" onClick={() => close('save')}>
              close
            </button>
            <Toast.Viewport>
              {toasts.value.map((toastItem) => (
                <Toast.Root key={toastItem.id} toast={toastItem} data-testid="toast-root">
                  <Toast.Title />
                </Toast.Root>
              ))}
            </Toast.Viewport>
          </>
        );
      },
    });

    try {
      const { user } = await render(
        <Toast.Provider>
          <App />
        </Toast.Provider>,
      );

      await user.click(screen.getByRole('button', { name: 'add' }));
      const toastRoot = screen.getByTestId('toast-root');
      expect(toastRoot).not.toHaveAttribute('data-starting-style');
      const initialHeight = toastRoot.style.getPropertyValue('--toast-height');
      expect(initialHeight).not.toBe('');

      await user.click(screen.getByRole('button', { name: 'close' }));
      expect(toastRoot).toHaveAttribute('data-ending-style');
      expect(toastRoot.style.getPropertyValue('--toast-height')).toBe('');

      await user.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('toast-root')).toBe(toastRoot);

      expect(toastRoot).not.toHaveAttribute('data-starting-style');
      await waitFor(() => {
        expect(toastRoot.style.getPropertyValue('--toast-height')).toBe(initialHeight);
      });
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('registers an active toast after its root remounts', async () => {
    const App = defineComponent({
      setup() {
        const { add, toasts } = Toast.useToastManager();
        const showToasts = shallowRef(true);
        const longTitle = shallowRef(false);

        return () => (
          <>
            <button type="button" onClick={() => add({ id: 'save', title: 'Saved', timeout: 0 })}>
              add
            </button>
            <button type="button" onClick={() => (showToasts.value = false)}>
              hide
            </button>
            <button
              type="button"
              onClick={() => {
                longTitle.value = true;
                showToasts.value = true;
              }}
            >
              show
            </button>
            <Toast.Viewport>
              {showToasts.value
                ? toasts.value.map((toastItem) => (
                    <Toast.Root
                      key={toastItem.id}
                      toast={toastItem}
                      data-testid="toast-root"
                      style={{ width: '30px' }}
                    >
                      <Toast.Title
                        v-slots={
                          longTitle.value
                            ? { default: () => 'This title is much longer than before' }
                            : {}
                        }
                      />
                    </Toast.Root>
                  ))
                : null}
            </Toast.Viewport>
          </>
        );
      },
    });

    const { user } = await render(
      <Toast.Provider>
        <App />
      </Toast.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'add' }));
    const initialRoot = screen.getByTestId('toast-root');
    expect(initialRoot).not.toHaveAttribute('data-starting-style');
    const initialHeight = parseInt(initialRoot.style.getPropertyValue('--toast-height'), 10);

    await user.click(screen.getByRole('button', { name: 'hide' }));
    expect(screen.queryByTestId('toast-root')).toBe(null);

    await user.click(screen.getByRole('button', { name: 'show' }));
    const remountedRoot = screen.getByTestId('toast-root');
    expect(remountedRoot).not.toBe(initialRoot);

    await waitFor(() => {
      const remountedHeight = parseInt(remountedRoot.style.getPropertyValue('--toast-height'), 10);
      expect(remountedHeight).toBeGreaterThan(initialHeight);
    });

    await user.keyboard('{F6}');
    await user.keyboard('{Tab}');

    expect(remountedRoot).toHaveFocus();
  });

  it('keeps stacking intact when re-adding an ending toast among other toasts', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const App = defineComponent({
      setup() {
        const { add, close, toasts } = Toast.useToastManager();

        return () => (
          <>
            <style>
              {`
              [data-testid^="toast-"] {
                opacity: 1;
                transition: opacity 10s;
              }

              [data-testid^="toast-"][data-ending-style] {
                opacity: 0;
              }
            `}
            </style>
            <button type="button" onClick={() => add({ id: 't1', title: 'One', timeout: 0 })}>
              add-1
            </button>
            <button type="button" onClick={() => add({ id: 't2', title: 'Two', timeout: 0 })}>
              add-2
            </button>
            <button type="button" onClick={() => close('t1')}>
              close-1
            </button>
            <Toast.Viewport>
              {toasts.value.map((toastItem) => (
                <Toast.Root
                  key={toastItem.id}
                  toast={toastItem}
                  data-testid={`toast-${toastItem.id}`}
                >
                  <Toast.Content data-testid={`content-${toastItem.id}`}>
                    <Toast.Title />
                  </Toast.Content>
                </Toast.Root>
              ))}
            </Toast.Viewport>
          </>
        );
      },
    });

    try {
      const { user } = await render(
        <Toast.Provider>
          <App />
        </Toast.Provider>,
      );

      await user.click(screen.getByRole('button', { name: 'add-1' }));
      await user.click(screen.getByRole('button', { name: 'add-2' }));
      await user.click(screen.getByRole('button', { name: 'close-1' }));

      const toast1 = screen.getByTestId('toast-t1');
      expect(toast1).toHaveAttribute('data-ending-style');

      await user.click(screen.getByRole('button', { name: 'add-1' }));

      expect(toast1).not.toHaveAttribute('data-starting-style');
      await waitFor(() => {
        expect(toast1.style.getPropertyValue('--toast-height')).not.toBe('');
      });

      // The revived toast is frontmost and its content is not hidden as "behind".
      expect(toast1.style.getPropertyValue('--toast-index')).toBe('0');
      expect(screen.getByTestId('content-t1')).not.toHaveAttribute('data-behind');

      // The unrelated toast is unaffected and stacks behind the revived one.
      const toast2 = screen.getByTestId('toast-t2');
      expect(toast2).not.toHaveAttribute('data-ending-style');
      expect(toast2.style.getPropertyValue('--toast-index')).toBe('1');
      expect(screen.getByTestId('content-t2')).toHaveAttribute('data-behind');
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('clears swipe state when re-adding a swipe-dismissed toast', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const App = defineComponent({
      setup() {
        const { add, toasts } = Toast.useToastManager();

        return () => (
          <>
            <style>
              {`
            [data-testid="toast-root"] {
              opacity: 1;
              transition: opacity 10s;
            }

            [data-testid="toast-root"][data-ending-style] {
              opacity: 0;
            }
          `}
            </style>
            <button type="button" onClick={() => add({ id: 'save', title: 'Saved', timeout: 0 })}>
              add
            </button>
            <Toast.Viewport>
              {toasts.value.map((toastItem) => (
                <Toast.Root
                  key={toastItem.id}
                  toast={toastItem}
                  data-testid="toast-root"
                  swipeDirection="right"
                >
                  <Toast.Title />
                </Toast.Root>
              ))}
            </Toast.Viewport>
          </>
        );
      },
    });

    try {
      const { user } = await render(
        <Toast.Provider>
          <App />
        </Toast.Provider>,
      );

      await user.click(screen.getByRole('button', { name: 'add' }));
      const toastRoot = screen.getByTestId('toast-root');
      Object.defineProperty(toastRoot, 'setPointerCapture', {
        configurable: true,
        value: () => {},
      });
      Object.defineProperty(toastRoot, 'releasePointerCapture', {
        configurable: true,
        value: () => {},
      });

      await simulateSwipe(toastRoot, 100, 100, 160, 100);

      expect(toastRoot).toHaveAttribute('data-ending-style');
      expect(toastRoot).toHaveAttribute('data-swipe-direction', 'right');

      await user.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('toast-root')).toBe(toastRoot);

      expect(toastRoot).not.toHaveAttribute('data-starting-style');
      expect(toastRoot).not.toHaveAttribute('data-swipe-direction');
      expect(toastRoot.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(toastRoot.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('clears swipe state when a retained root is reused for another toast', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const App = defineComponent({
      setup() {
        const { add, toasts } = Toast.useToastManager();

        return () => (
          <>
            <style>
              {`
              [data-testid^="root-"] {
                opacity: 1;
                transition: opacity 10s;
              }

              [data-testid^="root-"][data-ending-style] {
                opacity: 0;
              }
            `}
            </style>
            <button type="button" onClick={() => add({ title: 'Saved', timeout: 0 })}>
              add
            </button>
            <Toast.Viewport>
              {toasts.value.map((toastItem, index) => (
                <Toast.Root
                  key={index}
                  toast={toastItem}
                  data-testid={`root-${index}`}
                  swipeDirection="right"
                >
                  <Toast.Title />
                </Toast.Root>
              ))}
            </Toast.Viewport>
          </>
        );
      },
    });

    try {
      const { user } = await render(
        <Toast.Provider>
          <App />
        </Toast.Provider>,
      );

      const addButton = screen.getByRole('button', { name: 'add' });
      await user.click(addButton);
      await user.click(addButton);
      await user.click(addButton);

      const swipedRoot = screen.getByTestId('root-1');
      Object.defineProperty(swipedRoot, 'setPointerCapture', {
        configurable: true,
        value: () => {},
      });
      Object.defineProperty(swipedRoot, 'releasePointerCapture', {
        configurable: true,
        value: () => {},
      });

      await simulateSwipe(swipedRoot, 100, 100, 160, 100);
      expect(swipedRoot).toHaveAttribute('data-swipe-direction', 'right');

      // Index keys shift every retained root onto a different toast, so this root now
      // renders a toast that was never swiped.
      await user.click(addButton);
      expect(screen.getByTestId('root-1')).toBe(swipedRoot);

      expect(swipedRoot).not.toHaveAttribute('data-swipe-direction');
      expect(swipedRoot).not.toHaveAttribute('data-ending-style');
      expect(swipedRoot.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(swipedRoot.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('moves focus to the next toast when closing in an index-keyed list', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const App = defineComponent({
      setup() {
        const { add, toasts } = Toast.useToastManager();

        return () => (
          <>
            <style>
              {`
              [data-testid^="root-"] {
                opacity: 1;
                transition: opacity 10s;
              }

              [data-testid^="root-"][data-ending-style] {
                opacity: 0;
              }
            `}
            </style>
            <button type="button" onClick={() => add({ title: 'Saved', timeout: 0 })}>
              add
            </button>
            <Toast.Viewport>
              {toasts.value.map((toastItem, index) => (
                <Toast.Root key={index} toast={toastItem} data-testid={`root-${index}`}>
                  <Toast.Title />
                </Toast.Root>
              ))}
            </Toast.Viewport>
          </>
        );
      },
    });

    try {
      const { user } = await render(
        <Toast.Provider>
          <App />
        </Toast.Provider>,
      );

      // With index keys, each add shifts every retained root to a different toast,
      // so the store refs must be re-registered per toast id.
      await user.click(screen.getByRole('button', { name: 'add' }));
      await user.click(screen.getByRole('button', { name: 'add' }));
      await user.click(screen.getByRole('button', { name: 'add' }));

      await user.keyboard('{F6}');
      await user.keyboard('{Tab}');
      expect(screen.getByTestId('root-0')).toHaveFocus();

      await user.keyboard('{Escape}');

      // Focus hands off to the next active toast, not the one animating out.
      await waitFor(() => {
        expect(screen.getByTestId('root-1')).toHaveFocus();
      });
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  // requires :focus-visible check
  it('closes when pressing escape', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });

    button.focus();
    await flushMicrotasks();
    await user.click(button);

    await user.keyboard('{F6}');
    await user.keyboard('{Tab}');
    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('root')).toBe(null);
  });

  it('ignores Escape when focus is in portaled content', async () => {
    const PortalList = defineComponent({
      setup() {
        const { toasts } = Toast.useToastManager();
        return () =>
          toasts.value.map((toastItem) => (
            <Toast.Root key={toastItem.id} toast={toastItem} data-testid="root">
              <Toast.Title />
              <Teleport to={document.body}>
                <button type="button" data-testid="portaled">
                  portaled
                </button>
              </Teleport>
            </Toast.Root>
          ));
      },
    });

    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <PortalList />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'add' }));

    // The button is a child of the toast in the component tree, but it is outside the toast in the
    // DOM and owns the Escape key.
    screen.getByTestId('portaled').focus();
    await flushMicrotasks();
    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('root')).not.toBe(null);
  });

  it('sets the index, the offset and the height of each toast as CSS variables', async () => {
    const { manager } = await renderToasts();

    manager.add({ id: 'first', title: () => h('div', { style: { height: '10px' } }), timeout: 0 });
    manager.add({ id: 'second', title: () => h('div', { style: { height: '30px' } }), timeout: 0 });
    await flushMicrotasks();

    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');
    expect(second.style.getPropertyValue('--toast-index')).toBe('0');
    expect(first.style.getPropertyValue('--toast-index')).toBe('1');
    expect(second.style.getPropertyValue('--toast-offset-y')).toBe('0px');
    expect(first.style.getPropertyValue('--toast-offset-y')).toBe('30px');
    expect(second.style.getPropertyValue('--toast-height')).toBe('30px');
    expect(first.style.getPropertyValue('--toast-height')).toBe('10px');
  });

  it('removes data-starting-style when it has measured its height', async () => {
    const { manager } = await renderToasts();

    manager.add({ id: 'toast', title: 'Toast', timeout: 0 });
    await flushMicrotasks();

    expect(screen.getByTestId('toast')).not.toHaveAttribute('data-starting-style');
  });

  it('removes the toast from the list when it has left', async () => {
    const { manager } = await renderToasts();
    manager.add({ id: 'toast', title: 'Toast', timeout: 0 });
    await flushMicrotasks();
    const toast = screen.getByTestId('toast');

    manager.close('toast');

    await waitFor(() => {
      expect(toast).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('toast')).toBe(null);
  });

  it('gives a high priority toast the role alertdialog, and hides it until the viewport has focus', async () => {
    const { manager } = await renderToasts();

    manager.add({ id: 'high', title: 'High', priority: 'high', timeout: 0 });
    manager.add({ id: 'low', title: 'Low', timeout: 0 });
    await flushMicrotasks();

    expect(screen.getByTestId('high')).toHaveAttribute('role', 'alertdialog');
    expect(screen.getByTestId('high')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('low')).toHaveAttribute('role', 'dialog');
    expect(screen.getByTestId('low')).not.toHaveAttribute('aria-hidden');

    await fireEvent.keyDown(document.body, { key: 'F6' });

    expect(screen.getByTestId('viewport')).toHaveFocus();
    expect(screen.getByTestId('high')).not.toHaveAttribute('aria-hidden');
  });

  describe('VUE-99: the name of a toast with no title', () => {
    const LabelledToastList = defineComponent({
      setup() {
        const { toasts } = Toast.useToastManager();
        return () =>
          toasts.value.map((toastItem) => (
            <Toast.Root key={toastItem.id} toast={toastItem} data-testid={toastItem.id}>
              <Toast.Title />
              <Toast.Description data-testid="description" />
            </Toast.Root>
          ));
      },
    });

    it.each([
      { name: 'dialog', priority: undefined, role: 'dialog' },
      { name: 'alertdialog', priority: 'high', role: 'alertdialog' },
    ] as const)(
      'gives the role $name its name from the description',
      async ({ priority, role }) => {
        const manager = Toast.createToastManager();
        await render(
          <Toast.Provider toastManager={manager}>
            <Toast.Viewport data-testid="viewport">
              <LabelledToastList />
            </Toast.Viewport>
          </Toast.Provider>,
        );

        manager.add({ id: 'copied', description: 'Copied', priority, timeout: 0 });
        await flushMicrotasks();
        // A high priority toast has `aria-hidden` until the viewport has the focus.
        await fireEvent.keyDown(document.body, { key: 'F6' });

        const root = screen.getByTestId('copied');
        expect(root).toHaveAttribute('role', role);
        expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('description').id);
        expect(root).not.toHaveAttribute('aria-describedby');
        expect(root).toHaveAccessibleName('Copied');
        expect(root).toHaveAccessibleDescription('');
        await expectNoAxeViolations(root);
      },
    );

    it('names the toast with its title while a title is mounted', async () => {
      const showTitle = shallowRef(true);
      await render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root
              toast={{ id: 'test', title: 'Saved', description: 'Copied' }}
              data-testid="root"
            >
              {showTitle.value && <Toast.Title data-testid="title" />}
              <Toast.Description data-testid="description" />
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>
      ));
      const root = screen.getByTestId('root');

      expect(root).toHaveAccessibleName('Saved');
      expect(root).toHaveAccessibleDescription('Copied');

      showTitle.value = false;
      await nextTick();
      expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('description').id);
      expect(root).not.toHaveAttribute('aria-describedby');
      expect(root).toHaveAccessibleName('Copied');

      showTitle.value = true;
      await nextTick();
      expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('title').id);
      expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);
    });

    it.each([
      { name: 'aria-label', attrs: { 'aria-label': 'Clipboard' }, labelledBy: null },
      { name: 'aria-labelledby', attrs: { 'aria-labelledby': 'own-name' }, labelledBy: 'own-name' },
    ])('keeps the name from the $name of the consumer', async ({ attrs, labelledBy }) => {
      await render(
        <Toast.Provider>
          <span id="own-name">Clipboard</span>
          <Toast.Viewport>
            <Toast.Root toast={{ id: 'test', description: 'Copied' }} data-testid="root" {...attrs}>
              <Toast.Description data-testid="description" />
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );
      const root = screen.getByTestId('root');

      expect(root.getAttribute('aria-labelledby')).toBe(labelledBy);
      expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);
      expect(root).toHaveAccessibleName('Clipboard');
      expect(root).toHaveAccessibleDescription('Copied');
    });

    describe.each([
      { name: 'an empty aria-label', attrs: { 'aria-label': '' } },
      { name: 'an aria-label of white space', attrs: { 'aria-label': ' ' } },
      { name: 'an empty aria-labelledby', attrs: { 'aria-labelledby': '' } },
      { name: 'an aria-labelledby of white space', attrs: { 'aria-labelledby': '\n\t ' } },
    ])('VUE-106: $name of the consumer', ({ attrs }) => {
      it('names the toast with its description', async () => {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <Toast.Root
                toast={{ id: 'test', description: 'Copied' }}
                data-testid="root"
                {...attrs}
              >
                <Toast.Description data-testid="description" />
              </Toast.Root>
            </Toast.Viewport>
          </Toast.Provider>,
        );
        const root = screen.getByTestId('root');

        expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('description').id);
        expect(root).not.toHaveAttribute('aria-describedby');
        expect(root).toHaveAccessibleName('Copied');
        expect(root).toHaveAccessibleDescription('');
        await expectNoAxeViolations(root);
      });

      it('keeps the title as the name of a toast that has a title', async () => {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <Toast.Root
                toast={{ id: 'test', title: 'Saved', description: 'Copied' }}
                data-testid="root"
                {...attrs}
              >
                <Toast.Title data-testid="title" />
                <Toast.Description data-testid="description" />
              </Toast.Root>
            </Toast.Viewport>
          </Toast.Provider>,
        );
        const root = screen.getByTestId('root');

        expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('title').id);
        expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);
        expect(root).toHaveAccessibleName('Saved');
        expect(root).toHaveAccessibleDescription('Copied');
      });
    });

    it('VUE-103: names the toast with its description for an aria-labelledby of undefined', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root
              toast={{ id: 'test', description: 'Copied' }}
              data-testid="root"
              aria-labelledby={undefined}
            >
              <Toast.Description data-testid="description" />
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );
      const root = screen.getByTestId('root');

      expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('description').id);
      expect(root).not.toHaveAttribute('aria-describedby');
      expect(root).toHaveAccessibleName('Copied');
      expect(root).toHaveAccessibleDescription('');
    });

    it('VUE-103: gives no name and keeps the description for an aria-labelledby of null', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root
              toast={{ id: 'test', description: 'Copied' }}
              data-testid="root"
              aria-labelledby={null}
            >
              <Toast.Description data-testid="description" />
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );
      const root = screen.getByTestId('root');

      expect(root).not.toHaveAttribute('aria-labelledby');
      expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);
      expect(root).toHaveAccessibleName('');
      expect(root).toHaveAccessibleDescription('Copied');
    });
  });

  it('marks a toast that the limit hides with data-limited, and makes it inert', async () => {
    const { manager } = await renderToasts({ limit: 1 });

    manager.add({ id: 'old', title: 'Old', timeout: 0 });
    manager.add({ id: 'new', title: 'New', timeout: 0 });
    await flushMicrotasks();

    expect(screen.getByTestId('old')).toHaveAttribute('data-limited');
    expect(screen.getByTestId('old')).toHaveAttribute('inert');
    expect(screen.getByTestId('new')).not.toHaveAttribute('data-limited');
    expect(screen.getByTestId('new')).not.toHaveAttribute('inert');
  });

  describe('VUE-127: Escape with the focus in a toast', () => {
    async function renderToastWithDialog() {
      const manager = Toast.createToastManager();
      const onOpenChange = vi.fn();
      const result = await render(
        <ToastWithDialog manager={manager} onOpenChange={onOpenChange} />,
      );
      manager.add({ id: 'toast', title: 'Saved', timeout: 0 });
      await flushMicrotasks();
      return { onOpenChange, ...result };
    }

    it('closes the toast and keeps a modal dialog open', async () => {
      const { onOpenChange, user } = await renderToastWithDialog();
      const inDialog = screen.getByRole('button', { name: 'in dialog' });
      // The dialog takes the focus in a frame after it opens. A step before that frame loses the
      // focus to the dialog.
      await waitFor(() => {
        expect(inDialog).toHaveFocus();
      });

      await user.keyboard('{F6}');
      await user.keyboard('{Tab}');
      const root = screen.getByTestId('toast');
      expect(root).toHaveFocus();

      await user.keyboard('{Escape}');

      expect(root).toHaveAttribute('data-ending-style');
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('dialog')).not.toHaveAttribute('data-ending-style');

      // The focus is in the dialog again, so the next Escape is for the dialog.
      expect(inDialog).toHaveFocus();
      await user.keyboard('{Escape}');

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    });

    it('closes on Escape only while it has the focus, and stops only that Escape', async () => {
      const { manager } = await renderToasts();
      manager.add({ id: 'toast', title: 'Toast', timeout: 0 });
      await flushMicrotasks();
      const root = screen.getByTestId('toast');
      const keys: string[] = [];
      const record = (event: KeyboardEvent) => keys.push(event.key);
      document.addEventListener('keydown', record);
      onTestFinished(() => document.removeEventListener('keydown', record));

      // The focus is not in the toast, so the toast does not handle the key.
      await fireEvent.keyDown(root, { key: 'Escape' });
      expect(root).not.toHaveAttribute('data-ending-style');
      root.focus();
      await fireEvent.keyDown(root, { key: 'Enter' });
      expect(keys).toEqual(['Escape', 'Enter']);

      await fireEvent.keyDown(root, { key: 'Escape' });

      expect(root).toHaveAttribute('data-ending-style');
      expect(keys).toEqual(['Escape', 'Enter']);
    });

    it('does not stop an Escape that comes during the exit of the toast', async () => {
      const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      try {
        const manager = Toast.createToastManager();
        await render(
          <Toast.Provider toastManager={manager}>
            <style>
              {`
              [data-testid="toast"][data-ending-style] { animation: toast-exit 100s; }
              @keyframes toast-exit { to { opacity: 0; } }
            `}
            </style>
            <Toast.Viewport>
              <ToastTextList />
            </Toast.Viewport>
          </Toast.Provider>,
        );
        manager.add({ id: 'toast', title: 'Toast', timeout: 0 });
        await flushMicrotasks();
        const root = screen.getByTestId('toast');
        const keys: string[] = [];
        const record = (event: KeyboardEvent) => keys.push(event.key);
        document.addEventListener('keydown', record);
        onTestFinished(() => document.removeEventListener('keydown', record));

        root.focus();
        await nextEndingStyle(root, { action: () => fireEvent.keyDown(root, { key: 'Escape' }) });
        expect(keys).toEqual([]);

        // No element took the focus from the toast, and its exit of 100 s still runs.
        expect(root).toHaveFocus();
        await fireEvent.keyDown(root, { key: 'Escape' });

        expect(keys).toEqual(['Escape']);
      } finally {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
      }
    });
  });

  describe('swipe behavior', () => {
    const SwipeTestButton = defineComponent({
      props: {
        toastOptions: {
          type: Object as PropType<Partial<ToastManagerAddOptions<any>>>,
          default: undefined,
        },
      },
      setup(props) {
        const { add } = Toast.useToastManager();
        return () => (
          <button
            type="button"
            onClick={() => {
              add({
                id: 'swipe-test-toast',
                title: 'Swipe Me',
                description: 'Swipe to dismiss',
                ...(props.toastOptions ?? {}),
              });
            }}
          >
            add toast
          </button>
        );
      },
    });

    const SwipeTestToast = defineComponent({
      props: {
        swipeDirection: {
          type: [String, Array] as PropType<Toast.Root.Props['swipeDirection']>,
          required: true,
        },
      },
      setup(props) {
        const { toasts } = Toast.useToastManager();
        return () =>
          toasts.value.map((toastItem) => (
            <Toast.Root
              key={toastItem.id}
              toast={toastItem}
              data-testid="toast-root"
              swipeDirection={props.swipeDirection}
            >
              <Toast.Title />
              <Toast.Description />
            </Toast.Root>
          ));
      },
    });

    it.each([
      ['left', -60, 0],
      ['right', 60, 0],
      ['up', 0, -60],
      ['down', 0, 60],
    ] as const)('dismisses with a real %s pointer swipe', async (direction, deltaX, deltaY) => {
      const { user } = await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection={direction} />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await user.click(screen.getByRole('button', { name: 'add toast' }));
      const toastElement = screen.getByTestId('toast-root');
      Object.defineProperty(toastElement, 'setPointerCapture', {
        configurable: true,
        value: () => {},
      });
      Object.defineProperty(toastElement, 'releasePointerCapture', {
        configurable: true,
        value: () => {},
      });
      const rect = toastElement.getBoundingClientRect();
      const start = {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      };

      await user.pointer([
        { target: toastElement, coords: start, keys: '[TouchA>]' },
        {
          target: toastElement,
          pointerName: 'TouchA',
          coords: {
            clientX: start.clientX + Math.sign(deltaX),
            clientY: start.clientY + Math.sign(deltaY),
          },
        },
        {
          target: toastElement,
          pointerName: 'TouchA',
          coords: { clientX: start.clientX + deltaX, clientY: start.clientY + deltaY },
        },
        { keys: '[/TouchA]' },
      ]);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('closes toast when swiping in the specified direction beyond threshold', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Swipe up (starting at y=100, ending at y=55, which is > 40px threshold)
      await simulateSwipe(toastElement, 100, 100, 100, 55);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('locks to a single axis on the first move of a two-axis swipe', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection={['down', 'right']} />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');
      Object.defineProperty(toastElement, 'setPointerCapture', {
        configurable: true,
        value: () => {},
      });
      Object.defineProperty(toastElement, 'releasePointerCapture', {
        configurable: true,
        value: () => {},
      });

      await fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true,
        pointerId: 1,
      });
      await fireEvent.pointerMove(toastElement, {
        clientX: 101,
        clientY: 101,
        bubbles: true,
        pointerId: 1,
      });
      await fireEvent.pointerMove(toastElement, {
        clientX: 120,
        clientY: 150,
        bubbles: true,
        pointerId: 1,
      });

      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-y')).not.toBe('0px');

      await fireEvent.pointerUp(toastElement, {
        clientX: 120,
        clientY: 150,
        bubbles: true,
        pointerId: 1,
      });
    });

    it('does not close toast when swiping in the specified direction below threshold', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Swipe up but only by 10px (below 40px threshold)
      await simulateSwipe(toastElement, 100, 100, 100, 90);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    it('does not close toast when swiping in a non-specified direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Swipe down (opposite of allowed direction)
      await simulateSwipe(toastElement, 100, 100, 100, 150);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    describe('supports multiple swipe directions', () => {
      it('up + right', async () => {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <SwipeTestToast swipeDirection={['up', 'right']} />
            </Toast.Viewport>
            <SwipeTestButton />
          </Toast.Provider>,
        );

        const addToast = screen.getByRole('button', { name: 'add toast' });

        await fireEvent.click(addToast);

        // Swipe right
        await simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 150, 100);

        expect(screen.queryByTestId('toast-root')).toBe(null);

        await fireEvent.click(addToast);

        // Swipe up
        await simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 100, 50);

        expect(screen.queryByTestId('toast-root')).toBe(null);
      });

      it('right + left', async () => {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <SwipeTestToast swipeDirection={['right', 'left']} />
            </Toast.Viewport>
            <SwipeTestButton />
          </Toast.Provider>,
        );

        const addToast = screen.getByRole('button', { name: 'add toast' });

        await fireEvent.click(addToast);

        // Swipe right
        await simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 150, 100);

        expect(screen.queryByTestId('toast-root')).toBe(null);

        await fireEvent.click(addToast);

        // Swipe left
        await simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 50, 100);

        expect(screen.queryByTestId('toast-root')).toBe(null);
      });

      it('up + down', async () => {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <SwipeTestToast swipeDirection={['up', 'down']} />
            </Toast.Viewport>
            <SwipeTestButton />
          </Toast.Provider>,
        );

        const addToast = screen.getByRole('button', { name: 'add toast' });

        await fireEvent.click(addToast);

        // Swipe up
        await simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 100, 50);

        expect(screen.queryByTestId('toast-root')).toBe(null);

        await fireEvent.click(addToast);

        // Swipe down
        await simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 100, 150);

        expect(screen.queryByTestId('toast-root')).toBe(null);
      });
    });

    it('cancels a vertical swipe when the pointer changes its mind', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      await fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
      });
      await fireEvent.pointerMove(toastElement, {
        clientX: 100,
        clientY: 99,
        movementY: -1,
        pointerId: 1,
      });

      // Swipe up well past the dismiss threshold to arm the gesture.
      await fireEvent.pointerMove(toastElement, {
        clientX: 100,
        clientY: 10,
        movementY: -89,
        pointerId: 1,
      });
      expect(toastElement).toHaveAttribute('data-swipe-direction', 'up');

      // Reversing moves the cancel baseline to the turning point, so the swipe
      // is now measured as zero progress from there rather than 50px from the
      // original press, and the change of mind wins.
      await fireEvent.pointerMove(toastElement, {
        clientX: 100,
        clientY: 50,
        movementY: 40,
        pointerId: 1,
      });
      await fireEvent.pointerUp(toastElement, { clientX: 100, clientY: 50, pointerId: 1 });

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
    });

    it('cancels a horizontal swipe when the pointer changes its mind', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="right" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      await fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
      });
      await fireEvent.pointerMove(toastElement, {
        clientX: 101,
        clientY: 100,
        movementX: 1,
        pointerId: 1,
      });

      await fireEvent.pointerMove(toastElement, {
        clientX: 190,
        clientY: 100,
        movementX: 89,
        pointerId: 1,
      });
      expect(toastElement).toHaveAttribute('data-swipe-direction', 'right');

      await fireEvent.pointerMove(toastElement, {
        clientX: 150,
        clientY: 100,
        movementX: -40,
        pointerId: 1,
      });
      await fireEvent.pointerUp(toastElement, { clientX: 150, clientY: 100, pointerId: 1 });

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
    });

    it('locks the gesture to the horizontal axis when it starts sideways', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection={['down', 'right']} />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      await fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
      });
      await fireEvent.pointerMove(toastElement, { clientX: 100, clientY: 100, pointerId: 1 });

      // Mostly sideways, so the gesture locks to the horizontal axis.
      await fireEvent.pointerMove(toastElement, { clientX: 95, clientY: 98, pointerId: 1 });

      // Left is not a dismissible direction, so nothing gets armed.
      await fireEvent.pointerMove(toastElement, { clientX: 90, clientY: 98, pointerId: 1 });
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');

      // Back at the origin the horizontal delta is exactly zero.
      await fireEvent.pointerMove(toastElement, { clientX: 100, clientY: 98, pointerId: 1 });
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');

      // Dragging far downwards and slightly right: without the axis lock the
      // larger vertical delta would arm `down` instead.
      await fireEvent.pointerMove(toastElement, { clientX: 110, clientY: 220, pointerId: 1 });
      expect(toastElement).toHaveAttribute('data-swipe-direction', 'right');

      await fireEvent.pointerMove(toastElement, { clientX: 160, clientY: 220, pointerId: 1 });
      await fireEvent.pointerUp(toastElement, { clientX: 160, clientY: 220, pointerId: 1 });

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('locks the gesture to the vertical axis when it starts upright', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection={['down', 'right']} />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      await fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
      });
      await fireEvent.pointerMove(toastElement, { clientX: 100, clientY: 100, pointerId: 1 });

      // Mostly upright, so the gesture locks to the vertical axis.
      await fireEvent.pointerMove(toastElement, { clientX: 98, clientY: 95, pointerId: 1 });

      await fireEvent.pointerMove(toastElement, { clientX: 98, clientY: 90, pointerId: 1 });
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');

      await fireEvent.pointerMove(toastElement, { clientX: 98, clientY: 100, pointerId: 1 });
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');

      // Dragging far to the right and slightly down: without the axis lock the
      // larger horizontal delta would arm `right` instead.
      await fireEvent.pointerMove(toastElement, { clientX: 220, clientY: 110, pointerId: 1 });
      expect(toastElement).toHaveAttribute('data-swipe-direction', 'down');

      await fireEvent.pointerMove(toastElement, { clientX: 220, clientY: 160, pointerId: 1 });
      await fireEvent.pointerUp(toastElement, { clientX: 220, clientY: 160, pointerId: 1 });

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('does not start a swipe from a non-primary pointer button', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="right" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      await fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 2,
        pointerId: 1,
      });

      expect(toastElement).not.toHaveAttribute('data-swiping');

      await fireEvent.pointerMove(toastElement, { clientX: 200, clientY: 100, pointerId: 1 });
      await fireEvent.pointerUp(toastElement, { clientX: 200, clientY: 100, pointerId: 1 });

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    it('applies [data-swiping] attribute when swiping', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      await fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
      });

      expect(toastElement.getAttribute('data-swiping')).toBe('');
    });

    it('dismisses toast when swiped down with downward swipe direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="down" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');
      await simulateSwipe(toastElement, 100, 100, 100, 150);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('dismisses toast when swiped left with leftward swipe direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="left" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');
      await simulateSwipe(toastElement, 100, 100, 50, 100);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('dismisses toast when swiped right with rightward swipe direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="right" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');
      await simulateSwipe(toastElement, 100, 100, 150, 100);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('allows swiping in multiple directions when specified', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection={['up', 'right']} />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // First test upward swipe
      await simulateSwipe(toastElement, 100, 100, 100, 50);

      expect(screen.queryByTestId('toast-root')).toBe(null);

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));
      const secondToastElement = screen.getByTestId('toast-root');

      await simulateSwipe(secondToastElement, 100, 100, 150, 100);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('does not dismiss when swiped in non-specified direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Swipe right (not allowed)
      await simulateSwipe(toastElement, 100, 100, 150, 100);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);

      // Swipe down (not allowed)
      await simulateSwipe(toastElement, 100, 100, 100, 150);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    it('does not dismiss when swipe distance is below threshold', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Small upward swipe (below threshold)
      await simulateSwipe(toastElement, 100, 100, 100, 95);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    it('prevents native touchmove only during an active touch swipe', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast} data-testid="toast-root" swipeDirection="up">
              <Toast.Title />
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const toastElement = screen.getByTestId('toast-root');
      Object.defineProperty(toastElement, 'setPointerCapture', {
        value: () => {},
        configurable: true,
      });

      const beforeSwipeEvent = new Event('touchmove', { bubbles: true, cancelable: true });
      toastElement.dispatchEvent(beforeSwipeEvent);
      expect(beforeSwipeEvent.defaultPrevented).toBe(false);

      await fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
        pointerType: 'touch',
      });

      const duringSwipeEvent = new Event('touchmove', { bubbles: true, cancelable: true });
      toastElement.dispatchEvent(duringSwipeEvent);
      expect(duringSwipeEvent.defaultPrevented).toBe(true);

      await fireEvent.pointerCancel(toastElement, { pointerId: 1, pointerType: 'touch' });

      const afterSwipeEvent = new Event('touchmove', { bubbles: true, cancelable: true });
      toastElement.dispatchEvent(afterSwipeEvent);
      expect(afterSwipeEvent.defaultPrevented).toBe(false);
    });

    it('does not start swiping from elements with the data-vase-ui-swipe-ignore attribute', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast} data-testid="toast-root" swipeDirection="up">
              <div data-vase-ui-swipe-ignore data-testid="ignore-target">
                Ignore swipe
              </div>
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const toastElement = screen.getByTestId('toast-root');
      const ignoreTarget = screen.getByTestId('ignore-target');

      await fireEvent.pointerDown(ignoreTarget, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
      });

      expect(toastElement).not.toHaveAttribute('data-swiping');
    });

    it('does not start swiping from elements with the legacy data-swipe-ignore attribute', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast} data-testid="toast-root" swipeDirection="up">
              <div data-swipe-ignore data-testid="ignore-target">
                Ignore swipe
              </div>
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const toastElement = screen.getByTestId('toast-root');
      const ignoreTarget = screen.getByTestId('ignore-target');

      await fireEvent.pointerDown(ignoreTarget, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
      });

      expect(toastElement).not.toHaveAttribute('data-swiping');
    });

    it('ignores swipe gestures when toast is anchored', async () => {
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      try {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <SwipeTestToast swipeDirection="up" />
            </Toast.Viewport>
            <SwipeTestButton
              toastOptions={{
                positionerProps: {
                  anchor,
                },
              }}
            />
          </Toast.Provider>,
        );

        await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

        const toastElement = screen.getByTestId('toast-root');

        await simulateSwipe(toastElement, 100, 100, 100, 55);

        expect(screen.queryByTestId('toast-root')).not.toBe(null);
      } finally {
        document.body.removeChild(anchor);
      }
    });

    it('VUE-50: swipes the toast when setPointerCapture throws for a pointer that is not active', async () => {
      const { manager } = await renderToasts();
      manager.add({ id: 'toast', title: 'Toast', timeout: 0 });
      await flushMicrotasks();
      const root = screen.getByTestId('toast');
      Object.defineProperty(root, 'setPointerCapture', {
        value() {
          throw new DOMException('Invalid pointer id', 'NotFoundError');
        },
        configurable: true,
      });

      await simulateSwipe(root, 100, 100, 100, 200);

      expect(screen.queryByTestId('toast')).toBe(null);
    });
  });

  describe('drag behavior regression', () => {
    const DragList = defineComponent({
      setup() {
        const { toasts } = Toast.useToastManager();
        return () =>
          toasts.value.map((toastItem) => (
            <Toast.Root key={toastItem.id} toast={toastItem} data-testid="toast-root">
              <Toast.Content data-testid="toast-content">
                <Toast.Title />
                <Toast.Description />
              </Toast.Content>
            </Toast.Root>
          ));
      },
    });

    const DragButton = defineComponent({
      setup() {
        const { add } = Toast.useToastManager();
        return () => (
          <button
            type="button"
            onClick={() => {
              add({ title: 'T', description: 'D' });
            }}
          >
            add toast
          </button>
        );
      },
    });

    it.each(['element', 'toast'] as const)(
      'VUE-184: cancels the swipe when its %s changes',
      async (replacement) => {
        const manager = Toast.createToastManager();
        const tag = shallowRef('div');
        const id = shallowRef('first');
        const onClose = vi.fn();
        const App = defineComponent({
          setup: () => () => (
            <Toast.Root as={tag.value} toast={{ id: id.value }} data-testid="root" />
          ),
        });
        await render(
          <Toast.Provider toastManager={manager}>
            <App />
          </Toast.Provider>,
        );
        manager.add({ id: 'first', timeout: 0, onClose });
        manager.add({ id: 'second', timeout: 0, onClose });
        const original = screen.getByTestId('root');
        const pointer = { pointerId: 1, pointerType: 'mouse', clientY: 20 };
        await fireEvent.pointerDown(original, { ...pointer, clientX: 0, button: 0 });
        await fireEvent.pointerMove(original, { ...pointer, clientX: 1 });
        await fireEvent.pointerMove(original, { ...pointer, clientX: 60 });
        expect(original).toHaveAttribute('data-swiping');
        if (replacement === 'element') tag.value = 'section';
        else id.value = 'second';
        await nextTick();

        const current = screen.getByTestId('root');
        expect(current).not.toHaveAttribute('data-swiping');
        expect(current.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
        await fireEvent.pointerUp(document, pointer);
        expect(onClose).not.toHaveBeenCalled();
        await simulateSwipe(current, 0, 20, 60, 20, document);
        expect(onClose).toHaveBeenCalledOnce();
      },
    );

    it('resets drag state after releasing a far swipe even when the release lands on the document', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <DragList />
          </Toast.Viewport>
          <DragButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Default swipeDirection=['down','right']. Dragging left triggers the damped, opposite-
      // direction path. Release on the document to cover browsers that don't deliver the final
      // pointer event back to the toast root.
      await simulateSwipe(toastElement, 300, 100, -5000, 100, document);

      expect(toastElement).not.toHaveAttribute('data-swiping');
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
      expect(toastElement.style.transition).toBe('');
      expect(toastElement.style.transform).toBe('');

      await simulateSwipe(toastElement, 100, 100, 150, 100);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('resets drag state after a document pointercancel', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <DragList />
          </Toast.Viewport>
          <DragButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      await fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true,
        pointerId: 1,
      });
      await fireEvent.pointerMove(toastElement, {
        clientX: 101,
        clientY: 100,
        bubbles: true,
        pointerId: 1,
      });
      await fireEvent.pointerMove(toastElement, {
        clientX: 200,
        clientY: 100,
        bubbles: true,
        pointerId: 1,
      });

      expect(toastElement).toHaveAttribute('data-swiping');
      expect(toastElement).toHaveAttribute('data-swipe-direction', 'right');

      await fireEvent.pointerCancel(document, {
        clientX: 200,
        clientY: 100,
        bubbles: true,
        pointerId: 1,
      });

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
      expect(toastElement).not.toHaveAttribute('data-swiping');
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
      expect(toastElement.style.transition).toBe('');
      expect(toastElement.style.transform).toBe('');
    });
  });

  describe('object identity', () => {
    // Regression test for https://github.com/mui/base-ui/issues/3922
    // Toast calculations should use ID-based lookups, not referential equality
    it('works correctly when toast objects are recreated (not referentially equal)', async () => {
      // This component wraps useToastManager and creates NEW toast objects
      // by spreading them. This is a common pattern when users want to
      // add type-safety to the data field or transform toast properties.
      const ToastListWithNewObjects = defineComponent({
        setup() {
          const { toasts } = Toast.useToastManager();

          return () => {
            // Create new objects - this breaks referential equality
            const transformedToasts = toasts.value.map((t) => ({
              ...t,
              // Users might transform data for type-safety, like:
              // data: parseToastData(t.data)
            }));

            return transformedToasts.map((toastItem) => (
              <Toast.Root key={toastItem.id} toast={toastItem} data-testid="toast-root">
                <Toast.Title />
                <Toast.Description />
                <Toast.Close data-testid="toast-close">Close</Toast.Close>
              </Toast.Root>
            ));
          };
        },
      });

      const AddButton = defineComponent({
        setup() {
          const { add } = Toast.useToastManager();
          return () => (
            <button
              type="button"
              onClick={() => {
                add({
                  id: 'test-toast',
                  title: 'Test Title',
                  description: 'Test Description',
                });
              }}
            >
              add toast
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <ToastListWithNewObjects />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = await screen.findByTestId('toast-root');

      // Verify the toast index is correctly calculated (should be 0, not -1)
      // The --toast-index CSS variable is set based on the domIndex calculation
      await waitFor(() => {
        const toastIndex = toastElement.style.getPropertyValue('--toast-index');
        expect(toastIndex).toBe('0');
      });

      // Verify the close button works (which also relies on ID-based lookup)
      await fireEvent.click(screen.getByTestId('toast-close'));

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('correctly calculates indices for multiple toasts with recreated objects', async () => {
      const ToastListWithNewObjects = defineComponent({
        setup() {
          const { toasts } = Toast.useToastManager();

          return () => {
            // Create new objects - this breaks referential equality
            const transformedToasts = toasts.value.map((t) => ({ ...t }));

            return transformedToasts.map((toastItem) => (
              <Toast.Root
                key={toastItem.id}
                toast={toastItem}
                data-testid={`toast-${toastItem.id}`}
              >
                <Toast.Title />
              </Toast.Root>
            ));
          };
        },
      });

      const AddButton = defineComponent({
        setup() {
          const { add } = Toast.useToastManager();
          return () => (
            <button
              type="button"
              onClick={() => {
                add({ title: 'Toast 1' });
                add({ title: 'Toast 2' });
                add({ title: 'Toast 3' });
              }}
            >
              add toasts
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <ToastListWithNewObjects />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add toasts' }));

      // Wait for all toasts to appear
      const toasts = await screen.findAllByTestId(/^toast-/);
      expect(toasts).toHaveLength(3);

      // Verify each toast has a valid (non-negative) index
      await waitFor(() => {
        const toastIndexes = toasts.map((toastEl) =>
          parseInt(toastEl.style.getPropertyValue('--toast-index'), 10),
        );
        expect(toastIndexes.every((toastIndex) => toastIndex >= 0)).toBe(true);
      });
    });
  });

  describe('KeepAlive', () => {
    const TOAST_STYLE = `
      [data-testid="toast"] { transition: opacity 1s; }
      [data-testid="toast"][data-starting-style] { opacity: 0; }
    `;

    // The provider is outside `KeepAlive`, so it keeps the subscription to its manager while the
    // viewport is held.
    function renderKeptViewport(
      options: { withContent?: boolean; onTransitionrun?: (event: Event) => void } = {},
    ) {
      const manager = Toast.createToastManager();
      const visible = shallowRef(true);
      const ToastList = defineComponent({
        setup() {
          const { toasts } = Toast.useToastManager();
          return () =>
            toasts.value.map((toastItem) => (
              <Toast.Root
                key={toastItem.id}
                toast={toastItem}
                data-testid="toast"
                onTransitionrun={options.onTransitionrun}
              >
                {options.withContent ? (
                  <Toast.Content>
                    <div style={{ height: '40px' }} />
                  </Toast.Content>
                ) : (
                  <div style={{ height: '40px' }} />
                )}
              </Toast.Root>
            ));
        },
      });
      const Page = defineComponent({
        name: 'Page',
        setup: () => () => (
          <Toast.Viewport>
            <ToastList />
          </Toast.Viewport>
        ),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });
      const rendered = render(() => (
        <Toast.Provider toastManager={manager}>
          <style>{TOAST_STYLE}</style>
          <KeepAlive>{visible.value ? <Page key="page" /> : <Other key="other" />}</KeepAlive>
        </Toast.Provider>
      ));
      return { manager, visible, rendered };
    }

    it.each([
      { name: 'the root alone', withContent: false },
      { name: 'a root with Toast.Content', withContent: true },
    ])(
      'measures a toast that mounts while KeepAlive holds it, at the show: $name',
      async ({ withContent }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        const counter = createTransitionRunCounter(() => true);
        const { manager, visible, rendered } = renderKeptViewport({
          withContent,
          onTransitionrun: counter.onTransitionrun,
        });
        const { container } = await rendered;
        // A part that mounts in the flush of the deactivation gets `onDeactivated`.
        visible.value = false;
        await flushMicrotasks();
        manager.add({ title: 'kept', timeout: 0 });
        await flushMicrotasks();

        await nextEvent(container, 'transitionrun', {
          action: () => {
            visible.value = true;
          },
        });

        expect(counter.counts).toEqual({ enter: 1, exit: 0 });
        expect(screen.getByTestId('toast').style.getPropertyValue('--toast-height')).toBe('40px');
      },
    );

    // The observers of `Toast.Content` correct the height at the show. With them, only the enter
    // transition shows a measure in the flush of the deactivation.
    it.each([
      { name: 'the root alone', withContent: false },
      { name: 'a root with Toast.Content', withContent: true },
    ])(
      'measures a toast that mounts in the flush of the deactivation, at the show: $name',
      async ({ withContent }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        const counter = createTransitionRunCounter(() => true);
        const { manager, visible, rendered } = renderKeptViewport({
          withContent,
          onTransitionrun: counter.onTransitionrun,
        });
        const { container } = await rendered;
        manager.add({ title: 'kept', timeout: 0 });
        visible.value = false;
        await flushMicrotasks();

        await nextEvent(container, 'transitionrun', {
          action: () => {
            visible.value = true;
          },
        });

        expect(counter.counts).toEqual({ enter: 1, exit: 0 });
        expect(screen.getByTestId('toast').style.getPropertyValue('--toast-height')).toBe('40px');
      },
    );

    it('measures a toast that mounts in the render of the activation', async () => {
      const manager = Toast.createToastManager();
      const visible = shallowRef(true);
      const count = shallowRef(0);
      // The page renders the toasts itself. A new prop then renders them in the patch of the
      // activation.
      const Page = defineComponent({
        name: 'Page',
        props: { count: { type: Number, required: true } },
        setup(props) {
          const { toasts } = Toast.useToastManager();
          return () => (
            <Toast.Viewport data-count={props.count}>
              {toasts.value.map((toastItem) => (
                <Toast.Root key={toastItem.id} toast={toastItem} data-testid="toast">
                  <div style={{ height: '40px' }} />
                </Toast.Root>
              ))}
            </Toast.Viewport>
          );
        },
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });
      await render(() => (
        <Toast.Provider toastManager={manager}>
          <KeepAlive>
            {visible.value ? <Page key="page" count={count.value} /> : <Other key="other" />}
          </KeepAlive>
        </Toast.Provider>
      ));
      visible.value = false;
      await flushMicrotasks();

      manager.add({ title: 'kept', timeout: 0 });
      count.value += 1;
      visible.value = true;
      await flushMicrotasks();

      const root = screen.getByTestId('toast');
      await waitFor(() => {
        expect(root.style.getPropertyValue('--toast-height')).toBe('40px');
      });
      expect(root).not.toHaveAttribute('data-starting-style');
    });

    it('ends a swipe with no dismissal when KeepAlive deactivates the toast', async () => {
      const { manager, visible, rendered } = renderKeptViewport();
      await rendered;
      manager.add({ title: 'kept', timeout: 0 });
      await flushMicrotasks();
      const root = screen.getByTestId('toast');
      await fireEvent.pointerDown(root, {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true,
        pointerId: 1,
      });
      await fireEvent.pointerMove(root, {
        clientX: 101,
        clientY: 100,
        bubbles: true,
        pointerId: 1,
      });
      await fireEvent.pointerMove(root, {
        clientX: 200,
        clientY: 100,
        bubbles: true,
        pointerId: 1,
      });
      expect(root).toHaveAttribute('data-swiping');
      expect(root).toHaveAttribute('data-swipe-direction', 'right');

      visible.value = false;
      await flushMicrotasks();
      await fireEvent.pointerUp(document, {
        clientX: 200,
        clientY: 100,
        bubbles: true,
        pointerId: 1,
      });
      visible.value = true;
      await flushMicrotasks();

      expect(screen.getByTestId('toast')).toBe(root);
      expect(root).not.toHaveAttribute('data-ending-style');
      expect(root).not.toHaveAttribute('data-swiping');
      expect(root).not.toHaveAttribute('data-swipe-direction');
      expect(root.style.transform).toBe('');
    });
  });
});
