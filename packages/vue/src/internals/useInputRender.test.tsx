import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, flushMicrotasks, isVaporApp, screen } from '#test-utils';
import { recordInputWrites } from '../../test/recordInputWrites';
import InputRenderPart from './InputRenderPart.test.vue';
import InputRenderPartVapor from './InputRenderPartVapor.test.vue';

describe('useInputRender', () => {
  const { render } = createRenderer();

  async function checkRestore(Part: Component) {
    await render(h(Part, { value: 'kept' }));
    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.value = 'refused';
    const writes = recordInputWrites(input, 'value');
    input.dispatchEvent(new InputEvent('input'));
    await flushMicrotasks();
    expect(input.value).toBe('kept');

    input.dispatchEvent(new InputEvent('input'));
    await flushMicrotasks();
    expect(writes).toEqual(['kept']);
  }

  it('restores a refused edit in the same input', () => checkRestore(InputRenderPart));
  it.runIf(isVaporApp)('restores a refused edit in a Vapor input', () =>
    checkRestore(InputRenderPartVapor),
  );
});
