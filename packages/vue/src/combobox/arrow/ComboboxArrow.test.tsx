import { describe } from 'vitest';
import { Combobox } from '@vase-ui/vue/combobox';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

describe('<Combobox.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Arrow />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Portal>
            <Combobox.Positioner>{node}</Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));
});
