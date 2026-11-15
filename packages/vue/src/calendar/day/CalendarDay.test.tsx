import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

// 2026-11-11 is a Wednesday of the page of November 2026.
const day = () => Temporal.PlainDate.from('2026-11-11');

describe('<Calendar.Day />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.Day day={day()} />, () => ({
    refInstanceof: window.HTMLTableCellElement,
    testRenderPropWith: 'td',
    render: (node) => render(<CalendarAncestors level="month">{node}</CalendarAncestors>),
  }));

  it('renders a grid cell that has the date, and is not selected', async () => {
    await render(
      <CalendarAncestors level="month">
        <Calendar.Day day={day()} data-testid="day" />
      </CalendarAncestors>,
    );

    const cell = screen.getByTestId('day');
    expect(cell).toHaveAttribute('role', 'gridcell');
    expect(cell).toHaveAttribute('data-date', '2026-11-11');
    expect(cell).toHaveAttribute('aria-selected', 'false');
    expect(cell).not.toHaveAttribute('aria-disabled');
  });

  it('gives the state of the day to its default slot', async () => {
    await render(
      <CalendarAncestors level="month">
        <Calendar.Day
          day={Temporal.PlainDate.from('2026-11-14')}
          data-testid="day"
          v-slots={{
            default: ({ state }: { state: { today: boolean; weekend: boolean } }) =>
              `today ${state.today}, weekend ${state.weekend}`,
          }}
        />
      </CalendarAncestors>,
    );

    expect(screen.getByTestId('day')).toHaveTextContent('today true, weekend true');
  });

  it('gives a day of another month the state outsideMonth, and no selection', async () => {
    await render(
      <CalendarAncestors level="month">
        <Calendar.Day day={Temporal.PlainDate.from('2026-12-01')} data-testid="day" />
      </CalendarAncestors>,
    );

    const cell = screen.getByTestId('day');
    expect(cell).toHaveAttribute('data-outside-month');
    expect(cell).toHaveAttribute('data-hidden');
    expect(cell).not.toHaveAttribute('aria-selected');
  });
});
