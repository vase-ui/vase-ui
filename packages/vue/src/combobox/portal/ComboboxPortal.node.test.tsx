import { describe, expect, it } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as Combobox from '../index.parts';
import { ComboboxPortalContext } from './ComboboxPortalContext';

describe('<Combobox.Portal /> on a server', () => {
  it('renders no part of the popup of an open root', async () => {
    const html = await renderToString(
      <Combobox.Root defaultOpen modal>
        <Combobox.Input />
        <Combobox.Portal keepMounted>
          <Combobox.Backdrop data-testid="backdrop" />
          <Combobox.Positioner data-testid="positioner">
            <Combobox.Popup data-testid="popup">
              <Combobox.Arrow data-testid="arrow" />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('data-testid');
  });

  it('renders the parts of the popup with no DOM when a provider stands in for the portal', async () => {
    // The portal renders its content after the mount, so only a provider of its context lets the
    // setup of the parts run on a server.
    const PortalContextProvider = defineComponent((_, { slots }) => {
      provide(
        ComboboxPortalContext,
        computed(() => false),
      );
      return () => slots.default?.();
    });

    const html = await renderToString(
      <Combobox.Root defaultOpen modal>
        <Combobox.Input />
        <PortalContextProvider>
          <Combobox.Backdrop data-testid="backdrop" />
          <Combobox.Positioner data-testid="positioner">
            <Combobox.Popup data-testid="popup">
              <Combobox.Arrow data-testid="arrow" />
            </Combobox.Popup>
          </Combobox.Positioner>
        </PortalContextProvider>
      </Combobox.Root>,
    );

    for (const part of ['backdrop', 'positioner', 'popup', 'arrow']) {
      expect(html).toContain(`data-testid="${part}"`);
    }
  });
});
