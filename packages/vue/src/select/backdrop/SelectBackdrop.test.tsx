import { describe } from 'vitest';
import { Select } from '@vase-ui/vue/select';
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
