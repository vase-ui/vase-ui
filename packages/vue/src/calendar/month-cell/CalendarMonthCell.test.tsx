import { describe, expect, it, vi } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarViewAncestors from '../root/CalendarViewAncestors.test.vue';

// 2026-11-14 is today. The month of the cell is March 2026.
const month = () => Temporal.PlainYearMonth.from('2026-03');

function format(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(
    Date.parse('2026-03-01'),
  );
}

describe('<Calendar.MonthCell />', () => {
  const { render } = createRenderer();

  function renderCell(props: Record<string, unknown> = {}, slots = {}) {
    return render(
      <CalendarViewAncestors view="month" level="row">
        <Calendar.MonthCell month={month()} {...props} data-testid="cell" v-slots={slots} />
      </CalendarViewAncestors>,
    );
  }

  describeConformance(<Calendar.MonthCell month={month()} />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    testRenderPropWith: 'button',
    render: (node) =>
      render(
        <CalendarViewAncestors view="month" level="row">
          {node}
        </CalendarViewAncestors>,
      ),
  }));

  it('renders a button that has the name of the month, and the month and year as its name', async () => {
    await renderCell();

    const cell = screen.getByTestId('cell');
    expect(cell).toHaveAttribute('type', 'button');
    expect(cell).toHaveAttribute('role', 'gridcell');
    expect(cell.textContent).toBe(format({ month: 'long' }));
    expect(cell).toHaveAccessibleName(format({ month: 'long', year: 'numeric' }));
    expect(cell).toHaveAttribute('aria-selected', 'false');
    expect(cell).not.toHaveAttribute('aria-current');
  });

  it('writes the text of the month in the format, and names the button by that text and the year', async () => {
    await renderCell({ format: 'short' });

    const cell = screen.getByTestId('cell');
    expect(cell.textContent).toBe(format({ month: 'short' }));
    expect(cell).toHaveAccessibleName(format({ month: 'short', year: 'numeric' }));
  });

  it('gives the text and the state to the default slot and to the slot render', async () => {
    await renderCell(
      {},
      {
        default: ({ text, state }: { text: string; state: { selected: boolean } }) =>
          `[${text} ${state.selected}]`,
      },
    );
    expect(screen.getByTestId('cell')).toHaveTextContent(`[${format({ month: 'long' })} false]`);
  });

  it('gives the text to the slot render', async () => {
    await renderCell(
      {},
      {
        render: ({ props, text }: { props: Record<string, unknown>; text: string }) => (
          <button {...props} data-testid="render">{`(${text})`}</button>
        ),
      },
    );

    expect(screen.getByTestId('render')).toHaveTextContent(`(${format({ month: 'long' })})`);
  });

  it.each([
    { name: 'Enter', keys: '{Enter}' },
    { name: 'Space', keys: ' ' },
    { name: 'a click', keys: null },
  ])('presses a button that is not a native button with $name', async ({ keys }) => {
    const onClick = vi.fn();
    const { user } = await renderCell({ as: 'div', nativeButton: false, onClick });
    const cell = screen.getByTestId('cell');

    expect(cell).toHaveAttribute('role', 'gridcell');
    if (keys === null) {
      await user.click(cell);
    } else {
      cell.focus();
      await user.keyboard(keys);
    }

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
