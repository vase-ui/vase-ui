import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import { getMonthPage } from '../../internals/date-time/calendar/monthGrid';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

const week = () => getMonthPage(Temporal.PlainYearMonth.from('2026-11'), 7).weeks[1]!;

describe('<Calendar.Week />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.Week week={week()} />, () => ({
    refInstanceof: window.HTMLTableRowElement,
    testRenderPropWith: 'tr',
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));

  it('renders the slot day for each day of the week, with the day and its index', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.Week
          week={week()}
          v-slots={{
            day: ({ day, index }: { day: Temporal.PlainDate; index: number }) => (
              <td data-testid="day">{`${index}: ${day.toString()}`}</td>
            ),
          }}
        />
      </CalendarAncestors>,
    );

    expect(screen.getAllByTestId('day').map((item) => item.textContent)).toEqual([
      '0: 2026-11-08',
      '1: 2026-11-09',
      '2: 2026-11-10',
      '3: 2026-11-11',
      '4: 2026-11-12',
      '5: 2026-11-13',
      '6: 2026-11-14',
    ]);
  });
});
