import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

describe('<Calendar.GridHeaderRow />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.GridHeaderRow />, () => ({
    refInstanceof: window.HTMLTableRowElement,
    testRenderPropWith: 'tr',
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));

  it('renders the slot weekday for each day of the week, from the first day of the week', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.GridHeaderRow
          v-slots={{
            weekday: ({ weekday, index }: { weekday: number; index: number }) => (
              <td data-testid="weekday">{`${index}: ${weekday}`}</td>
            ),
          }}
        />
      </CalendarAncestors>,
    );

    // The locale `en-US` starts the week on Sunday, which is the day 7.
    expect(screen.getAllByTestId('weekday').map((item) => item.textContent)).toEqual([
      '0: 7',
      '1: 1',
      '2: 2',
      '3: 3',
      '4: 4',
      '5: 5',
      '6: 6',
    ]);
  });
});
