import { describe, expect, it, vi } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { createRenderer, fireEvent, screen, wait } from '#test-utils';

describe('picker fields', () => {
  const { render } = createRenderer();
  const date = Temporal.PlainDate.from('2026-11-14');

  it.each([
    { name: 'a composition key', init: { isComposing: true } },
    { name: 'key code 229', init: { keyCode: 229 } },
  ])('leaves Alt+Down to the input method for $name', async ({ init }) => {
    const onOpenChange = vi.fn();
    const { container, user } = await render(
      <DatePicker.Root defaultValue={date} onOpenChange={onOpenChange}>
        <DatePicker.Field>
          <DateField.Input />
        </DatePicker.Field>
        <DatePicker.Trigger>Choose</DatePicker.Trigger>
      </DatePicker.Root>,
    );
    const day = container.querySelector<HTMLInputElement>('input[data-type="day"]')!;
    const trigger = screen.getByRole('button');
    day.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      altKey: true,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    await fireEvent(day, event);

    expect(event.defaultPrevented).toBe(false);
    expect(day).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('reports one native reset when two fields share a picker', async () => {
    const change = vi.fn();
    const update = vi.fn();
    const { container } = await render(
      <form data-testid="form">
        <DatePicker.Root
          defaultValue={date}
          name="day"
          onValueChange={change}
          onUpdate:modelValue={update}
        >
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
        </DatePicker.Root>
      </form>,
    );
    const form = screen.getByTestId<HTMLFormElement>('form');
    const input = container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
    await fireEvent.input(input, { target: { value: '2026-11-20' } });
    expect(new FormData(form).getAll('day')).toEqual(['2026-11-20', '2026-11-20']);
    change.mockClear();
    update.mockClear();

    form.reset();
    await wait(0);
    expect(change).toHaveBeenCalledExactlyOnceWith(
      date,
      expect.objectContaining({ reason: 'none' }),
    );
    expect(update).toHaveBeenCalledExactlyOnceWith(date);
    expect(new FormData(form).getAll('day')).toEqual(['2026-11-14', '2026-11-14']);
  });
});
