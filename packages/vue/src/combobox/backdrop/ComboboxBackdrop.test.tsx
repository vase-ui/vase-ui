import { describe } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import * as Combobox from '../index.parts';

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
