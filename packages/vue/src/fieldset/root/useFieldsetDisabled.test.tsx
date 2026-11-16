import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { useFieldsetDisabled } from './useFieldsetDisabled';

describe('useFieldsetDisabled', () => {
  const { render } = createRenderer();

  // The root of a date picker gives the element of its field or of its trigger, and each of them
  // can unmount while the root stays.
  it('VUE-112: reads no native fieldset while the element is null', async () => {
    const hasElement = shallowRef(true);
    const Part = defineComponent(() => {
      const button = shallowRef<HTMLButtonElement | null>(null);
      const disabled = useFieldsetDisabled(() => (hasElement.value ? button.value : null));
      return () => (
        <button
          ref={button}
          type="button"
          data-testid="part"
          data-disabled={disabled.value ? '' : undefined}
        >
          Part
        </button>
      );
    });
    await render(() => (
      <fieldset disabled>
        <Part />
      </fieldset>
    ));
    expect(screen.getByTestId('part')).toHaveAttribute('data-disabled');

    hasElement.value = false;
    await flushMicrotasks();

    expect(screen.getByTestId('part')).not.toHaveAttribute('data-disabled');
  });
});
