import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Dialog } from '@vase-ui/vue/dialog';
import { useDialogRootContext } from './DialogRootContext';

function renderApp(render: () => unknown) {
  return renderToString(createSSRApp({ render }));
}

function getButtonTag(html: string, id: string) {
  return new RegExp(`<button [^>]*id="${id}"[^>]*>`).exec(html)?.[0];
}

describe('<Dialog.Root /> on a server', () => {
  describe('VUE-128: prop: disabled', () => {
    it.each([
      { name: 'modal', modal: true },
      { name: 'not modal', modal: false },
    ])('renders an open dialog in place: $name', async ({ modal }) => {
      const context: Record<string, unknown> = {};
      const html = await renderToString(
        createSSRApp({
          render: () => (
            <main>
              <button>Before</button>
              <Dialog.Root open modal={modal}>
                <Dialog.Portal disabled to="#target">
                  <Dialog.Backdrop />
                  <Dialog.Popup>
                    <Dialog.Title>Title</Dialog.Title>
                    <Dialog.Description>Description</Dialog.Description>
                    <Dialog.Close>Close</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
              <button>After</button>
            </main>
          ),
        }),
        context,
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('data-vase-ui-portal');
      expect(html.replace(/<!--.*?-->/g, '')).toContain('>Title</h2>');
      expect(html.indexOf('>Before</button>')).toBeLessThan(html.indexOf('data-vase-ui-portal'));
      expect(html.indexOf('data-vase-ui-portal')).toBeLessThan(html.indexOf('>After</button>'));
      expect(html.includes('data-vase-ui-inert')).toBe(modal);
      const popup = /<div [^>]*role="dialog"[^>]*>/.exec(html)?.[0];
      expect(popup).toBeDefined();
      expect(popup).not.toContain('aria-labelledby');
      expect(popup).not.toContain('aria-describedby');
      expect(html).not.toContain('teleport');
      expect(context.teleports).toBeUndefined();
    });

    it('keeps the explicit name and description of the popup in the server HTML', async () => {
      const html = await renderApp(() => (
        <Dialog.Root open>
          <Dialog.Portal disabled>
            <Dialog.Popup aria-labelledby="panel-title" aria-describedby="panel-description">
              <Dialog.Title id="panel-title">Title</Dialog.Title>
              <Dialog.Description id="panel-description">Description</Dialog.Description>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const popup = /<div [^>]*role="dialog"[^>]*>/.exec(html)?.[0];
      expect(popup).toContain('aria-labelledby="panel-title"');
      expect(popup).toContain('aria-describedby="panel-description"');
      expect(html).toContain('id="panel-title"');
      expect(html).toContain('id="panel-description"');
    });

    it.each([
      { name: 'without keepMounted', keepMounted: false },
      { name: 'with keepMounted', keepMounted: true },
    ])('renders a closed dialog in place: $name', async ({ keepMounted }) => {
      const html = await renderApp(() => (
        <Dialog.Root>
          <Dialog.Portal disabled keepMounted={keepMounted}>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(html.includes('data-vase-ui-portal')).toBe(keepMounted);
      const popup = /<div [^>]*role="dialog"[^>]*>/.exec(html)?.[0] ?? null;
      expect(popup !== null).toBe(keepMounted);
      expect(popup !== null && / hidden[ =>]/.test(popup)).toBe(keepMounted);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
    // A portal renders the popup after the mount, so no trigger names it.
    expect(twoTag).not.toContain('aria-controls');
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

  it('ignores openWithPayload() with no root and gives no warning in a production build', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    const handle = Dialog.createHandle<number>();

    handle.openWithPayload(8);

    expect(handle.isOpen).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
