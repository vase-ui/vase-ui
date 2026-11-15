import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { createRenderer, describeConformance, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import { REASONS } from '../../internals/reasons';

const DAY = Temporal.PlainDate.from('2026-11-14');

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;

describe('<DateField.Clear />', () => {
  const { render } = createRenderer();

  describeConformance(<DateField.Clear />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render(node) {
      return render(
        <DateField.Root defaultValue={DAY}>
          <DateField.Input />
          {node}
        </DateField.Root>,
      );
    },
  }));

  it('empties the field with the reason clear-press, and gives the focus to the first segment', async () => {
    const onValueChange = vi.fn();
    const { container, user } = await render(
      <DateField.Root defaultValue={DAY} locale="en-US" onValueChange={onValueChange}>
        <DateField.Input />
        <DateField.Clear />
      </DateField.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall![0]).toBe(null);
    expect(onValueChange.mock.lastCall![1].reason).toBe(REASONS.clearPress);
    expect(container.querySelector('input[aria-hidden]')).toHaveValue('');
    expect(segmentOf(container, 'month')).toHaveFocus();
  });

  // The button has the state of its field, so a style rule can hide it for an empty field.
  it.each([
    { name: 'the field is empty', props: {} },
    { name: 'the field is disabled', props: { defaultValue: DAY, disabled: true } },
    { name: 'the field is read-only', props: { defaultValue: DAY, readOnly: true } },
  ] as const)('is disabled while $name', async ({ props }) => {
    await render(
      <DateField.Root {...props}>
        <DateField.Input />
        <DateField.Clear />
      </DateField.Root>,
    );

    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('shows an x that the aria-label Clear names, and shows its own content with no label', async () => {
    await render(
      <DateField.Root defaultValue={DAY}>
        <DateField.Clear data-testid="own">Reset</DateField.Clear>
        <DateField.Clear data-testid="default" />
      </DateField.Root>,
    );

    expect(screen.getByTestId('default')).toHaveTextContent('x');
    expect(screen.getByTestId('default')).toHaveAttribute('aria-label', 'Clear');
    expect(screen.getByTestId('own')).toHaveTextContent('Reset');
    expect(screen.getByTestId('own')).not.toHaveAttribute('aria-label');
  });

  it('shows x in the children component of the #render slot', async () => {
    await render(
      <DateField.Root defaultValue={DAY}>
        <DateField.Clear
          data-testid="clear"
          v-slots={{
            render: ({ props, children }: { props: HTMLProps; children: Component }) => (
              <button {...props}>{h(children)}</button>
            ),
          }}
        />
      </DateField.Root>,
    );

    expect(screen.getByTestId('clear').textContent).toBe('x');
  });
});
