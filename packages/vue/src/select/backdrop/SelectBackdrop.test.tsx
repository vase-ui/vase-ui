import { describe } from 'vitest';
import * as Select from '../index.parts';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Select.Root open>{node}</Select.Root>);
    },
  }));
});
