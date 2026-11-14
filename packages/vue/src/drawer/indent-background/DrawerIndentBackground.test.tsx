import { describe } from 'vitest';
import { createRenderer, describeConformance } from '#test-utils';
import * as Drawer from '../index.parts';

describe('<Drawer.IndentBackground />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.IndentBackground />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<Drawer.Provider>{node}</Drawer.Provider>),
  }));
});
