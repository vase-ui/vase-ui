import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarViewAncestors from '../root/CalendarViewAncestors.test.vue';

describe('<Calendar.MonthGrid />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.MonthGrid />, () => ({
    refInstanceof: window.HTMLDivElement,
    testRenderPropWith: 'div',
    render: (node) =>
      render(
        <CalendarViewAncestors view="month" level="root">
          {node}
        </CalendarViewAncestors>,
      ),
  }));

  function renderGrid(props: Record<string, unknown> = {}) {
    return render(
      <CalendarViewAncestors view="month" level="root">
        <Calendar.MonthGrid
          {...props}
          data-testid="grid"
          v-slots={{
            row: ({ months, index }: { months: Temporal.PlainYearMonth[]; index: number }) => (
              <div data-testid="row">{`${index}: ${months.map(String).join(' ')}`}</div>
            ),
          }}
        />
      </CalendarViewAncestors>,
    );
  }

  it('renders a grid that has a name, and the slot row for each row of three months', async () => {
    await renderGrid();

    const grid = screen.getByTestId('grid');
    expect(grid).toHaveAttribute('role', 'grid');
    expect(grid).toHaveAccessibleName(
      new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of('month'),
    );
    expect(screen.getAllByTestId('row').map((row) => row.textContent)).toEqual([
      '0: 2026-01 2026-02 2026-03',
      '1: 2026-04 2026-05 2026-06',
      '2: 2026-07 2026-08 2026-09',
      '3: 2026-10 2026-11 2026-12',
    ]);
  });

  it('gives each row the columns of the grid', async () => {
    await renderGrid({ columns: 5 });

    expect(screen.getAllByTestId('row').map((row) => row.textContent?.split(' ').length)).toEqual([
      6, 6, 3,
    ]);
  });

  it('renders nothing when the grid shows another view', async () => {
    await render(
      <CalendarViewAncestors view="year" level="root">
        <Calendar.MonthGrid data-testid="grid" />
      </CalendarViewAncestors>,
    );

    expect(screen.queryByTestId('grid')).toBe(null);
  });

  it('has no row for the #render slot, which gives the element of the grid', async () => {
    await render(
      <CalendarViewAncestors view="month" level="root">
        <Calendar.MonthGrid
          v-slots={{
            render: ({ props }: { props: Record<string, unknown> }) => (
              <section {...props} data-testid="render" />
            ),
            row: () => <p data-testid="row" />,
          }}
        />
      </CalendarViewAncestors>,
    );

    expect(screen.getByTestId('render')).toHaveAttribute('role', 'grid');
    expect(screen.queryByTestId('row')).toBe(null);
  });
});
