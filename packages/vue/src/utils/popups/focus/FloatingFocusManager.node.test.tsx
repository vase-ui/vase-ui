import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useFloatingRootStore } from '../floating-root/useFloatingRootStore';
import FloatingFocusManager from './FloatingFocusManager.vue';

describe('FloatingFocusManager on a server', () => {
  it.each([
    { name: 'the two guards around the content of a modal popup', modal: true, guards: 2 },
    { name: 'only the content of a popup that is not modal', modal: false, guards: 0 },
  ])('renders $name with no DOM', async ({ modal, guards }) => {
    const App = defineComponent({
      setup() {
        const store = useFloatingRootStore({ open: true });
        return () =>
          h(FloatingFocusManager, { store, modal }, { default: () => h('div', { id: 'popup' }) });
      },
    });

    const html = await renderToString(h(App));

    expect(html.match(/data-vase-ui-focus-guard/g) ?? []).toHaveLength(guards);
    expect(html).toContain('<div id="popup"></div>');
    expect(html).not.toContain('role="button"');
  });
});
