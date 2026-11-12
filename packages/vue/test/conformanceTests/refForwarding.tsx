import { expect, describe, it } from 'vitest';
import type { VNode } from 'vue';
import { cloneElement } from '../cloneElement';
import type { VaseUiConformanceTestsOptions } from '../describeConformance';
import { throwMissingPropError } from './utils';

export function testRefForwarding(element: VNode, getOptions: () => VaseUiConformanceTestsOptions) {
  describe('ref', () => {
    it('attaches the ref', async () => {
      const { render, refInstanceof } = getOptions();

      if (!render) {
        throwMissingPropError('render');
      }

      // A ref on a part gives the component. The part exposes its element as `element`.
      let component: { element: Element | null } | null = null;
      const Test = () =>
        cloneElement(element, {
          ref: (value: { element: Element | null } | null) => {
            component = value;
          },
        });
      await render(<Test />);

      expect(component!.element).toBeInstanceOf(refInstanceof);
    });
  });
}
