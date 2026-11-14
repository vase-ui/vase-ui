import { describe, expect, it } from 'vitest';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';

async function type(text: string) {
  await fireEvent.input(screen.getByRole('combobox'), {
    target: { value: text },
    inputType: 'insertText',
  });
  await flushMicrotasks();
}

describe('<Autocomplete.Value />', () => {
  const { render } = createRenderer();

  it('shows the text of the input', async () => {
    await render(
      <Autocomplete.Root defaultValue="ma">
        <Autocomplete.Input />
        <span data-testid="value">
          <Autocomplete.Value />
        </span>
      </Autocomplete.Root>,
    );
    expect(screen.getByTestId('value').textContent).toBe('ma');

    await type('mal');

    expect(screen.getByTestId('value').textContent).toBe('mal');
  });

  it('gives the text to the default slot as value', async () => {
    await render(
      <Autocomplete.Root defaultValue="ma">
        <Autocomplete.Input />
        <span data-testid="value">
          <Autocomplete.Value
            v-slots={{ default: ({ value }: { value: string }) => `[${value}]` }}
          />
        </span>
      </Autocomplete.Root>,
    );
    expect(screen.getByTestId('value').textContent).toBe('[ma]');

    await type('mal');

    expect(screen.getByTestId('value').textContent).toBe('[mal]');
  });

  it('shows static slot content in the place of the text', async () => {
    await render(
      <Autocomplete.Root defaultValue="ma">
        <Autocomplete.Input />
        <span data-testid="value">
          <Autocomplete.Value>fixed</Autocomplete.Value>
        </span>
      </Autocomplete.Root>,
    );

    await type('mal');

    expect(screen.getByTestId('value').textContent).toBe('fixed');
  });

  it('leaves no text node for an empty value', async () => {
    await render(
      <Autocomplete.Root>
        <span data-testid="value">
          <Autocomplete.Value />
        </span>
      </Autocomplete.Root>,
    );

    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
  });

  describe('prop: children', () => {
    it('renders current input value via function child', async () => {
      await render(
        <Autocomplete.Root defaultValue="hel">
          <Autocomplete.Trigger>
            <Autocomplete.Value
              v-slots={{
                default: ({ value }: { value: string }) => <div data-testid="value">{value}</div>,
              }}
            />
          </Autocomplete.Trigger>
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="hello">hello</Autocomplete.Item>
                  <Autocomplete.Item value="help">help</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('hel');
    });

    it('renders function child with empty string when no value typed', async () => {
      await render(
        <Autocomplete.Root>
          <Autocomplete.Value
            v-slots={{
              default: ({ value }: { value: string }) => (
                <div data-testid="value">{value === '' ? 'empty' : value}</div>
              ),
            }}
          />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="a">a</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('empty');
    });

    it('overrides the display when children is a static ReactNode', async () => {
      await render(
        <Autocomplete.Root defaultValue="test-value">
          <Autocomplete.Value>Custom Display Text</Autocomplete.Value>
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="test-value">Test</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      expect(screen.getByText('Custom Display Text')).not.toBe(null);
    });

    it('renders complex ReactNode children', async () => {
      await render(
        <Autocomplete.Root defaultValue="test">
          <Autocomplete.Value>
            <span data-testid="complex">
              <strong>Bold</strong> and <em>italic</em> text
            </span>
          </Autocomplete.Value>
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="test">Test</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const element = screen.getByTestId('complex');
      expect(element.querySelector('strong')).toHaveTextContent('Bold');
      expect(element.querySelector('em')).toHaveTextContent('italic');
    });
  });
});
