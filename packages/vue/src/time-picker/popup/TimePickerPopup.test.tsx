import { describe } from 'vitest';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

const time = Temporal.PlainTime.from('14:30');

describe('<TimePicker.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<TimePicker.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <TimePicker.Root open defaultValue={time}>
          <TimePicker.Trigger>Open</TimePicker.Trigger>
          <TimePicker.Portal>
            <TimePicker.Positioner>{node}</TimePicker.Positioner>
          </TimePicker.Portal>
        </TimePicker.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));
});
