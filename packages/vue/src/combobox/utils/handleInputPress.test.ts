import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { handleInputPress } from './handleInputPress';
import type { ComboboxStore } from '../store';

describe('handleInputPress', () => {
  it('handles an event whose target is not an Element', () => {
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const currentTarget = document.createElement('div');
    const textNode = document.createTextNode('padding');
    const event = {
      target: textNode,
      currentTarget,
      preventDefault,
    } as unknown as MouseEvent;
    const store = {
      state: {
        openOnInputClick: false,
      },
      context: {
        inputRef: shallowRef({ focus }),
      },
    } as unknown as ComboboxStore;

    handleInputPress(event, store, false);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });
});
