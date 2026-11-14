import { expect, vi, describe, it } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import type { Component } from 'vue';
import { Select } from '@vase-ui/vue/select';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import type { SelectStore } from '../store';
import SelectValueReplacement from './SelectValueReplacement.test.vue';

type ValueSlotProps = { value: any };

describe('<Select.Value />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Value />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(<Select.Root open>{node}</Select.Root>);
    },
  }));

  describe('prop: children', () => {
    it('overrides the text when children is a string', async () => {
      await render(
        <Select.Root value="1">
          <Select.Value>one</Select.Value>
        </Select.Root>,
      );

      expect(screen.getByText('one')).not.toBe(null);
    });

    it('accepts a function with a value parameter', async () => {
      const children = vi.fn();
      await render(
        <Select.Root value="1">
          <Select.Trigger>
            <Select.Value
              v-slots={{
                default: ({ value }: ValueSlotProps) => {
                  children(value);
                  return value;
                },
              }}
            />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="1">one</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await fireEvent.click(screen.getByText('1'));
      await flushMicrotasks();

      expect(children.mock.calls[0]?.[0]).toBe('1');
      expect(children.mock.calls[0]?.at(-1)).toBe('1');
    });
  });

  describe('prop: items (object format)', () => {
    it('falls back to raw value when value is not in items object', async () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
      };

      await render(
        <Select.Root value="unknown" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('unknown');
    });

    it('supports ReactNode labels in items object', async () => {
      const items = {
        sans: () => <span>Sans-serif</span>,
        serif: () => <span>Serif</span>,
      };

      await render(
        <Select.Root value="sans" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value').querySelector('span')).toHaveTextContent('Sans-serif');
    });

    it('can lookup null value', async () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
        null: 'Null',
      };

      await render(
        <Select.Root value={null} items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Null');
    });

    it('displays the label from items object when no children are provided', async () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
        mono: 'Monospace',
      };

      await render(
        <Select.Root value="sans" items={items}>
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="sans">Sans-serif</Select.Item>
                <Select.Item value="serif">Serif</Select.Item>
                <Select.Item value="mono">Monospace</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif');
    });

    it('updates the label when value changes with items object', async () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
        mono: 'Monospace',
      };

      const value = shallowRef<string | null>('sans');
      const App = defineComponent({
        setup: () => () => (
          <div>
            <button onClick={() => (value.value = 'serif')}>serif</button>
            <button onClick={() => (value.value = 'mono')}>mono</button>
            <Select.Root v-model:value={value.value} items={items}>
              <Select.Trigger>
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="sans">Sans-serif</Select.Item>
                    <Select.Item value="serif">Serif</Select.Item>
                    <Select.Item value="mono">Monospace</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        ),
      });

      const { user } = await render(<App />);

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif');

      await user.click(screen.getByRole('button', { name: 'serif' }));
      expect(screen.getByTestId('value')).toHaveTextContent('Serif');

      await user.click(screen.getByRole('button', { name: 'mono' }));
      expect(screen.getByTestId('value')).toHaveTextContent('Monospace');
    });
  });

  describe('prop: items (array format)', () => {
    it('falls back to raw value when value is not in items array', async () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
      ];

      await render(
        <Select.Root value="unknown" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('unknown');
    });

    it('supports ReactNode labels in items array', async () => {
      const items = [
        { value: 'bold', label: () => <strong>Bold Text</strong> },
        { value: 'italic', label: () => <em>Italic Text</em> },
      ];

      await render(
        <Select.Root value="bold" items={items}>
          <Select.Value data-testid="value" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value').querySelector('strong')).toHaveTextContent('Bold Text');
    });

    it('displays the label from items array when no children are provided', async () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ];

      await render(
        <Select.Root value="serif" items={items}>
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="sans">Sans-serif</Select.Item>
                <Select.Item value="serif">Serif</Select.Item>
                <Select.Item value="mono">Monospace</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Serif');
    });

    it('updates the label when value changes with items array', async () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ];

      const value = shallowRef<string | null>('sans');
      const App = defineComponent({
        setup: () => () => (
          <div>
            <button onClick={() => (value.value = 'serif')}>serif</button>
            <button onClick={() => (value.value = 'mono')}>mono</button>
            <Select.Root v-model:value={value.value} items={items}>
              <Select.Trigger>
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="sans">Sans-serif</Select.Item>
                    <Select.Item value="serif">Serif</Select.Item>
                    <Select.Item value="mono">Monospace</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        ),
      });

      const { user } = await render(<App />);

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif');

      await user.click(screen.getByRole('button', { name: 'serif' }));
      expect(screen.getByTestId('value')).toHaveTextContent('Serif');

      await user.click(screen.getByRole('button', { name: 'mono' }));
      expect(screen.getByTestId('value')).toHaveTextContent('Monospace');
    });

    it('is not stale after being updated', async () => {
      const value = shallowRef<string | null>('a');
      const items = shallowRef([
        { value: 'a', label: 'a' },
        { value: 'b', label: 'b' },
      ]);

      function updateItems() {
        items.value = [
          { value: 'a', label: 'a new' },
          { value: 'b', label: 'b new' },
          { value: 'c', label: 'c' },
        ];
      }

      const App = defineComponent({
        setup: () => () => (
          <div>
            <button onClick={updateItems}>update</button>
            <button onClick={() => (value.value = 'c')}>select c</button>
            <Select.Root v-model:value={value.value} items={items.value}>
              <Select.Trigger>
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.value.map((item) => (
                      <Select.Item key={item.value} value={item.value}>
                        {item.label}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        ),
      });

      const { user } = await render(<App />);

      expect(screen.getByTestId('value')).toHaveTextContent('a');

      await user.click(screen.getByRole('button', { name: 'update' }));

      expect(screen.getByTestId('value')).toHaveTextContent('a new');

      await user.click(screen.getByRole('button', { name: 'select c' }));

      expect(screen.getByTestId('value')).toHaveTextContent('c');
    });
  });

  describe('prop: itemToStringLabel', () => {
    it('uses custom itemToStringLabel function', async () => {
      const items = [
        { country: 'United States', code: 'US' },
        { country: 'Canada', code: 'CA' },
      ];

      await render(
        <Select.Root
          value={items[1]}
          itemToStringLabel={(i: any) => i.country}
          itemToStringValue={(i: any) => i.code}
        >
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Canada');
    });

    it('falls back to label/value properties when functions are not provided', async () => {
      const items = [
        { label: 'United States', value: 'US' },
        { label: 'Canada', value: 'CA' },
      ];

      await render(
        <Select.Root name="country" value={items[1]}>
          <Select.Trigger>
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.value} value={it}>
                    {it.label}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Canada');

      const hiddenInput = screen.getByRole('textbox', {
        hidden: true,
      });
      expect(hiddenInput).toHaveValue('CA');
    });
  });

  describe('prop: children (takes precedence over items)', () => {
    it('uses children string over items object', async () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
      };

      await render(
        <Select.Root value="sans" items={items}>
          <Select.Value data-testid="value">Custom Text</Select.Value>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Custom Text');
    });

    it('uses children function over items array', async () => {
      const items = [
        { value: 'sans', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
      ];

      await render(
        <Select.Root value="sans" items={items}>
          <Select.Value
            data-testid="value"
            v-slots={{ default: ({ value }: ValueSlotProps) => `Custom: ${value}` }}
          />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Custom: sans');
    });
  });

  it('changes text when the value changes', async () => {
    const value = shallowRef<string | null>(null);
    const App = defineComponent({
      setup: () => () => (
        <div>
          <button onClick={() => (value.value = '1')}>1</button>
          <button onClick={() => (value.value = '2')}>2</button>
          <button onClick={() => (value.value = null)}>null</button>
          <Select.Root v-model:value={value.value}>
            <Select.Trigger>
              <Select.Value
                data-testid="value"
                v-slots={{ default: ({ value: val }: ValueSlotProps) => val ?? 'initial' }}
              />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">1</Select.Item>
                  <Select.Item value="2">2</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      ),
    });

    const { user } = await render(<App />);

    await user.click(screen.getByText('initial'));
    await flushMicrotasks();

    await user.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByTestId('value')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByTestId('value')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'null' }));
    expect(screen.getByTestId('value')).toHaveTextContent('initial');
  });

  describe('prop: multiple', () => {
    it('displays comma-separated labels for multiple values with items object', async () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
        mono: 'Monospace',
      };

      await render(
        <Select.Root value={['sans', 'serif']} items={items} multiple>
          <Select.Trigger>
            <span data-testid="value">
              <Select.Value />
            </span>
          </Select.Trigger>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif, Serif');
    });

    it('displays comma-separated labels for multiple values with items array', async () => {
      const items = [
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ];

      await render(
        <Select.Root value={['serif', 'mono']} items={items} multiple>
          <Select.Trigger>
            <span data-testid="value">
              <Select.Value />
            </span>
          </Select.Trigger>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Serif, Monospace');
    });

    it('supports ReactNode labels for multiple selections', async () => {
      const items = [
        { value: 'bold', label: () => <strong>Bold Text</strong> },
        { value: 'italic', label: () => <em>Italic Text</em> },
      ];

      await render(
        <Select.Root value={['bold', 'italic']} items={items} multiple>
          <Select.Trigger>
            <span data-testid="value">
              <Select.Value />
            </span>
          </Select.Trigger>
        </Select.Root>,
      );

      const value = screen.getByTestId('value');
      expect(value.querySelector('strong')).toHaveTextContent('Bold Text');
      expect(value.querySelector('em')).toHaveTextContent('Italic Text');
      expect(value).toHaveTextContent('Bold Text, Italic Text');
    });

    it('falls back to raw values when no items are provided', async () => {
      await render(
        <Select.Root value={['serif', 'mono']} multiple>
          <Select.Trigger>
            <span data-testid="value">
              <Select.Value />
            </span>
          </Select.Trigger>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('serif, mono');
    });

    it('displays single value when only one value is selected in multiple mode', async () => {
      await render(
        <Select.Root value={['sans']} multiple>
          <Select.Value data-testid="value" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('sans');
    });

    it('displays empty when no values are selected in multiple mode', async () => {
      await render(
        <Select.Root value={[]} multiple>
          <Select.Value data-testid="value" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('');
    });

    it('children function receives array of values in multiple mode', async () => {
      const children = vi.fn();
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
      };

      await render(
        <Select.Root value={['sans', 'serif']} items={items} multiple>
          <Select.Value
            v-slots={{
              default: ({ value: values }: ValueSlotProps) => {
                children(values);
                return `Selected: ${Array.isArray(values) ? values.join(' + ') : values}`;
              },
            }}
          />
        </Select.Root>,
      );

      expect(children.mock.calls[0]?.[0]).toEqual(['sans', 'serif']);
      expect(screen.getByText('Selected: sans + serif')).not.toBe(null);
    });

    it('children prop takes precedence over items in multiple mode', async () => {
      const items = {
        sans: 'Sans-serif',
        serif: 'Serif',
      };

      await render(
        <Select.Root value={['sans', 'serif']} items={items} multiple>
          <Select.Value data-testid="value">Custom Multiple Text</Select.Value>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Custom Multiple Text');
    });

    it('defaults to empty array when no value is provided', async () => {
      const renderValue = vi.fn();

      await render(
        <Select.Root multiple>
          <Select.Value v-slots={{ default: ({ value }: ValueSlotProps) => renderValue(value) }} />
        </Select.Root>,
      );

      expect(renderValue.mock.calls[0]?.[0]).toEqual([]);
    });
  });

  describe('prop: placeholder', () => {
    it('displays placeholder when no value is selected', async () => {
      await render(
        <Select.Root>
          <Select.Value data-testid="value" placeholder="Select an option" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });

    it('displays placeholder when value is null', async () => {
      await render(
        <Select.Root value={null}>
          <Select.Value data-testid="value" placeholder="Select an option" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });

    it('children prop takes precedence over placeholder', async () => {
      await render(
        <Select.Root>
          <Select.Value data-testid="value" placeholder="Select an option">
            Custom Text
          </Select.Value>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Custom Text');
    });

    it('children function takes precedence over placeholder', async () => {
      await render(
        <Select.Root>
          <Select.Value
            data-testid="value"
            placeholder="Select an option"
            v-slots={{ default: ({ value }: ValueSlotProps) => value || 'Function fallback' }}
          />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Function fallback');
    });

    it('displays placeholder when object items do not have a null key', async () => {
      const items = {
        option1: 'Option 1',
        option2: 'Option 2',
      };

      await render(
        <Select.Root items={items}>
          <Select.Value data-testid="value" placeholder="Select an option" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });

    it('null key label in object items takes precedence over placeholder', async () => {
      const items = {
        null: 'None',
        option1: 'Option 1',
      };

      await render(
        <Select.Root items={items}>
          <Select.Value data-testid="value" placeholder="Select an option" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('None');
    });

    it('supports ReactNode as placeholder', async () => {
      await render(
        <Select.Root>
          <Select.Value
            data-testid="value"
            placeholder={() => <span data-testid="placeholder">Select an option</span>}
          />
        </Select.Root>,
      );

      expect(screen.getByTestId('placeholder')).toHaveTextContent('Select an option');
    });

    it('does not display placeholder when value is selected', async () => {
      await render(
        <Select.Root value="option1">
          <Select.Value data-testid="value" placeholder="Select an option" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="option1">Option 1</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('option1');
    });

    it('null item label in items takes precedence over placeholder', async () => {
      const items = [
        { value: null, label: 'None' },
        { value: 'option1', label: 'Option 1' },
      ];

      await render(
        <Select.Root items={items}>
          <Select.Value data-testid="value" placeholder="Select an option" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value={null}>None</Select.Item>
                <Select.Item value="option1">Option 1</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('None');
    });

    it('uses placeholder when items have null value without label', async () => {
      const items = [
        { value: null, label: null },
        { value: 'option1', label: 'Option 1' },
      ];

      await render(
        <Select.Root items={items}>
          <Select.Value data-testid="value" placeholder="Select an option" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value={null}>None</Select.Item>
                <Select.Item value="option1">Option 1</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Select an option');
    });
  });

  describe('#render slot', () => {
    it('shows the label of the value in the `children` component', async () => {
      await render(
        <Select.Root value="sans" items={{ sans: 'Sans-serif' }}>
          <Select.Value
            v-slots={{
              render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                <strong {...props} data-testid="value">
                  {h(children)}
                </strong>
              ),
            }}
          />
        </Select.Root>,
      );

      expect(screen.getByTestId('value').textContent).toBe('Sans-serif');
    });
  });

  // The compiled template of the fixture mounts the new value part before it unmounts the old
  // value part. A render function in TSX reuses the component, so it does not show this order.
  it('keeps the element of the new value part in the store when a template replaces the part', async () => {
    let store!: SelectStore;
    const { setProps } = await render(
      <SelectValueReplacement first onStore={(value: SelectStore) => (store = value)} />,
    );
    expect(store.context.valueRef.value).toBe(screen.getByTestId('first'));

    await setProps({ first: false });

    expect(store.context.valueRef.value).toBe(screen.getByTestId('second'));
  });

  describe('a value with no label', () => {
    it.each([
      { name: 'a multiple select with no value', root: { multiple: true } },
      { name: 'an empty string value', root: { defaultValue: '' } },
    ])('renders no text node for $name', async ({ root }) => {
      await render(
        <Select.Root {...root}>
          <Select.Value data-testid="value" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    });
  });
});
