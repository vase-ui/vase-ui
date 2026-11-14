import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ToastTextList from '../../../test/fixtures/ToastTextList.vue';
import { Toast } from '@vase-ui/vue/toast';

describe('<Toast.Viewport /> on a server', () => {
  it('renders the region of the viewport, and no focus guard and no alert region', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Toast.Provider>
            <Toast.Viewport />
          </Toast.Provider>
        ),
      }),
    );

    expect(html).toContain(
      '<div tabindex="-1" role="region" aria-live="polite" aria-atomic="false" aria-relevant="additions text" aria-label="Notifications">',
    );
    expect(html).not.toContain('data-vase-ui-focus-guard');
    expect(html).not.toContain('role="alert"');
  });

  // Script makes the alert region after the mount, so a server renders only the toast.
  it('renders no alert region on a server', async () => {
    const AddInSetup = defineComponent({
      setup() {
        Toast.useToastManager().add({ title: 'Saved', priority: 'high', timeout: 0 });
        return () => null;
      },
    });

    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Toast.Provider>
            <AddInSetup />
            <Toast.Viewport>
              <ToastTextList />
            </Toast.Viewport>
          </Toast.Provider>
        ),
      }),
    );

    expect(html).toContain('Saved');
    expect(html).not.toContain('role="alert"');
  });

  it('renders the component of a function label only in the toast on a server', async () => {
    const Label = defineComponent({ setup: () => () => <em data-toast-label>Saved</em> });
    const AddInSetup = defineComponent({
      setup() {
        Toast.useToastManager().add({ title: () => h(Label), priority: 'high', timeout: 0 });
        return () => null;
      },
    });

    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Toast.Provider>
            <AddInSetup />
            <Toast.Viewport>
              <ToastTextList />
            </Toast.Viewport>
          </Toast.Provider>
        ),
      }),
    );

    expect(html.match(/data-toast-label/g)).toHaveLength(1);
  });
});
