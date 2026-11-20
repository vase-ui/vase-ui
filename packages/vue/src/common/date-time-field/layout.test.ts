import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatter } from '../../internals/date-time/format';
import {
  getDayPeriodTexts,
  getFixedSegmentTexts,
  getSegmentLayout,
} from './layout';
import type { SegmentLayoutOptions, SegmentType } from './layout';

const DATE_TIME: SegmentLayoutOptions = {
  date: 'day',
  time: 'minute',
  hourCycle: 24,
  calendar: 'gregory',
  era: false,
  timeZoneName: false,
};

const types = (options: Partial<SegmentLayoutOptions>, locale = 'en-US') =>
  getSegmentLayout(locale, { ...DATE_TIME, ...options }).segments.map(({ type }) => type);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getSegmentLayout', () => {
  it.each(['en-US', 'de-DE', 'fr-FR', 'ja-JP', 'ar-EG', 'ko-KR', 'hi-IN', 'fr-CA'])(
    'gives the segments and the literals of %s in its order',
    (locale) => {
      const { segments } = getSegmentLayout(locale, DATE_TIME);
      const numbers = new Intl.NumberFormat(locale, {
        useGrouping: false,
        minimumIntegerDigits: 2,
      });
      const textOfType: Partial<Record<SegmentType, string>> = {
        year: new Intl.NumberFormat(locale, { useGrouping: false }).format(2026),
        month: numbers.format(11),
        day: numbers.format(14),
        hour: numbers.format(15),
        minute: numbers.format(4),
      };
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

      const shown = segments.map((segment) =>
        segment.type === 'literal' ? segment.text : textOfType[segment.type],
      );
      expect(shown.join('')).toBe(format.format(epoch));
    },
  );

  it.each([
    { name: 'a year and month', options: { date: 'month', time: undefined } as const, count: 2 },
    { name: 'a date', options: { date: 'day', time: undefined } as const, count: 3 },
    { name: 'a time of hours', options: { date: undefined, time: 'hour' } as const, count: 1 },
    { name: 'a time of seconds', options: { date: undefined, time: 'second' } as const, count: 3 },
  ])('shows only the units of $name', ({ options, count }) => {
    const editable = types(options).filter((type) => type !== 'literal');
    expect(editable).toHaveLength(count);
  });

  it.each([
    { hourCycle: 12 as const, resolved: 'h12', dayPeriod: true },
    { hourCycle: 24 as const, resolved: 'h23', dayPeriod: false },
  ])('has the hour cycle $resolved when the prop is $hourCycle', ({ hourCycle, ...expected }) => {
    const layout = getSegmentLayout('en-US', { ...DATE_TIME, hourCycle });
    expect(layout.hourCycle).toBe(expected.resolved);
    expect(layout.segments.some(({ type }) => type === 'dayPeriod')).toBe(expected.dayPeriod);
  });

  it('keeps the hour cycle of the locale, and has none without a time', () => {
    const [format] = formatter(Temporal.PlainTime.from('15:04'), { hour: 'numeric' }, 'de-DE');
    expect(getSegmentLayout('de-DE', { ...DATE_TIME, hourCycle: undefined }).hourCycle).toBe(
      format.resolvedOptions().hourCycle,
    );
    expect(getSegmentLayout('en-US', { ...DATE_TIME, time: undefined }).hourCycle).toBe(undefined);
  });

  it('puts the era and the time zone name where the locale puts them', () => {
    expect(types({ era: true, time: undefined })).toContain('era');
    expect(types({ timeZoneName: true })).toContain('timeZoneName');
    expect(types({ time: undefined, timeZoneName: true })).not.toContain('timeZoneName');
    const japanese = getSegmentLayout('ja-JP', {
      ...DATE_TIME,
      time: undefined,
      calendar: 'japanese',
    });
    expect(japanese.segments[0]?.type).toBe('era');
  });

  it('gives Intl the Gregorian calendar for the ISO calendar', () => {
    expect(types({ calendar: 'iso8601' })).toEqual(types({ calendar: 'gregory' }));
  });

  // `resolvedOptions()` of these calendars has no `year` in Node.js. Their pattern gives
  // `relatedYear`, so the layout keeps the pattern with no era.
  it.each([
    { name: 'the Chinese calendar in en-US', locale: 'en-US', calendar: 'chinese' },
    { name: 'the Dangi calendar in ko-KR', locale: 'ko-KR', calendar: 'dangi' },
  ])('keeps the layout of $name with no era', ({ locale, calendar }) => {
    const [format, epoch] = formatter(
      Temporal.PlainDate.from('2026-11-14').withCalendar(calendar),
      { year: 'numeric', month: 'numeric', day: 'numeric' },
      locale,
    );
    const parts = format
      .formatToParts(epoch)
      .map(({ type, value }) => (type === 'literal' ? value : type));
    const { segments } = getSegmentLayout(locale, { ...DATE_TIME, time: undefined, calendar });

    expect(segments.map(({ type, text }) => (type === 'literal' ? text : type))).toEqual(
      parts.map((part) => (part === 'relatedYear' ? 'year' : part)),
    );
  });

  it('maps the parts that Intl gives, and joins the literals that follow each other', () => {
    // `Intl` has the parts `relatedYear` and `yearName` for a Chinese year, and TypeScript has not.
    const part = (type: string, value: string) => ({ type, value }) as Intl.DateTimeFormatPart;
    vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockReturnValue([
      part('relatedYear', '2026'),
      part('yearName', 'bing-wu'),
      part('literal', '/'),
      part('literal', ' '),
      part('weekday', 'Sat'),
      part('month', '11'),
    ]);
    expect(getSegmentLayout('en-US', DATE_TIME).segments).toEqual([
      { type: 'year', text: '' },
      { type: 'year', text: '' },
      { type: 'literal', text: '/ Sat' },
      { type: 'month', text: '' },
    ]);
  });
});

