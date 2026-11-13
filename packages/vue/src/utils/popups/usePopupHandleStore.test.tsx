import { describe, expect, it } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { createRenderer, hydrate, renderOnServer } from '#test-utils';
import {
  PopupHandleFixtureStore,
  createPopupHandleFixture,
} from '../../../test/fixtures/PopupHandleFixture';
import PopupHandleHydration from '../../../test/fixtures/PopupHandleHydration.test.vue';
import { usePopupHandleStore } from './usePopupHandleStore';

const HYDRATION_FIXTURE = 'test/fixtures/PopupHandleHydration.test.vue';

function readExpanded(root: ParentNode) {
  return Object.fromEntries(
    Array.from(root.querySelectorAll('button'), (button) => [
      button.id,
      button.getAttribute('aria-expanded'),
    ]),
  );
}

describe('usePopupHandleStore', () => {
  const { render } = createRenderer();

  it('follows the root that attaches to the handle and detaches from it', async () => {
    const handle = createPopupHandleFixture();
    const rootStore = new PopupHandleFixtureStore();
    const Reader = defineComponent(() => {
      const store = usePopupHandleStore(() => handle);
      return () => (
        <output>
          {store.value === rootStore ? 'root' : store.value === handle.fallback ? 'inert' : 'other'}
        </output>
      );
    });

    const { container } = await render(<Reader />);
    const output = container.querySelector('output')!;
    expect(output.textContent).toBe('inert');

    const detach = handle.attachStore(rootStore);
    await nextTick();
    expect(output.textContent).toBe('root');

    detach();
    await nextTick();
    expect(output.textContent).toBe('inert');
  });

  describe('hydration', () => {
    async function hydrateWithRoot(props: { defaultOpen: boolean; defaultTriggerId: string }) {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;

      const { container } = await hydrate(PopupHandleHydration, { serverHtml, props });
      return { server: readExpanded(template.content), client: readExpanded(container) };
    }

    // The root attaches before the trigger that follows it hydrates. Hydration does not patch an
    // attribute, so a trigger that read the store of the root would keep the server HTML.
    it('gives the inert store while a trigger with a handle hydrates, and the store of the root after it', async () => {
      const { server, client } = await hydrateWithRoot({
        defaultOpen: true,
        defaultTriggerId: 'after',
      });

      expect(server).toEqual({ before: 'false', inside: 'false', after: 'false' });
      expect(client).toEqual({ before: 'false', inside: 'false', after: 'true' });
    });

    it('gives no store to a trigger with no handle, so it reads the store of its root while it hydrates', async () => {
      const { server, client } = await hydrateWithRoot({
        defaultOpen: true,
        defaultTriggerId: 'inside',
      });

      expect(server).toEqual({ before: 'false', inside: 'true', after: 'false' });
      expect(client).toEqual(server);
    });
  });
});
