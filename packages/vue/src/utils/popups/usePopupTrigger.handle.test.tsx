import { describe, expect, it, onTestFinished } from 'vitest';
import { createSSRApp, defineComponent, nextTick, shallowRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  installPartsInterop,
  renderOnServer,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import {
  PopupHandleFixtureStore,
  createPopupHandleFixture,
} from '../../../test/fixtures/PopupHandleFixture';
import type { PopupHandleFixture } from '../../../test/fixtures/PopupHandleFixture';
import PopupHandleHydration from './PopupHandleHydration.test.vue';
import PopupHandleLateTriggerHydration from './PopupHandleLateTriggerHydration.test.vue';
import { usePopupHandleStore } from './usePopupTrigger';

const HYDRATION_FIXTURE = 'src/utils/popups/PopupHandleHydration.test.vue';

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

  it('follows a change of the handle that the getter gives', async () => {
    const handleA = createPopupHandleFixture();
    const rootStoreA = new PopupHandleFixtureStore();
    handleA.attachStore(rootStoreA);
    const handleB = createPopupHandleFixture();
    const handle = shallowRef<PopupHandleFixture | undefined>(handleA);
    let result!: ReturnType<typeof usePopupHandleStore>;
    const Reader = defineComponent(() => {
      result = usePopupHandleStore(() => handle.value);
      return () => null;
    });

    await render(<Reader />);
    expect(result.value).toBe(rootStoreA);

    handle.value = handleB;
    expect(result.value).toBe(handleB.fallback);

    handle.value = undefined;
    expect(result.value).toBeUndefined();
  });

  describe('hydration', () => {
    async function hydrateWithRoot(props: { defaultOpen: boolean; defaultTriggerId: string }) {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;

      const { container } = await hydrate(PopupHandleHydration, { serverHtml, props });
      return { server: readExpanded(template.content), client: readExpanded(container) };
    }

    // The root of the fixture attaches before the trigger that follows it hydrates, as a mounted
    // root does for a trigger that hydrates late. The fixture binds a plain object without
    // `useRenderElement`. Its trigger would keep the server value of `aria-expanded` if it read the
    // root store while it hydrates.
    it('gives the inert store while a trigger with a handle hydrates, and the store of the root after it', async () => {
      const { server, client } = await hydrateWithRoot({
        defaultOpen: true,
        defaultTriggerId: 'after',
      });

      expect(server).toEqual({ before: 'false', inside: 'false', after: 'false' });
      expect(client).toEqual({ before: 'false', inside: 'false', after: 'true' });
    });

    it('hydrates a late trigger of a mounted root from the inert store, then gives it the values of the root', async () => {
      const handle = Menu.createHandle();
      const gate = Promise.withResolvers<void>();
      const container = document.createElement('div');
      container.innerHTML = await renderOnServer(
        'src/utils/popups/PopupHandleLateTriggerHydration.test.vue',
      );
      document.body.append(container);
      const trigger = within(container).getByRole('button', { name: 'Trigger' });
      expect(trigger).toBeEnabled();
      expect(trigger).toHaveClass('on');

      const app = installPartsInterop(
        createSSRApp(PopupHandleLateTriggerHydration, { handle, hydrationGate: gate.promise }),
      );
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await flushMicrotasks();
      expect(handle.store).not.toBe(handle.serverStore);

      gate.resolve();
      await waitFor(() => {
        expect(trigger).toBeDisabled();
      });
      expect(trigger).toHaveClass('off');
      expect(trigger).not.toHaveClass('on');
      expect(trigger).toHaveAttribute('data-disabled');
      expect(within(container).getByRole('button', { name: 'Trigger' })).toBe(trigger);
      expect(takeReportedMessages()).toEqual([]);
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
