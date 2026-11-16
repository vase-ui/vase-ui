import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarViewAncestors from '../root/CalendarViewAncestors.test.vue';

describe('<Calendar.MonthGridRow />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.MonthGridRow />, () => ({
    refInstanceof: window.HTMLDivElement,
    testRenderPropWith: 'div',
    render: (node) =>
      render(
        <CalendarViewAncestors view="month" level="grid">
          {node}
        </CalendarViewAncestors>,
      ),
  }));

  it('renders a row', async () => {
    await render(
      <CalendarViewAncestors view="month" level="grid">
        <Calendar.MonthGridRow data-testid="row" />
      </CalendarViewAncestors>,
    );

    expect(screen.getByTestId('row')).toHaveAttribute('role', 'row');
  });
});
