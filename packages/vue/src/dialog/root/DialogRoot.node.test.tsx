import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as Dialog from '../index.parts';
import { useDialogRootContext } from './DialogRootContext';

describe('<Dialog.Root /> on a server', () => {
  it('renders its default slot with no payload and attaches no store to its handle', async () => {
    const handle = Dialog.createHandle<number>();

    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Dialog.Root handle={handle} defaultOpen>
            {{
              default: ({ payload }: { payload: number | undefined }) => <p>{String(payload)}</p>,
            }}
          </Dialog.Root>
        ),
      }),
    );

    expect(html).toContain('<p>undefined</p>');
    expect(handle.isOpen).toBe(false);
    expect(handle.store).toBe(handle.serverStore);
  });

  it('gives the open state and the nested state to the parts, and counts no nested dialog', async () => {
    const Probe = defineComponent({
      props: { name: { type: String, required: true } },
      setup(props) {
        const store = useDialogRootContext();
        return () => (
          <p>
            {props.name} open:{String(store.select('open'))} nested:{String(store.select('nested'))}{' '}
            count:{store.select('nestedOpenDialogCount')}
          </p>
        );
      },
    });

    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Dialog.Root defaultOpen>
            <Probe name="parent" />
            <Dialog.Root defaultOpen>
              <Probe name="child" />
            </Dialog.Root>
          </Dialog.Root>
        ),
      }),
    );

    expect(html).toContain('parent open:true nested:false count:0');
    expect(html).toContain('child open:true nested:true count:0');
  });
});
