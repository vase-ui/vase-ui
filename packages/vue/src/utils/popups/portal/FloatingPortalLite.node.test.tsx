import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import FloatingPortalLite from './FloatingPortalLite.vue';

const Page = defineComponent({
  setup: () => () => (
    <main>
      <FloatingPortalLite data-testid="portal">
        <div>content</div>
      </FloatingPortalLite>
    </main>
  ),
});

describe('FloatingPortalLite on a server', () => {
  it('renders no portal element and no content of the portal', async () => {
    const context: { teleports?: Record<string, string> } = {};
    const html = await renderToString(createSSRApp(Page), context);

    expect(html).toBe('<main><!----></main>');
    expect(context.teleports).toBeUndefined();
  });
});
