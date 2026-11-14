import { describe } from 'vitest';
import * as Select from '../index.parts';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.ScrollDownArrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.ScrollDownArrow keepMounted />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Positioner>{node}</Select.Positioner>
        </Select.Root>,
      );
    },
  }));
});
