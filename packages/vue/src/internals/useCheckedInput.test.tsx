import { describe, expect, it } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import { createRenderer } from '#test-utils';
import { recordInputWrites } from '../../test/recordInputWrites';
import CheckboxRoot from '../checkbox/root/CheckboxRoot.vue';

describe('useCheckedInput', () => {
  const { render } = createRenderer();

  it('keeps the input style of a named parent checkbox', async () => {
    const { container } = await render(<CheckboxRoot parent name="fruit" />);
    const input = container.querySelector('input')!;
    expect(input).not.toHaveAttribute('name');
    expect(input).toHaveStyle({ position: 'absolute', width: '1px' });
  });

  it('binds changes of the mixed state to the native checkbox', async () => {
    const mixed = shallowRef(false);
    const { container } = await render(() => <CheckboxRoot indeterminate={mixed.value} />);
    const input = container.querySelector('input')!;

    mixed.value = true;
    await nextTick();
    expect(input.indeterminate).toBe(true);

    mixed.value = false;
    await nextTick();
    expect(input.indeterminate).toBe(false);
  });

  it('restores only the checked properties changed by a click', async () => {
    const { container } = await render(<CheckboxRoot modelValue={false} indeterminate />);
    const input = container.querySelector('input')!;
    const checked = recordInputWrites(input, 'checked');
    const mixed = recordInputWrites(input, 'indeterminate');

    input.click();
    await nextTick();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    await nextTick();

    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(true);
    expect(checked).toEqual([false]);
    expect(mixed).toEqual([true]);
  });
});
