import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { TimeField } from '@vase-ui/vue/time-field';
import { createRenderer, describeConformance, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';

describe('<TimeField.Clear />', () => {
  const { render } = createRenderer();

  describeConformance(<TimeField.Clear />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render: (node) =>
      render(
        <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')}>
          <TimeField.Input />
          {node}
        </TimeField.Root>,
      ),
  }));

  function Field(props: Record<string, unknown>) {
    return (
      <TimeField.Root locale="en-US" {...props}>
        <TimeField.Input />
        <TimeField.Clear />
      </TimeField.Root>
    );
  }

  it('shows x with the name Clear, and the default slot replaces both', async () => {
    await render(
      <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')}>
        <TimeField.Clear data-testid="default" />
        <TimeField.Clear data-testid="text">{{ default: () => 'Reset' }}</TimeField.Clear>
        <TimeField.Clear data-testid="own" aria-label="Clear the alarm">
          {{ default: () => '\u00d7' }}
        </TimeField.Clear>
      </TimeField.Root>,
    );

    expect(screen.getByTestId('default')).toHaveTextContent('x');
    expect(screen.getByTestId('default')).toHaveAccessibleName('Clear');
    expect(screen.getByTestId('text')).toHaveAccessibleName('Reset');
    expect(screen.getByTestId('own')).toHaveAccessibleName('Clear the alarm');
  });

  it('shows x in the children component of the #render slot', async () => {
    await render(
      <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')}>
        <TimeField.Clear>
          {{
            render: ({ props, children }: { props: HTMLProps; children: Component }) => (
              <button {...props} data-testid="own">
                {h(children)}
              </button>
            ),
          }}
        </TimeField.Clear>
      </TimeField.Root>,
    );

    expect(screen.getByTestId('own')).toHaveTextContent('x');
  });

  it('empties the field with the reason clear-press, and gives the focus to the first segment', async () => {
    const onValueChange = vi.fn();
    const { container, user } = await render(
      <Field defaultValue={Temporal.PlainTime.from('15:04')} onValueChange={onValueChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0]).toBe(null);
    expect(onValueChange.mock.calls[0]![1].reason).toBe('clear-press');
    expect(container.querySelector('input[data-type="hour"]')).toHaveFocus();
    expect(container.querySelector('input[data-type="hour"]')).toHaveValue('');
  });

  it.each([
    { name: 'an empty field', value: false, props: {}, clearProps: {} },
    { name: 'a disabled field', value: true, props: { disabled: true }, clearProps: {} },
    { name: 'a read-only field', value: true, props: { readOnly: true }, clearProps: {} },
    { name: 'the disabled prop', value: true, props: {}, clearProps: { disabled: true } },
  ])('is disabled for $name', async ({ value, props, clearProps }) => {
    await render(
      <TimeField.Root
        locale="en-US"
        defaultValue={value ? Temporal.PlainTime.from('15:04') : undefined}
        {...props}
      >
        <TimeField.Input />
        <TimeField.Clear {...clearProps} />
      </TimeField.Root>,
    );
    const button = screen.getByRole('button', { name: 'Clear', hidden: true });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-disabled');
  });

  it('does not empty a read-only field for a press on an element that is not a native button', async () => {
    const onValueChange = vi.fn();
    const { user } = await render(
      <TimeField.Root
        readOnly
        defaultValue={Temporal.PlainTime.from('15:04')}
        onValueChange={onValueChange}
      >
        <TimeField.Input />
        <TimeField.Clear as="div" nativeButton={false} data-testid="clear" />
      </TimeField.Root>,
    );

    await user.click(screen.getByTestId('clear'));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('is enabled for a field with a value', async () => {
    await render(<Field defaultValue={Temporal.PlainTime.from('15:04')} />);
    const button = screen.getByRole('button', { name: 'Clear' });

    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('data-disabled');
  });
});
