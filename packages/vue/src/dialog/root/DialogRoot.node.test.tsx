import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as Dialog from '../index.parts';
import { useDialogRootContext } from './DialogRootContext';

function renderApp(render: () => unknown) {
  return renderToString(createSSRApp({ render }));
}

function getButtonTag(html: string, id: string) {
  return new RegExp(`<button [^>]*id="${id}"[^>]*>`).exec(html)?.[0];
}

describe('<Dialog.Root /> on a server', () => {
  it('renders its default slot with no payload and attaches no store to its handle', async () => {
    const handle = Dialog.createHandle<number>();

    const html = await renderApp(() => (
      <Dialog.Root handle={handle} defaultOpen>
        {{
          default: ({ payload }: { payload: number | undefined }) => <p>{String(payload)}</p>,
        }}
      </Dialog.Root>
    ));

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

    const html = await renderApp(() => (
      <Dialog.Root defaultOpen>
        <Probe name="parent" />
        <Dialog.Root defaultOpen>
          <Probe name="child" />
        </Dialog.Root>
      </Dialog.Root>
    ));

    expect(html).toContain('parent open:true nested:false count:0');
    expect(html).toContain('child open:true nested:true count:0');
  });

  it.each([
    { name: 'a closed dialog', root: {}, two: false },
    { name: 'an open dialog with no trigger id', root: { defaultOpen: true }, two: false },
    {
      name: 'an open dialog with a trigger id',
      root: { defaultOpen: true, defaultTriggerId: 'two' },
      two: true,
    },
  ])('writes the open state of the triggers of $name', async ({ root, two }) => {
    const html = await renderApp(() => (
      <Dialog.Root {...root}>
        <Dialog.Trigger id="one">One</Dialog.Trigger>
        <Dialog.Trigger id="two">Two</Dialog.Trigger>
      </Dialog.Root>
    ));

    const one = getButtonTag(html, 'one');
    expect(one).toContain('aria-haspopup="dialog" aria-expanded="false"');
    expect(one).not.toContain('data-popup-open');
    expect(one).not.toContain('aria-controls');
    const twoTag = getButtonTag(html, 'two');
    expect(twoTag).toContain(`aria-expanded="${two}"`);
    expect(twoTag?.includes('data-popup-open')).toBe(two);
    expect(twoTag?.includes('aria-controls="')).toBe(two);
  });

  it('writes the closed form of a trigger with a handle', async () => {
    const handle = Dialog.createHandle();

    const html = await renderApp(() => (
      <>
        <Dialog.Trigger handle={handle} id="one">
          One
        </Dialog.Trigger>
        <Dialog.Root handle={handle} defaultOpen defaultTriggerId="one" />
      </>
    ));

    const one = getButtonTag(html, 'one');
    expect(one).toContain('aria-expanded="false"');
    expect(one).not.toContain('data-popup-open');
  });
});
