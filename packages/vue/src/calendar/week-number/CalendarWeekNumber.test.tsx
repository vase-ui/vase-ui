import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import { getMonthPage } from '../../internals/date-time/calendar/monthGrid';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';
import CalendarNavigationAnatomy from '../root/CalendarNavigationAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday.
const today = () => day('2026-11-14');

function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

// The page of November 2026 with weeks that start on Sunday: its first week is 2026-11-01.
const week = () => getMonthPage(Temporal.PlainYearMonth.from('2026-11'), 7).weeks[0]!;

describe('<Calendar.WeekNumber />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.WeekNumber week={week()} />, () => ({
    refInstanceof: window.HTMLTableCellElement,
    render: (node) =>
      render(
        <CalendarAncestors level="root">
          <table>
            <tbody>
              <tr>{node}</tr>
            </tbody>
          </table>
        </CalendarAncestors>,
      ),
  }));

  function renderCalendar(props: Record<string, unknown> = {}) {
    return render(
      <CalendarNavigationAnatomy
        {...{ today: today(), locale: 'en-US', weekNumbers: true, ...props }}
      />,
    );
  }

  // The text of the cells of the week numbers, one for each week of the grid.
  const numbers = () =>
    [...document.querySelectorAll('th[scope="row"]')].map((header) => header.textContent);

  it('numbers each week, and gives the week as a row header with a name and a state', async () => {
    await renderCalendar();

    // The week that holds January 1, from Sunday: 2026-11-01 is the first day of week 45.
    expect(numbers()).toEqual(['45', '46', '47', '48', '49']);
    const header = document.querySelector('th[scope="row"]')!;
    expect(header).toHaveAttribute('data-week-number', '45');
    expect(header).toHaveAccessibleName('Week 45');
    expect(header).toHaveAttribute('data-empty');
  });

  it.each([
    {
      name: 'a locale that starts on Monday has the ISO numbers',
      props: { locale: 'fr' },
      expected: ['44', '45', '46', '47', '48', '49'],
    },
    {
      name: 'isoWeek has the ISO numbers',
      props: { isoWeek: true },
      expected: ['44', '45', '46', '47', '48', '49'],
    },
    {
      name: 'firstDayOfWeek 1 has the ISO numbers',
      props: { firstDayOfWeek: 1 },
      expected: ['44', '45', '46', '47', '48', '49'],
    },
  ])('numbers the weeks of November 2026: $name', async ({ props, expected }) => {
    await renderCalendar(props);

    expect(numbers()).toEqual(expected);
  });

  it.each([
    { name: 'isoWeek: the last week of 2026 is week 53', props: { isoWeek: true }, last: '53' },
    {
      name: 'firstWeekContainsDate 1 with Monday: that week is week 1 of 2027',
      props: { firstDayOfWeek: 1, firstWeekContainsDate: 1 },
      last: '1',
    },
    {
      name: 'a locale that starts on Sunday: that week has the next number',
      props: {},
      last: '1',
    },
  ])('numbers the week that holds December 28 and January 1: $name', async ({ props, last }) => {
    await renderCalendar({ ...props, defaultMonth: Temporal.PlainYearMonth.from('2026-12') });

    expect(numbers().at(-1)).toBe(last);
  });

  it('shows the digits of the locale', async () => {
    await renderCalendar({ locale: 'ar-EG-u-nu-arab' });

    expect(numbers()[0]).toBe(new Intl.NumberFormat('ar-EG-u-nu-arab').format(45));
  });

  it('gives the default slot the text and the state', async () => {
    await render(
      <CalendarAncestors level="root">
        <table>
          <tbody>
            <tr>
              <Calendar.WeekNumber
                week={week()}
                data-testid="number"
                v-slots={{
                  default: ({ text, state }: { text: string; state: { weekNumber: number } }) =>
                    `${text}:${state.weekNumber}`,
                }}
              />
            </tr>
          </tbody>
        </table>
      </CalendarAncestors>,
    );

    expect(screen.getByTestId('number')).toHaveTextContent('45:45');
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Calendar.Root>', async () => {
    await expect(render(<Calendar.WeekNumber week={week()} />)).rejects.toThrow(
      'Vase UI: A part of Calendar must be inside <Calendar.Root>. Without a root the part has no days and no selection to show. Put the part inside <Calendar.Root>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
