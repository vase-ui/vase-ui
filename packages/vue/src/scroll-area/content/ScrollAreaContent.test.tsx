import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createApp, createSSRApp, defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import {
  createRenderer,
  describeConformance,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
  within,
} from '#test-utils';
import ScrollAreaContentHydration from './ScrollAreaContentHydration.test.vue';

function readAttributes(element: HTMLElement) {
  return Object.fromEntries(
    Array.from(element.attributes).map(({ name, value }) => [
      name,
      name === 'style' ? element.style.cssText : value,
    ]),
  );
}

describe('<ScrollArea.Content />', () => {
  const { render } = createRenderer();

  describeConformance(<ScrollArea.Content />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <ScrollArea.Root>
          <ScrollArea.Viewport>{node}</ScrollArea.Viewport>
        </ScrollArea.Root>,
      );
    },
  }));

  it.skipIf(isJSDOM)('recomputes overflow when observed content resizes', async () => {
    const renderArea = (contentHeight: number) => (
      <ScrollArea.Root data-testid="root" style={{ width: '100px', height: '100px' }}>
        <ScrollArea.Viewport style={{ width: '100%', height: '100%' }}>
          <ScrollArea.Content data-testid="content" style={{ height: `${contentHeight}px` }} />
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    );

    const { rerender } = await render(renderArea(50));
    const root = screen.getByTestId('root');
    const viewport = screen.getByTestId('content').parentElement!;

    // The first measurement writes this variable.
    await waitFor(() => {
      expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-end')).toBe('0px');
    });
    // Wait for the first notification of each observer. It comes after the animation frame
    // callbacks of the next frame. If the content changes before it, the observer of the viewport
    // measures again, and the case does not test the observer of the content.
    await waitSingleFrame();
    await waitSingleFrame();
    expect(root).not.toHaveAttribute('data-has-overflow-y');

    await rerender(renderArea(1000));

    await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-y'));
  });

  it('supports a custom content renderer that does not forward its ref', async () => {
    // The attributes go to the root element of the component. It exposes no element.
    const ContentWithoutRef = defineComponent({
      setup(_, { expose }) {
        expose({ element: null });
        return () => <div />;
      },
    });

    await render(
      <ScrollArea.Root>
        <ScrollArea.Viewport>
          <ScrollArea.Content data-testid="content" as={ContentWithoutRef} />
        </ScrollArea.Viewport>
      </ScrollArea.Root>,
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  describe('ResizeObserver', () => {
    it('stops the observer when the content unmounts', async () => {
      const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
      onTestFinished(() => {
        disconnect.mockRestore();
      });

      const visible = shallowRef(true);
      const App = defineComponent(() => () => (
        <ScrollArea.Root>
          <ScrollArea.Viewport>{visible.value ? <ScrollArea.Content /> : null}</ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      await render(<App />);

      expect(disconnect).not.toHaveBeenCalled();

      visible.value = false;
      await nextTick();

      // The observer of the viewport stays.
      expect(disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('KeepAlive', () => {
    it('stops the observer of a deactivated content, and observes again on activation', async () => {
      const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
      const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
      onTestFinished(() => {
        observe.mockRestore();
        disconnect.mockRestore();
      });

      const visible = shallowRef(true);
      // `KeepAlive` is in the viewport and holds only the content, so the viewport stays active.
      const App = defineComponent(() => () => (
        <ScrollArea.Root>
          <ScrollArea.Viewport>
            <KeepAlive>{visible.value ? <ScrollArea.Content /> : null}</KeepAlive>
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      await render(<App />);
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

  describe('hydration', () => {
    it('hydrates the content, then writes its overflow attributes after the measurement', async () => {
      // The `hydrate` helper compares after two ticks. The attributes change after the
      // measurement, so the test hydrates by hand and waits for them.
      const serverHtml = await renderOnServer(
        'src/scroll-area/content/ScrollAreaContentHydration.test.vue',
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const content = within(container).getByTestId('content');
      expect(content).toHaveAttribute('role', 'presentation');
      expect(content.style.minWidth).toBe('fit-content');
      expect(content).not.toHaveAttribute('data-has-overflow-y');

      const hydratingApp = createSSRApp(ScrollAreaContentHydration);
      onTestFinished(() => {
        hydratingApp.unmount();
        container.remove();
      });
      hydratingApp.mount(container);

      await waitFor(() => expect(content).toHaveAttribute('data-has-overflow-y'));
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(within(container).getByTestId('content')).toBe(content);
      expect(takeReportedMessages()).toEqual([]);

      const clientContainer = document.createElement('div');
      document.body.append(clientContainer);
      const clientApp = createApp(ScrollAreaContentHydration);
      onTestFinished(() => {
        clientApp.unmount();
        clientContainer.remove();
      });
      clientApp.mount(clientContainer);
      const clientContent = within(clientContainer).getByTestId('content');

      await waitFor(() => expect(clientContent).toHaveAttribute('data-has-overflow-y'));

      expect(readAttributes(content)).toEqual(readAttributes(clientContent));
    });
  });

  it('throws a descriptive error when rendered outside <ScrollArea.Viewport>', async () => {
    await expect(
      render(
        <ScrollArea.Root>
          <ScrollArea.Content />
        </ScrollArea.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <ScrollArea.Content> must be inside <ScrollArea.Viewport>. Without a viewport the content cannot start a measurement. Put <ScrollArea.Content> inside <ScrollArea.Viewport>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
