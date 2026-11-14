import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Toast } from '@vase-ui/vue/toast';

describe('<Toast.Positioner /> on a server', () => {
  it('renders the positioner and the arrow of a toast that setup adds, with the index and the default side', async () => {
    const AnchoredList = defineComponent({
      setup() {
        const { add, toasts } = Toast.useToastManager();
        add({ id: 'anchored', title: 'Copied', timeout: 0 });
        return () =>
          toasts.value.map((toast) => (
            <Toast.Positioner key={toast.id} toast={toast}>
              <Toast.Root toast={toast}>
                <Toast.Arrow />
                <Toast.Title />
              </Toast.Root>
            </Toast.Positioner>
          ));
      },
    });

    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Toast.Provider>
            <Toast.Viewport>
              <AnchoredList />
            </Toast.Viewport>
          </Toast.Provider>
        ),
      }),
    );

    expect(html).toMatch(
      /<div data-side="top" data-align="center" role="presentation" style="[^"]*--toast-index:0;[^"]*">/,
    );
    expect(html).toMatch(/<div data-side="top" data-align="center"[^>]* aria-hidden="true">/);
  });
});
