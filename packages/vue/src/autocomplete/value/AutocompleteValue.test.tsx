import { describe, expect, it } from 'vitest';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import * as Autocomplete from '../index.parts';

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
});
