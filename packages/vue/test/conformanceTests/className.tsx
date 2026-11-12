import { screen } from '@testing-library/dom';
import { expect, describe, it } from 'vitest';
import type { VNode } from 'vue';
import { cloneElement } from '../cloneElement';
import type { VaseUiConformanceTestsOptions } from '../describeConformance';
import { throwMissingPropError } from './utils';

export function testClassName(element: VNode, getOptions: () => VaseUiConformanceTestsOptions) {
  describe('prop: className', () => {
    const { render } = getOptions();

    if (!render) {
      throwMissingPropError('render');
    }

    it('should apply the className to the root element when passed as a string', async () => {
      await render(cloneElement(element, { class: 'test-class', 'data-testid': 'root' }));
      expect(screen.getByTestId('root')).toHaveClass('test-class');
    });
  });
}
