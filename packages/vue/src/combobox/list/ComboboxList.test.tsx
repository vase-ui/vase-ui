import { expect, vi, describe, it } from 'vitest';
import { KeepAlive, shallowRef, toRaw } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  heldMountListTests,
  screen,
  waitFor,
} from '#test-utils';
import ComboboxListReplacement from '../../../test/fixtures/ComboboxListReplacement.vue';
import type { HTMLProps } from '../../internals/types';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';

describe('<Combobox.List />', () => {
  const { render } = createRenderer();

  heldMountListTests({
    render,
    renderList: (withLastItem) => (
      <Combobox.Root inline>
        <Combobox.Input />
        <Combobox.List>
          <Combobox.Item value="a">a</Combobox.Item>
          {withLastItem ? <Combobox.Item value="b">b</Combobox.Item> : null}
        </Combobox.List>
      </Combobox.Root>
    ),
    async check(user) {
      screen.getByRole('combobox').focus();
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-highlighted');
      });
    },
  });

  describeConformance(<Combobox.List />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Combobox.Root>{node}</Combobox.Root>);
    },
  }));

  it('sets role=listbox and aria-multiselectable in multiple mode', async () => {
    await render(
      <Combobox.Root multiple defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const list = screen.getByRole('listbox');
    expect(list).toHaveAttribute('aria-multiselectable', 'true');
  });

  it('sets aria-readonly on the listbox when the root is readOnly', async () => {
    await render(
      <Combobox.Root readOnly defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(screen.getByRole('listbox')).toHaveAttribute('aria-readonly', 'true');
  });

  it('does not set aria-readonly on the grid when the root is readOnly', async () => {
    await render(
      <Combobox.Root readOnly defaultOpen grid>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Row>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.Row>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    // `aria-readonly` on a grid describes cell editability, so the combobox carries the state.
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-readonly');
    expect(screen.getByTestId('input')).toHaveAttribute('aria-readonly', 'true');
  });

  it('does not set aria-readonly on the listbox by default', async () => {
    await render(
      <Combobox.Root defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-readonly');
  });

  // `Autocomplete.Portal`, `Autocomplete.Positioner`, `Autocomplete.Popup`, `Autocomplete.List` and
  // `Autocomplete.Item` are these parts of Combobox under other names, and the Autocomplete entry
  // does not export them yet. The case asserts only the list.
  it('sets aria-readonly on the Autocomplete listbox when the root is readOnly', async () => {
    await render(
      <Autocomplete.Root readOnly defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Autocomplete.Root>,
    );

    expect(screen.getByRole('listbox')).toHaveAttribute('aria-readonly', 'true');
  });

  it('does not prevent Enter when no item is highlighted', async () => {
    await render(
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const list = screen.getByRole('listbox');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    list.dispatchEvent(event);
    await flushMicrotasks();
    expect(event.defaultPrevented).toBe(false);
  });

  it('selects the highlighted item with Enter', async () => {
    const onValueChange = vi.fn();
    const { user } = await render(
      <Combobox.Root defaultOpen onValueChange={onValueChange}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}');

    const list = screen.getByRole('listbox');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    list.dispatchEvent(event);
    await flushMicrotasks();

    expect(onValueChange).toHaveBeenCalledWith('a', expect.anything());
  });

  it.each([{ disabled: true }, { readOnly: true }])(
    'ignores Enter when interaction is disabled: %o',
    async (rootProps) => {
      const onValueChange = vi.fn();
      await render(
        <Combobox.Root defaultOpen onValueChange={onValueChange} {...rootProps}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const list = screen.getByRole('listbox');
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      list.dispatchEvent(event);
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
    },
  );

  describe('Vue form of the list', () => {
    function StoreProbe(props: { onStore: (store: ComboboxStore) => void }) {
      props.onStore(useComboboxRootContext());
      return null;
    }

    it('renders the item slot for each filtered item', async () => {
      await render(
        <Combobox.Root items={['apple', 'banana']} defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item, index }: { item: string; index: number }) => (
                      <Combobox.Item key={item} value={item}>
                        {`${index}: ${item}`}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        '0: apple',
        '1: banana',
      ]);
    });

    it('keeps the element of an item when the filter moves the item', async () => {
      await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      const cherry = screen.getByRole('option', { name: 'cherry' });

      await fireEvent.input(screen.getByRole('combobox'), {
        target: { value: 'cherry' },
        inputType: 'insertText',
      });
      await flushMicrotasks();
      expect(screen.getAllByRole('option')).toEqual([cherry]);

      await fireEvent.input(screen.getByRole('combobox'), {
        target: { value: '' },
        inputType: 'deleteContentBackward',
      });
      await flushMicrotasks();
      expect(screen.getAllByRole('option')).toHaveLength(3);
      expect(screen.getByRole('option', { name: 'cherry' })).toBe(cherry);
    });

    it('is the positioner element of a list with no positioner', async () => {
      let store: ComboboxStore | undefined;
      await render(
        <Combobox.Root inline>
          <StoreProbe onStore={(value) => (store = value)} />
          <Combobox.Input />
          <Combobox.List data-testid="list">
            <Combobox.Item value="a">a</Combobox.Item>
          </Combobox.List>
        </Combobox.Root>,
      );

      expect(toRaw(store!.state).positionerElement).toBe(screen.getByTestId('list'));
    });

    it('gives the labels of the rendered items to the root with no items', async () => {
      let store: ComboboxStore | undefined;
      await render(
        <Combobox.Root defaultOpen>
          <StoreProbe onStore={(value) => (store = value)} />
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">Apple</Combobox.Item>
                  <Combobox.Item value="b">Banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      await flushMicrotasks();

      expect(store!.context.labelsRef.value).toEqual(['Apple', 'Banana']);
    });

    it('gives no rendered labels to the root when the root has items', async () => {
      let store: ComboboxStore | undefined;
      await render(
        <Combobox.Root items={['a', 'b']} defaultOpen>
          <StoreProbe onStore={(value) => (store = value)} />
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {`Label ${item}`}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      await flushMicrotasks();

      expect(screen.getAllByRole('option')).toHaveLength(2);
      expect(store!.context.labelsRef.value).toEqual([]);
    });

    it('clears the labels of the rendered items when the list unmounts', async () => {
      let store: ComboboxStore | undefined;
      await render(
        <Combobox.Root defaultOpen>
          <StoreProbe onStore={(value) => (store = value)} />
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">Apple</Combobox.Item>
                  <Combobox.Item value="b">Banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      await flushMicrotasks();
      expect(store!.context.labelsRef.value).toEqual(['Apple', 'Banana']);

      await fireEvent.click(screen.getByRole('option', { name: 'Banana' }));
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(store!.context.labelsRef.value).toEqual([]);
    });

    it('keeps the labels that the root made from its items when the list unmounts', async () => {
      let store: ComboboxStore | undefined;
      await render(
        <Combobox.Root items={['a', 'b']} defaultOpen>
          <StoreProbe onStore={(value) => (store = value)} />
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: { item: string }) => (
                      <Combobox.Item key={item} value={item}>
                        {`Label ${item}`}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      store!.context.forceMount();
      expect(store!.context.labelsRef.value).toEqual(['a', 'b']);

      await fireEvent.click(screen.getByRole('option', { name: 'Label b' }));
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(store!.context.labelsRef.value).toEqual(['a', 'b']);
    });

    it('keeps the elements of a list that mounts before the old list unmounts', async () => {
      let store!: ComboboxStore;
      const { setProps } = await render(
        <ComboboxListReplacement first onStore={(value: ComboboxStore) => (store = value)} />,
      );
      expect(toRaw(store.state).listElement).toBe(screen.getByTestId('first-list'));

      await setProps({ first: false });

      const list = screen.getByTestId('second-list');
      expect(screen.queryByTestId('first-list')).toBe(null);
      expect(toRaw(store.state).listElement).toBe(list);
      expect(toRaw(store.state).positionerElement).toBe(list);
    });

    describe('VUE-73: aria-controls names only an element in the document', () => {
      it('gives no element while KeepAlive holds the list', async () => {
        const show = shallowRef(true);
        await render(() => (
          <Combobox.Root defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <KeepAlive>{show.value ? <Combobox.List id="list" /> : null}</KeepAlive>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));
        await flushMicrotasks();
        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');
        expect(input).toHaveAttribute('aria-controls', 'list');
        expect(trigger).toHaveAttribute('aria-controls', 'list');

        show.value = false;
        await flushMicrotasks();

        expect(document.getElementById('list')).toBe(null);
        expect(input).not.toHaveAttribute('aria-controls');
        expect(trigger).not.toHaveAttribute('aria-controls');

        show.value = true;
        await flushMicrotasks();

        expect(input).toHaveAttribute('aria-controls', 'list');
        expect(trigger).toHaveAttribute('aria-controls', 'list');
      });

      it('gives a new element to the store only after KeepAlive shows the list again', async () => {
        const show = shallowRef(true);
        const tag = shallowRef<'div' | 'ul'>('div');
        let store!: ComboboxStore;
        await render(() => (
          <Combobox.Root defaultOpen>
            <StoreProbe onStore={(value) => (store = value)} />
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <KeepAlive>
                    {show.value ? (
                      <Combobox.List
                        v-slots={{
                          render: ({ props }: { props: HTMLProps }) =>
                            tag.value === 'div' ? (
                              <div {...props} id="list" data-testid="list" />
                            ) : (
                              <ul {...props} id="list" data-testid="list" />
                            ),
                        }}
                      />
                    ) : null}
                  </KeepAlive>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));
        await flushMicrotasks();
        const input = screen.getByTestId('input');
        expect(input).toHaveAttribute('aria-controls', 'list');

        show.value = false;
        await flushMicrotasks();
        tag.value = 'ul';
        await flushMicrotasks();

        expect(document.getElementById('list')).toBe(null);
        expect(toRaw(store.state).listElement).toBe(null);
        expect(input).not.toHaveAttribute('aria-controls');

        show.value = true;
        await flushMicrotasks();

        const list = screen.getByTestId('list');
        expect(list.tagName).toBe('UL');
        expect(toRaw(store.state).listElement).toBe(list);
        expect(input).toHaveAttribute('aria-controls', 'list');
      });

      it('gives no element when it mounts while KeepAlive holds its branch', async () => {
        const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
          () => <Combobox.List id="list" data-testid="list" />,
          { renderBranch: (part) => part },
        );
        let store!: ComboboxStore;
        await render(() => (
          <Combobox.Root defaultOpen>
            <StoreProbe onStore={(value) => (store = value)} />
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <HeldBranch />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));
        await flushMicrotasks();

        await mountWhileHeld();

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');
        expect(document.getElementById('list')).toBe(null);
        expect(toRaw(store.state).listElement).toBe(null);
        expect(input).not.toHaveAttribute('aria-controls');
        expect(trigger).not.toHaveAttribute('aria-controls');

        await show();

        expect(toRaw(store.state).listElement).toBe(screen.getByTestId('list'));
        expect(input).toHaveAttribute('aria-controls', 'list');
        expect(trigger).toHaveAttribute('aria-controls', 'list');
      });
    });
  });
});
