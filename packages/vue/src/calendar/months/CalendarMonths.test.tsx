import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

describe('<Calendar.Months />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.Months />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));

  it('renders the slot month for each page, with the page and its index', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.Months
          v-slots={{
            month: ({
              month,
              index,
            }: {
              month: { yearMonth: Temporal.PlainYearMonth };
              index: number;
            }) => <span data-testid="month">{`${index}: ${month.yearMonth.toString()}`}</span>,
          }}
        />
      </CalendarAncestors>,
    );

    expect(screen.getAllByTestId('month').map((item) => item.textContent)).toEqual(['0: 2026-11']);
  });

  it('does not render the slot month in the slot render', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.Months
          v-slots={{
            month: () => <span data-testid="month" />,
            render: ({ props }: { props: Record<string, unknown> }) => (
              <section {...props} data-testid="custom" />
            ),
          }}
        />
      </CalendarAncestors>,
    );

    expect(screen.getByTestId('custom')).not.toBe(null);
    expect(screen.queryByTestId('month')).toBe(null);
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Calendar.Root>', async () => {
    await expect(render(<Calendar.Months />)).rejects.toThrow(
      'Vase UI: A part of Calendar must be inside <Calendar.Root>. Without a root the part has no days and no selection to show. Put the part inside <Calendar.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
