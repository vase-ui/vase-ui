import { describe } from 'vitest';
import { Combobox } from '@vase-ui/vue/combobox';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

describe('<Combobox.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Portal>{node}</Combobox.Portal>
        </Combobox.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));
});
