import { describe, expect, it, vi } from 'vitest';
import { TimePicker } from '@vase-ui/vue/time-picker';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';

const time = (text: string) => Temporal.PlainTime.from(text);

const columnOf = (name: string) => within(screen.getByRole('listbox', { name }));
const hours = () => columnOf('hour');
const minutes = () => columnOf('minute');
const dayPeriods = () => columnOf('AM/PM');

describe('<TimePicker.ColumnItem />', () => {
  const { render } = createRenderer();

  // A column with one value mounts the vnode of the test one time.
  describeConformance(<TimePicker.ColumnItem value={0} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) =>
      render(
        <TimePicker.Root hourCycle={24}>
          <TimePicker.Column unit="hour" step={24} v-slots={{ item: () => node }} />
        </TimePicker.Root>,
      ),
  }));

  function renderColumns(rootProps: Record<string, unknown> = {}) {
    return render(
      <TimePicker.Root locale="en-US" hourCycle={12} {...rootProps}>
        <TimePicker.Column unit="hour" />
        <TimePicker.Column unit="minute" step={15} />
        <TimePicker.Column unit="dayPeriod" />
      </TimePicker.Root>,
    );
  }

  describe('a press', () => {
    it('sets the unit of the column, and keeps each other unit', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({ defaultValue: time('15:30:45'), onValueChange });

      await user.click(hours().getByRole('option', { name: '9' }));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('21:30:45');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('item-press');
      expect(hours().getByRole('option', { name: '9' })).toHaveAttribute('aria-selected', 'true');
      expect(hours().getByRole('option', { name: '3' })).toHaveAttribute('aria-selected', 'false');
    });

    it.each([
      { name: 'a minute', column: minutes, option: '45', from: '15:30:20', to: '15:45:20' },
      {
        name: 'the day period PM',
        column: dayPeriods,
        option: 'PM',
        from: '09:30',
        to: '21:30:00',
      },
      {
        name: 'the day period AM',
        column: dayPeriods,
        option: 'AM',
        from: '21:30',
        to: '09:30:00',
      },
      {
        name: 'the hour 12 at the start of the day',
        column: hours,
        option: '12',
        from: '09:30',
        to: '00:30:00',
      },
      { name: 'the hour 12 at noon', column: hours, option: '12', from: '21:30', to: '12:30:00' },
    ])('sets $name', async ({ column, option, from, to }) => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({ defaultValue: time(from), onValueChange });

      await user.click(column().getByRole('option', { name: option }));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe(to);
    });

    it('sets an hour of a 24-hour cycle', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({
        hourCycle: 24,
        defaultValue: time('15:30'),
        onValueChange,
      });

      await user.click(hours().getByRole('option', { name: '07' }));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('07:30:00');
    });

    it('keeps the kind, the date and the zone of the value', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({
        defaultValue: Temporal.ZonedDateTime.from('2026-11-14T15:30[Asia/Tokyo]'),
        onValueChange,
      });

      await user.click(minutes().getByRole('option', { name: '45' }));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe(
        '2026-11-14T15:45:00+09:00[Asia/Tokyo]',
      );
    });

    it('starts at midnight while the picker has no value', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({ onValueChange });

      await user.click(minutes().getByRole('option', { name: '45' }));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('00:45:00');
    });

    it('starts at the reference date while the picker has no value, and gives its kind', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({
        referenceDate: Temporal.PlainDateTime.from('2026-11-20T09:00'),
        onValueChange,
      });

      await user.click(minutes().getByRole('option', { name: '45' }));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-11-20T09:45:00');
    });

    it('gives no value for the selected item', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({ defaultValue: time('15:30'), onValueChange });

      await user.click(minutes().getByRole('option', { name: '30' }));

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does nothing in a read-only picker', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TimePicker.Root locale="en-US" hourCycle={24} readOnly onValueChange={onValueChange}>
          <TimePicker.Column unit="hour" step={12} />
        </TimePicker.Root>,
      );

      await user.click(screen.getAllByRole('option')[1]!);

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does nothing for a disabled item', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TimePicker.Root locale="en-US" hourCycle={24} onValueChange={onValueChange}>
          <TimePicker.Column
            unit="hour"
            step={12}
            v-slots={{
              item: ({ value }: { value: number | 'am' | 'pm' }) => (
                <TimePicker.ColumnItem value={value} disabled />
              ),
            }}
          />
        </TimePicker.Root>,
      );

      const option = screen.getAllByRole('option')[1]!;
      await user.click(option);

      expect(option).toHaveAttribute('aria-disabled', 'true');
      expect(option).toHaveAttribute('data-disabled');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('keeps the value when a listener cancels the change', async () => {
      const { user } = await renderColumns({
        defaultValue: time('15:30'),
        onValueChange: (_value: unknown, details: { cancel: () => void }) => {
          details.cancel();
        },
      });

      await user.click(minutes().getByRole('option', { name: '45' }));
      await flushMicrotasks();

      expect(minutes().getByRole('option', { name: '30' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('selects the focused item with Enter and with Space', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({ defaultValue: time('15:30'), onValueChange });
      await user.tab();
      await user.tab();

      await user.keyboard('{ArrowDown}{Enter}');
      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('15:45:00');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('item-press');

      await user.keyboard('{ArrowUp} ');
      await waitFor(() => {
        expect(onValueChange.mock.lastCall?.[0].toString()).toBe('15:30:00');
      });
    });
  });

  describe('the limits of the picker', () => {
    const limits = { minTime: time('09:30'), maxTime: time('17:45') };

    it('disables an hour that has no time in the limits', async () => {
      await renderColumns({ ...limits, hourCycle: 24, defaultValue: time('12:00') });

      expect(hours().getByRole('option', { name: '08' })).toHaveAttribute('aria-disabled', 'true');
      expect(hours().getByRole('option', { name: '09' })).not.toHaveAttribute('aria-disabled');
      expect(hours().getByRole('option', { name: '17' })).not.toHaveAttribute('aria-disabled');
      expect(hours().getByRole('option', { name: '18' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('disables a minute that is before minTime, in the hour of the time', async () => {
      await renderColumns({ ...limits, defaultValue: time('09:00') });

      expect(minutes().getByRole('option', { name: '00' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(minutes().getByRole('option', { name: '15' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(minutes().getByRole('option', { name: '30' })).not.toHaveAttribute('aria-disabled');
      expect(minutes().getByRole('option', { name: '45' })).not.toHaveAttribute('aria-disabled');
    });

    it('disables a minute that is after maxTime', async () => {
      await renderColumns({
        ...limits,
        minTime: undefined,
        maxTime: time('17:20'),
        defaultValue: time('17:00'),
      });

      expect(minutes().getByRole('option', { name: '15' })).not.toHaveAttribute('aria-disabled');
      expect(minutes().getByRole('option', { name: '30' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('disables a day period that has no time in the limits', async () => {
      await renderColumns({ minTime: time('13:00'), defaultValue: time('15:00') });

      expect(dayPeriods().getByRole('option', { name: 'AM' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(dayPeriods().getByRole('option', { name: 'PM' })).not.toHaveAttribute('aria-disabled');
    });

    it('moves the time into the limits when the hour has times out of them', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({
        ...limits,
        hourCycle: 24,
        defaultValue: time('12:00'),
        onValueChange,
      });

      await user.click(hours().getByRole('option', { name: '09' }));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('09:30:00');
    });

    it('does nothing for a disabled hour', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderColumns({
        ...limits,
        hourCycle: 24,
        defaultValue: time('12:00'),
        onValueChange,
      });

      await user.click(hours().getByRole('option', { name: '08' }));

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <TimePicker.Column>', async () => {
    await expect(
      render(
        <TimePicker.Root>
          <TimePicker.ColumnItem value={3} />
        </TimePicker.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <TimePicker.ColumnItem> must be inside <TimePicker.Column>. Without a column the item has no unit to set. Put the item inside <TimePicker.Column>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
