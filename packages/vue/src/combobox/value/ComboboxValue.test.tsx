import { expect, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { createRenderer, screen } from '#test-utils';
import * as Combobox from '../index.parts';

type ValueSlotProps = { value: any };

describe('<Combobox.Value />', () => {
  const { render } = createRenderer();

  describe('prop: children', () => {
    it('renders current selected value via function child', async () => {
      await render(
        <Combobox.Root defaultValue="b">
          <Combobox.Value
            v-slots={{
              default: ({ value }: ValueSlotProps) => <div data-testid="value">{value}</div>,
            }}
          />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('b');
    });

    it('renders function child with null when no value selected', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Value
            v-slots={{
              default: ({ value }: ValueSlotProps) => (
                <div data-testid="value">{value === null ? 'null' : String(value)}</div>
              ),
            }}
          />
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

      expect(screen.getByTestId('value')).toHaveTextContent('null');
    });

    it('renders function child with complex objects', async () => {
      const complexValue = { id: 1, name: 'Test', nested: { data: 'value' } };

      await render(
        <Combobox.Root defaultValue={complexValue}>
          <Combobox.Value
            v-slots={{
              default: ({ value }: ValueSlotProps) => (
                <div data-testid="value">{value ? `${value.name} (${value.id})` : 'No value'}</div>
              ),
            }}
          />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={complexValue}>Test Item</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Test (1)');
    });

    it('overrides the value display when children is a static ReactNode', async () => {
      await render(
        <Combobox.Root defaultValue="test-value">
          <Combobox.Value>Custom Display Text</Combobox.Value>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="test-value">Test</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByText('Custom Display Text')).not.toBe(null);
    });

    it('renders complex ReactNode children', async () => {
      await render(
        <Combobox.Root defaultValue="test">
          <Combobox.Value>
            <span data-testid="complex">
              <strong>Bold</strong> and <em>italic</em> text
            </span>
          </Combobox.Value>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="test">Test</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const element = screen.getByTestId('complex');
      expect(element.querySelector('strong')).toHaveTextContent('Bold');
      expect(element.querySelector('em')).toHaveTextContent('italic');
    });
  });

  describe('selected value with label property', () => {
    it('renders label from selected value object', async () => {
      const valueWithLabel = { value: 'test', label: 'Test Label' };

      await render(
        <Combobox.Root defaultValue={valueWithLabel}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={valueWithLabel}>Test Item</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Test Label');
    });

    it('renders ReactNode label from selected value object', async () => {
      const valueWithLabel = {
        value: 'test',
        label: () => <span data-testid="label-node">Formatted Label</span>,
      };

      await render(
        <Combobox.Root defaultValue={valueWithLabel}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={valueWithLabel}>Test Item</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('label-node')).toHaveTextContent('Formatted Label');
    });

    it('handles selected value with null label', async () => {
      const valueWithNullLabel = { value: 'test', label: null };

      await render(
        <Combobox.Root defaultValue={valueWithNullLabel}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={valueWithNullLabel}>Test Item</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should fall back to stringifyItem behavior
      expect(screen.getByTestId('value')).toHaveTextContent('test');
    });
  });

  describe('items array format', () => {
    it('renders null item label from items array when no value selected', async () => {
      const items = [
        { value: null, label: 'Select item' },
        { value: 'a', label: 'A' },
      ];

      await render(
        <Combobox.Root items={items}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={items[0]}>Select item</Combobox.Item>
                  <Combobox.Item value={items[1]}>A</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Select item');
    });

    it('displays the label from items array when value is selected', async () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ];

      await render(
        <Combobox.Root defaultValue={items[1]} items={items}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={items[0]}>Sans-serif</Combobox.Item>
                  <Combobox.Item value={items[1]}>Serif</Combobox.Item>
                  <Combobox.Item value={items[2]}>Monospace</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Serif');
    });

    it('updates the label when value changes with items array', async () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ];

      const App = defineComponent(() => {
        const value = shallowRef<(typeof items)[number] | null>(items[0]);
        return () => (
          <div>
            <button onClick={() => (value.value = items[1])}>serif</button>
            <button onClick={() => (value.value = items[2])}>mono</button>
            <button onClick={() => (value.value = null)}>clear</button>
            <Combobox.Root v-model:value={value.value} items={items}>
              <Combobox.Trigger data-testid="value">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value={items[0]}>Sans-serif</Combobox.Item>
                      <Combobox.Item value={items[1]}>Serif</Combobox.Item>
                      <Combobox.Item value={items[2]}>Monospace</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </div>
        );
      });

      const { user } = await render(<App />);

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif');

      await user.click(screen.getByRole('button', { name: 'serif' }));
      expect(screen.getByTestId('value')).toHaveTextContent('Serif');

      await user.click(screen.getByRole('button', { name: 'mono' }));
      expect(screen.getByTestId('value')).toHaveTextContent('Monospace');

      await user.click(screen.getByRole('button', { name: 'clear' }));
      expect(screen.getByTestId('value')).toHaveTextContent('');
    });

    it('supports ReactNode labels in items array', async () => {
      const items = [
        { value: 'bold', label: () => <strong>Bold Text</strong> },
        { value: 'italic', label: () => <em>Italic Text</em> },
      ];

      await render(
        <Combobox.Root defaultValue={items[0]} items={items}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={items[0]}>Bold Text</Combobox.Item>
                  <Combobox.Item value={items[1]}>Italic Text</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value').querySelector('strong')).toHaveTextContent('Bold Text');
    });

    it('handles duplicate values in items array (uses first match)', async () => {
      const items = [
        { value: 'test', label: 'First Label' },
        { value: 'test', label: 'Second Label' },
        { value: 'other', label: 'Other' },
      ];

      await render(
        <Combobox.Root defaultValue={items[0]} items={items}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={items[0]}>First Label</Combobox.Item>
                  <Combobox.Item value={items[1]}>Second Label</Combobox.Item>
                  <Combobox.Item value={items[2]}>Other</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('First Label');
    });

    it('is not stale after items are updated', async () => {
      // Keep stable object identities for selected items
      const a = { value: 'a', label: 'a' };
      const b = { value: 'b', label: 'b' };
      let c: { value: 'c'; label: string } | null = null;

      const App = defineComponent(() => {
        const value = shallowRef<{ value: string; label: string } | null>(a);
        const items = shallowRef<{ value: string; label: string }[]>([a, b]);

        function updateItems() {
          // mutate the label but keep the same object identity for `a`
          a.label = 'a new';
          // introduce a new item `c` and keep reference to it for selection later
          c = { value: 'c', label: 'c' };
          items.value = [a, b, c];
        }

        return () => (
          <div>
            <button onClick={updateItems}>update</button>
            <button onClick={() => c && (value.value = c)}>select c</button>
            <Combobox.Root v-model:value={value.value} items={items.value}>
              <Combobox.Trigger data-testid="value">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {items.value.map((item) => (
                        <Combobox.Item key={item.value} value={item}>
                          {item.label}
                        </Combobox.Item>
                      ))}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </div>
        );
      });

      const { user } = await render(<App />);

      expect(screen.getByTestId('value')).toHaveTextContent('a');

      await user.click(screen.getByRole('button', { name: 'update' }));
      expect(screen.getByTestId('value')).toHaveTextContent('a new');

      await user.click(screen.getByRole('button', { name: 'select c' }));
      expect(screen.getByTestId('value')).toHaveTextContent('c');
    });
  });

  describe('grouped items', () => {
    it('handles grouped items correctly', async () => {
      const items = [
        {
          value: 'fonts',
          items: [
            { value: 'sans', label: 'Sans-serif' },
            { value: 'serif', label: 'Serif' },
          ],
        },
        {
          value: 'sizes',
          items: [
            { value: 'small', label: 'Small' },
            { value: 'large', label: 'Large' },
          ],
        },
      ];

      await render(
        <Combobox.Root defaultValue={items[0].items[1]} items={items}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group items={items[0].items}>
                    <Combobox.Item value={items[0].items[0]}>Sans-serif</Combobox.Item>
                    <Combobox.Item value={items[0].items[1]}>Serif</Combobox.Item>
                  </Combobox.Group>
                  <Combobox.Group items={items[1].items}>
                    <Combobox.Item value={items[1].items[0]}>Small</Combobox.Item>
                    <Combobox.Item value={items[1].items[1]}>Large</Combobox.Item>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Serif');
    });

    it('handles null items in grouped structure', async () => {
      const items = [
        {
          value: 'options',
          items: [
            { value: null, label: 'None selected' },
            { value: 'option1', label: 'Option 1' },
          ],
        },
      ];

      await render(
        <Combobox.Root items={items}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group items={items[0].items}>
                    <Combobox.Item value={items[0].items[0]}>None selected</Combobox.Item>
                    <Combobox.Item value={items[0].items[1]}>Option 1</Combobox.Item>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('None selected');
    });
  });

  describe('multiple selection', () => {
    it('displays comma-separated labels from items array', async () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ];

      await render(
        <Combobox.Root defaultValue={[items[0], items[1]]} items={items} multiple>
          <Combobox.Trigger>
            <span data-testid="value">
              <Combobox.Value />
            </span>
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List
                  v-slots={{
                    item: ({ item }: { item: any }) => (
                      <Combobox.Item key={item.value} value={item}>
                        {item.label}
                      </Combobox.Item>
                    ),
                  }}
                />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif, Serif');
    });

    it('supports ReactNode labels for multiple selections', async () => {
      const items = [
        { value: 'bold', label: () => <strong>Bold Text</strong> },
        { value: 'italic', label: () => <em>Italic Text</em> },
      ];

      await render(
        <Combobox.Root defaultValue={items} items={items} multiple>
          <Combobox.Trigger>
            <span data-testid="value">
              <Combobox.Value />
            </span>
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List
                  v-slots={{
                    item: ({ item }: { item: any }) => (
                      <Combobox.Item key={item.value} value={item}>
                        {item.label}
                      </Combobox.Item>
                    ),
                  }}
                />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const value = screen.getByTestId('value');
      expect(value.querySelector('strong')).toHaveTextContent('Bold Text');
      expect(value.querySelector('em')).toHaveTextContent('Italic Text');
      expect(value).toHaveTextContent('Bold Text, Italic Text');
    });

    it('falls back to raw values when items are not provided', async () => {
      await render(
        <Combobox.Root defaultValue={['serif', 'mono']} multiple>
          <Combobox.Trigger>
            <span data-testid="value">
              <Combobox.Value />
            </span>
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="serif">Serif</Combobox.Item>
                  <Combobox.Item value="mono">Monospace</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('serif, mono');
    });
  });

  describe('primitive values', () => {
    it('handles string values correctly', async () => {
      await render(
        <Combobox.Root defaultValue="test-string">
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="test-string">Test String</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('test-string');
    });

    it('handles number values correctly', async () => {
      await render(
        <Combobox.Root defaultValue={42}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={42}>Forty Two</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('42');
    });

    it('handles boolean values correctly', async () => {
      await render(
        <Combobox.Root defaultValue={true}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={true}>True</Combobox.Item>
                  <Combobox.Item value={false}>False</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('true');
    });
  });

  describe('prop: itemToStringLabel', () => {
    it('uses custom itemToStringLabel function', async () => {
      const customitemToStringLabel = (item: any) => {
        if (item && typeof item === 'object' && 'name' in item) {
          return `Custom: ${item.name}`;
        }
        return String(item);
      };

      const complexItem = { id: 1, name: 'Test Item' };

      await render(
        <Combobox.Root defaultValue={complexItem} itemToStringLabel={customitemToStringLabel}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={complexItem}>Test Item</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Custom: Test Item');
    });
  });

  describe('prop: placeholder', () => {
    it('displays placeholder when no value is selected', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value placeholder="Select an option" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="option1">Option 1</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });

    it('does not display placeholder when value is selected', async () => {
      await render(
        <Combobox.Root defaultValue="option1">
          <Combobox.Trigger data-testid="value">
            <Combobox.Value placeholder="Select an option" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="option1">Option 1</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('option1');
    });

    it('children prop takes precedence over placeholder', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value placeholder="Select an option">Custom Text</Combobox.Value>
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="option1">Option 1</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Custom Text');
    });

    it('children function takes precedence over placeholder', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value
              placeholder="Select an option"
              v-slots={{ default: ({ value }: ValueSlotProps) => value || 'Function fallback' }}
            />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="option1">Option 1</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Function fallback');
    });

    it('null item label in items takes precedence over placeholder', async () => {
      const items = [
        { value: null, label: 'None' },
        { value: 'option1', label: 'Option 1' },
      ];

      await render(
        <Combobox.Root items={items}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value placeholder="Select an option" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={null}>None</Combobox.Item>
                  <Combobox.Item value="option1">Option 1</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('None');
    });

    it('uses placeholder when items have null value without label', async () => {
      const items = [
        { value: null, label: null },
        { value: 'option1', label: 'Option 1' },
      ];

      await render(
        <Combobox.Root items={items}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value placeholder="Select an option" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value={null}>None</Combobox.Item>
                  <Combobox.Item value="option1">Option 1</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });

    it('supports ReactNode as placeholder', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger>
            <Combobox.Value
              placeholder={() => <span data-testid="placeholder">Select an option</span>}
            />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="option1">Option 1</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('placeholder')).toHaveTextContent('Select an option');
    });

    it('displays placeholder when multiple mode has empty array', async () => {
      await render(
        <Combobox.Root multiple defaultValue={[]}>
          <Combobox.Trigger data-testid="value">
            <Combobox.Value placeholder="Select options" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="option1">Option 1</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Select options');
    });
  });

  describe('a value with no label', () => {
    it.each([
      { name: 'a multiple combobox with no value', root: { multiple: true } },
      { name: 'an empty string value', root: { defaultValue: '' } },
    ])('renders no text node for $name', async ({ root }) => {
      await render(
        <Combobox.Root {...root}>
          <span data-testid="value">
            <Combobox.Value />
          </span>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    });
  });
});
