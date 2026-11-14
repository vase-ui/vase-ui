import { describe } from 'vitest';
import * as Select from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  positionerConformanceTests,
} from '#test-utils';

describe('<Select.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Select.Root open>
          <Select.Portal>{node}</Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  positionerConformanceTests({
    render,
    stableState: false,
    createComponent: ({
      root,
      trigger,
      positioner: { render: renderPositioner, ...positioner },
      popup,
    }) => (
      <Select.Root {...root}>
        <Select.Trigger {...trigger}>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            align="center"
            {...positioner}
            v-slots={renderPositioner ? { render: renderPositioner } : undefined}
          >
            <Select.Popup {...popup}>Popup</Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ),
  });
});
