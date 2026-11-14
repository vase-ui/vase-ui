import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import CompositeRootPart from '../../../test/fixtures/CompositeRootPart.vue';
import { MenubarProvider, createMenubarContext } from '../../../test/fixtures/MenuParentFixture';
import { reset as resetWarnings } from '../../common/warn';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import * as Menu from '../index.parts';
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

  it('renders the trigger of an open root with its attributes and its state', async () => {
    const html = await renderToString(
      <Menu.Root defaultOpen defaultTriggerId="trigger">
        <Menu.Trigger id="trigger">Open</Menu.Trigger>
      </Menu.Root>,
    );

    expect(html).toMatch(
      /^<!--\[--><button data-popup-open data-pressed type="button" tabindex="0" aria-haspopup="menu" aria-expanded="true" aria-controls="[^"]+" id="trigger"><!--\[-->Open<!--\]--><\/button><!--\]-->$/,
    );
  });

  it('renders the trigger of a handle in its closed form, and attaches no store to the handle', async () => {
    const handle = Menu.createHandle();

    const html = await renderToString(
      <div>
        <Menu.Trigger handle={handle} id="detached">
          Detached
        </Menu.Trigger>
        <Menu.Root handle={handle} defaultOpen defaultTriggerId="detached" />
      </div>,
    );

    expect(html).toContain('aria-haspopup="menu"');
    expect(html).not.toContain('aria-expanded');
    expect(html).not.toContain('data-popup-open');
    expect(handle.isOpen).toBe(false);
    expect(handle.store).toBe(handle.serverStore);
  });

  it('renders the trigger in a menubar with the menuitem role and the tab stop of its menubar', async () => {
    const html = await renderToString(
      <MenubarProvider context={createMenubarContext()}>
        <CompositeRootPart>
          <Menu.Root>
            <Menu.Trigger>File</Menu.Trigger>
          </Menu.Root>
          <Menu.Root>
            <Menu.Trigger>Edit</Menu.Trigger>
          </Menu.Root>
        </CompositeRootPart>
      </MenubarProvider>,
    );

    expect(html.match(/role="menuitem"/g)).toHaveLength(2);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1);
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
