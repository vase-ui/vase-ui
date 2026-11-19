import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import ErrorsForm from '../../../../test/fixtures/ErrorsForm.vue';
import { Form } from '@vase-ui/vue/form';
import {
  createFormDataSpy,
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hiddenInputSizeTests,
  hydrate,
  hydrateAfter,
  recordInputEvents,
  renderOnServer,
  screen,
  takeReportedMessages,
} from '#test-utils';
import DateTimeFieldProbe from '../../../../test/fixtures/DateTimeFieldProbe.vue';
import { formatter } from '../format';
import { kindOf } from '../temporal';
import type { TemporalValue } from '../temporal';
import { PARTIAL_MESSAGE } from './useDateTimeFieldRoot';
import { useDateTimeFieldContext } from './DateTimeFieldContext';

const PROBE = 'test/fixtures/DateTimeFieldProbe.vue';

type FieldRootInstance = InstanceType<typeof Field.Root>;

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const hiddenInputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
const typesOf = (container: Element) =>
  Array.from(container.querySelectorAll('input[data-type]'), (input) =>
    input.getAttribute('data-type'),
  );
const textOf = (value: TemporalValue, options: Intl.DateTimeFormatOptions, locale: string) => {
  const [format, epoch] = formatter(value, options, locale);
  return format.format(epoch);
};
const shownBy = (container: Element) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-type]'), (element) =>
    element instanceof HTMLInputElement ? element.value : element.textContent,
  ).join('');

