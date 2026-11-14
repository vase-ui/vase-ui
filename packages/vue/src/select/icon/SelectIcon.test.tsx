import { describe } from 'vitest';
import { createRenderer, describeConformance } from '#test-utils';
import * as Select from '../index.parts';

describe('<Select.Icon />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Icon />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(<Select.Root open>{node}</Select.Root>);
    },
  }));
});
