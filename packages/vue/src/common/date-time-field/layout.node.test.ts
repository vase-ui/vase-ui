import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LayoutCase, LayoutResult } from '../../../../test/server/printSegmentLayouts';
import { formatter } from '../../internals/date-time/format';
import type { TemporalValue } from '../../internals/date-time/temporal';
import type { SegmentLayoutOptions } from './layout';

const PRINT_SEGMENT_LAYOUTS = fileURLToPath(
  new URL('../../../../test/server/printSegmentLayouts.ts', import.meta.url),
);

// `Temporal` has no `islamic` and no `islamic-rgsa`, so no field shows them.
const CALENDARS = [
  'buddhist',
  'coptic',
  'ethioaa',
  'ethiopic',
  'hebrew',
  'indian',
  'islamic-civil',
  'islamic-tbla',
  'islamic-umalqura',
  'japanese',
  'persian',
  'roc',
];

const DATE: SegmentLayoutOptions = {
  date: 'day',
  time: undefined,
  hourCycle: undefined,
  calendar: 'gregory',
  era: false,
  timeZoneName: false,
};
const YEAR_MONTH: SegmentLayoutOptions = { ...DATE, date: 'month' };

function printSegmentLayouts(cases: LayoutCase[]): Record<string, LayoutResult> {
  const child = spawnSync(process.execPath, [PRINT_SEGMENT_LAYOUTS], {
    input: JSON.stringify(cases),
    encoding: 'utf8',
  });
  const lines = child.stdout.trim().split('\n');
  // A child that `Intl` ends gets a signal. Its last line is the name of the case of the call.
  expect({
    signal: child.signal,
    lastCase: child.status === 0 ? undefined : lines.at(-1),
    stderr: child.stderr,
  }).toEqual({ signal: null, lastCase: undefined, stderr: '' });
  return JSON.parse(lines.at(-1)!) as Record<string, LayoutResult>;
}

const DATE_WITH_ERA: Intl.DateTimeFormatOptions = {
  era: 'short',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
};

function textsOf(value: TemporalValue, locale: string, options: Intl.DateTimeFormatOptions) {
  const [format, epoch] = formatter(value, options, locale);
  const parts = format.formatToParts(epoch);
  const textOf = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { era: textOf('era'), timeZoneName: textOf('timeZoneName') };
}

// Node.js 22, 24 and 26 end the process for these layouts
// (https://github.com/nodejs/node/issues/67076). When `.node-version` has the correction, `my` gets
// the order and the Japanese era names of its own pattern, and both cases fail. See "Tool versions"
// in CONTRIBUTING.md.
describe('getSegmentLayout in Node.js', () => {
  it('gives each layout of my, ksh and sc that Node.js 22 to 26 cannot format', () => {
    const cases = [
      ...CALENDARS.map((calendar) => ({
        name: `my-MM ${calendar}`,
        locale: 'my-MM',
        options: { ...DATE, calendar },
        expected: 'era " " year "/" month "/" day',
      })),
      ...['gregory', ...CALENDARS].map((calendar) => ({
        name: `ksh ${calendar}`,
        locale: 'ksh',
        options: { ...YEAR_MONTH, calendar },
        expected: 'year "-" month',
      })),
      { name: 'sc-IT gregory', locale: 'sc-IT', options: YEAR_MONTH, expected: 'month "/" year' },
      // The field asks for the era of a value in another era than its reference date.
      {
        name: 'ksh japanese with an era',
        locale: 'ksh',
        options: { ...YEAR_MONTH, era: true, calendar: 'japanese' },
        expected: 'era " " year "-" month',
      },
      {
        name: 'sc-IT gregory with an era',
        locale: 'sc-IT',
        options: { ...YEAR_MONTH, era: true },
        expected: 'month "/" year " " era',
      },
    ];

    const results = printSegmentLayouts(cases);

    expect(
      Object.fromEntries(Object.entries(results).map(([name, { types }]) => [name, types])),
    ).toEqual(Object.fromEntries(cases.map(({ name, expected }) => [name, expected])));
  });

  it('gives the era and the time zone name of a value in such a layout', () => {
    const zoned = '2026-11-14T15:04[Asia/Tokyo]';
    const results = printSegmentLayouts([
      {
        name: 'a zoned Buddhist value',
        locale: 'my-MM',
        options: { ...DATE, time: 'minute', timeZoneName: true, calendar: 'buddhist' },
        value: zoned,
      },
      {
        name: 'a Japanese date',
        locale: 'my-MM',
        options: { ...DATE, calendar: 'japanese' },
        value: '2026-11-14',
      },
      // The field asks for the era of a date in another era than its reference date.
      {
        name: 'a Japanese date of another era',
        locale: 'my-MM',
        options: { ...DATE, era: true, calendar: 'japanese' },
        value: '2019-04-01',
      },
    ]);

    // The options with `era: 'short'` never end the process.
    expect(
      Object.fromEntries(Object.entries(results).map(([name, { texts }]) => [name, texts])),
    ).toEqual({
      'a zoned Buddhist value': textsOf(
        Temporal.ZonedDateTime.from(zoned).withCalendar('buddhist'),
        'my-MM',
        { ...DATE_WITH_ERA, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' },
      ),
      'a Japanese date': textsOf(
        Temporal.PlainDate.from('2026-11-14').withCalendar('japanese'),
        'my-MM',
        DATE_WITH_ERA,
      ),
      'a Japanese date of another era': textsOf(
        Temporal.PlainDate.from('2019-04-01').withCalendar('japanese'),
        'my-MM',
        DATE_WITH_ERA,
      ),
    });
  });
});
