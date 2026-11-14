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

  it('renders the alert region of a high priority toast that setup adds, and none for a low priority toast', async () => {
    const AddInSetup = defineComponent({
      setup() {
        const { add } = Toast.useToastManager();
        add({ title: 'Saved', description: 'The file is saved.', priority: 'high', timeout: 0 });
        add({ title: 'Draft', priority: 'low', timeout: 0 });
        return () => null;
      },
    });

    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Toast.Provider>
            <AddInSetup />
            <Toast.Viewport />
          </Toast.Provider>
        ),
      }),
    );

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain('Saved');
    expect(html).toContain('The file is saved.');
    expect(html).not.toContain('Draft');
  });

  it('renders the component of a function label in the toast and in the alert region', async () => {
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

    expect(html.match(/data-toast-label/g)).toHaveLength(2);
  });
});
