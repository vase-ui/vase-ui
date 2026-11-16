import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as RangeCalendar from '../index.parts';
import RangeCalendarAncestors from '../root/RangeCalendarAncestors.test.vue';

// 2026-11-11 is a Wednesday of the page of November 2026.
const day = () => Temporal.PlainDate.from('2026-11-11');

describe('<RangeCalendar.Day />', () => {
  const { render } = createRenderer();

  describeConformance(<RangeCalendar.Day day={day()} />, () => ({
    refInstanceof: window.HTMLTableCellElement,
    testRenderPropWith: 'td',
    render: (node) => render(<RangeCalendarAncestors level="month">{node}</RangeCalendarAncestors>),
  }));

  it('renders a grid cell that has the date, and is not selected', async () => {
    await render(
      <RangeCalendarAncestors level="month">
        <RangeCalendar.Day day={day()} data-testid="day" />
      </RangeCalendarAncestors>,
    );

    const cell = screen.getByTestId('day');
    expect(cell).toHaveAttribute('role', 'gridcell');
    expect(cell).toHaveAttribute('data-date', '2026-11-11');
    expect(cell).toHaveAttribute('aria-selected', 'false');
    expect(cell).not.toHaveAttribute('aria-disabled');
    expect(cell).not.toHaveAttribute('data-range-start');
    expect(cell).not.toHaveAttribute('data-range-end');
    expect(cell).not.toHaveAttribute('data-range-middle');
  });

  it('gives the state of the day, and its range states, to its default slot', async () => {
    await render(
      <RangeCalendarAncestors level="month">
        <RangeCalendar.Day
          day={Temporal.PlainDate.from('2026-11-14')}
          data-testid="day"
          v-slots={{
            default: ({ state }: { state: Record<string, boolean> }) =>
              ['today', 'weekend', 'rangeStart', 'rangeEnd', 'rangeMiddle', 'selected']
                .map((key) => `${key} ${state[key]}`)
                .join(', '),
          }}
        />
      </RangeCalendarAncestors>,
    );

    expect(screen.getByTestId('day')).toHaveTextContent(
      'today true, weekend true, rangeStart false, rangeEnd false, rangeMiddle false, selected false',
    );
  });

  it('gives a day of another month the state outsideMonth, and no selection', async () => {
    await render(
      <RangeCalendarAncestors level="month">
        <RangeCalendar.Day day={Temporal.PlainDate.from('2026-12-01')} data-testid="day" />
      </RangeCalendarAncestors>,
    );

    const cell = screen.getByTestId('day');
    expect(cell).toHaveAttribute('data-outside-month');
    expect(cell).toHaveAttribute('data-hidden');
    expect(cell).not.toHaveAttribute('aria-selected');
  });
});
