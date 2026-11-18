import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Radio } from '@vase-ui/vue/radio';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { useFieldsetDisabled } from './useFieldsetDisabled';

describe('useFieldsetDisabled', () => {
  const { render } = createRenderer();

  it('VUE-112: follows a disabled fieldset after the consumer takes the element out of the document and puts it in the fieldset', async () => {
    await render(
      <>
        <fieldset data-testid="fieldset" disabled />
        <div data-testid="wrapper">
          <Radio.Root data-testid="radio" value="a" />
        </div>
      </>,
    );
    const fieldset = screen.getByTestId('fieldset');
    const wrapper = screen.getByTestId('wrapper');
    const radio = screen.getByTestId('radio');
    expect(radio).not.toHaveAttribute('aria-disabled', 'true');

    wrapper.remove();
    await flushMicrotasks();
    fieldset.append(wrapper);
    await flushMicrotasks();

    expect(radio).toHaveAttribute('aria-disabled', 'true');
  });

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
