import { describe, expect, it, vi } from 'vitest';
import { TimeField } from '@vase-ui/vue/time-field';
import { createRenderer, describeConformance, screen } from '#test-utils';

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

  it('has the text Clear, and the default slot replaces it', async () => {
    await render(
      <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')}>
        <TimeField.Clear data-testid="default" />
        <TimeField.Clear data-testid="own">{{ default: () => 'Reset' }}</TimeField.Clear>
      </TimeField.Root>,
    );

    expect(screen.getByTestId('default')).toHaveAccessibleName('Clear');
    expect(screen.getByTestId('own')).toHaveAccessibleName('Reset');
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

  it('is enabled for a field with a value', async () => {
    await render(<Field defaultValue={Temporal.PlainTime.from('15:04')} />);
    const button = screen.getByRole('button', { name: 'Clear' });

    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('data-disabled');
  });
});
