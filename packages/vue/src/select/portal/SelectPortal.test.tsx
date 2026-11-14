import { describe } from 'vitest';
import * as Select from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

describe('<Select.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(<Select.Root open>{node}</Select.Root>);
      await flushMicrotasks();
      return result;
    },
  }));
});
