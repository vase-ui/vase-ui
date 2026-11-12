import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import SinglePart from './SinglePart.vue';

describe('SinglePart', () => {
  it('has no DOM in the node project', () => {
    expect(typeof document).toBe('undefined');
  });

  it('renders on a server', async () => {
    // `SinglePart` writes a development marker on purpose. The package check
    // (`packages/vue/scripts/checkPackage.ts`) makes sure that a production bundle does not
    // contain it.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const html = await renderToString(<SinglePart orientation="vertical">text</SinglePart>);

    expect(html).toBe(
      '<div data-single-part data-orientation="vertical"><!--[-->text<!--]--></div>',
    );
    expect(warnSpy).toHaveBeenCalledExactlyOnceWith('package-check development marker');
  });
});
