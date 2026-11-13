import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Menu } from '@vase-ui/vue/menu';
import { MenubarProvider, createMenubarContext } from '../../../test/fixtures/MenuParentFixture';
import { reset as resetWarnings } from '../../common/warn';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { MenuStore } from '../store/MenuStore';
import { useMenuRootContext } from './MenuRootContext';

function createTestTrigger() {
  const stores: Array<MenuStore<unknown>> = [];
  const TestTrigger = defineComponent({
    props: { id: { type: String, required: true } },
    setup(props) {
      const { store } = useMenuRootContext();
      stores.push(store);
      const isActive = computed(() => store.select('isTriggerActive', props.id));

      return () => <button id={props.id} {...store.select('triggerProps', isActive.value)} />;
    },
  });

  return { TestTrigger, stores };
}

describe('<Menu.Root /> on a server', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders the trigger props of an open root', async () => {
    const { TestTrigger } = createTestTrigger();

    const html = await renderToString(
      <Menu.Root defaultOpen defaultTriggerId="trigger">
        <TestTrigger id="trigger" />
      </Menu.Root>,
    );

    expect(html).toBe(
      '<!--[--><button id="trigger" aria-haspopup="menu" aria-expanded="true"></button><!--]-->',
    );
  });

  it('drops an open change on a server, and leaves the handle and the tree with nothing', async () => {
    const { TestTrigger, stores } = createTestTrigger();
    const handle = Menu.createHandle();
    const events: unknown[] = [];

    await renderToString(
      <Menu.Root
        defaultOpen
        defaultTriggerId="trigger"
        handle={handle}
        onOpenChange={() => events.push(1)}
      >
        <TestTrigger id="trigger" />
      </Menu.Root>,
    );
    const [store] = stores;

    store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));

    expect(events).toEqual([]);
    expect(store.state.open).toBe(true);
    expect(handle.isOpen).toBe(false);
    expect(store.state.floatingTreeRoot.nodesRef.value).toHaveLength(0);
  });

  it('gives no warning for modal in a production build', async () => {
    resetWarnings();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');

    await renderToString(
      <MenubarProvider context={createMenubarContext()}>
        <Menu.Root modal={false} />
      </MenubarProvider>,
    );

    expect(warn).not.toHaveBeenCalled();
  });
});