describe('getFixedSegmentTexts', () => {
  const textsOf = (
    value: Temporal.PlainDate | Temporal.ZonedDateTime,
    options: SegmentLayoutOptions,
    locale = 'en-US',
  ) => getFixedSegmentTexts(value, locale, getSegmentLayout(locale, options), options.calendar);

  it('gives the era and the time zone name that Intl gives for the value', () => {
    const zoned = Temporal.ZonedDateTime.from('0000-03-01T09:00[Asia/Tokyo]').withCalendar(
      'gregory',
    );
    const options = { ...DATE_TIME, era: true, timeZoneName: true };
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo',
      calendar: 'gregory',
      era: 'short',
      timeZoneName: 'short',
      year: 'numeric',
      hour: 'numeric',
    }).formatToParts(zoned.epochMilliseconds);
    const textOf = (type: string) => parts.find((part) => part.type === type)?.value;

    expect(textsOf(zoned, options)).toEqual({
      era: textOf('era'),
      timeZoneName: textOf('timeZoneName'),
    });
  });

  it('gives the era of the calendar of the layout for a value in another calendar', () => {
    const options = { ...DATE_TIME, time: undefined, calendar: 'persian' };
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', calendar: 'persian' })
      .formatToParts(Date.UTC(2026, 10, 14))
      .filter((part) => part.type === 'era');

    expect(parts).toHaveLength(1);
    expect(textsOf(Temporal.PlainDate.from('2026-11-14'), options).era).toBe(parts[0]?.value);
  });

  it('gives an empty text for a part that the layout does not have', () => {
    expect(textsOf(Temporal.PlainDate.from('2026-11-14'), DATE_TIME)).toEqual({
      era: '',
      timeZoneName: '',
    });
  });
});

describe('the era of a layout', () => {
  const japanese = { ...DATE_TIME, time: undefined, calendar: 'japanese', locale: 'ja-JP' };
  const eraTextOf = (date: string, era: boolean) => {
    const options = { ...japanese, era };
    const layout = getSegmentLayout(japanese.locale, options);
    return getFixedSegmentTexts(
      Temporal.PlainDate.from(date),
      japanese.locale,
      layout,
      options.calendar,
    ).era;
  };

  it('keeps the style of the pattern of the locale when the pattern has an era', () => {
    // The pattern of ja-JP for the Japanese calendar writes the short form of the era.
    expect(eraTextOf('2019-05-01', false)).toBe(eraTextOf('2019-05-01', true));
    expect(eraTextOf('2018-05-01', false)).toBe(eraTextOf('2018-05-01', true));
    expect(eraTextOf('2018-05-01', true)).not.toBe('');
    expect(eraTextOf('2018-05-01', true)).toHaveLength(eraTextOf('2019-05-01', true).length);
  });

  it('gives Intl the era when the pattern has none', () => {
    const withEra = getSegmentLayout('en-US', { ...DATE_TIME, time: undefined, era: true });
    const withoutEra = getSegmentLayout('en-US', { ...DATE_TIME, time: undefined, era: false });

    expect(withEra.segments.some(({ type }) => type === 'era')).toBe(true);
    expect(withoutEra.segments.some(({ type }) => type === 'era')).toBe(false);
  });
});

describe('getDayPeriodTexts', () => {
  it.each(['en-US', 'ja-JP', 'ar-EG'])('gives the two day periods of %s', (locale) => {
    const text = (hour: number) =>
      new Intl.DateTimeFormat(locale, { hour: 'numeric', hourCycle: 'h12', timeZone: 'UTC' })
        .formatToParts(Date.UTC(2026, 10, 14, hour))
        .find((part) => part.type === 'dayPeriod')?.value;

    expect(getDayPeriodTexts(locale)).toEqual({ am: text(3), pm: text(15) });
  });
});
