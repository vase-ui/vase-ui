import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { createRenderer, describeConformance, screen, waitFor } from '#test-utils';
import DatePickerAnatomy from '../root/DatePickerAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);
const today = () => day('2026-11-14');

const dayButton = (iso: string) =>
  document.querySelector<HTMLElement>(`[data-date="${iso}"] button`)!;
const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const hiddenInputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[aria-hidden]')!;

describe('<DatePicker.Calendar />', () => {
  const { render } = createRenderer();

  describeConformance(<DatePicker.Calendar />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<DatePicker.Root>{node}</DatePicker.Root>);
    },
  }));

  function renderPicker(props: Record<string, unknown> = {}) {
    return render(
      <DatePickerAnatomy
        {...{ locale: 'en-US', timeZone: 'UTC', calendarProps: { today: today() }, ...props }}
      />,
    );
  }

  // The popup is open at the mount, so the part is in the document.
  function renderOpen(props: Record<string, unknown> = {}) {
    return renderPicker({ defaultOpen: true, ...props });
  }

  it('shows the value of the picker as the selected day', async () => {
    await renderOpen({ defaultValue: day('2026-11-18') });

    await waitFor(() => {
      expect(dayButton('2026-11-18').closest('[data-date]')).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(
      screen
        .getAllByRole('gridcell')
        .filter((cell) => cell.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(1);
  });

  it('gives a press on a day to the picker, with the reason of the calendar', async () => {
    const onValueChange = vi.fn();
    const { user, container } = await renderOpen({
      defaultValue: day('2026-11-18'),
      closeOnSelect: false,
      onValueChange,
    });
    await waitFor(() => {
      expect(dayButton('2026-11-20')).not.toBe(null);
    });

    await user.click(dayButton('2026-11-20'));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-11-20');
    expect(onValueChange.mock.lastCall?.[1].reason).toBe('day-press');
    expect(segmentOf(container, 'day').value).toBe('20');
    expect(hiddenInputOf(container).value).toBe('2026-11-20');
  });

  it('keeps the value when a listener cancels the change', async () => {
    const { user, container } = await renderOpen({
      defaultValue: day('2026-11-18'),
      closeOnSelect: false,
      onValueChange: (_value: unknown, details: { cancel: () => void }) => {
        details.cancel();
      },
    });
    await waitFor(() => {
      expect(dayButton('2026-11-20')).not.toBe(null);
    });

    await user.click(dayButton('2026-11-20'));

    expect(hiddenInputOf(container).value).toBe('2026-11-18');
    expect(dayButton('2026-11-18').closest('[data-date]')).toHaveAttribute('aria-selected', 'true');
  });

  describe('the picker owns the limits', () => {
    it('disables the days outside `minDate` and `maxDate`, and the field gets the same limits', async () => {
      const { container } = await renderOpen({
        defaultValue: day('2026-11-18'),
        minDate: day('2026-11-10'),
        maxDate: day('2026-11-20'),
      });

      await waitFor(() => {
        expect(dayButton('2026-11-09')).toBeDisabled();
      });
      expect(dayButton('2026-11-10')).not.toBeDisabled();
      expect(dayButton('2026-11-20')).not.toBeDisabled();
      expect(dayButton('2026-11-21')).toBeDisabled();
      expect(hiddenInputOf(container)).toHaveAttribute('min', '2026-11-10');
      expect(hiddenInputOf(container)).toHaveAttribute('max', '2026-11-20');
    });

    it('marks the unavailable days, and makes the field invalid for one of them', async () => {
      const { container } = await renderOpen({
        defaultValue: day('2026-11-14'),
        // Saturday and Sunday.
        unavailableDates: { dayOfWeek: [6, 7] },
      });

      await waitFor(() => {
        expect(dayButton('2026-11-15')).toHaveAttribute('aria-disabled', 'true');
      });
      expect(dayButton('2026-11-16')).not.toHaveAttribute('aria-disabled');
      expect(hiddenInputOf(container).validationMessage).not.toBe('');
    });

    it('is disabled and read-only with the picker', async () => {
      await renderOpen({ defaultValue: day('2026-11-18'), disabled: true });

      await waitFor(() => {
        expect(screen.getByTestId('calendar')).toHaveAttribute('data-disabled');
      });
      expect(dayButton('2026-11-20')).toBeDisabled();
    });
  });

  describe('kind of a new value', () => {
    // The field and the calendar make a value of the same kind and of the same time.
    it.each([
      { name: 'a date', props: {}, expected: '2026-11-20' },
      {
        name: 'a date with a time, for a granularity of minutes',
        props: { granularity: 'minute' },
        expected: '2026-11-20T00:00:00',
      },
      {
        name: 'a date with a time at the time of the reference date',
        props: {
          granularity: 'minute',
          referenceDate: Temporal.PlainDateTime.from('2026-01-01T09:30'),
        },
        expected: '2026-11-20T09:30:00',
      },
      {
        name: 'a date with a time in the zone of the reference date',
        props: {
          granularity: 'minute',
          referenceDate: Temporal.ZonedDateTime.from('2026-01-01T09:30[Asia/Tokyo]'),
        },
        expected: '2026-11-20T09:30:00+09:00[Asia/Tokyo]',
      },
    ])('is $name when the picker has no value', async ({ props, expected }) => {
      const onValueChange = vi.fn();
      const { user } = await renderOpen({ onValueChange, closeOnSelect: false, ...props });
      await waitFor(() => {
        expect(dayButton('2026-11-20')).not.toBe(null);
      });

      await user.click(dayButton('2026-11-20'));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe(expected);
    });

    it('keeps the kind of the last value after the value goes', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: Temporal.ZonedDateTime.from('2026-11-18T09:30[Asia/Tokyo]'),
        closeOnSelect: false,
        onValueChange,
      });

      segmentOf(container, 'month').focus();
      await user.keyboard('{Backspace}{Backspace}');
      await waitFor(() => {
        expect(hiddenInputOf(container).value).toBe('');
      });
      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(dayButton('2026-11-20')).not.toBe(null);
      });
      await user.click(dayButton('2026-11-20'));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe(
        '2026-11-20T09:30:00+09:00[Asia/Tokyo]',
      );
    });
  });
});
