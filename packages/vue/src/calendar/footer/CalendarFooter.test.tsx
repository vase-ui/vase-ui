import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';
import CalendarNavigationAnatomy from '../root/CalendarNavigationAnatomy.test.vue';

describe('<Calendar.Footer />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.Footer />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));

  it('is a live region that shows the message and the state of the calendar', async () => {
    await render(
      <CalendarNavigationAnatomy
        {...{ today: Temporal.PlainDate.from('2026-11-14'), locale: 'en-US', invalid: true }}
        footer="No day is selected."
      />,
    );

    const footer = screen.getByRole('status');
    expect(footer).toHaveTextContent('No day is selected.');
    expect(footer).toHaveAttribute('aria-live', 'polite');
    expect(footer).toHaveAttribute('data-empty');
    expect(footer).toHaveAttribute('data-invalid');
  });
});
