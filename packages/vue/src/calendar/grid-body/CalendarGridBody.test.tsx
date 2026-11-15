import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

describe('<Calendar.GridBody />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.GridBody />, () => ({
    refInstanceof: window.HTMLTableSectionElement,
    testRenderPropWith: 'tbody',
    render: (node) => render(<CalendarAncestors level="month">{node}</CalendarAncestors>),
  }));

  it('renders the slot week for each week of the month, with the week and its index', async () => {
    await render(
      <CalendarAncestors level="month">
        <Calendar.GridBody
          v-slots={{
            week: ({ week, index }: { week: { start: Temporal.PlainDate }; index: number }) => (
              <tr data-testid="week">
                <td>{`${index}: ${week.start.toString()}`}</td>
              </tr>
            ),
          }}
        />
      </CalendarAncestors>,
    );

    // November 2026 has five weeks that start on Sunday.
    expect(screen.getAllByTestId('week').map((item) => item.textContent)).toEqual([
      '0: 2026-11-01',
      '1: 2026-11-08',
      '2: 2026-11-15',
      '3: 2026-11-22',
      '4: 2026-11-29',
    ]);
  });
});
