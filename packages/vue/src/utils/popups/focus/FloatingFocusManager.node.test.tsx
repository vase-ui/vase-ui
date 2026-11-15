import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { FloatingFocusManager } from '../../../../test/fixtures/floatingFocusManagerHarness';
import { useFloatingRootStore } from '../floating-root/useFloatingRootStore';

describe('FloatingFocusManager on a server', () => {
  it.each([
    { name: 'a modal popup', modal: true },
    { name: 'a non-modal popup', modal: false },
  ])('renders the element of $name with no guard and no DOM', async ({ modal }) => {
    const App = defineComponent({
      setup() {
        const store = useFloatingRootStore({ open: true });
        return () =>
          h(FloatingFocusManager, { store, modal }, { default: () => h('div', { id: 'popup' }) });
      },
    });

    const html = await renderToString(h(App));

    expect(html).toBe('<div id="popup"></div>');
  });
});
