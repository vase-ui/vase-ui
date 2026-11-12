import { describe, expect, it } from 'vitest';
import { render } from 'vue';
import SinglePart from './SinglePart.vue';

describe('SinglePart', () => {
  it('renders in a browser', () => {
    const container = document.createElement('div');
    document.body.append(container);

    try {
      render(<SinglePart orientation="vertical">text</SinglePart>, container);

      const element = container.querySelector('[data-single-part]');
      expect(element).toHaveAttribute('data-orientation', 'vertical');
      expect(element).toBeVisible();
    } finally {
      render(null, container);
      container.remove();
    }
  });
});
