import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ToastTextList from '../../../test/fixtures/ToastTextList.vue';
import type { ToastManager } from '../createToastManager';
import * as Toast from '../index.parts';

describe('<Toast.Provider /> on a server', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // A request adds its toast in `setup`, through the manager of a module or through the composable.
  function createRequest(title: string, manager?: ToastManager) {
    const AddInSetup = defineComponent({
      setup() {
        (manager ?? Toast.useToastManager()).add({ title, timeout: 100 });
        return () => null;
      },
    });

    return createSSRApp({
      render: () => (
        <Toast.Provider toastManager={manager}>
          <AddInSetup />
          <Toast.Viewport>
            <ToastTextList />
          </Toast.Viewport>
        </Toast.Provider>
      ),
    });
  }

  it('renders no element of its own', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Toast.Provider>
            <p>content</p>
          </Toast.Provider>
        ),
      }),
    );

    expect(html).toBe('<!--[--><p>content</p><!--]-->');
  });

  it('does not subscribe to a manager that each request shares, so no request gets the toast of another', async () => {
    const manager = Toast.createToastManager();
    const subscribe = vi.spyOn(manager, ' subscribe');

    const [first, second] = await Promise.all([
      renderToString(createRequest('first request', manager)),
      renderToString(createRequest('second request', manager)),
    ]);

    expect(first).not.toContain('first request');
    expect(first).toBe(second);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('renders a toast that setup adds in the HTML of its own request only, and starts no timer', async () => {
    vi.useFakeTimers();

    const [first, second] = await Promise.all([
      renderToString(createRequest('first request')),
      renderToString(createRequest('second request')),
    ]);

    expect(first).toContain('first request');
    expect(first).toContain('data-starting-style');
    expect(first).not.toContain('second request');
    expect(second).toContain('second request');
    expect(second).not.toContain('first request');
    expect(vi.getTimerCount()).toBe(0);
  });
});
