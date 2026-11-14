import { describe, expect, it } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  PopupFixtureContext,
  PopupFixturePositionerContext,
  PopupFixtureStore,
} from '../../../../test/fixtures/PopupFixture';
import PopupViewportPart from '../../../../test/fixtures/PopupViewportPart.vue';

describe('usePopupViewport', () => {
  it('renders the current container of an open popup on a server, and writes nothing to the store', async () => {
    const store = new PopupFixtureStore<unknown>({ open: true, mounted: true });
    const Root = defineComponent({
      setup() {
        provide(PopupFixtureContext, store);
        provide(PopupFixturePositionerContext, { side: computed(() => 'bottom' as const) });
        return () => <PopupViewportPart>Content</PopupViewportPart>;
      },
    });

    const html = await renderToString(<Root />);

    expect(typeof document).toBe('undefined');
    expect(html).toBe(
      '<div><!--[--><!----><div data-current="true"><!--[--><!--[-->Content<!--]--><!--]--></div><!--]--></div>',
    );
    expect(store.state.adaptiveOrigin).toBe(undefined);
  });
});
