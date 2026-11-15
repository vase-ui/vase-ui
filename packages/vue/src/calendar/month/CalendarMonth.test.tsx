import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import { getMonthPage } from '../../internals/date-time/calendar/monthGrid';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

const page = () => getMonthPage(Temporal.PlainYearMonth.from('2026-11'), 7);

describe('<Calendar.Month />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.Month month={page()} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));

  it('gives the position of the month, also the first one, and the state of the calendar', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.Month month={page()} data-testid="month" />
      </CalendarAncestors>,
    );

    const month = screen.getByTestId('month');
    expect(month).toHaveAttribute('data-index', '0');
    expect(month).toHaveAttribute('data-empty');
  });

  it('gives its default slot the state', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.Month
          month={page()}
          v-slots={{ default: ({ state }: { state: { index: number } }) => `index ${state.index}` }}
          data-testid="month"
        />
      </CalendarAncestors>,
    );

    expect(screen.getByTestId('month')).toHaveTextContent('index 0');
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Calendar.Root>', async () => {
    await expect(render(<Calendar.Month month={page()} />)).rejects.toThrow(
      'Vase UI: A part of Calendar must be inside <Calendar.Root>. Without a root the part has no days and no selection to show. Put the part inside <Calendar.Root>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
