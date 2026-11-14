import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
import * as Combobox from '../index.parts';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';

describe('<Combobox.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(<Combobox.Root open>{node}</Combobox.Root>);
      await flushMicrotasks();
      return result;
    },
  }));

  it('renders the popup in the children component of the #render slot', async () => {
    await render(
      <Combobox.Root open>
        <Combobox.Input />
        <Combobox.Portal
          v-slots={{
            render: ({
              props,
              children,
            }: {
              props: Record<string, unknown>;
              children: Component;
            }) => (
              <section {...props} data-testid="portal">
                {h(children, null, () => (
                  <Combobox.Positioner>
                    <Combobox.Popup data-testid="popup" />
                  </Combobox.Positioner>
                ))}
              </section>
            ),
          }}
        />
      </Combobox.Root>,
    );
    await flushMicrotasks();

    const portal = screen.getByTestId('portal');
    expect(portal.localName).toBe('section');
    expect(portal.parentElement).toBe(document.body);
    expect(portal.contains(screen.getByTestId('popup'))).toBe(true);
  });

  it('keeps the positioner in the DOM while the popup is closed with keepMounted', async () => {
    await render(
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Portal keepMounted>
          <Combobox.Positioner data-testid="positioner">
            <Combobox.Popup />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('hidden');
    expect(positioner).toHaveAttribute('data-closed');
  });

  it('renders the positioner of a closed popup that the root mounts by force', async () => {
    let store!: ComboboxStore;
    const StoreProbe = defineComponent(() => {
      store = useComboboxRootContext();
      return () => null;
    });
    await render(
      <Combobox.Root>
        <StoreProbe />
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner data-testid="positioner">
            <Combobox.Popup />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );
    await flushMicrotasks();
    expect(screen.queryByTestId('positioner')).toBe(null);

    store.context.forceMount();

    expect(await screen.findByTestId('positioner')).toHaveAttribute('hidden');
  });
});
