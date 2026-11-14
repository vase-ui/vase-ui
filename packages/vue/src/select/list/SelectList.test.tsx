import { describe } from 'vitest';
import * as Select from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

describe('<Select.List />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.List />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>{node}</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));
});
