import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vue';
import MultiPartItem from './MultiPartItem.vue';

describe('MultiPartItem', () => {
  it('emits select once for a trusted click', async () => {
    const onSelect = vi.fn<(event: MouseEvent) => void>();
    const container = document.createElement('div');
    document.body.append(container);

    try {
      render(<MultiPartItem onSelect={onSelect}>item</MultiPartItem>, container);

      await userEvent.click(container.querySelector('button')!);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect.mock.calls[0][0].isTrusted).toBe(true);
    } finally {
      render(null, container);
      container.remove();
    }
  });
});
