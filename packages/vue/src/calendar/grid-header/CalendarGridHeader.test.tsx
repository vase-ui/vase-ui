import { describe } from 'vitest';
import { createRenderer, describeConformance } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';

describe('<Calendar.GridHeader />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.GridHeader />, () => ({
    refInstanceof: window.HTMLTableSectionElement,
    testRenderPropWith: 'thead',
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));
});
