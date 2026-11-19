import { expect, it } from 'vitest';
import { defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import { createRenderer, screen } from '#test-utils';
import { Calendar } from '@vase-ui/vue/calendar';
import { getMonthPage } from '../../internals/date-time/calendar/monthGrid';

const { render } = createRenderer();

it.each(['day', 'month', 'year'] as const)(
  'focuses the active %s cell after a cached cell returns',
  async (view) => {
    const date = Temporal.PlainDate.from('2016-01-01');
    const month = date.toPlainYearMonth();
    const page = getMonthPage(month, 1);
    const key = shallowRef(1);
    const root = shallowRef<{ focus(): void } | null>(null);
    const Cell = defineComponent(() => {
      if (view === 'day') {
        return () => <Calendar.DayButton data-testid="cell" />;
      }
      return view === 'month'
        ? () => <Calendar.MonthCell month={month} data-testid="cell" />
        : () => <Calendar.YearCell year={month} data-testid="cell" />;
    });
    const cached = () => (
      <KeepAlive>
        <Cell key={key.value} />
      </KeepAlive>
    );
    const row = ({ index }: { index: number }) => (index === 0 ? cached() : null);
    const Host = defineComponent(() => () => (
      <Calendar.Root ref={root} view={view} today={date} locale="en-US">
        {view === 'day' ? (
          <Calendar.Month month={page}>
            <Calendar.Day day={date}>{cached()}</Calendar.Day>
          </Calendar.Month>
        ) : view === 'month' ? (
          <Calendar.MonthGrid v-slots={{ row }} />
        ) : (
          <Calendar.YearGrid v-slots={{ row }} />
        )}
      </Calendar.Root>
    ));
    await render(<Host />);
    const first = screen.getByTestId('cell');
    for (const next of [2, 1]) {
      key.value = next;
      await nextTick();
      root.value!.focus();
      await nextTick();
      expect(screen.getByTestId('cell')).toHaveFocus();
    }
    expect(screen.getByTestId('cell')).toBe(first);
  },
);
