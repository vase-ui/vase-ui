import { describe, expect, it, vi } from 'vitest';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { createRenderer, describeConformance, flushMicrotasks, screen, waitFor } from '#test-utils';
import { formatText } from '../../internals/date-time/calendar/formatText';

const time = (text: string) => Temporal.PlainTime.from(text);

const timeText = (value: string, options: Intl.DateTimeFormatOptions = {}, locale = 'en-US') =>
  formatText(time(value), { hour: 'numeric', minute: '2-digit', ...options }, locale);

const optionOf = (text: string) => screen.getByRole('option', { name: timeText(text) });

describe('<TimePicker.Item />', () => {
  const { render } = createRenderer();

  // A list with one time mounts the vnode of the test one time.
  describeConformance(<TimePicker.Item time={time('09:30')} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) =>
      render(
        <TimePicker.Root>
          <TimePicker.List step={1440} v-slots={{ item: () => node }} />
        </TimePicker.Root>,
      ),
  }));

  function renderList(
    rootProps: Record<string, unknown> = {},
    listProps: Record<string, unknown> = {},
  ) {
    return render(
      <TimePicker.Root locale="en-US" {...rootProps}>
        <TimePicker.List step={60} {...listProps} />
      </TimePicker.Root>,
    );
  }

  describe('state', () => {
    it('is an option with the time as its name', async () => {
      await renderList();

      expect(optionOf('09:00')).toHaveAttribute('aria-selected', 'false');
      expect(optionOf('09:00')).not.toHaveAttribute('data-selected');
    });

    it('is selected when it has the time of the picker', async () => {
      await renderList({ defaultValue: time('09:00') });

      expect(optionOf('09:00')).toHaveAttribute('aria-selected', 'true');
      expect(optionOf('09:00')).toHaveAttribute('data-selected');
      expect(optionOf('10:00')).toHaveAttribute('aria-selected', 'false');
    });

    it.each([
      { name: 'a date and time', value: Temporal.PlainDateTime.from('2026-11-14T09:00') },
      {
        name: 'a zoned date and time',
        value: Temporal.ZonedDateTime.from('2026-11-14T09:00[UTC]'),
      },
    ])('is selected for $name that has the time of the item', async ({ value }) => {
      await renderList({ defaultValue: value });

      expect(optionOf('09:00')).toHaveAttribute('aria-selected', 'true');
    });

    it('is not selected for a time with seconds', async () => {
      await renderList({ defaultValue: time('09:00:30') });

      expect(screen.queryAllByRole('option', { selected: true })).toHaveLength(0);
    });

    it('follows the value of a controlled picker', async () => {
      const { setProps } = await render(
        <TimePicker.Root locale="en-US" modelValue={time('09:00')}>
          <TimePicker.List step={60} />
        </TimePicker.Root>,
      );

      await setProps({ modelValue: time('11:00') });

      expect(optionOf('09:00')).toHaveAttribute('aria-selected', 'false');
      expect(optionOf('11:00')).toHaveAttribute('aria-selected', 'true');
    });

    it('is disabled with the prop', async () => {
      await render(
        <TimePicker.Root locale="en-US">
          <TimePicker.List
            step={720}
            v-slots={{
              item: ({ time: itemTime, index }: { time: Temporal.PlainTime; index: number }) => (
                <TimePicker.Item time={itemTime} disabled={index === 1} />
              ),
            }}
          />
        </TimePicker.Root>,
      );

      const [first, second] = screen.getAllByRole('option');
      expect(first).not.toHaveAttribute('aria-disabled');
      expect(second).toHaveAttribute('aria-disabled', 'true');
      expect(second).toHaveAttribute('data-disabled');
    });

    it('is disabled in a disabled picker', async () => {
      await renderList({ disabled: true });

      for (const option of screen.getAllByRole('option')) {
        expect(option).toHaveAttribute('aria-disabled', 'true');
      }
    });

    it('gives the text to the slot of the default content', async () => {
      await render(
        <TimePicker.Root locale="en-US">
          <TimePicker.List
            step={720}
            v-slots={{
              item: ({ time: itemTime }: { time: Temporal.PlainTime }) => (
                <TimePicker.Item
                  time={itemTime}
                  v-slots={{ default: ({ text }: { text: string }) => <b>{`at ${text}`}</b> }}
                />
              ),
            }}
          />
        </TimePicker.Root>,
      );

      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        `at ${timeText('00:00')}`,
        `at ${timeText('12:00')}`,
      ]);
    });
  });

  describe('a press', () => {
    it('gives the time to the picker with the reason item-press', async () => {
      const onValueChange = vi.fn();
      const onUpdateValue = vi.fn();
      const { user } = await renderList({ onValueChange, 'onUpdate:modelValue': onUpdateValue });

      await user.click(optionOf('14:00'));

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('14:00:00');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('item-press');
      expect(onUpdateValue.mock.lastCall?.[0].toString()).toBe('14:00:00');
      expect(optionOf('14:00')).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps the kind, the date and the zone of the value', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderList({
        defaultValue: Temporal.ZonedDateTime.from('2026-11-14T09:00[Asia/Tokyo]'),
        onValueChange,
      });

      await user.click(optionOf('14:00'));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe(
        '2026-11-14T14:00:00+09:00[Asia/Tokyo]',
      );
    });

    it('gives a value of the kind of the reference date while the picker has no value', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderList({
        referenceDate: Temporal.PlainDateTime.from('2026-11-20T00:00'),
        onValueChange,
      });

      await user.click(optionOf('14:00'));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-11-20T14:00:00');
    });

    it('gives a value of the kind of the last value after the picker is emptied', async () => {
      const onValueChange = vi.fn();
      const { user, setProps } = await render(
        <TimePicker.Root
          locale="en-US"
          modelValue={Temporal.PlainDateTime.from('2026-11-14T09:00')}
          onValueChange={onValueChange}
        >
          <TimePicker.List step={60} />
        </TimePicker.Root>,
      );
      await setProps({ modelValue: null });

      await user.click(optionOf('14:00'));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-11-14T14:00:00');
    });

    it('does not give a value for the selected item', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderList({ defaultValue: time('09:00'), onValueChange });

      await user.click(optionOf('09:00'));

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does nothing for a disabled item', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TimePicker.Root locale="en-US" onValueChange={onValueChange}>
          <TimePicker.List
            step={720}
            v-slots={{
              item: ({ time: itemTime }: { time: Temporal.PlainTime }) => (
                <TimePicker.Item time={itemTime} disabled />
              ),
            }}
          />
        </TimePicker.Root>,
      );

      await user.click(screen.getAllByRole('option')[1]!);

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does nothing in a read-only picker', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderList({ readOnly: true, onValueChange });

      await user.click(optionOf('14:00'));

      expect(onValueChange).not.toHaveBeenCalled();
      expect(optionOf('14:00')).toHaveAttribute('aria-selected', 'false');
    });

    it('keeps the value when a listener cancels the change', async () => {
      const { user } = await renderList({
        defaultValue: time('09:00'),
        onValueChange: (_value: unknown, details: { cancel: () => void }) => {
          details.cancel();
        },
      });

      await user.click(optionOf('14:00'));
      await flushMicrotasks();

      expect(optionOf('09:00')).toHaveAttribute('aria-selected', 'true');
      expect(optionOf('14:00')).toHaveAttribute('aria-selected', 'false');
    });

    it('gives no change of a controlled picker, and leaves the decision to the parent', async () => {
      const onUpdateValue = vi.fn();
      const { user } = await renderList({
        modelValue: time('09:00'),
        'onUpdate:modelValue': onUpdateValue,
      });

      await user.click(optionOf('14:00'));

      expect(onUpdateValue.mock.lastCall?.[0].toString()).toBe('14:00:00');
      expect(optionOf('09:00')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('keys', () => {
    it.each(['{Enter}', ' '])('selects the focused item with %j', async (key) => {
      const onValueChange = vi.fn();
      const { user } = await renderList({ onValueChange, defaultValue: time('09:00') });
      await user.tab();
      await user.keyboard('{ArrowDown}');

      await user.keyboard(key);

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('10:00:00');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('item-press');
      await waitFor(() => {
        expect(optionOf('10:00')).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('does not select an item for a key in an element inside it', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TimePicker.Root locale="en-US" onValueChange={onValueChange}>
          <TimePicker.List
            step={720}
            v-slots={{
              item: ({ time: itemTime }: { time: Temporal.PlainTime }) => (
                <TimePicker.Item time={itemTime}>
                  <input aria-label="Note" />
                </TimePicker.Item>
              ),
            }}
          />
        </TimePicker.Root>,
      );
      const [note] = screen.getAllByRole('textbox', { name: 'Note' });
      note!.focus();

      await user.keyboard(' ');

      expect(note).toHaveValue(' ');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });
});
