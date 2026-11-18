import { describe, expect, it } from 'vitest';
import { createRenderer } from '#test-utils';
import { recordInputWrites } from '../../test/recordInputWrites';
import CheckboxRoot from '../checkbox/root/CheckboxRoot.vue';
import { restoreChecked } from './checkedInputProps';

describe('checkedInputProps', () => {
  const { render } = createRenderer();

  it('keeps the input style of a named parent checkbox', async () => {
    const { container } = await render(<CheckboxRoot parent name="fruit" />);
    const input = container.querySelector('input')!;
    expect(input).not.toHaveAttribute('name');
    expect(input).toHaveStyle({ position: 'absolute', width: '1px' });
  });

  it('restores only the checked properties changed by a click', () => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.indeterminate = true;
    input.click();
    const checked = recordInputWrites(input, 'checked');
    const mixed = recordInputWrites(input, 'indeterminate');

    restoreChecked(input, false, true);
    restoreChecked(input, false, true);

    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(true);
    expect(checked).toEqual([false]);
    expect(mixed).toEqual([true]);
  });
});
