import { describe, expect, it } from 'vitest';
import { computed, createSSRApp, defineComponent, provide } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { DialogPortalContext } from '../../dialog/portal/DialogPortalContext';
import * as Drawer from '../index.parts';

// `Drawer.Portal` renders its children only after the mount. This part gives the children the
// context of the portal, so the server renders the viewport and the popup.
const ServerPortal = defineComponent({
  setup(_props, { slots }) {
    provide(
      DialogPortalContext,
      computed(() => false),
    );
    return () => slots.default?.();
  },
});

describe('<Drawer.Viewport /> on a server', () => {
  it('renders the viewport and the popup of an open drawer, and reads no document', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => (
          <Drawer.Root defaultOpen snapPoints={['100px', 1]}>
            <ServerPortal>
              <Drawer.Viewport data-testid="viewport">
                <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
              </Drawer.Viewport>
            </ServerPortal>
          </Drawer.Root>
        ),
      }),
    );

    expect(html).toContain('data-testid="viewport"');
    expect(html).toMatch(/<div[^>]*role="dialog"[^>]*data-testid="popup"/);
    expect(html).toContain('--drawer-snap-point-offset:0px;');
  });
});
