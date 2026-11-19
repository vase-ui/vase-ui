import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import PopupPortal from './PopupPortal.vue';

const Page = defineComponent({
  setup: () => () => (
    <main>
      <PopupPortal to="#teleports" data-testid="portal">
        <div>content</div>
      </PopupPortal>
    </main>
  ),
});

describe('PopupPortal on a server', () => {
  it('VUE-168: renders no portal element or content for a selector on the server', async () => {
    const context: { teleports?: Record<string, string> } = {};
    const html = await renderToString(createSSRApp(Page), context);

    expect(html).toBe('<main><!----></main>');
    expect(context.teleports).toBeUndefined();
  });
});
