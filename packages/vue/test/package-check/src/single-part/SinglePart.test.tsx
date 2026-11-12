import { describe, expect, it, vi } from 'vitest';
import { render } from 'vue';
import SinglePart from './SinglePart.vue';

describe('SinglePart', () => {
  it('renders in a browser', () => {
    // `SinglePart` writes a development marker on purpose. The package check
    // (`packages/vue/scripts/checkPackage.ts`) makes sure that a production bundle does not
    // contain it.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.append(container);

    try {
      render(<SinglePart orientation="vertical">text</SinglePart>, container);

      const element = container.querySelector('[data-single-part]');
      expect(element).toHaveAttribute('data-orientation', 'vertical');
      expect(element).toBeVisible();
      expect(warnSpy).toHaveBeenCalledExactlyOnceWith('package-check development marker');
    } finally {
      render(null, container);
      container.remove();
    }
  });
});
