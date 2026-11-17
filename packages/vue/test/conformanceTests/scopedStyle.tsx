import { screen } from '../queries';
import { describe, expect, it } from 'vitest';
import type { Component, VNode } from 'vue';
import type { VaseUiConformanceTestsOptions } from '../describeConformance';
import { contentOf } from './utils';
import ScopedConsumer from './ScopedConsumer.vue';

export function testScopedStyle(element: VNode, getOptions: () => VaseUiConformanceTestsOptions) {
  const { render, elementIsRoot = true } = getOptions();

  describe('scoped style of a consumer', () => {
    it(
      elementIsRoot ? 'matches the element of the part' : 'does not match the element of the part',
      async () => {
        await render(
          <ScopedConsumer
            part={element.type as Component}
            content={contentOf(element)}
            partProps={{ ...element.props, 'data-testid': 'root' }}
          />,
        );

        const { outlineStyle } = getComputedStyle(screen.getByTestId('root'));
        if (elementIsRoot) {
          expect(outlineStyle).toBe('dashed');
        } else {
          expect(outlineStyle).not.toBe('dashed');
        }
      },
    );
  });
}
