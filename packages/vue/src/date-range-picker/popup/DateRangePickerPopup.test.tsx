import { describe } from 'vitest';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

const day = (text: string) => Temporal.PlainDate.from(text);

describe('<DateRangePicker.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<DateRangePicker.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <DateRangePicker.Root open defaultValue={[day('2026-11-14'), day('2026-11-16')]}>
          <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
          <DateRangePicker.Portal>
            <DateRangePicker.Positioner>{node}</DateRangePicker.Positioner>
          </DateRangePicker.Portal>
        </DateRangePicker.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));
});
