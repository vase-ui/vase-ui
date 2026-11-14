import { expect, describe, it } from 'vitest';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import * as Combobox from '../index.parts';

describe('<Combobox.Collection />', () => {
  const { render } = createRenderer();

  it('renders filtered items', async () => {
    await render(
      <Combobox.Root items={['alpha', 'beta', 'alpine']} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Collection>
                  {({ item }: { item: string }) => (
                    <Combobox.Item key={item} value={item} data-testid={`item-${item}`}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.Collection>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(screen.getByTestId('item-alpha')).not.toBe(null);
    expect(screen.getByTestId('item-beta')).not.toBe(null);
    expect(screen.getByTestId('item-alpine')).not.toBe(null);
  });

  it('renders nothing when a nested group does not provide items', async () => {
    await render(
      <Combobox.Root defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Group data-testid="group">
                  <Combobox.Collection>
                    {({ item }: { item: string }) => <span key={item}>{item}</span>}
                  </Combobox.Collection>
                </Combobox.Group>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    // The fragment of a slot leaves empty text nodes.
    expect(screen.getByTestId('group').innerHTML).toBe('');
  });

  describe('Vue form of the collection', () => {
    function renderNestedGroups(innerItems?: string[]) {
      return render(
        <Combobox.Root items={['root item']} defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group items={['outer item']}>
                    <Combobox.Group items={innerItems}>
                      <Combobox.Collection>
                        {({ item }: { item: string }) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        )}
                      </Combobox.Collection>
                    </Combobox.Group>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
    }

    it.each([
      { name: 'the items of its own group', innerItems: ['inner item'], expected: 'inner item' },
      { name: 'the items of the group around it', innerItems: undefined, expected: 'outer item' },
    ])('renders $name', async ({ innerItems, expected }) => {
      await renderNestedGroups(innerItems);

      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        expected,
      ]);
    });

    it('renders the filtered items of the root in a group with no items', async () => {
      await render(
        <Combobox.Root items={['alpha', 'beta']} defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group>
                    <Combobox.Collection>
                      {({ item }: { item: string }) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.Collection>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'alpha',
        'beta',
      ]);
    });

    it('keeps the element of an item when the filter removes an item before it', async () => {
      await render(
        <Combobox.Root items={['alpha', 'beta', 'alpine']} defaultOpen>
          <Combobox.Input data-testid="input" />
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

      const alpine = screen.getByRole('option', { name: 'alpine' });

      await fireEvent.input(screen.getByTestId('input'), {
        target: { value: 'alp' },
        inputType: 'insertText',
      });
      await flushMicrotasks();

      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'alpha',
        'alpine',
      ]);
      expect(screen.getByRole('option', { name: 'alpine' })).toBe(alpine);
    });
  });
});
