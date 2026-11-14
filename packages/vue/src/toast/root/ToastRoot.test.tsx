import { describe, expect, it } from 'vitest';
import { defineComponent, h, onScopeDispose, shallowRef } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';
import ToastTextList from '../../../test/fixtures/ToastTextList.vue';
import * as Toast from '../index.parts';
import { toastRootStateAttributesMapping } from './ToastRoot.vue';
import { useToastRootContext } from './ToastRootContext';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

// A label part registers its id with the root by source. This stand-in does it as a label part does.
const RegisteredId = defineComponent({
  props: {
    kind: { type: String as PropType<'title' | 'description'>, required: true },
    id: { type: String, required: true },
  },
  setup(props) {
    const { registerTitleId, registerDescriptionId } = useToastRootContext();
    const register = props.kind === 'title' ? registerTitleId : registerDescriptionId;
    const source = Symbol();
    register(source, () => props.id);
    onScopeDispose(() => register(source, undefined));
    return () => <span id={props.id} />;
  },
});

async function simulateSwipe(
  element: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
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

  await fireEvent.pointerUp(element, {
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

    manager.close('toast');

    await waitFor(() => {
      expect(screen.queryByTestId('toast')).toBe(null);
    });
  });

  it('names the toast with the id of the last label that registered, and drops the name with the label', async () => {
    const showSecondTitle = shallowRef(true);
    const showDescription = shallowRef(true);
    await render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast} data-testid="root">
            <RegisteredId kind="title" id="first-title" />
            {showSecondTitle.value ? <RegisteredId kind="title" id="second-title" /> : null}
            {showDescription.value ? <RegisteredId kind="description" id="description" /> : null}
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    const root = screen.getByTestId('root');

    expect(root).toHaveAttribute('aria-labelledby', 'second-title');
    expect(root).toHaveAttribute('aria-describedby', 'description');

    showSecondTitle.value = false;
    showDescription.value = false;
    await flushMicrotasks();

    expect(root).toHaveAttribute('aria-labelledby', 'first-title');
    expect(root).not.toHaveAttribute('aria-describedby');
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

  it('closes the toast on Escape while the focus is inside it', async () => {
    const { manager } = await renderToasts();
    manager.add({ id: 'toast', title: 'Toast', timeout: 0 });
    await flushMicrotasks();
    const root = screen.getByTestId('toast');

    await fireEvent.keyDown(root, { key: 'Escape' });

    expect(root).not.toHaveAttribute('data-ending-style');

    root.focus();
    await fireEvent.keyDown(root, { key: 'Escape' });

    expect(root).toHaveAttribute('data-ending-style');
  });

  describe('swipe behavior', () => {
    it('closes the toast when it is swiped beyond the threshold, and keeps it for a shorter swipe', async () => {
      const { manager } = await renderToasts();
      manager.add({ id: 'toast', title: 'Toast', timeout: 0 });
      await flushMicrotasks();
      const root = screen.getByTestId('toast');

      await simulateSwipe(root, 100, 100, 100, 130);

      expect(root).not.toHaveAttribute('data-ending-style');
      expect(root).not.toHaveAttribute('data-swiping');

      await simulateSwipe(root, 100, 100, 100, 160);

      expect(root).toHaveAttribute('data-ending-style');
      expect(root).toHaveAttribute('data-swipe-direction', 'down');
    });

    it('prevents the native touchmove only during a touch swipe', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast} data-testid="toast-root" swipeDirection="up">
              {toast.title}
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );
      const root = screen.getByTestId('toast-root');

      function dispatchTouchmove() {
        const event = new Event('touchmove', { bubbles: true, cancelable: true });
        root.dispatchEvent(event);
        return event.defaultPrevented;
      }

      expect(dispatchTouchmove()).toBe(false);

      await fireEvent.pointerDown(root, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
        pointerType: 'touch',
      });

      expect(dispatchTouchmove()).toBe(true);

      await fireEvent.pointerCancel(root, { pointerId: 1, pointerType: 'touch' });

      expect(dispatchTouchmove()).toBe(false);
    });

    it('does not start swiping from elements with the data-base-ui-swipe-ignore attribute', async () => {
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

      await waitFor(() => {
        expect(screen.queryByTestId('toast')).toBe(null);
      });
    });
  });
});
