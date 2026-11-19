import { describe, expect, it } from 'vitest';
import { TimePicker } from '@vase-ui/vue/time-picker';
import {
  createRenderer,
  describeConformance,
  heldMountListTests,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { formatText } from '../../internals/date-time/calendar/formatText';

const time = (text: string) => Temporal.PlainTime.from(text);

// The text of an item follows the options of the part.
const timeText = (
  value: string | Temporal.PlainTime,
  options: Intl.DateTimeFormatOptions = {},
  locale = 'en-US',
) =>
  formatText(
    typeof value === 'string' ? time(value) : value,
    { hour: 'numeric', minute: '2-digit', ...options },
    locale,
  );

const optionTexts = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('<TimePicker.List />', () => {
  const { render } = createRenderer();

  describeConformance(<TimePicker.List />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<TimePicker.Root>{node}</TimePicker.Root>),
  }));

  heldMountListTests({
    render,
    renderList: (withLastItem) => (
      <TimePicker.Root locale="en-US">
        <TimePicker.List
          step={360}
          v-slots={{
            item: ({ time: itemTime, index }: { time: Temporal.PlainTime; index: number }) =>
              index < 3 || withLastItem ? <TimePicker.Item time={itemTime} /> : null,
          }}
        />
      </TimePicker.Root>
    ),
    async check(user) {
      screen.getByRole('option', { name: timeText('00:00') }).focus();
      await user.keyboard('{End}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: timeText('18:00') })).toHaveFocus();
      });
    },
  });

  function renderList(
    listProps: Record<string, unknown> = {},
    rootProps: Record<string, unknown> = {},
  ) {
    return render(
      <TimePicker.Root locale="en-US" {...rootProps}>
        <TimePicker.List {...listProps} />
      </TimePicker.Root>,
    );
  }

  describe('name and state', () => {
    it('is a listbox with a default name', async () => {
      await renderList();

      expect(screen.getByRole('listbox', { name: 'Time' })).not.toBe(null);
    });

    it('takes the name that the consumer gives', async () => {
      await renderList({ 'aria-label': 'Start time' });

      expect(screen.getByRole('listbox', { name: 'Start time' })).not.toBe(null);
    });

    it('has the states of the picker as attributes', async () => {
      await renderList({}, { disabled: true, readOnly: true });

      const list = screen.getByRole('listbox');
      expect(list).toHaveAttribute('aria-disabled', 'true');
      expect(list).toHaveAttribute('aria-readonly', 'true');
      expect(list).toHaveAttribute('data-disabled');
      expect(list).toHaveAttribute('data-readonly');
    });

    it('has no state attribute for a picker that the user can change', async () => {
      await renderList();

      const list = screen.getByRole('listbox');
      expect(list).not.toHaveAttribute('aria-disabled');
      expect(list).not.toHaveAttribute('aria-readonly');
      expect(list).not.toHaveAttribute('data-disabled');
      expect(list).not.toHaveAttribute('data-readonly');
    });
  });

  describe('the times', () => {
    it('has a time for each half hour of the day', async () => {
      await renderList();

      const expected = Array.from({ length: 48 }, (_, place) =>
        timeText(time('00:00').add({ minutes: place * 30 })),
      );
      expect(optionTexts()).toEqual(expected);
    });

    it.each([
      { step: 15, count: 96 },
      { step: 60, count: 24 },
      { step: 90, count: 16 },
      { step: 1440, count: 1 },
    ])('has $count times for a step of $step minutes', async ({ step, count }) => {
      await renderList({ step });

      expect(screen.getAllByRole('option')).toHaveLength(count);
    });

    it('starts at minTime, goes on by the step and ends at maxTime', async () => {
      await renderList({ step: 45 }, { minTime: time('09:15'), maxTime: time('10:45') });

      expect(optionTexts()).toEqual([timeText('09:15'), timeText('10:00'), timeText('10:45')]);
    });

    it.each([
      { step: 1, min: '23:58:30', expected: ['23:58:30', '23:59:30'] },
      { step: 30, min: '23:00:30', expected: ['23:00:30', '23:30:30'] },
    ])('keeps the seconds of the minimum for a step of $step', async ({ step, min, expected }) => {
      await render(
        <TimePicker.Root minTime={time(min)}>
          <TimePicker.List
            step={step}
            v-slots={{
              item: ({ time: option }: { time: Temporal.PlainTime }) => (
                <span data-testid="time">{option.toString()}</span>
              ),
            }}
          />
        </TimePicker.Root>,
      );

      expect(screen.getAllByTestId('time').map((option) => option.textContent)).toEqual(expected);
    });

    it('ends at the last time before maxTime when the step does not reach it', async () => {
      await renderList({ step: 30 }, { minTime: time('09:00'), maxTime: time('10:20') });

      expect(optionTexts()).toEqual([timeText('09:00'), timeText('09:30'), timeText('10:00')]);
    });

    it('has no time when minTime is after maxTime', async () => {
      await renderList({}, { minTime: time('11:00'), maxTime: time('10:00') });

      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });

    it('ends at the last time of the day with no maxTime', async () => {
      await renderList({ step: 60 }, { minTime: time('20:00') });

      expect(optionTexts()).toEqual(
        ['20:00', '21:00', '22:00', '23:00'].map((text) => timeText(text)),
      );
    });

    it('formats the times in the hour cycle and the locale of the picker', async () => {
      await renderList({ step: 360 }, { hourCycle: 24 });

      expect(optionTexts()).toEqual(
        ['00:00', '06:00', '12:00', '18:00'].map((text) => timeText(text, { hourCycle: 'h23' })),
      );
    });

    it('follows the locale of the picker', async () => {
      await renderList({ step: 720 }, { locale: 'ja-JP' });

      expect(optionTexts()).toEqual(['00:00', '12:00'].map((text) => timeText(text, {}, 'ja-JP')));
    });

    it.each([0, -5, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'warns for the step %s and uses a step of 30',
      async (step) => {
        await renderList({ step });

        expect(screen.getAllByRole('option')).toHaveLength(48);
        expect(takeReportedMessages()).toEqual([
          'console.warn: Vase UI: TimePicker.List `step` must be a whole number of minutes above 0. The list uses a step of 30 minutes instead. Set `step` to a whole number above 0.',
        ]);
      },
    );

    it('gives each time and its index to the slot item', async () => {
      await render(
        <TimePicker.Root locale="en-US">
          <TimePicker.List
            step={720}
            v-slots={{
              item: ({ time: itemTime, index }: { time: Temporal.PlainTime; index: number }) => (
                <TimePicker.Item time={itemTime} data-index={index} />
              ),
            }}
          />
        </TimePicker.Root>,
      );

      expect(
        screen.getAllByRole('option').map((option) => option.getAttribute('data-index')),
      ).toEqual(['0', '1']);
    });

    it('does not render the times in the slot render', async () => {
      await render(
        <TimePicker.Root locale="en-US">
          <TimePicker.List
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => (
                <section {...props} data-testid="custom" />
              ),
            }}
          />
        </TimePicker.Root>,
      );

      expect(screen.getByTestId('custom')).not.toBe(null);
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });
  });

  describe('keys', () => {
    it('has the tab stop on the selected item', async () => {
      const { user } = await renderList({}, { defaultValue: time('14:30') });

      await user.tab();

      expect(screen.getByRole('option', { name: timeText('14:30') })).toHaveFocus();
    });

    it('has the tab stop on the first item while the picker has no value', async () => {
      const { user } = await renderList();

      await user.tab();

      expect(screen.getAllByRole('option')[0]).toHaveFocus();
    });

    it('has the tab stop on the first item for a value that the list does not have', async () => {
      const { user } = await renderList({ step: 60 }, { defaultValue: time('14:30') });

      await user.tab();

      expect(screen.getAllByRole('option')[0]).toHaveFocus();
    });

    it('has one tab stop', async () => {
      await renderList({}, { defaultValue: time('14:30') });

      const tabStops = screen.getAllByRole('option').filter((option) => option.tabIndex === 0);
      expect(tabStops).toHaveLength(1);
      expect(tabStops[0]).toHaveTextContent(timeText('14:30'));
    });

    it('moves the focus with the arrow keys, goes round at the ends and has Home and End', async () => {
      const { user } = await renderList({ step: 360 });
      const [first, second, , last] = screen.getAllByRole('option');
      await user.tab();

      await user.keyboard('{ArrowDown}');
      expect(second).toHaveFocus();

      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(last).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(first).toHaveFocus();

      await user.keyboard('{End}');
      expect(last).toHaveFocus();

      await user.keyboard('{Home}');
      expect(first).toHaveFocus();
    });

    it('moves the focus over a disabled item', async () => {
      const { user } = await render(
        <TimePicker.Root locale="en-US">
          <TimePicker.List
            step={360}
            v-slots={{
              item: ({ time: itemTime, index }: { time: Temporal.PlainTime; index: number }) => (
                <TimePicker.Item time={itemTime} disabled={index === 1} />
              ),
            }}
          />
        </TimePicker.Root>,
      );
      const options = screen.getAllByRole('option');
      await user.tab();

      await user.keyboard('{ArrowDown}');

      expect(options[2]).toHaveFocus();
    });
  });
});
