import { describe, expect, it } from 'vitest';
import type { VNode } from 'vue';
import { isJSDOM } from '../src/common/testUtils';
import type { createRenderer } from './createRenderer';
import { flushMicrotasks } from './flushMicrotasks';

/**
 * The hidden input of a control without a `name` is zero-size, so Chrome doesn't give each one a
 * compositor layer. It grows to 1px when reported invalid, as Chrome doesn't show the native
 * validation message for a zero-size or off-screen input.
 */
export function hiddenInputSizeTests(config: HiddenInputSizeTestsConfig) {
  const { render, createComponent } = config;

  // Sizes need layout.
  describe.skipIf(isJSDOM)('hidden input size', () => {
    it('grows from zero size to an on-screen 1px box when reported invalid', async () => {
      const { container } = await render(createComponent({ required: true }));

      const input = container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
      // Unnamed radios are never missing a value, so fail the way Field validation does.
      input.setCustomValidity('Invalid');
      expect(input.validity.valid).toBe(false);
      expect(getRect(input)).toEqual({ top: 0, width: 0, height: 0 });

      input.reportValidity();
      await flushMicrotasks();

      expect(getRect(input)).toEqual({ top: 0, width: 1, height: 1 });
    });
  });
}

function getRect(element: HTMLElement) {
  const { top, width, height } = element.getBoundingClientRect();
  return { top, width, height };
}

export interface HiddenInputSizeTestsConfig {
  /**
   * Render function returned from `createRenderer`.
   */
  render: ReturnType<typeof createRenderer>['render'];
  /**
   * Returns the component tree, without a `name`, with the form props spread on its root.
   * `required` makes Select and Combobox render a real input instead of `type="hidden"`.
   */
  createComponent: (props: { required?: boolean }) => VNode;
}
