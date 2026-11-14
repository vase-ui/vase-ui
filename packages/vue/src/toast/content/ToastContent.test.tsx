import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';
import * as Toast from '../index.parts';
import ToastLabelContent from '../utils/ToastLabelContent.vue';

const toast = {
  id: 'test',
  title: 'Toast title',
};

// The real pointer of the browser can rest on the viewport. A dispatched event still reaches the
// viewport, and the real pointer sends no event of its own.
const noRealPointer = { pointerEvents: 'none' } as const;

describe('<Toast.Content />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Content />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast}>{node}</Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );
    },
  }));

  const ContentList = defineComponent({
    setup() {
      const { toasts } = Toast.useToastManager();
      return () =>
        toasts.value.map((toastItem) => (
          <Toast.Root key={toastItem.id} toast={toastItem} data-testid={toastItem.id}>
            <Toast.Content data-testid={`content-${toastItem.id}`}>
              <ToastLabelContent label={toastItem.title} />
            </Toast.Content>
          </Toast.Root>
        ));
    },
  });

  async function renderContents() {
    const manager = Toast.createToastManager();
    await render(
      <Toast.Provider toastManager={manager}>
        <Toast.Viewport data-testid="viewport" style={noRealPointer}>
          <ContentList />
        </Toast.Viewport>
      </Toast.Provider>,
    );
    return manager;
  }

  it('sets data-behind on the content of each toast except the frontmost', async () => {
    const manager = await renderContents();

    manager.add({ id: 'first', title: 'First', timeout: 0 });
    manager.add({ id: 'second', title: 'Second', timeout: 0 });
    await flushMicrotasks();

    // The newest toast is at the front; the older one sits behind it.
    expect(screen.getByTestId('content-second')).not.toHaveAttribute('data-behind');
    expect(screen.getByTestId('content-first')).toHaveAttribute('data-behind');
  });

  it('sets data-expanded on the content while the viewport is hovered', async () => {
    const manager = await renderContents();
    manager.add({ id: 'toast', title: 'Toast', timeout: 0 });
    await flushMicrotasks();
    const content = screen.getByTestId('content-toast');

    expect(content).not.toHaveAttribute('data-expanded');

    await fireEvent.mouseEnter(screen.getByTestId('viewport'));

    expect(content).toHaveAttribute('data-expanded');
  });

  it('measures its toast again when its content changes size', async () => {
    const height = shallowRef(10);
    const manager = await renderContents();

    manager.add({
      id: 'toast',
      title: () => h('div', { style: { height: `${height.value}px` } }),
      timeout: 0,
    });
    await flushMicrotasks();
    const root = screen.getByTestId('toast');

    expect(root.style.getPropertyValue('--toast-height')).toBe('10px');

    height.value = 40;

    await waitFor(() => {
      expect(root.style.getPropertyValue('--toast-height')).toBe('40px');
    });
  });

  it('stops its observers while KeepAlive holds it, and observes again on activation', async () => {
    const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
    const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
    onTestFinished(() => {
      observe.mockRestore();
      disconnect.mockRestore();
    });
    const visible = shallowRef(true);
    // `KeepAlive` holds only the content, so the provider, the viewport and the root stay active.
    await render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <KeepAlive>{visible.value ? <Toast.Content /> : null}</KeepAlive>
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    const observeAfterMount = observe.mock.calls.length;
    const disconnectAfterMount = disconnect.mock.calls.length;

    visible.value = false;
    await nextTick();

    expect(disconnect).toHaveBeenCalledTimes(disconnectAfterMount + 1);
    expect(observe).toHaveBeenCalledTimes(observeAfterMount);

    visible.value = true;
    await nextTick();

    expect(observe).toHaveBeenCalledTimes(observeAfterMount + 1);
    expect(disconnect).toHaveBeenCalledTimes(disconnectAfterMount + 1);
  });
});