describe('useDateTimeFieldRoot', () => {
  const { render } = createRenderer();

  describe('layout', () => {
    it.each(['ar-EG', 'ja-JP', 'fr-CA'])(
      'shows a date and time as Intl does in %s',
      async (locale) => {
        const { container } = await render(
          <DateTimeFieldProbe defaultValue="2026-11-14T15:04" locale={locale} hourCycle={24} />,
        );
        const [format, epoch] = formatter(
          Temporal.PlainDateTime.from('2026-11-14T15:04'),
          {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hourCycle: 'h23',
          },
          locale,
        );

        expect(shownBy(container)).toBe(format.format(epoch));
      },
    );

    it.each([
      { name: 'a year and month', props: { defaultValue: '2026-11' }, types: 'month year' },
      { name: 'a date', props: { defaultValue: '2026-11-14' }, types: 'month day year' },
      {
        name: 'a date shown as a month',
        props: { defaultValue: '2026-11-14', granularity: 'month' },
        types: 'month year',
      },
      {
        name: 'a date with hours',
        props: { defaultValue: '2026-11-14T15:04', granularity: 'hour' },
        types: 'month day year hour',
      },
      {
        name: 'a date with minutes',
        props: { defaultValue: '2026-11-14T15:04' },
        types: 'month day year hour minute',
      },
      {
        name: 'a date with seconds',
        props: { defaultValue: '2026-11-14T15:04', granularity: 'second' },
        types: 'month day year hour minute second',
      },
      {
        name: 'a date and time shown as a date',
        props: { defaultValue: '2026-11-14T15:04', granularity: 'day' },
        types: 'month day year',
      },
      {
        name: 'a time with minutes',
        props: { family: 'time', defaultValue: '15:04' },
        types: 'hour minute',
      },
      {
        name: 'a time with hours',
        props: { family: 'time', defaultValue: '15:04', granularity: 'hour' },
        types: 'hour',
      },
      {
        name: 'a time with seconds',
        props: { family: 'time', defaultValue: '15:04', granularity: 'second' },
        types: 'hour minute second',
      },
    ] as const)('shows the segments of $name', async ({ props, types }) => {
      const { container } = await render(
        <DateTimeFieldProbe locale="en-US" hourCycle={24} {...props} />,
      );

      expect(typesOf(container).join(' ')).toBe(types);
    });

    it.each([
      { name: 'the 12-hour cycle of en-US', locale: 'en-US', hourCycle: undefined, period: true },
      { name: 'the 24-hour cycle of de-DE', locale: 'de-DE', hourCycle: undefined, period: false },
      { name: 'the prop 12 in de-DE', locale: 'de-DE', hourCycle: 12, period: true },
      { name: 'the prop 24 in en-US', locale: 'en-US', hourCycle: 24, period: false },
    ] as const)('shows a day period for $name: $period', async (row) => {
      const { container } = await render(
        <DateTimeFieldProbe
          family="time"
          defaultValue="15:04"
          locale={row.locale}
          hourCycle={row.hourCycle}
        />,
      );

      expect(typesOf(container).includes('dayPeriod')).toBe(row.period);
    });

    it('shows the hour and the day period of a 12-hour cycle', async () => {
      const { container } = await render(
        <DateTimeFieldProbe family="time" defaultValue="15:04" locale="en-US" />,
      );
      const [format, epoch] = formatter(
        Temporal.PlainTime.from('15:04'),
        { hour: 'numeric' },
        'en-US',
      );
      const period = format.formatToParts(epoch).find((part) => part.type === 'dayPeriod')?.value;

      expect(segmentOf(container, 'hour').value).toBe('3');
      expect(segmentOf(container, 'dayPeriod').value).toBe(period);
    });

    it.each([
      { name: 'month, day and hour', force: true, digits: '2-digit' },
      { name: 'no number', force: false, digits: 'numeric' },
    ] as const)('pads $name when forceLeadingZeros is $force', async ({ force, digits }) => {
      const { container } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-01-05T09:04"
          locale="en-US"
          hourCycle={24}
          forceLeadingZeros={force}
        />,
      );

      const options = {
        year: 'numeric',
        month: digits,
        day: digits,
        hour: digits,
        minute: '2-digit',
        hourCycle: 'h23',
      } as const;
      expect(shownBy(container)).toBe(
        textOf(Temporal.PlainDateTime.from('2026-01-05T09:04'), options, 'en-US'),
      );
    });

    it('shows the era of a date before the year 1, and adds it when a year goes below 1', async () => {
      const bce = Temporal.PlainDate.from({ calendar: 'gregory', year: 0, month: 3, day: 1 });
      const { container, user } = await render(
        <div>
          <DateTimeFieldProbe defaultValue={bce} locale="en-US" data-testid="before" />
          <DateTimeFieldProbe defaultValue="0001-06-15" locale="en-US" data-testid="after" />
        </div>,
      );
      const [format, epoch] = formatter(bce, { era: 'short', year: 'numeric' }, 'en-US');
      const era = format.formatToParts(epoch).find((part) => part.type === 'era')?.value;
      const [before, after] = Array.from(container.querySelectorAll<HTMLElement>('[role="group"]'));

      expect(before!.querySelector('[data-type="era"]')).toHaveTextContent(era!);
      expect(segmentOf(before!, 'year').value).toBe('1');
      expect(after!.querySelector('[data-type="era"]')).toBe(null);

      await user.click(segmentOf(after!, 'year'));
      await user.keyboard('{ArrowDown}');

      expect(after!.querySelector('[data-type="era"]')).toHaveTextContent(era!);
      expect(segmentOf(after!, 'year').value).toBe('1');
    });

    it('moves a year across the eras of a calendar, and shows the era that the calendar gives', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          defaultValue="2019-05-01"
          locale="ja-JP"
          calendar="japanese"
          onValueChange={onValueChange}
        />,
      );
      const eraText = (date: string) => {
        const [format, epoch] = formatter(
          Temporal.PlainDate.from(date).withCalendar('japanese'),
          { year: 'numeric', month: 'numeric', day: 'numeric' },
          'ja-JP',
        );
        return format.formatToParts(epoch).find((part) => part.type === 'era')?.value;
      };

      expect(container.querySelector('[data-type="era"]')).toHaveTextContent(
        eraText('2019-05-01')!,
      );
      expect(segmentOf(container, 'year').value).toBe('1');

      await user.click(segmentOf(container, 'year'));
      await user.keyboard('{ArrowDown}');

      expect(onValueChange.mock.calls[0]![0].toString()).toBe('2018-05-01');
      expect(container.querySelector('[data-type="era"]')).toHaveTextContent(
        eraText('2018-05-01')!,
      );
      expect(segmentOf(container, 'year').value).toBe('30');
    });

    it('makes the layout again when the locale changes', async () => {
      const { container, setProps } = await render(
        <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" />,
      );
      expect(typesOf(container)).toEqual(['month', 'day', 'year']);

      await setProps({ locale: 'de-DE' });

      expect(typesOf(container)).toEqual(['day', 'month', 'year']);
      expect(shownBy(container)).toBe(
        textOf(
          Temporal.PlainDate.from('2026-11-14'),
          { year: 'numeric', month: 'numeric', day: 'numeric' },
          'de-DE',
        ),
      );
    });

    it('shows the time zone name of a zoned value, unless hideTimeZone is set', async () => {
      const { container } = await render(
        <div>
          <DateTimeFieldProbe defaultValue="2026-11-14T15:04[Asia/Tokyo]" locale="en-US" />
          <DateTimeFieldProbe defaultValue="2026-11-14T15:04[Asia/Tokyo]" hideTimeZone />
        </div>,
      );
      const name = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        timeZoneName: 'short',
        hour: 'numeric',
      })
        .formatToParts(Date.UTC(2026, 10, 14))
        .find((part) => part.type === 'timeZoneName')?.value;
      const [shown, hidden] = Array.from(container.querySelectorAll<HTMLElement>('[role="group"]'));

      expect(shown!.querySelector('[data-type="timeZoneName"]')).toHaveTextContent(name!);
      expect(hidden!.querySelector('[data-type="timeZoneName"]')).toBe(null);
    });

    it.each([
      { name: 'the time zone prop', props: { timeZone: 'Asia/Tokyo' }, expected: 'Asia/Tokyo' },
      {
        name: 'the zone of a zoned default value',
        props: { defaultValue: '2026-11-14T15:04[Asia/Tokyo]' },
        expected: 'Asia/Tokyo',
      },
      {
        name: 'the time zone prop over the zone of the value',
        props: { defaultValue: '2026-11-14T15:04[Asia/Tokyo]', timeZone: 'Europe/Paris' },
        expected: 'Europe/Paris',
      },
      { name: 'the zone of the runtime', props: {}, expected: undefined },
    ])('reads today in $name', async ({ props, expected }) => {
      const now = vi.spyOn(Temporal.Now, 'plainDateISO');
      onTestFinished(() => {
        now.mockRestore();
      });

      await render(<DateTimeFieldProbe locale="en-US" {...props} />);

      expect(now).toHaveBeenCalled();
      expect(new Set(now.mock.calls.map(([timeZone]) => timeZone))).toEqual(new Set([expected]));
    });

    it('shows a date in the calendar prop and keeps the calendar of the value', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-11-14"
          locale="en-US"
          calendar="persian"
          onValueChange={onValueChange}
        />,
      );
      const persian = Temporal.PlainDate.from('2026-11-14').withCalendar('persian');
      const [format, epoch] = formatter(
        persian,
        { year: 'numeric', month: 'numeric', day: 'numeric' },
        'en-US',
      );

      expect(shownBy(container)).toBe(format.format(epoch));

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{ArrowUp}');

      const [value] = onValueChange.mock.calls[0] as [Temporal.PlainDate];
      expect(value.calendarId).toBe('iso8601');
      expect(value.toString()).toBe('2026-11-15');
    });
  });

  describe('value', () => {
    it.each([
      {
        name: 'a date and time',
        props: { defaultValue: '2026-11-14T15:04:33' },
        segment: 'minute',
        expected: '2026-11-14T15:05:33',
      },
      {
        name: 'a zoned value',
        props: { defaultValue: '2026-11-14T15:04:33[Asia/Tokyo]' },
        segment: 'day',
        expected: '2026-11-15T15:04:33+09:00[Asia/Tokyo]',
      },
      {
        name: 'a year and month',
        props: { defaultValue: '2026-11' },
        segment: 'month',
        expected: '2026-12',
      },
      {
        name: 'a time',
        props: { family: 'time', defaultValue: '15:04:33' },
        segment: 'minute',
        expected: '15:05:33',
      },
    ] as const)('keeps the kind, the time and the zone of $name', async (row) => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          locale="en-US"
          hourCycle={24}
          onValueChange={onValueChange}
          {...row.props}
        />,
      );

      await user.click(segmentOf(container, row.segment));
      await user.keyboard('{ArrowUp}');

      const [value] = onValueChange.mock.calls[0] as [TemporalValue];
      expect(value.toString()).toBe(row.expected);
    });

    it.each([
      {
        name: 'a date',
        make: (T: typeof Temporal) => T.PlainDate.from('2026-11-14'),
        props: {},
        segment: 'day',
        expected: '2026-11-15',
      },
      {
        name: 'a date and time',
        make: (T: typeof Temporal) => T.PlainDateTime.from('2026-11-14T15:04'),
        props: { hourCycle: 24 },
        segment: 'minute',
        expected: '2026-11-14T15:05:00',
      },
      {
        name: 'a zoned value',
        make: (T: typeof Temporal) => T.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]'),
        props: {},
        segment: 'day',
        expected: '2026-11-15T15:04:00+09:00[Asia/Tokyo]',
      },
      {
        name: 'a year and month',
        make: (T: typeof Temporal) => T.PlainYearMonth.from('2026-11'),
        props: {},
        segment: 'month',
        expected: '2026-12',
      },
      {
        name: 'a time',
        make: (T: typeof Temporal) => T.PlainTime.from('15:04:33'),
        props: { family: 'time', hourCycle: 24 },
        segment: 'minute',
        expected: '15:05:33',
      },
    ] as const)(
      'works with $name that another realm made, which `instanceof` does not know',
      async (row) => {
        const frame = document.createElement('iframe');
        document.body.append(frame);
        onTestFinished(() => {
          frame.remove();
        });
        const other = (frame.contentWindow as unknown as { Temporal: typeof Temporal }).Temporal;
        const value = row.make(other);
        const onValueChange = vi.fn();
        const { container, user } = await render(
          <DateTimeFieldProbe
            defaultValue={value}
            locale="en-US"
            onValueChange={onValueChange}
            {...row.props}
          />,
        );

        expect(value).not.toBeInstanceOf(Temporal[value.constructor.name as 'PlainDate']);

        await user.click(segmentOf(container, row.segment));
        await user.keyboard('{ArrowUp}');

        expect(onValueChange.mock.calls[0]![0].toString()).toBe(row.expected);
      },
    );

    it('emits valueChange, then update:modelValue, and gives the reason of the key', async () => {
      const calls: string[] = [];
      const { container, user } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-11-14"
          locale="en-US"
          onValueChange={(_value: unknown, details: { reason: string }) =>
            calls.push(`valueChange ${details.reason}`)
          }
          {...{ 'onUpdate:modelValue': () => calls.push('update:modelValue') }}
        />,
      );

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{ArrowUp}');
      await user.keyboard('3');

      expect(calls).toEqual([
        'valueChange keyboard',
        'update:modelValue',
        'valueChange input-change',
        'update:modelValue',
      ]);
    });

    it('keeps the value when a listener cancels the change', async () => {
      const onUpdate = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-11-14"
          name="when"
          onValueChange={(_value: unknown, details: { cancel: () => void }) => details.cancel()}
          {...{ 'onUpdate:modelValue': onUpdate }}
        />,
      );

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{ArrowUp}');

      expect(onUpdate).not.toHaveBeenCalled();
      expect(segmentOf(container, 'day').value).toBe('14');
      expect(hiddenInputOf(container).value).toBe('2026-11-14');
    });

    it('shows the value of the parent, and keeps it when the parent does not take a change', async () => {
      const Parent = defineComponent(() => {
        const value = shallowRef(Temporal.PlainDate.from('2026-11-14'));
        return () => (
          <>
            <DateTimeFieldProbe modelValue={value.value} onValueChange={() => {}} />
            <button
              type="button"
              onClick={() => (value.value = Temporal.PlainDate.from('2027-01-02'))}
            >
              Set
            </button>
          </>
        );
      });
      const { container, user } = await render(<Parent />);

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{ArrowUp}');
      expect(segmentOf(container, 'day').value).toBe('14');

      await user.click(screen.getByRole('button', { name: 'Set' }));
      expect(segmentOf(container, 'day').value).toBe('2');
      expect(hiddenInputOf(container).value).toBe('2027-01-02');
    });

    it('gives a value only when each segment has a number', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-11-14"
          locale="en-US"
          onValueChange={onValueChange}
        />,
      );
      const root = container.querySelector('[role="group"]')!;
      expect(root).toHaveAttribute('data-complete');

      await user.click(segmentOf(container, 'day'));
      // The first Backspace leaves the day 1, which is a number of the range.
      await user.keyboard('{Backspace}');
      expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-11-01');
      await user.keyboard('{Backspace}');

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange.mock.calls[1]![0]).toBe(null);
      expect(root).not.toHaveAttribute('data-complete');
      expect(root).not.toHaveAttribute('data-empty');
      expect(segmentOf(container, 'month').value).toBe('11');
      expect(segmentOf(container, 'day').value).toBe('');
      expect(hiddenInputOf(container).value).toBe('');

      // The first digit gives a number of the range, so the field has a value again.
      await user.keyboard('2');
      expect(onValueChange).toHaveBeenCalledTimes(3);
      expect(onValueChange.mock.calls[2]![0].toString()).toBe('2026-11-02');
      expect(root).toHaveAttribute('data-complete');

      await user.keyboard('0');
      expect(onValueChange.mock.calls.at(-1)![0].toString()).toBe('2026-11-20');
    });

    it.each([
      {
        name: 'a date',
        props: { locale: 'en-US' },
        keys: '05172027',
        kind: 'date',
        expected: '2027-05-17',
      },
      {
        name: 'a year and month',
        props: { granularity: 'month' },
        keys: '052027',
        kind: 'yearMonth',
        expected: '2027-05',
      },
      {
        name: 'a date and time',
        props: { granularity: 'minute', hourCycle: 24 },
        keys: '051720270930',
        kind: 'dateTime',
        expected: '2027-05-17T09:30:00',
      },
      {
        name: 'a time',
        props: { family: 'time', hourCycle: 24 },
        keys: '0930',
        kind: 'time',
        expected: '09:30:00',
      },
    ] as const)('makes $name from the numbers that the user types', async (row) => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe locale="en-US" onValueChange={onValueChange} {...row.props} />,
      );

      await user.click(segmentOf(container, row.props.family === 'time' ? 'hour' : 'month'));
      await user.keyboard(row.keys);

      const [value] = onValueChange.mock.calls.at(-1) as [TemporalValue];
      expect(kindOf(value)).toBe(row.kind);
      expect(value.toString()).toBe(row.expected);
    });

    it('keeps the calendar of an empty year and month field when the locale has a calendar of other months', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe granularity="month" locale="fa-IR" onValueChange={onValueChange} />,
      );

      await user.click(segmentOf(container, 'month'));
      await user.keyboard('5');
      await user.click(segmentOf(container, 'year'));
      await user.keyboard('2027');

      expect(onValueChange.mock.calls.at(-1)![0].toString()).toBe('2027-05');
      expect(segmentOf(container, 'month')).toHaveAttribute('aria-valuenow', '5');
      expect(segmentOf(container, 'year')).toHaveAttribute('aria-valuenow', '2027');
    });

    it('makes an ISO date in an empty date field when the locale has another calendar', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe locale="fa-IR" onValueChange={onValueChange} />,
      );

      await user.click(segmentOf(container, 'year'));
      await user.keyboard('1405');
      await user.click(segmentOf(container, 'month'));
      await user.keyboard('8');
      await user.click(segmentOf(container, 'day'));
      await user.keyboard('23');

      const [value] = onValueChange.mock.calls.at(-1) as [Temporal.PlainDate];
      expect(kindOf(value)).toBe('date');
      expect(value.toString()).toBe('2026-11-14');
      expect(segmentOf(container, 'year')).toHaveAttribute('aria-valuenow', '1405');
      expect(segmentOf(container, 'month')).toHaveAttribute('aria-valuenow', '8');
    });

    it.each([
      {
        name: 'the Persian calendar of the prop',
        calendar: 'persian',
        month: '8',
        year: '1405',
        expected: '2026-10-23[u-ca=persian]',
      },
      {
        name: 'the ISO calendar, with a Buddhist prop',
        calendar: 'buddhist',
        month: '5',
        year: '2570',
        expected: '2027-05',
      },
    ])('makes the value of an empty year and month field in $name', async (row) => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          granularity="month"
          locale="en-US"
          calendar={row.calendar}
          name="when"
          onValueChange={onValueChange}
        />,
      );

      await user.click(segmentOf(container, 'month'));
      await user.keyboard(row.month);

      expect(onValueChange).not.toHaveBeenCalled();
      const firstDay = Temporal.PlainDate.from({
        calendar: row.calendar,
        year: Number(row.year),
        month: Number(row.month),
        day: 1,
      });
      expect(segmentOf(container, 'month')).toHaveAttribute(
        'aria-valuetext',
        textOf(firstDay, { month: 'long' }, 'en-US'),
      );

      await user.click(segmentOf(container, 'year'));
      await user.keyboard(row.year);

      const [value] = onValueChange.mock.calls.at(-1) as [Temporal.PlainYearMonth];
      expect(kindOf(value)).toBe('yearMonth');
      expect(value.toString()).toBe(row.expected);
      expect(segmentOf(container, 'month')).toHaveAttribute('aria-valuenow', row.month);
      expect(segmentOf(container, 'year')).toHaveAttribute('aria-valuenow', row.year);
      expect(hiddenInputOf(container).value).toBe(row.expected);
    });

    it('keeps the calendar prop of an empty year and month field in a month that is also an ISO month', async () => {
      // The ISO month 2027-11 is the Hebrew month 5788-M02, day for day.
      const now = vi
        .spyOn(Temporal.Now, 'plainDateISO')
        .mockReturnValue(Temporal.PlainDate.from('2027-11-15'));
      onTestFinished(() => {
        now.mockRestore();
      });
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          granularity="month"
          locale="en-US"
          calendar="hebrew"
          onValueChange={onValueChange}
        />,
      );

      await user.click(segmentOf(container, 'month'));
      await user.keyboard('{ArrowUp}');
      await user.click(segmentOf(container, 'year'));
      await user.keyboard('{ArrowUp}');

      const [first] = onValueChange.mock.calls.at(-1) as [Temporal.PlainYearMonth];
      expect(first.toString()).toBe('2027-11-01[u-ca=hebrew]');

      await user.click(segmentOf(container, 'month'));
      await user.keyboard('{ArrowUp}');

      const [next] = onValueChange.mock.calls.at(-1) as [Temporal.PlainYearMonth];
      expect(next.toString()).toBe('2027-12-01[u-ca=hebrew]');
      expect(segmentOf(container, 'month')).toHaveAttribute('aria-valuenow', '3');
      expect(segmentOf(container, 'year')).toHaveAttribute('aria-valuenow', '5788');
    });

    it('takes the numbers of an empty segment, and the zone, from referenceDate', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          referenceDate="2025-03-09T10:30[Asia/Tokyo]"
          locale="en-US"
          hourCycle={24}
          onValueChange={onValueChange}
        />,
      );

      for (const type of ['month', 'day', 'year', 'hour', 'minute']) {
        await user.click(segmentOf(container, type));
        await user.keyboard('{ArrowUp}');
      }

      expect(segmentOf(container, 'month').value).toBe('3');
      const [value] = onValueChange.mock.calls.at(-1) as [Temporal.ZonedDateTime];
      expect(value.toString()).toBe('2025-03-09T10:30:00+09:00[Asia/Tokyo]');
    });

    it('moves a day above the length of the month down to the last day', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-01-31"
          locale="en-US"
          onValueChange={onValueChange}
        />,
      );

      await user.click(segmentOf(container, 'month'));
      await user.keyboard('2');

      expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-02-28');
      expect(segmentOf(container, 'day').value).toBe('28');
    });

    it('moves a time in the gap of a zone change forward', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-03-08T01:30[America/New_York]"
          locale="en-US"
          hourCycle={24}
          onValueChange={onValueChange}
        />,
      );

      await user.click(segmentOf(container, 'hour'));
      await user.keyboard('{ArrowUp}');

      expect(onValueChange.mock.calls[0]![0].hour).toBe(3);
      expect(segmentOf(container, 'hour').value).toBe('03');
    });

    it('keeps the hour that a clock repeats when the minute changes', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-11-01T01:30:00-05:00[America/New_York]"
          locale="en-US"
          hourCycle={24}
          onValueChange={onValueChange}
        />,
      );

      await user.click(segmentOf(container, 'minute'));
      await user.keyboard('{ArrowUp}');

      expect(onValueChange.mock.calls[0]![0].toString()).toBe(
        '2026-11-01T01:31:00-05:00[America/New_York]',
      );
    });

    it('keeps the date and the zone of a zoned value in a time field, and shows its zone name', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          family="time"
          defaultValue="2026-11-14T15:04:33[Asia/Tokyo]"
          locale="en-US"
          hourCycle={24}
          onValueChange={onValueChange}
        />,
      );

      expect(typesOf(container)).toEqual(['hour', 'minute']);
      expect(container.querySelector('[data-type="timeZoneName"]')).not.toBe(null);

      await user.click(segmentOf(container, 'minute'));
      await user.keyboard('{ArrowUp}');

      expect(onValueChange.mock.calls[0]![0].toString()).toBe(
        '2026-11-14T15:05:33+09:00[Asia/Tokyo]',
      );
    });

    it('empties the field with Clear, and sends the focus to the first segment', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-11-14"
          locale="en-US"
          onValueChange={onValueChange}
        />,
      );
      const root = container.querySelector('[role="group"]')!;

      await user.click(screen.getByTestId('clear'));

      expect(onValueChange.mock.calls[0]![0]).toBe(null);
      expect(onValueChange.mock.calls[0]![1].reason).toBe('clear-press');
      expect(root).toHaveAttribute('data-empty');
      expect(segmentOf(container, 'month')).toHaveFocus();
    });
  });

  describe('hidden input', () => {
    it.each([
      { name: 'a date', props: { defaultValue: '2026-11-14' }, type: 'date', text: '2026-11-14' },
      {
        name: 'a date and time',
        props: { defaultValue: '2026-11-14T15:04:33' },
        type: 'datetime-local',
        text: '2026-11-14T15:04',
      },
      {
        name: 'a date and time with seconds',
        props: { defaultValue: '2026-11-14T15:04:33', granularity: 'second' },
        type: 'datetime-local',
        text: '2026-11-14T15:04:33',
        step: '1',
      },
      {
        name: 'a time',
        props: { family: 'time', defaultValue: '15:04:33' },
        type: 'time',
        text: '15:04',
      },
      {
        name: 'a time with seconds',
        props: { family: 'time', defaultValue: '15:04:33', granularity: 'second' },
        type: 'time',
        text: '15:04:33',
        step: '1',
      },
      {
        name: 'a zoned value',
        props: { defaultValue: '2026-11-14T15:04[Asia/Tokyo]' },
        type: 'text',
        text: '2026-11-14T15:04+09:00[Asia/Tokyo]',
      },
      {
        name: 'a year and month',
        props: { defaultValue: '2026-11' },
        type: 'text',
        text: '2026-11',
      },
      { name: 'no value', props: { granularity: 'day' }, type: 'date', text: '' },
    ] as const)('has the type and the text of $name', async (row) => {
      const { container } = await render(<DateTimeFieldProbe {...row.props} />);
      const input = hiddenInputOf(container);

      expect(input.type).toBe(row.type);
      expect(input.value).toBe(row.text);
      expect(input.getAttribute('step')).toBe('step' in row ? row.step : null);
    });

    it('gives the limits, the name and the form attributes to its input', async () => {
      const { container } = await render(
        <div>
          <DateTimeFieldProbe
            defaultValue="2026-11-14"
            minDate="2026-11-02"
            maxDate="2026-11-20"
            name="when"
            form="orders"
            required
            autoComplete="bday"
          />
          <DateTimeFieldProbe
            family="time"
            defaultValue="12:00"
            minTime="09:00"
            maxTime="17:30"
            step={900}
            readOnly
          />
        </div>,
      );
      const [date, time] = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[aria-hidden]'),
      );

      expect(date!.getAttribute('min')).toBe('2026-11-02');
      expect(date!.getAttribute('max')).toBe('2026-11-20');
      expect(date).toHaveAttribute('name', 'when');
      expect(date).toHaveAttribute('form', 'orders');
      expect(date).toHaveAttribute('autocomplete', 'bday');
      expect(date).toBeRequired();
      expect(time!.getAttribute('min')).toBe('09:00');
      expect(time!.getAttribute('max')).toBe('17:30');
      expect(time!.getAttribute('step')).toBe('900');
      expect(time!.readOnly).toBe(true);
    });

    it('gives the value to the form, and an empty text for no value', async () => {
      const onSubmit = createFormDataSpy('when');
      const { container, user } = await render(
        <form data-testid="form" onSubmit={onSubmit}>
          <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" name="when" />
        </form>,
      );
      const form = screen.getByTestId<HTMLFormElement>('form');

      form.requestSubmit();
      expect(onSubmit.mock.results.at(-1)?.value).toBe('2026-11-14');

      await user.click(screen.getByTestId('clear'));
      form.requestSubmit();
      expect(onSubmit.mock.results.at(-1)?.value).toBe('');
      expect(hiddenInputOf(container).value).toBe('');
    });

    it('takes text that a browser or a program fills in, one time for the two events', async () => {
      const onValueChange = vi.fn();
      const { container } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-11-14"
          locale="en-US"
          onValueChange={onValueChange}
        />,
      );
      const input = hiddenInputOf(container);

      input.value = '2026-12-25';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-12-25');
      expect(onValueChange.mock.calls[0]![1].reason).toBe('input-change');
      expect(segmentOf(container, 'month').value).toBe('12');

      input.value = '';
      await fireEvent(input, new Event('input', { bubbles: true }));
      expect(onValueChange.mock.calls[1]![0]).toBe(null);
      expect(segmentOf(container, 'month').value).toBe('');
    });

    it('ignores text that is not a value, and puts the text of the value back', async () => {
      const onValueChange = vi.fn();
      const { container } = await render(
        <DateTimeFieldProbe
          defaultValue="2026-11-14T15:04[Asia/Tokyo]"
          locale="en-US"
          onValueChange={onValueChange}
        />,
      );
      const input = hiddenInputOf(container);
      expect(input.type).toBe('text');

      input.value = 'not a date';
      await fireEvent(input, new Event('input', { bubbles: true }));

      expect(onValueChange).not.toHaveBeenCalled();
      expect(input.value).toBe('2026-11-14T15:04+09:00[Asia/Tokyo]');

      input.value = '2027-02-03T10:30[Asia/Tokyo]';
      await fireEvent(input, new Event('input', { bubbles: true }));

      expect(onValueChange.mock.calls[0]![0].toString()).toBe(
        '2027-02-03T10:30:00+09:00[Asia/Tokyo]',
      );
    });

    it('handles one text that an input event and a change event bring one time', async () => {
      const onValueChange = vi.fn();
      const { container } = await render(
        <DateTimeFieldProbe
          modelValue={Temporal.PlainDate.from('2026-11-14')}
          locale="en-US"
          onValueChange={onValueChange}
        />,
      );
      const input = hiddenInputOf(container);

      input.value = '2026-12-25';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(input.value).toBe('2026-11-14');
    });

    it('takes the text that its hidden input got before the hydration, with one change', async () => {
      const props = { defaultValue: '2026-11-14', locale: 'en-US', name: 'when' };
      const onValueChange = vi.fn();
      const serverHtml = await renderOnServer(PROBE, props);
      let events: string[] = [];

      const { container } = await hydrateAfter(DateTimeFieldProbe, {
        serverHtml,
        props: { ...props, onValueChange },
        before(serverContainer) {
          const input = hiddenInputOf(serverContainer);
          events = recordInputEvents(input);
          input.value = '2026-12-25';
        },
      });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-12-25');
      expect(onValueChange.mock.calls[0]![1].reason).toBe('input-change');
      expect(segmentOf(container, 'month').value).toBe('12');
      expect(hiddenInputOf(container).value).toBe('2026-12-25');
      expect(events).toEqual(['input']);
    });

    it('keeps a value that the type of its hidden input refuses at a `pageshow` event after the hydration', async () => {
      // A `date` input has no year 0, so it has no value.
      const props = { defaultValue: '0000-03-01', locale: 'en-US', name: 'when' };
      const onValueChange = vi.fn();
      const serverHtml = await renderOnServer(PROBE, props);
      const { container } = await hydrate(DateTimeFieldProbe, {
        serverHtml,
        props: { ...props, onValueChange },
      });
      const input = hiddenInputOf(container);
      const events = recordInputEvents(input);
      expect(input.value).toBe('');

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(segmentOf(container, 'year').value).toBe('1');
      expect(events).toEqual([]);
    });

    hiddenInputSizeTests({
      render,
      createComponent: (props) => <DateTimeFieldProbe defaultValue="2026-11-14" {...props} />,
    });

    it('keeps the size that the invalid event gave to the input when the root renders again', async () => {
      const { container, setProps } = await render(<DateTimeFieldProbe required />);
      const input = hiddenInputOf(container);
      const size = () => {
        const { width, height } = input.getBoundingClientRect();
        return [width, height];
      };

      expect(size()).toEqual([0, 0]);
      input.reportValidity();
      await flushMicrotasks();
      expect(size()).toEqual([1, 1]);

      await setProps({ autoComplete: 'bday' });

      expect(input).toHaveAttribute('autocomplete', 'bday');
      expect(size()).toEqual([1, 1]);
    });

    it('gives the hidden input to the part that exposes it', async () => {
      let probe: InstanceType<typeof DateTimeFieldProbe> | null = null;
      const { container } = await render(() => (
        <DateTimeFieldProbe
          ref={(instance: unknown) => {
            probe = instance as InstanceType<typeof DateTimeFieldProbe> | null;
          }}
          defaultValue="2026-11-14"
        />
      ));

      expect(probe!.context.hiddenInputElement.value).toBe(hiddenInputOf(container));
    });

    describe('a native reset of the form', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      async function settleReset() {
        vi.advanceTimersByTime(0);
        await flushMicrotasks();
      }

      it('puts an uncontrolled field back to its default value, and a partial entry away', async () => {
        const onValueChange = vi.fn();
        const { container } = await render(
          <form data-testid="form">
            <DateTimeFieldProbe
              defaultValue="2026-11-14"
              locale="en-US"
              name="when"
              onValueChange={onValueChange}
            />
          </form>,
        );
        const input = hiddenInputOf(container);
        input.value = '2027-02-03';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flushMicrotasks();
        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(onValueChange.mock.calls.at(-1)![1].reason).toBe('none');
        expect(segmentOf(container, 'month').value).toBe('11');
        expect(input.value).toBe('2026-11-14');
      });

      it('does not change a controlled field', async () => {
        const onValueChange = vi.fn();
        const { container } = await render(
          <form data-testid="form">
            <DateTimeFieldProbe
              modelValue={Temporal.PlainDate.from('2026-11-14')}
              name="when"
              onValueChange={onValueChange}
            />
          </form>,
        );

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(onValueChange).not.toHaveBeenCalled();
        expect(hiddenInputOf(container).value).toBe('2026-11-14');
      });
    });
  });

  describe('validity', () => {
    it.each([
      {
        name: 'a date before the least',
        props: { defaultValue: '2026-11-01', minDate: '2026-11-02' },
        flag: 'rangeUnderflow',
      },
      {
        name: 'a date after the greatest',
        props: { defaultValue: '2026-11-21', maxDate: '2026-11-20' },
        flag: 'rangeOverflow',
      },
      {
        name: 'a date in the range',
        props: { defaultValue: '2026-11-10', minDate: '2026-11-02', maxDate: '2026-11-20' },
        flag: 'valid',
      },
      {
        name: 'a time before the least',
        props: { family: 'time', defaultValue: '08:00', minTime: '09:00' },
        flag: 'rangeUnderflow',
      },
      {
        name: 'a time after the greatest',
        props: { family: 'time', defaultValue: '18:00', maxTime: '17:30' },
        flag: 'rangeOverflow',
      },
      {
        name: 'a date and time on a day before',
        props: { defaultValue: '2026-11-01T12:00', minDate: '2026-11-02' },
        flag: 'rangeUnderflow',
      },
      {
        name: 'a date and time before the least time',
        props: {
          defaultValue: '2026-11-14T09:59',
          minDate: Temporal.PlainDateTime.from('2026-11-14T10:00'),
        },
        flag: 'rangeUnderflow',
      },
      {
        name: 'a date and time on the least time',
        props: {
          defaultValue: '2026-11-14T10:00',
          minDate: Temporal.PlainDateTime.from('2026-11-14T10:00'),
        },
        flag: 'valid',
      },
      {
        name: 'a date and time after the greatest time',
        props: {
          defaultValue: '2026-11-14T17:31',
          maxDate: Temporal.PlainDateTime.from('2026-11-14T17:30'),
        },
        flag: 'rangeOverflow',
      },
      {
        name: 'a date and time that shows no time',
        props: {
          defaultValue: '2026-11-14T09:00',
          granularity: 'day',
          minDate: Temporal.PlainDateTime.from('2026-11-14T10:00'),
        },
        flag: 'valid',
      },
      { name: 'an empty required field', props: { required: true }, flag: 'valueMissing' },
    ] as const)('gives the native validity of $name', async ({ props, flag }) => {
      const { container } = await render(<DateTimeFieldProbe locale="en-US" {...props} />);

      expect(hiddenInputOf(container).validity[flag]).toBe(true);
    });

    it.each([
      {
        name: 'a partial entry',
        props: { defaultValue: '2026-11-14' },
        prepare: '{Backspace}{Backspace}',
        message: PARTIAL_MESSAGE,
      },
      {
        name: 'a zoned value before the least day',
        props: { defaultValue: '2026-11-01T12:00[Asia/Tokyo]', minDate: '2026-11-02' },
        prepare: '',
        message: 'later',
      },
      {
        name: 'a zoned value before the least time',
        props: {
          defaultValue: '2026-11-14T09:59[Asia/Tokyo]',
          minDate: Temporal.PlainDateTime.from('2026-11-14T10:00'),
        },
        prepare: '',
        message: 'later',
      },
      {
        name: 'a zoned value after the greatest time',
        props: {
          defaultValue: '2026-11-14T17:31[Asia/Tokyo]',
          maxDate: Temporal.ZonedDateTime.from('2026-11-14T17:30[Asia/Tokyo]'),
        },
        prepare: '',
        message: 'earlier',
      },
      {
        name: 'a zoned value before a least limit in another zone',
        // 19:00 in New York on 9 November is 00:00 UTC, and 10:00 in Tokyo is 01:00 UTC.
        props: {
          defaultValue: '2026-11-09T19:00[America/New_York]',
          minDate: Temporal.ZonedDateTime.from('2026-11-10T10:00[Asia/Tokyo]'),
        },
        prepare: '',
        message: 'later',
      },
      {
        name: 'a year and month after the greatest',
        props: { defaultValue: '2026-12', maxDate: '2026-11-20' },
        prepare: '',
        message: 'earlier',
      },
      {
        name: 'a date that is not available',
        props: { defaultValue: '2026-11-14', unavailableDates: { dayOfWeek: [6] } },
        prepare: '',
        message: 'not available',
      },
    ] as const)('gives a custom error for $name', async ({ props, prepare, message }) => {
      const { container, user } = await render(<DateTimeFieldProbe locale="en-US" {...props} />);
      const input = hiddenInputOf(container);

      if (prepare) {
        await user.click(segmentOf(container, 'day'));
        await user.keyboard(prepare);
      }

      expect(input.validity.customError).toBe(true);
      expect(input.validationMessage).toContain(message);
    });

    it.each([
      {
        name: 'a date before the least',
        props: { defaultValue: '2026-11-01', minDate: '2026-11-02' },
        match: 'rangeUnderflow',
      },
      {
        name: 'a date after the greatest',
        props: { defaultValue: '2026-11-21', maxDate: '2026-11-20' },
        match: 'rangeOverflow',
      },
      {
        name: 'a time before the least',
        props: { family: 'time', defaultValue: '08:00', minTime: '09:00' },
        match: 'rangeUnderflow',
      },
      {
        name: 'a time after the greatest',
        props: { family: 'time', defaultValue: '18:00', maxTime: '17:30' },
        match: 'rangeOverflow',
      },
      {
        name: 'a zoned value before the least day',
        props: { defaultValue: '2026-11-01T12:00[Asia/Tokyo]', minDate: '2026-11-02' },
        match: 'customError',
      },
      {
        name: 'a year and month after the greatest',
        props: { defaultValue: '2026-12', maxDate: '2026-11-20' },
        match: 'customError',
      },
      {
        name: 'a date that is not available',
        props: { defaultValue: '2026-11-14', unavailableDates: { dayOfWeek: [6] } },
        match: 'customError',
      },
    ] as const)('gives $match to Field for $name', async ({ props, match }) => {
      let field: FieldRootInstance | null = null;
      await render(() => (
        <Field.Root
          ref={(instance) => {
            field = instance as FieldRootInstance | null;
          }}
          name="when"
        >
          <DateTimeFieldProbe locale="en-US" {...props} />
          <Field.Error match={match} data-testid="error">
            Out of range
          </Field.Error>
        </Field.Root>
      ));
      expect(screen.queryByTestId('error')).toBe(null);

      field!.validate();
      await flushMicrotasks();

      expect(screen.getByTestId('error')).toHaveTextContent('Out of range');
    });

    it('gives no error to Field for a value in the range', async () => {
      let field: FieldRootInstance | null = null;
      await render(() => (
        <Field.Root
          ref={(instance) => {
            field = instance as FieldRootInstance | null;
          }}
          name="when"
        >
          <DateTimeFieldProbe
            defaultValue="2026-11-10"
            minDate="2026-11-02"
            maxDate="2026-11-20"
            locale="en-US"
          />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      field!.validate();
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
    });

    it.each([
      {
        name: 'a zoned value on the least time',
        props: {
          defaultValue: '2026-11-14T10:00[Asia/Tokyo]',
          minDate: Temporal.PlainDateTime.from('2026-11-14T10:00'),
        },
      },
      {
        name: 'a zoned value after a least limit in another zone',
        // 05:00 in New York on 10 November is 10:00 UTC, and 10:00 in Tokyo is 01:00 UTC.
        props: {
          defaultValue: '2026-11-10T05:00[America/New_York]',
          minDate: Temporal.ZonedDateTime.from('2026-11-10T10:00[Asia/Tokyo]'),
        },
      },
      {
        name: 'a zoned value that shows no time',
        props: {
          defaultValue: '2026-11-14T09:00[Asia/Tokyo]',
          granularity: 'day',
          minDate: Temporal.PlainDateTime.from('2026-11-14T10:00'),
        },
      },
    ] as const)('gives no custom error for $name', async ({ props }) => {
      const { container } = await render(<DateTimeFieldProbe locale="en-US" {...props} />);

      expect(hiddenInputOf(container).validity.valid).toBe(true);
    });

    it('updates native validity when only the unavailable dates change', async () => {
      const { container, setProps } = await render(
        <DateTimeFieldProbe defaultValue="2026-11-14" />,
      );
      const input = hiddenInputOf(container);
      expect(input.validity.valid).toBe(true);

      await setProps({ unavailableDates: { dayOfWeek: 6 } });
      expect(input.validity.customError).toBe(true);

      await setProps({ unavailableDates: undefined });
      expect(input.validity.valid).toBe(true);
    });

    it('discards a partial entry after the parent supplies a complete value', async () => {
      const { container, setProps, user } = await render(
        <DateTimeFieldProbe modelValue={null} referenceDate="2026-11-14" locale="en-US" />,
      );
      const month = segmentOf(container, 'month');
      await user.click(month);
      await user.keyboard('{ArrowUp}');
      expect(month.value).toBe('11');

      await setProps({ modelValue: '2026-12-31' });
      expect(month.value).toBe('12');

      await setProps({ modelValue: null });
      expect(month.value).toBe('');
      expect(hiddenInputOf(container).validity.valid).toBe(true);
    });

    it('takes the custom error back when the entry is complete again', async () => {
      const { container, user } = await render(
        <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" />,
      );
      const input = hiddenInputOf(container);

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{Backspace}{Backspace}');
      expect(input.validity.customError).toBe(true);

      await user.keyboard('15');
      expect(input.validity.valid).toBe(true);
    });

    it('shows the error of a partial entry through Field at the blur', async () => {
      const { container, user } = await render(
        <Field.Root name="when" validationMode="blur">
          <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" />
          <Field.Error data-testid="error" />
          <button type="button">Next</button>
        </Field.Root>,
      );
      const root = container.querySelector('[role="group"]')!;

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{Backspace}{Backspace}');
      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByTestId('error')).toHaveTextContent(PARTIAL_MESSAGE);
      expect(root).toHaveAttribute('data-invalid');
      expect(root).toHaveAttribute('data-touched');
    });

    it('validates a field with two date fields through the first one that is invalid', async () => {
      const { container, user } = await render(
        <Field.Root name="range" validationMode="blur">
          <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" />
          <DateTimeFieldProbe defaultValue="2026-11-20" locale="en-US" />
          <Field.Error data-testid="error" />
          <button type="button">Next</button>
        </Field.Root>,
      );
      const [first] = Array.from(container.querySelectorAll<HTMLElement>('[role="group"]'));

      await user.click(segmentOf(first!, 'day'));
      await user.keyboard('{Backspace}{Backspace}');
      await user.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByTestId('error')).toHaveTextContent(PARTIAL_MESSAGE);
    });

    it('shows a missing value through Field after the user empties a required field', async () => {
      const { container, user } = await render(
        <Field.Root name="when" validationMode="change">
          <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" required />
          <Field.Error match="valueMissing" data-testid="error">
            Enter a date
          </Field.Error>
        </Field.Root>,
      );

      await user.click(screen.getByTestId('clear'));

      expect(screen.getByTestId('error')).toHaveTextContent('Enter a date');
      expect(container.querySelector('[role="group"]')).toHaveAttribute('data-dirty');
    });

    it('shows the error of a Form for the name of the field, and takes it away at a change', async () => {
      const { container, user } = await render(
        <ErrorsForm errors={{ when: 'This date is taken' }}>
          <Field.Root name="when">
            <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </ErrorsForm>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('This date is taken');
      expect(segmentOf(container, 'day')).toHaveAttribute('aria-invalid', 'true');

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{ArrowUp}');

      expect(screen.queryByTestId('error')).toBe(null);
    });
  });

  describe('field', () => {
    it('names the group and the first segment from the label of the field', async () => {
      const { container, user } = await render(
        <Field.Root name="when">
          <Field.Label data-testid="label">Birthday</Field.Label>
          <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" />
        </Field.Root>,
      );
      const label = screen.getByTestId('label');

      expect(container.querySelector('[role="group"]')).toHaveAttribute(
        'aria-labelledby',
        label.id,
      );

      await user.click(label);
      expect(segmentOf(container, 'month')).toHaveFocus();
    });

    it('marks the enclosing field as filled at mount and clears the mark when the parent clears the value', async () => {
      const value = shallowRef<string | null>('2026-11-14');
      await render(() => (
        <Field.Root data-testid="field">
          <DateTimeFieldProbe modelValue={value.value} />
        </Field.Root>
      ));
      const field = screen.getByTestId('field');
      expect(field).toHaveAttribute('data-filled');

      value.value = null;
      await flushMicrotasks();
      expect(field).not.toHaveAttribute('data-filled');
    });

    it('gives disabled, read-only and required to the group state and the segments', async () => {
      const { container } = await render(
        <div>
          <DateTimeFieldProbe defaultValue="2026-11-14" disabled />
          <DateTimeFieldProbe defaultValue="2026-11-14" readOnly required />
        </div>,
      );
      const [disabled, readOnly] = Array.from(container.querySelectorAll('[role="group"]'));
      const [disabledInput] = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[aria-hidden]'),
      );

      expect(disabled).toHaveAttribute('data-disabled');
      expect(segmentOf(disabled!, 'day')).toBeDisabled();
      expect(disabledInput).toBeDisabled();
      expect(readOnly).toHaveAttribute('data-readonly');
      expect(readOnly).toHaveAttribute('data-required');
      expect(segmentOf(readOnly!, 'day').readOnly).toBe(true);
      expect(segmentOf(readOnly!, 'day')).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('a layout of the server that differs from the layout of the browser', () => {
    it.each([
      { name: 'a date in is-IS', props: { locale: 'is-IS', defaultValue: '2026-11-14' } },
      {
        name: 'a time in fr-CA',
        props: { family: 'time', locale: 'fr-CA', defaultValue: '15:04:33' },
      },
      {
        name: 'a date and time of a zone in de-DE',
        props: { locale: 'de-DE', defaultValue: '2026-11-14T15:04[Asia/Tokyo]' },
      },
      {
        name: 'a date and time in is-IS',
        props: { locale: 'is-IS', defaultValue: '2026-11-14T15:04' },
      },
    ])('hydrates $name with no warning', async ({ props }) => {
      const serverHtml = await renderOnServer(PROBE, props);

      await hydrate(DateTimeFieldProbe, { serverHtml, props });
    });

    it('makes the segments again when the server has other ranges for the same segments', async () => {
      // The same segments, in the same order, with the hour cycle h12 on the server and h11 here.
      const serverHtml = await renderOnServer(PROBE, {
        family: 'time',
        locale: 'ja-JP-u-hc-h12',
        defaultValue: '15:04',
      });
      const props = { family: 'time', locale: 'ja-JP-u-hc-h11', defaultValue: '15:04' };

      const { container } = await hydrate(DateTimeFieldProbe, { serverHtml, props });

      expect(segmentOf(container, 'hour')).toHaveAttribute('aria-valuemin', '0');
      expect(segmentOf(container, 'hour')).toHaveAttribute('aria-valuemax', '11');
    });

    it('makes the segments again when the layout of the server has another order', async () => {
      const serverHtml = await renderOnServer(PROBE, {
        locale: 'ja-JP',
        defaultValue: '2026-11-14',
      });
      const props = { locale: 'en-US', defaultValue: '2026-11-14' };

      const { container } = await hydrate(DateTimeFieldProbe, { serverHtml, props });

      expect(typesOf(container).join(' ')).toBe('month day year');
      expect(shownBy(container)).toBe(
        textOf(
          Temporal.PlainDate.from('2026-11-14'),
          { year: 'numeric', month: 'numeric', day: 'numeric' },
          'en-US',
        ),
      );
    });
  });

  // A case that throws in `setup` is the last of its file.
  it('throws a descriptive error when a part is rendered outside its root', async () => {
    const Outside = defineComponent(() => {
      useDateTimeFieldContext();
      return () => null;
    });

    await expect(render(<Outside />)).rejects.toThrow(
      'Vase UI: A part of a date or time field must be inside its root. Without a root the part has no value to show. Put the part inside <DateField.Root> or <TimeField.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
