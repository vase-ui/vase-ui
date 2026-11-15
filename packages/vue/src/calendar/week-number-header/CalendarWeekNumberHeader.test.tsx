import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

describe('<Calendar.WeekNumberHeader />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.WeekNumberHeader />, () => ({
    refInstanceof: window.HTMLTableCellElement,
    render: (node) =>
      render(
        <CalendarAncestors level="root">
          <table>
            <thead>
              <tr>{node}</tr>
            </thead>
          </table>
        </CalendarAncestors>,
      ),
  }));

  it('is the header of a column, and is named by the week number', async () => {
    await render(
      <CalendarAncestors level="root">
        <table>
          <thead>
            <tr>
              <Calendar.WeekNumberHeader data-testid="header">#</Calendar.WeekNumberHeader>
            </tr>
          </thead>
        </table>
      </CalendarAncestors>,
    );

    const header = screen.getByTestId('header');
    expect(header).toHaveAttribute('scope', 'col');
    expect(header).toHaveAccessibleName('Week number');
    expect(header).toHaveTextContent('#');
  });
});
