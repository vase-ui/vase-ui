import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import type { DayOfWeek } from '../../internals/date-time/temporal';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

// The day 2024-01-01 is a Monday, so the day of the week is the day of January.
function weekdayName(weekday: number, style: 'narrow' | 'short' | 'long') {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: style }).format(
    Date.UTC(2024, 0, weekday),
  );
}

describe('<Calendar.Weekday />', () => {
  const { render } = createRenderer();

  function renderWeekday(weekday: number, props = {}) {
    return render(
      <CalendarAncestors level="root">
        <Calendar.Weekday weekday={weekday as DayOfWeek} {...props} data-testid="weekday" />
      </CalendarAncestors>,
    );
  }

  describeConformance(<Calendar.Weekday weekday={1} />, () => ({
    refInstanceof: window.HTMLTableCellElement,
    testRenderPropWith: 'th',
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));

  it('renders a column header that has the short name, and the long name in abbr', async () => {
    await renderWeekday(3);

    const header = screen.getByTestId('weekday');
    expect(header).toHaveAttribute('scope', 'col');
    expect(header).toHaveTextContent(weekdayName(3, 'short'));
    expect(header).toHaveAttribute('abbr', weekdayName(3, 'long'));
  });

  it.each(['narrow', 'short', 'long'] as const)(
    'writes the %s name with the format',
    async (format) => {
      await renderWeekday(3, { format });

      expect(screen.getByTestId('weekday').textContent).toBe(weekdayName(3, format));
      expect(screen.getByTestId('weekday')).toHaveAttribute('abbr', weekdayName(3, 'long'));
    },
  );

  it.each([
    { name: 'Saturday', weekday: 6, expected: true },
    { name: 'Sunday', weekday: 7, expected: true },
    { name: 'Monday', weekday: 1, expected: false },
  ])('gives $name the state weekend: $expected', async ({ weekday, expected }) => {
    await renderWeekday(weekday);

    expect(screen.getByTestId('weekday').hasAttribute('data-weekend')).toBe(expected);
  });

  it('gives the name to the default slot and to the slot render', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.Weekday
          weekday={1}
          data-testid="default"
          v-slots={{ default: ({ text }: { text: string }) => `[${text}]` }}
        />
        <Calendar.Weekday
          weekday={1}
          v-slots={{
            render: ({ props, text }: { props: Record<string, unknown>; text: string }) => (
              <td {...props} data-testid="render">{`(${text})`}</td>
            ),
          }}
        />
      </CalendarAncestors>,
    );

    expect(screen.getByTestId('default')).toHaveTextContent(`[${weekdayName(1, 'short')}]`);
    expect(screen.getByTestId('render')).toHaveTextContent(`(${weekdayName(1, 'short')})`);
  });
});
