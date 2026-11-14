import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, hydrate, renderOnServer } from '#test-utils';
import * as Menu from '../../menu/index.parts';
import { useMenuRootContext } from '../../menu/root/MenuRootContext';
import type { MenuRootContext } from '../../menu/root/MenuRootContext';
import * as ContextMenu from '../index.parts';
import { useContextMenuRootContext } from './ContextMenuRootContext';
import type { ContextMenuRootContext } from './ContextMenuRootContext';
import ContextMenuRootHydration from './ContextMenuRootHydration.test.vue';

/** Reads the context of the context menu and the context of the menu that a part below the root gets. */
function createProbe() {
  const contexts: ContextMenuRootContext[] = [];
  const menuContexts: MenuRootContext[] = [];
  const Probe = defineComponent({
    setup() {
      contexts.push(useContextMenuRootContext(false));
      menuContexts.push(useMenuRootContext());
      return () => null;
    },
  });

  return {
    Probe,
    get context() {
      return contexts[0];
    },
    get menuContext() {
      return menuContexts[0];
    },
    get store() {
      return menuContexts[0].store;
    },
  };
}

interface RootActions {
  close(): void;
  unmount(): void;
}

describe('<ContextMenu.Root />', () => {
  const { render } = createRenderer();

  describe('events', () => {
    it('emits openChange and then update:open', async () => {
      const events: unknown[] = [];
      const { getByTestId } = await render(
        <ContextMenu.Root
          onOpenChange={(open, details) => events.push(['openChange', open, details.reason])}
          onUpdate:open={(open) => events.push(['update:open', open])}
        >
          <ContextMenu.Trigger data-testid="trigger">area</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await fireEvent.contextMenu(getByTestId('trigger'));

      expect(events).toEqual([
        ['openChange', true, 'trigger-press'],
        ['update:open', true],
      ]);
    });

    it('does not emit update:open after details.cancel()', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <ContextMenu.Root
          onOpenChange={(open, details) => {
            events.push(['openChange', open]);
            details.cancel();
          }}
          onUpdate:open={(open) => events.push(['update:open', open])}
        >
          <probe.Probe />
          <ContextMenu.Trigger data-testid="trigger">area</ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      await fireEvent.contextMenu(getByTestId('trigger'));

      expect(events).toEqual([['openChange', true]]);
      expect(probe.store.state.open).toBe(false);
    });

    it('emits openChangeComplete and itemHighlighted of the menu root', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <ContextMenu.Root
          onOpenChangeComplete={(open) => events.push(['openChangeComplete', open])}
          onItemHighlighted={(item, details) =>
            events.push(['itemHighlighted', item?.id, details.reason, details.label])
          }
        >
          <probe.Probe />
        </ContextMenu.Root>,
      );
      const item = document.createElement('div');
      item.id = 'item';
      document.body.append(item);
      onTestFinished(() => {
        item.remove();
      });

      probe.store.context.onOpenChangeComplete?.(true);
      probe.store.context.itemDomElements.value = [item];
      probe.store.context.itemLabels.value = ['Item'];
      probe.store.setActiveIndex(0, 'keyboard', new KeyboardEvent('keydown'));
      await flushMicrotasks();

      expect(events).toEqual([
        ['openChangeComplete', true],
        ['itemHighlighted', 'item', 'keyboard', 'Item'],
      ]);
    });
  });

  describe('props', () => {
    it.each([
      {
        name: 'the defaults',
        props: {},
        expected: {
          open: false,
          highlightItemOnHover: true,
          loopFocus: true,
          orientation: 'vertical',
        },
      },
      {
        name: 'each prop that is set',
        props: {
          defaultOpen: true,
          highlightItemOnHover: false,
          loopFocus: false,
          orientation: 'horizontal' as const,
        },
        expected: {
          open: true,
          highlightItemOnHover: false,
          loopFocus: false,
          orientation: 'horizontal',
        },
      },
    ])('gives $name to the menu root', async ({ props, expected }) => {
      const probe = createProbe();
      await render(
        <ContextMenu.Root {...props}>
          <probe.Probe />
        </ContextMenu.Root>,
      );
      const { menuContext, store } = probe;

      expect({
        open: store.state.open,
        highlightItemOnHover: store.select('highlightItemOnHover'),
        loopFocus: menuContext.loopFocus.value,
        orientation: menuContext.orientation.value,
      }).toEqual(expected);
    });

    it('follows the open prop', async () => {
      const open = shallowRef(false);
      const onOpenChange = vi.fn();
      const { getByTestId } = await render(() => (
        <ContextMenu.Root open={open.value} onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">area</ContextMenu.Trigger>
        </ContextMenu.Root>
      ));
      const trigger = getByTestId('trigger');

      await fireEvent.contextMenu(trigger);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(trigger).not.toHaveAttribute('data-popup-open');

      open.value = true;
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open', '');
    });
  });

  describe('exposed actions', () => {
    it('exposes close and unmount', async () => {
      const events: unknown[] = [];
      let root!: ComponentPublicInstance;
      await render(() => (
        <ContextMenu.Root
          ref={(instance) => {
            root = instance as ComponentPublicInstance;
          }}
          defaultOpen
          onOpenChange={(open, details) => events.push([open, details.reason])}
        />
      ));

      expect(Object.keys(root).sort()).toEqual(['close', 'unmount']);

      (root as unknown as RootActions).close();

      expect(events).toEqual([[false, 'imperative-action']]);
    });

    it('VUE-47: the details of openChange have preventUnmountOnClose()', async () => {
      const completions: boolean[] = [];
      const probe = createProbe();
      let root!: ComponentPublicInstance;
      await render(() => (
        <ContextMenu.Root
          ref={(instance) => {
            root = instance as ComponentPublicInstance;
          }}
          defaultOpen
          onOpenChange={(_open, details) => details.preventUnmountOnClose()}
          onOpenChangeComplete={(open) => completions.push(open)}
        >
          <probe.Probe />
        </ContextMenu.Root>
      ));

      (root as unknown as RootActions).close();
      await flushMicrotasks();

      expect(probe.store.state.preventUnmountingOnClose).toBe(true);
      expect(probe.store.state.mounted).toBe(true);
      expect(completions).toEqual([]);

      (root as unknown as RootActions).unmount();
      await flushMicrotasks();

      expect(probe.store.state.mounted).toBe(false);
      expect(completions).toEqual([false]);
    });
  });

  describe('the parent of the menu', () => {
    it('gives its menu the context menu as the parent, also below another menu', async () => {
      const probe = createProbe();
      const { unmount } = await render(
        <Menu.Root>
          <ContextMenu.Root>
            <probe.Probe />
          </ContextMenu.Root>
        </Menu.Root>,
      );
      const { context, store } = probe;

      expect(store.state.parent.type).toBe('context-menu');
      expect(store.select('rootId')).toBe(context.rootId.value);
      expect(store.select('modal')).toBe(true);
      expect(context.actionsRef.value?.setOpen).toBe(store.setOpen);

      unmount();

      expect(context.actionsRef.value).toBe(null);
    });

    it('leaves a menu in its trigger a plain menu', async () => {
      const probe = createProbe();
      await render(
        <ContextMenu.Root>
          <ContextMenu.Trigger>
            <Menu.Root>
              <probe.Probe />
            </Menu.Root>
          </ContextMenu.Trigger>
        </ContextMenu.Root>,
      );

      expect(probe.store.state.parent.type).toBe(undefined);
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a closed root', props: {} },
      { name: 'an open root', props: { defaultOpen: true } },
      { name: 'a disabled root', props: { disabled: true } },
    ])('hydrates $name with no warning', async ({ props }) => {
      const serverHtml = await renderOnServer(
        'src/context-menu/root/ContextMenuRootHydration.test.vue',
        props,
      );

      await hydrate(ContextMenuRootHydration, { serverHtml, props });
    });
  });
});
