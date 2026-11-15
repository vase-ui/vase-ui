import { describe, expect, it } from 'vitest';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

const monthName = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
}).format(Date.parse('2026-11-14'));

describe('<Calendar.Grid />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.Grid />, () => ({
    refInstanceof: window.HTMLTableElement,
    testRenderPropWith: 'table',
    render: (node) => render(<CalendarAncestors level="month">{node}</CalendarAncestors>),
  }));

  it('names the grid by the month when no caption names it', async () => {
    await render(
      <CalendarAncestors level="month">
        <Calendar.Grid />
      </CalendarAncestors>,
    );

    // The grid assumes a caption until it is mounted, and the first flush after the mount drops it.
    await flushMicrotasks();

    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('grid')).toHaveAccessibleName(monthName);
  });

  it.each([
    { name: 'an aria-label', props: { 'aria-label': 'Departure' }, expected: 'Departure' },
    { name: 'an aria-labelledby', props: { 'aria-labelledby': 'title' }, expected: null },
  ])('lets $name of the consumer replace the name of the month', async ({ props, expected }) => {
    await render(
      <CalendarAncestors level="month">
        <span id="title">Departure</span>
        <Calendar.Grid {...props} />
      </CalendarAncestors>,
    );

    const grid = screen.getByRole('grid');
    expect(grid.getAttribute('aria-label')).toBe(expected);
    expect(grid).toHaveAccessibleName('Departure');
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Calendar.Month>', async () => {
    await expect(
      render(
        <CalendarAncestors level="root">
          <Calendar.Grid />
        </CalendarAncestors>,
      ),
    ).rejects.toThrow(
      'Vase UI: A part of a month of Calendar must be inside <Calendar.Month>. Without a month the part has no weeks to show. Put the part inside <Calendar.Month>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
