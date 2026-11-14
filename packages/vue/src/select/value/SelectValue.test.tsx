import { expect, vi, describe, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Select from '../index.parts';

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
          <Select.Value
            v-slots={{ default: ({ value }: ValueSlotProps) => renderValue(value) }}
          />
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
  });

  describe('children of the #render slot', () => {
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

    it('renders no text node when it has no label to show', async () => {
      await render(
        <Select.Root multiple>
          <Select.Value data-testid="value" />
        </Select.Root>,
      );

      expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    });
  });
});
