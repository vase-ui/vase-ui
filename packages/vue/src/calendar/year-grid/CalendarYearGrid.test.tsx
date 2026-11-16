import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarViewAncestors from '../root/CalendarViewAncestors.test.vue';

describe('<Calendar.YearGrid />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.YearGrid />, () => ({
    refInstanceof: window.HTMLDivElement,
    testRenderPropWith: 'div',
    render: (node) =>
      render(
        <CalendarViewAncestors view="year" level="root">
          {node}
        </CalendarViewAncestors>,
      ),
  }));

  it('renders a grid that has a name, and the slot row for each row of the page of years', async () => {
    await render(
      <CalendarViewAncestors view="year" level="root">
        <Calendar.YearGrid
          data-testid="grid"
          columns={4}
          v-slots={{
            row: ({ years, index }: { years: Temporal.PlainYearMonth[]; index: number }) => (
              <div data-testid="row">{`${index}: ${years.map((year) => year.year).join(' ')}`}</div>
            ),
          }}
        />
      </CalendarViewAncestors>,
    );

    const grid = screen.getByTestId('grid');
    expect(grid).toHaveAttribute('role', 'grid');
    expect(grid).not.toHaveAttribute('aria-multiselectable');
    expect(grid).toHaveAccessibleName(
      new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of('year'),
    );
    expect(screen.getAllByTestId('row').map((row) => row.textContent)).toEqual([
      '0: 2016 2017 2018 2019',
      '1: 2020 2021 2022 2023',
      '2: 2024 2025 2026 2027',
    ]);
  });

  it('renders nothing when the grid shows another view', async () => {
    await render(
      <CalendarViewAncestors view="month" level="root">
        <Calendar.YearGrid data-testid="grid" />
      </CalendarViewAncestors>,
    );

    expect(screen.queryByTestId('grid')).toBe(null);
  });
});
