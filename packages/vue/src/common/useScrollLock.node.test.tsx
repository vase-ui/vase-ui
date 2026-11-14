import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useScrollLock } from './useScrollLock';

const Locked = defineComponent({
  setup() {
    useScrollLock(true);
    return () => <div>content</div>;
  },
});

describe('useScrollLock on a server', () => {
  it('renders its component and takes no lock, so it makes no registry', async () => {
    const html = await renderToString(createSSRApp(Locked));

    expect(html).toBe('<div>content</div>');
    expect(Symbol.for('vase-ui.scroll-lock') in globalThis).toBe(false);
  });
});
