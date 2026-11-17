import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, isVaporApp, screen } from '#test-utils';
import { visuallyHiddenInputPinned } from '../common/visuallyHidden';
import { handleHiddenInputInvalid } from './handleHiddenInputInvalid';
import HiddenInputPart from './HiddenInputPart.test.vue';
import HiddenInputPartVapor from './HiddenInputPartVapor.test.vue';

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

  // The template of a part binds the props of its hidden input beside the `ref` setter. Vue then
  // writes each key of the style of the input again in each render. The project `vapor` mounts the
  // part as a Vapor component, and each other project mounts it as a virtual DOM component.
  it('keeps the size after a render that changes another attribute of the input', async () => {
    const Part: Component = isVaporApp ? HiddenInputPartVapor : HiddenInputPart;
    const { setProps } = await render(h(Part, { count: 0, report: () => {} }));
    const input = screen.getByRole<HTMLInputElement>('checkbox');
    input.checkValidity();

    await setProps({ count: 1 });

    expect(input).toHaveAttribute('data-count', '1');
    expect(input).toHaveStyle({ width: '1px', height: '1px' });
  });

  it.runIf(isVaporApp)('gives the input to a part that is a Vapor component', async () => {
    const report = vi.fn();
    await render(h(HiddenInputPartVapor, { count: 0, report }));

    expect(report).toHaveBeenCalledExactlyOnceWith(screen.getByRole('checkbox'));
  });
});
