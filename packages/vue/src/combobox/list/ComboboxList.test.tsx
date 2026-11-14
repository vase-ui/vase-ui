import { expect, vi, describe, it } from 'vitest';
import { toRaw } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
} from '#test-utils';
import ComboboxListReplacement from '../../../test/fixtures/ComboboxListReplacement.vue';
import * as Autocomplete from '../../autocomplete/index.parts';
import * as Combobox from '../index.parts';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';

describe('<Combobox.List />', () => {
  const { render } = createRenderer();

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
  });
});
