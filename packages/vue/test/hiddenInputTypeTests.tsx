import { describe, expect, it } from 'vitest';
import type { VNode } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { screen } from '@testing-library/dom';
import type { createRenderer } from './createRenderer';

/**
 * The visually hidden input of a control without a native input is `type="hidden"` unless it
 * takes part in a form, so password managers don't treat each instance as a form field.
 */
export function hiddenInputTypeTests(config: HiddenInputTypeTestsConfig) {
  const { render, createComponent } = config;

  describe('hidden input type', () => {
    it('is hidden when the control takes no part in a form', async () => {
      const { container } = await render(createComponent({}));

      expect(container.querySelector('input[aria-hidden]')).toHaveAttribute('type', 'hidden');
    });

    it.each([
      { name: 'name', props: { name: 'field' } },
      { name: 'autoComplete', props: { autoComplete: 'country' } },
      { name: 'required', props: { required: true } },
    ])('is a text input when $name is set', async ({ props }) => {
      await render(createComponent(props));

      expect(screen.getByRole('textbox', { hidden: true })).not.toHaveAttribute('type');
    });

    it('is a text input inside Field.Root', async () => {
      await render(<Field.Root>{createComponent({})}</Field.Root>);

      expect(screen.getByRole('textbox', { hidden: true })).not.toHaveAttribute('type');
    });
  });
}

export interface HiddenInputTypeTestsConfig {
  /**
   * Render function returned from `createRenderer`.
   */
  render: ReturnType<typeof createRenderer>['render'];
  /**
   * Returns the component tree with the form props spread on its root.
   */
  createComponent: (props: { name?: string; autoComplete?: string; required?: boolean }) => VNode;
}
