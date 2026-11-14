import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import * as AlertDialog from '../index.parts';

describe('<AlertDialog.Root /> on a server', () => {
  it('gives the alert dialog state to the parts and attaches no store to its handle', async () => {
    const handle = AlertDialog.createHandle<number>();
    const Probe = defineComponent({
      setup() {
        const store = useDialogRootContext();
        return () => (
          <p>
            open:{String(store.select('open'))} role:{store.select('role')} modal:
            {String(store.select('modal'))} disablePointerDismissal:
            {String(store.select('disablePointerDismissal'))}
          </p>
        );
      },
    });

    const html = await renderToString(
      createSSRApp({
        render: () => (
          <AlertDialog.Root handle={handle} defaultOpen>
            {{
              default: ({ payload }: { payload: number | undefined }) => [
                <Probe />,
                <span>{String(payload)}</span>,
              ],
            }}
          </AlertDialog.Root>
        ),
      }),
    );

    expect(html).toContain('open:true role:alertdialog modal:true disablePointerDismissal:true');
    expect(html).toContain('<span>undefined</span>');
    expect(handle.isOpen).toBe(false);
    expect(handle.store).toBe(handle.serverStore);
  });
});
