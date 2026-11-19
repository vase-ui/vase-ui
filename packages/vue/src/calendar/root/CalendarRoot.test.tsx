import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, onErrorCaptured, shallowReactive } from 'vue';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import CalendarAnatomy from './CalendarAnatomy.test.vue';
import * as Calendar from '../index.parts';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const today = () => day('2026-11-14');

function cell(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;
}

function button(iso: string) {
  return cell(iso).querySelector<HTMLElement>('button');
}

// A text that the browser formats, so that no test writes a month name or a weekday name.
function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

const monthName = (iso: string, locale?: string) =>
  format({ month: 'long', year: 'numeric' }, iso, locale);

describe('<Calendar.Root />', () => {
  const { render } = createRenderer();

  // The props go through a spread, because the fixture declares none.
  function renderCalendar(props: Record<string, unknown> = {}) {
    return render(<CalendarAnatomy {...{ today: today(), locale: 'en-US', ...props }} />);
  }

  describeConformance(<Calendar.Root today={today()} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  it('keeps the last day when a consumer clears the selection in the same task', async () => {
    const zoned = Temporal.ZonedDateTime.from('2026-11-16T09:30[Asia/Tokyo]');
    const dates = shallowReactive<(Temporal.PlainDate | Temporal.ZonedDateTime)[]>([today()]);
    const onValueChange = vi.fn();
    const { user } = await renderCalendar({ modelValue: dates, multiple: true, onValueChange });

    dates[0] = zoned;
    dates.length = 0;
    await nextTick();
    await user.click(button('2026-11-18')!);

    expect(onValueChange.mock.calls[0]![0][0].toString()).toBe(
      '2026-11-18T09:30:00+09:00[Asia/Tokyo]',
    );
  });

  it('checks a modifier name added to the same reactive object', async () => {
    const modifiers = shallowReactive<Record<string, Temporal.PlainDate>>({});
    const errors: string[] = [];
    const Host = defineComponent(() => {
      onErrorCaptured((error) => {
        errors.push((error as Error).message);
        return false;
      });
      return () => <Calendar.Root today={today()} modifiers={modifiers} />;
    });
    await render(<Host />);

    modifiers.selected = today();
    await nextTick();

    expect(errors).toEqual([expect.stringContaining('has the key `selected`')]);
  });

  describe('names', () => {
    it('renders a group that the visible month names', async () => {
      await renderCalendar();

      expect(screen.getByRole('group', { name: monthName('2026-11-14') })).not.toBe(null);
    });

    it.each([
      { name: 'an aria-label', props: { 'aria-label': 'Birthday' }, expected: 'Birthday' },
      { name: 'an aria-labelledby', props: { 'aria-labelledby': 'title' }, expected: null },
    ])('lets $name of the consumer replace the name of the month', async ({ props, expected }) => {
      await render(
        <div>
          <span id="title">Birthday</span>
          <CalendarAnatomy {...{ today: today(), locale: 'en-US', ...props }} />
        </div>,
      );

      const group = screen.getByRole('group');
      expect(group.getAttribute('aria-label')).toBe(expected);
      expect(group).toHaveAccessibleName('Birthday');
    });

    it.each([
      { name: 'an empty aria-label', props: { 'aria-label': '' } },
      { name: 'an aria-label of white space', props: { 'aria-label': ' ' } },
      { name: 'an empty aria-labelledby', props: { 'aria-labelledby': '' } },
      { name: 'an aria-labelledby of white space', props: { 'aria-labelledby': ' ' } },
    ])('VUE-106: keeps the name of the month for $name of the consumer', async ({ props }) => {
      await renderCalendar(props);

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-label', monthName('2026-11-14'));
      expect(group).not.toHaveAttribute('aria-labelledby');
      expect(group).toHaveAccessibleName(monthName('2026-11-14'));
    });

    it('VUE-103: keeps the name of the month for an aria-labelledby of null', async () => {
      await renderCalendar({ 'aria-labelledby': null });

      const group = screen.getByRole('group');
      expect(group).not.toHaveAttribute('aria-labelledby');
      expect(group).toHaveAccessibleName(monthName('2026-11-14'));
    });

    it('names the grid by the month, and the headers by the days of the week', async () => {
      await renderCalendar();

      expect(screen.getByRole('grid', { name: monthName('2026-11-14') })).not.toBe(null);
      const headers = screen.getAllByRole('columnheader');
      expect(headers.map((header) => header.textContent)).toEqual(
        [8, 9, 10, 11, 12, 13, 14].map((dayOfMonth) =>
          format({ weekday: 'short' }, `2026-11-${String(dayOfMonth).padStart(2, '0')}`),
        ),
      );
      expect(headers[0]!.getAttribute('abbr')).toBe(format({ weekday: 'long' }, '2026-11-08'));
    });

    it('names a day by its full date, and marks today', async () => {
      await renderCalendar();

      const label = format(
        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
        '2026-11-14',
      );
      expect(button('2026-11-14')).toHaveAccessibleName(label);
      expect(button('2026-11-14')).toHaveAttribute('aria-current', 'date');
      expect(button('2026-11-13')).not.toHaveAttribute('aria-current');
      expect(button('2026-11-14')).toHaveTextContent(format({ day: 'numeric' }, '2026-11-14'));
    });
  });

  describe('selection', () => {
    function listeners() {
      return {
        onValueChange: vi.fn(),
        'onUpdate:modelValue': vi.fn(),
      };
    }

    it('selects the pressed day, and gives the change its reason and its event', async () => {
      const handlers = listeners();
      const { user } = await renderCalendar(handlers);

      await user.click(button('2026-11-11')!);

      expect(handlers.onValueChange).toHaveBeenCalledTimes(1);
      const [value, details] = handlers.onValueChange.mock.calls[0]!;
      expect(value.toString()).toBe('2026-11-11');
      expect(details.reason).toBe('day-press');
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(handlers['onUpdate:modelValue'].mock.calls[0]![0].toString()).toBe('2026-11-11');
      expect(cell('2026-11-11')).toHaveAttribute('aria-selected', 'true');
      expect(cell('2026-11-11')).toHaveAttribute('data-selected');
      expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'false');
    });

    it('changes the selection of an uncontrolled calendar from its default', async () => {
      const { user } = await renderCalendar({ defaultValue: day('2026-11-10') });

      expect(cell('2026-11-10')).toHaveAttribute('aria-selected', 'true');
      await user.click(button('2026-11-12')!);

      expect(cell('2026-11-10')).toHaveAttribute('aria-selected', 'false');
      expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'true');
    });

    it('leaves the selection of a controlled calendar to its value', async () => {
      const handlers = listeners();
      const { user, setProps } = await renderCalendar({
        modelValue: day('2026-11-10'),
        ...handlers,
      });

      await user.click(button('2026-11-12')!);

      expect(handlers.onValueChange).toHaveBeenCalledTimes(1);
      expect(cell('2026-11-10')).toHaveAttribute('aria-selected', 'true');
      expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'false');

      await setProps({ modelValue: day('2026-11-12') });

      expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'true');
    });

    it('gives a controlled calendar with a null value an empty selection', async () => {
      const { user } = await renderCalendar({ modelValue: null });

      await user.click(button('2026-11-12')!);

      expect(document.querySelector('[aria-selected="true"]')).toBe(null);
      expect(screen.getByRole('group')).toHaveAttribute('data-empty');
    });

    it('keeps the old value when a listener cancels the change', async () => {
      const handlers = {
        onValueChange: vi.fn((_value: unknown, details: { cancel: () => void }) => {
          details.cancel();
        }),
        'onUpdate:modelValue': vi.fn(),
      };
      const { user } = await renderCalendar({ defaultValue: day('2026-11-10'), ...handlers });

      await user.click(button('2026-11-12')!);

      expect(handlers.onValueChange).toHaveBeenCalledTimes(1);
      expect(handlers['onUpdate:modelValue']).not.toHaveBeenCalled();
      expect(cell('2026-11-10')).toHaveAttribute('aria-selected', 'true');
      expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'false');
    });

    it('changes nothing when the selected day is pressed', async () => {
      const handlers = listeners();
      const { user } = await renderCalendar({ defaultValue: day('2026-11-10'), ...handlers });

      await user.click(button('2026-11-10')!);

      expect(handlers.onValueChange).not.toHaveBeenCalled();
      expect(cell('2026-11-10')).toHaveAttribute('aria-selected', 'true');
    });

    it('does not select a day of a read-only calendar, and keeps its focus', async () => {
      const handlers = listeners();
      const { user } = await renderCalendar({ readOnly: true, ...handlers });

      await user.click(button('2026-11-12')!);

      expect(handlers.onValueChange).not.toHaveBeenCalled();
      expect(button('2026-11-12')).toHaveFocus();
      expect(screen.getByRole('group')).toHaveAttribute('data-readonly');
      expect(screen.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');
    });

    describe('multiple', () => {
      it('adds a pressed day, and removes a pressed day that is selected', async () => {
        const handlers = listeners();
        const { user } = await renderCalendar({ multiple: true, ...handlers });

        await user.click(button('2026-11-10')!);
        await user.click(button('2026-11-12')!);
        await user.click(button('2026-11-10')!);

        const values = handlers.onValueChange.mock.calls.map(([value]) =>
          value.map((item: Temporal.PlainDate) => item.toString()),
        );
        expect(values).toEqual([['2026-11-10'], ['2026-11-10', '2026-11-12'], ['2026-11-12']]);
        expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
      });

      it('gives a single calendar no aria-multiselectable', async () => {
        await renderCalendar();

        expect(screen.getByRole('grid')).not.toHaveAttribute('aria-multiselectable');
      });

      it('keeps minDays days selected', async () => {
        const handlers = listeners();
        const { user } = await renderCalendar({
          multiple: true,
          minDays: 1,
          defaultValue: [day('2026-11-10'), day('2026-11-12')],
          ...handlers,
        });

        await user.click(button('2026-11-10')!);
        await user.click(button('2026-11-12')!);

        expect(handlers.onValueChange).toHaveBeenCalledTimes(1);
        expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'true');
      });

      it('adds no day past maxDays', async () => {
        const handlers = listeners();
        const { user } = await renderCalendar({
          multiple: true,
          maxDays: 2,
          defaultValue: [day('2026-11-10'), day('2026-11-12')],
          ...handlers,
        });

        await user.click(button('2026-11-15')!);

        expect(handlers.onValueChange).not.toHaveBeenCalled();
        expect(cell('2026-11-15')).toHaveAttribute('aria-selected', 'false');
      });

      it('changes the list of a controlled calendar only through its value', async () => {
        const handlers = listeners();
        const { user, setProps } = await renderCalendar({
          multiple: true,
          modelValue: [day('2026-11-10')],
          ...handlers,
        });

        await user.click(button('2026-11-12')!);
        expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'false');

        await setProps({ modelValue: [day('2026-11-10'), day('2026-11-12')] });
        expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'true');
      });
    });

    describe('the value that a press gives', () => {
      // The press is on 2026-11-12, and the default value is on 2026-11-10.
      it.each([
        { name: 'a date', value: () => day('2026-11-10'), expected: '2026-11-12' },
        {
          name: 'a date and time',
          value: () => Temporal.PlainDateTime.from('2026-11-10T09:30'),
          expected: '2026-11-12T09:30:00',
        },
        {
          name: 'a zoned date and time',
          value: () => Temporal.ZonedDateTime.from('2026-11-10T09:30[Asia/Tokyo]'),
          expected: '2026-11-12T09:30:00+09:00[Asia/Tokyo]',
        },
        {
          name: 'a date in the Persian calendar',
          value: () => day('2026-11-10').withCalendar('persian'),
          expected: '2026-11-12[u-ca=persian]',
        },
        {
          name: 'a date in the Gregorian calendar',
          value: () => day('2026-11-10').withCalendar('gregory'),
          expected: '2026-11-12[u-ca=gregory]',
        },
      ])(
        'keeps the kind, the time, the zone and the calendar of $name',
        async ({ value, expected }) => {
          const handlers = listeners();
          const { user } = await renderCalendar({ defaultValue: value(), ...handlers });

          await user.click(button('2026-11-12')!);

          expect(handlers.onValueChange.mock.calls[0]![0].toString()).toBe(expected);
        },
      );

      it('gives a date in the ISO calendar when the calendar has no value', async () => {
        const handlers = listeners();
        const { user } = await renderCalendar({ calendar: 'persian', ...handlers });

        await user.click(button('2026-11-12')!);

        const value = handlers.onValueChange.mock.calls[0]![0];
        expect(value.toString()).toBe('2026-11-12');
        expect(value.calendarId).toBe('iso8601');
      });

      it('takes the kind of the default value for a press that follows a removal', async () => {
        const handlers = listeners();
        const { user } = await renderCalendar({
          multiple: true,
          defaultValue: [Temporal.PlainDateTime.from('2026-11-10T09:30')],
          ...handlers,
        });

        await user.click(button('2026-11-10')!);
        await user.click(button('2026-11-12')!);

        expect(handlers.onValueChange.mock.calls[1]![0].map(String)).toEqual([
          '2026-11-12T09:30:00',
        ]);
      });

      it('selects the day of a zoned value in its own zone', async () => {
        // 23:30 in UTC is 08:30 of the next day in Tokyo.
        const value = Temporal.ZonedDateTime.from('2026-11-14T23:30:00+00:00[UTC]').withTimeZone(
          'Asia/Tokyo',
        );
        await renderCalendar({ modelValue: value });

        expect(cell('2026-11-15')).toHaveAttribute('aria-selected', 'true');
        expect(cell('2026-11-14')).toHaveAttribute('aria-selected', 'false');
      });
    });
  });

  describe('the states of a day', () => {
    // 2026-11-10 is a Tuesday.
    const forms = [
      {
        name: 'a date',
        matcher: () => day('2026-11-11'),
        matched: ['2026-11-11'],
        other: ['2026-11-12'],
      },
      {
        name: 'a range',
        matcher: () => ({ start: day('2026-11-10'), end: day('2026-11-12') }),
        matched: ['2026-11-10', '2026-11-12'],
        other: ['2026-11-09', '2026-11-13'],
      },
      {
        name: 'a function',
        matcher: () => (date: Temporal.PlainDate) => date.day === 20,
        matched: ['2026-11-20'],
        other: ['2026-11-21'],
      },
      {
        name: 'a list',
        matcher: () => [day('2026-11-11'), { dayOfWeek: 1 }],
        matched: ['2026-11-11', '2026-11-16'],
        other: ['2026-11-12'],
      },
    ];
    const props = [
      { prop: 'disabledDates', attribute: 'data-disabled' },
      { prop: 'unavailableDates', attribute: 'data-unavailable' },
      { prop: 'hiddenDates', attribute: 'data-hidden' },
    ];

    it.each(props.flatMap((entry) => forms.map((form) => ({ ...entry, ...form }))))(
      'marks the days that $prop matches by $name',
      async ({ prop, attribute, matcher, matched, other }) => {
        await renderCalendar({ [prop]: matcher() });

        for (const iso of matched) {
          expect(cell(iso)).toHaveAttribute(attribute);
        }
        for (const iso of other) {
          expect(cell(iso)).not.toHaveAttribute(attribute);
        }
      },
    );

    it('disables a day so that it takes no focus and no press', async () => {
      const handlers = { onValueChange: vi.fn() };
      const { user } = await renderCalendar({ disabledDates: day('2026-11-11'), ...handlers });

      await user.click(button('2026-11-11')!);

      expect(button('2026-11-11')).toBeDisabled();
      expect(cell('2026-11-11')).toHaveAttribute('aria-disabled', 'true');
      expect(handlers.onValueChange).not.toHaveBeenCalled();
    });

    it('lets an unavailable day take focus but no press', async () => {
      const handlers = { onValueChange: vi.fn() };
      const { user } = await renderCalendar({ unavailableDates: day('2026-11-11'), ...handlers });

      await user.click(button('2026-11-11')!);

      expect(button('2026-11-11')).not.toBeDisabled();
      expect(button('2026-11-11')).toHaveAttribute('aria-disabled', 'true');
      expect(button('2026-11-11')).toHaveFocus();
      expect(handlers.onValueChange).not.toHaveBeenCalled();
    });

    it('renders no button for a hidden day, and an empty cell', async () => {
      await renderCalendar({ hiddenDates: day('2026-11-11') });

      expect(cell('2026-11-11')).not.toBe(null);
      expect(button('2026-11-11')).toBe(null);
      expect(cell('2026-11-11')).not.toHaveAttribute('aria-selected');
    });

    it('hides the days of the months around the month', async () => {
      await renderCalendar();

      // The page has the first days of December in its last week.
      expect(cell('2026-12-01')).toHaveAttribute('data-outside-month');
      expect(button('2026-12-01')).toBe(null);
      expect(cell('2026-11-30')).not.toHaveAttribute('data-outside-month');
    });

    it.each([
      { name: 'before minDate', iso: '2026-11-09', attribute: 'data-disabled', expected: true },
      { name: 'minDate itself', iso: '2026-11-10', attribute: 'data-disabled', expected: false },
      { name: 'maxDate itself', iso: '2026-11-20', attribute: 'data-disabled', expected: false },
      { name: 'after maxDate', iso: '2026-11-21', attribute: 'data-disabled', expected: true },
    ])(
      'gives the day $name the state disabled: $expected',
      async ({ iso, attribute, expected }) => {
        await renderCalendar({ minDate: day('2026-11-10'), maxDate: day('2026-11-20') });

        expect(cell(iso).hasAttribute(attribute)).toBe(expected);
        expect(button(iso)!.hasAttribute('disabled')).toBe(expected);
      },
    );

    it('marks today, the weekend, and the selection', async () => {
      await renderCalendar({ defaultValue: day('2026-11-10') });

      expect(cell('2026-11-14')).toHaveAttribute('data-today');
      expect(cell('2026-11-13')).not.toHaveAttribute('data-today');
      expect(cell('2026-11-14')).toHaveAttribute('data-weekend');
      expect(cell('2026-11-15')).toHaveAttribute('data-weekend');
      expect(cell('2026-11-13')).not.toHaveAttribute('data-weekend');
      expect(cell('2026-11-10')).toHaveAttribute('data-selected');
      expect(button('2026-11-10')).toHaveAttribute('data-selected');
    });

    it('gives a day that a modifier matches the attribute of the name', async () => {
      await renderCalendar({
        modifiers: { holiday: day('2026-11-26'), isWorkDay: { dayOfWeek: [1, 2] } },
      });

      expect(cell('2026-11-26')).toHaveAttribute('data-holiday');
      expect(button('2026-11-26')).toHaveAttribute('data-holiday');
      expect(cell('2026-11-25')).not.toHaveAttribute('data-holiday');
      expect(cell('2026-11-23')).toHaveAttribute('data-is-work-day');
      expect(cell('2026-11-24')).toHaveAttribute('data-is-work-day');
      expect(cell('2026-11-25')).not.toHaveAttribute('data-is-work-day');
    });

    it('gives the state of a calendar to the root', async () => {
      await renderCalendar({ invalid: true, disabled: true });

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('data-invalid');
      expect(group).toHaveAttribute('data-disabled');
      expect(group).toHaveAttribute('data-empty');
      expect(screen.getByRole('grid')).toHaveAttribute('aria-disabled', 'true');
      expect(button('2026-11-12')).toBeDisabled();
    });
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws when a modifier has the name of a state of a day', async () => {
    await expect(renderCalendar({ modifiers: { selected: day('2026-11-11') } })).rejects.toThrow(
      'Vase UI: The `modifiers` prop of <Calendar.Root> has the key `selected`. A day uses the attribute `data-selected` for a meaning of its own, so the attribute would have two meanings. Rename the modifier.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of watcher callback'),
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
