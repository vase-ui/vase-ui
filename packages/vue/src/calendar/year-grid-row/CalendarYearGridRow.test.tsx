import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarViewAncestors from '../root/CalendarViewAncestors.test.vue';

describe('<Calendar.YearGridRow />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.YearGridRow />, () => ({
    refInstanceof: window.HTMLDivElement,
    testRenderPropWith: 'div',
    render: (node) =>
      render(
        <CalendarViewAncestors view="year" level="grid">
          {node}
        </CalendarViewAncestors>,
      ),
  }));

  it('renders a row', async () => {
    await render(
      <CalendarViewAncestors view="year" level="grid">
        <Calendar.YearGridRow data-testid="row" />
      </CalendarViewAncestors>,
    );

    expect(screen.getByTestId('row')).toHaveAttribute('role', 'row');
  });
});
