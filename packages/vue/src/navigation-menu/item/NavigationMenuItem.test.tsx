import { describe } from 'vitest';
import { createRenderer, describeConformance } from '#test-utils';
import * as NavigationMenu from '../index.parts';

describe('<NavigationMenu.Item />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Item />, () => ({
    refInstanceof: window.HTMLLIElement,
    render(node) {
      return render(<NavigationMenu.Root>{node}</NavigationMenu.Root>);
    },
  }));
});
