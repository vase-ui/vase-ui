import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp, createSSRApp } from 'vue';
import type { VNode } from 'vue';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import ScrollAreaContentHydration from '../content/ScrollAreaContentHydration.test.vue';

function mockViewportMetrics(viewport: HTMLElement | null) {
  if (!viewport) {
    return;
  }

  const metrics = {
    clientHeight: 100,
    scrollHeight: 1000,
    clientWidth: 100,
    scrollWidth: 1000,
  };

  for (const [key, value] of Object.entries(metrics)) {
    const descriptor = Object.getOwnPropertyDescriptor(viewport, key);
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(viewport, key, { value, configurable: true });
    }
  }
}

function readAttributes(element: HTMLElement) {
  return Object.fromEntries(
    Array.from(element.attributes).map(({ name, value }) => [
      name,
      name === 'style' ? element.style.cssText : value,
    ]),
  );
}

describe('<ScrollArea.Corner />', () => {
  const { render } = createRenderer();

  // A ref on a part gives its component, which exposes `element`.
  const renderArea = (corner?: VNode) => () => (
    <ScrollArea.Root>
      <ScrollArea.Viewport
        ref={(viewport) =>
          mockViewportMetrics((viewport as { element: HTMLElement | null } | null)?.element ?? null)
        }
        style={{ width: '100px', height: '100px' }}
      >
        <div style={{ width: '1000px', height: '1000px' }} />
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" keepMounted style={{ width: '10px' }}>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="horizontal" keepMounted style={{ height: '10px' }}>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      {corner}
    </ScrollArea.Root>
  );

  describeConformance(<ScrollArea.Corner />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      // The corner has no element until the first measurement shows both scrollbars.
      const result = await render(renderArea(node));
      await flushMicrotasks();
      return result;
    },
  }));

  it('is hidden from the accessibility tree by default', async () => {
    await render(renderArea(<ScrollArea.Corner data-testid="corner" />));
    await flushMicrotasks();

    expect(screen.getByTestId('corner')).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding aria-hidden', async () => {
    await render(renderArea(<ScrollArea.Corner data-testid="corner" aria-hidden={undefined} />));
    await flushMicrotasks();

    expect(screen.getByTestId('corner')).not.toHaveAttribute('aria-hidden');
  });

  describe.skipIf(isJSDOM)('interactions', () => {
    it('should apply correct corner size when both scrollbars are present', async () => {
      await render(
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" style={{ width: '10px' }} />
          <ScrollArea.Scrollbar orientation="horizontal" style={{ height: '10px' }} />
          <ScrollArea.Corner data-testid="corner" />
        </ScrollArea.Root>,
      );
      await flushMicrotasks();

      const corner = screen.getByTestId('corner');

      await waitFor(() => {
        const style = getComputedStyle(corner);
        expect({
          width: style.getPropertyValue('--scroll-area-corner-width'),
          height: style.getPropertyValue('--scroll-area-corner-height'),
        }).toEqual({ width: '10px', height: '10px' });
      });
    });
  });

  describe('hydration', () => {
    it('renders no corner on a server, and mounts it after the measurement', async () => {
      // The `hydrate` helper compares after two ticks. The corner mounts after the measurement, so
      // the test hydrates by hand and waits for it.
      const serverHtml = await renderOnServer(
        'src/scroll-area/content/ScrollAreaContentHydration.test.vue',
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      expect(within(container).queryByTestId('corner')).toBe(null);

      const hydratingApp = createSSRApp(ScrollAreaContentHydration);
      onTestFinished(() => {
        hydratingApp.unmount();
        container.remove();
      });
      hydratingApp.mount(container);

      const corner = await within(container).findByTestId('corner');
      await waitFor(() => expect(corner.style.width).toBe('10px'));
      expect(takeReportedMessages()).toEqual([]);

      const clientContainer = document.createElement('div');
      document.body.append(clientContainer);
      const clientApp = createApp(ScrollAreaContentHydration);
      onTestFinished(() => {
        clientApp.unmount();
        clientContainer.remove();
      });
      clientApp.mount(clientContainer);
      const clientCorner = await within(clientContainer).findByTestId('corner');

      await waitFor(() => expect(clientCorner.style.width).toBe('10px'));

      expect(readAttributes(corner)).toEqual(readAttributes(clientCorner));
    });
  });
});
