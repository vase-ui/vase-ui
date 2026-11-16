import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarViewAncestors from '../root/CalendarViewAncestors.test.vue';

// The page of years that holds today, in 2026, has the years 2016 to 2027.
const year = () => Temporal.PlainYearMonth.from('2018-01');

describe('<Calendar.YearCell />', () => {
  const { render } = createRenderer();

  function renderCell(props: Record<string, unknown> = {}, slots = {}) {
    return render(
      <CalendarViewAncestors view="year" level="row">
        <Calendar.YearCell year={year()} {...props} data-testid="cell" v-slots={slots} />
      </CalendarViewAncestors>,
    );
  }

  describeConformance(<Calendar.YearCell year={year()} />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    testRenderPropWith: 'button',
    render: (node) =>
      render(
        <CalendarViewAncestors view="year" level="row">
          {node}
        </CalendarViewAncestors>,
      ),
  }));

  it('renders a button that has the year as its text and as its name', async () => {
    await renderCell();

    const cell = screen.getByTestId('cell');
    expect(cell).toHaveAttribute('type', 'button');
    expect(cell).toHaveAttribute('role', 'gridcell');
    expect(cell).not.toHaveAttribute('aria-label');
    expect(cell).toHaveAccessibleName('2018');
    expect(cell).toHaveAttribute('aria-selected', 'false');
  });

  it('writes the year in the format', async () => {
    await renderCell({ format: '2-digit' });

    expect(screen.getByTestId('cell').textContent).toBe('18');
  });

  it('gives the text and the state to the default slot', async () => {
    await renderCell(
      {},
      {
        default: ({ text, state }: { text: string; state: { current: boolean } }) =>
          `[${text} ${state.current}]`,
      },
    );

    expect(screen.getByTestId('cell')).toHaveTextContent('[2018 false]');
  });

  it('has the state current for the year of today', async () => {
    await renderCell({ year: Temporal.PlainYearMonth.from('2026-01') });

    expect(screen.getByTestId('cell')).toHaveAttribute('data-current');
    expect(screen.getByTestId('cell')).toHaveAttribute('aria-current', 'date');
  });
});
