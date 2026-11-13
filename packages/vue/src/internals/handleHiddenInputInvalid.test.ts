import { expect, describe, it } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { visuallyHiddenInputPinned } from '../common/visuallyHidden';
import { handleHiddenInputInvalid } from './handleHiddenInputInvalid';

describe('handleHiddenInputInvalid', () => {
  const { render } = createRenderer();

  it('grows an input that has no size to 1px when the input is invalid', async () => {
    await render(
      h('input', {
        type: 'checkbox',
        required: true,
        style: visuallyHiddenInputPinned,
        onInvalid: handleHiddenInputInvalid,
      }),
    );
    const input = screen.getByRole<HTMLInputElement>('checkbox');
    expect(input).toHaveStyle({ width: '0px', height: '0px' });

    input.checkValidity();

    expect(input).toHaveStyle({ width: '1px', height: '1px' });
  });

  // Vue writes each key of a style again when the `style` object is not the object of the last
  // render. A part must give the style constant itself, or a render sets the size back to zero.
  it('keeps the size after a render that changes another attribute of the input', async () => {
    const count = shallowRef(0);
    const Test = defineComponent(
      () => () =>
        h('input', {
          type: 'checkbox',
          required: true,
          style: visuallyHiddenInputPinned,
          'data-count': count.value,
          onInvalid: handleHiddenInputInvalid,
        }),
    );
    await render(h(Test));
    const input = screen.getByRole<HTMLInputElement>('checkbox');
    input.checkValidity();

    count.value += 1;
    await flushMicrotasks();

    expect(input).toHaveAttribute('data-count', '1');
    expect(input).toHaveStyle({ width: '1px', height: '1px' });
  });
});
