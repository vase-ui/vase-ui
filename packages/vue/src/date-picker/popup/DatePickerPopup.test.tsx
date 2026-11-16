import { describe } from 'vitest';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

const day = Temporal.PlainDate.from('2026-11-14');

describe('<DatePicker.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<DatePicker.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <DatePicker.Root open defaultValue={day}>
          <DatePicker.Trigger>Open</DatePicker.Trigger>
          <DatePicker.Portal>
            <DatePicker.Positioner>{node}</DatePicker.Positioner>
          </DatePicker.Portal>
        </DatePicker.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));
});
