import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import type { ComputedRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import { Menubar } from '@vase-ui/vue/menubar';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import type { Orientation } from '../internals/types';
import * as Menu from '../menu/index.parts';
import type { MenuRootChangeEventReason } from '../menu/root/MenuRoot.vue';
import type { MenuOpenEventDetails } from '../menu/utils/types';
import type { FloatingTreeStore } from '../utils/popups/tree/FloatingTreeStore';
import { provideFloatingTree } from '../utils/popups/tree/FloatingTree';
import { useMenubarContext } from './MenubarContext';
import MenubarHydration from './MenubarHydration.test.vue';
import MenubarMockMenu from './MenubarMockMenu.test.vue';

const HYDRATION_FIXTURE = 'src/menubar/MenubarHydration.test.vue';

// The real pointer of the browser can rest on an item. A dispatched event still reaches the item,
// and the real pointer sends no event of its own.
const noRealPointer = { pointerEvents: 'none' } as const;

type MockMenu = InstanceType<typeof MenubarMockMenu>;

function readTabindexes(root: ParentNode) {
  return ['a', 'b', 'c'].map((testId) =>
    root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex'),
  );
}

function parse(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

function createTreeProvider() {
  let tree: ComputedRef<FloatingTreeStore> | undefined;
  const TreeProvider = defineComponent((_, { slots }) => {
    tree = provideFloatingTree();
    return () => slots.default?.();
  });
  return { TreeProvider, getTree: () => tree!.value };
}

type MenuDefinition = {
  label: string;
  triggerTestId: string;
  menuTestId: string;
};

const menus: MenuDefinition[] = [
  { label: 'File', triggerTestId: 'file-trigger', menuTestId: 'file-menu' },
  { label: 'Edit', triggerTestId: 'edit-trigger', menuTestId: 'edit-menu' },
  { label: 'View', triggerTestId: 'view-trigger', menuTestId: 'view-menu' },
];

const ContainedTriggerMenubar = defineComponent(() => () => (
  <Menubar>
    {menus.map((menu) => (
      <Menu.Root key={menu.label}>
        <Menu.Trigger data-testid={menu.triggerTestId}>{menu.label}</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid={menu.menuTestId}>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ))}
  </Menubar>
));

const DynamicMenu = defineComponent(
  (props: { handle?: Menu.Handle<MenuDefinition> }, { slots }) =>
    () => (
      <Menu.Root
        handle={props.handle}
        v-slots={{
          default: ({ payload: menu }: { payload: MenuDefinition | undefined }) => [
            slots.default?.(),
            <Menu.Portal>
              <Menu.Positioner data-testid={menu?.menuTestId}>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>,
          ],
        }}
      />
    ),
  { props: ['handle'] },
);

const DetachedTriggerMenubar = defineComponent(() => {
  const menuHandle = Menu.createHandle<MenuDefinition>();
  return () => (
    <>
      <Menubar>
        {menus.map((menu) => (
          <Menu.Trigger
            handle={menuHandle}
            payload={menu}
            key={menu.label}
            data-testid={menu.triggerTestId}
          >
            {menu.label}
          </Menu.Trigger>
        ))}
      </Menubar>
      <DynamicMenu handle={menuHandle} />
    </>
  );
});

const MultipleContainedTriggersMenubar = defineComponent(() => () => (
  <Menubar>
    <DynamicMenu>
      {menus.map((menu) => (
        <Menu.Trigger payload={menu} key={menu.label} data-testid={menu.triggerTestId}>
          {menu.label}
        </Menu.Trigger>
      ))}
    </DynamicMenu>
  </Menubar>
));

describe('<Menubar />', () => {
  const { render } = createRenderer();

  describeConformance(<Menubar />, () => ({
    render: (node) => render(<Menubar>{node}</Menubar>),
    refInstanceof: window.HTMLDivElement,
  }));

  describe('ARIA attributes', () => {
    it.each<{ orientation: Orientation }>([
      { orientation: 'horizontal' },
      { orientation: 'vertical' },
    ])('has aria-orientation="$orientation"', async ({ orientation }) => {
      const { container } = await render(<Menubar orientation={orientation} />);

      const menubar = container.firstElementChild as HTMLElement;
      expect(menubar).toHaveAttribute('aria-orientation', orientation);
      expect(menubar).toHaveAttribute('data-orientation', orientation);
    });

    it('has a generated id until the id prop gives one', async () => {
      const { container, setProps } = await render(<Menubar />);
      const menubar = container.firstElementChild as HTMLElement;
      const generatedId = menubar.id;
      expect(generatedId).toMatch(/^vase-ui-/);

      await setProps({ id: 'file-menubar' });
      expect(menubar).toHaveAttribute('id', 'file-menubar');

      await setProps({ id: undefined });
      expect(menubar).toHaveAttribute('id', generatedId);
    });
  });

  describe('data attributes', () => {
    it('has data-modal only while the menubar is modal', async () => {
      const { container, setProps } = await render(<Menubar />);
      const menubar = container.firstElementChild as HTMLElement;
      expect(menubar).toHaveAttribute('data-modal', '');

      await setProps({ modal: false });
      expect(menubar).not.toHaveAttribute('data-modal');
    });

    it('has data-has-submenu-open only while a menu is open', async () => {
      const menu = shallowRef<MockMenu | null>(null);
      const { container } = await render(
        <Menubar>
          <MenubarMockMenu ref={menu} />
        </Menubar>,
      );
      const menubar = container.firstElementChild as HTMLElement;
      expect(menubar).not.toHaveAttribute('data-has-submenu-open');

      menu.value!.report(true, 'trigger-press');
      await nextTick();
      expect(menubar).toHaveAttribute('data-has-submenu-open', '');
    });
  });

  describe('context', () => {
    it('gives the props, the id and the element of the menubar to a part below it', async () => {
      const menu = shallowRef<MockMenu | null>(null);
      const { container } = await render(
        <Menubar>
          <MenubarMockMenu ref={menu} />
        </Menubar>,
      );
      const menubar = container.firstElementChild as HTMLElement;
      expect(menubar.id).toMatch(/^vase-ui-/);

      const context = menu.value!.menubar;
      expect(context.modal.value).toBe(true);
      expect(context.disabled.value).toBe(false);
      expect(context.orientation.value).toBe('horizontal');
      expect(context.rootId.value).toBe(menubar.id);
      expect(context.contentElement.value).toBe(menubar);
      expect(context.hasSubmenuOpen.value).toBe(false);
      expect(context.allowMouseUpTriggerRef.value).toBe(false);
    });

    it('follows a change of the props', async () => {
      const menu = shallowRef<MockMenu | null>(null);
      const { container, setProps } = await render(
        <Menubar id="file-menubar">
          <MenubarMockMenu ref={menu} />
        </Menubar>,
      );
      const menubar = container.firstElementChild as HTMLElement;
      const context = menu.value!.menubar;
      expect(context.modal.value).toBe(true);
      expect(context.rootId.value).toBe('file-menubar');

      await setProps({ modal: false, disabled: true, orientation: 'vertical', id: 'edit-menubar' });

      expect(context.modal.value).toBe(false);
      expect(context.disabled.value).toBe(true);
      expect(context.orientation.value).toBe('vertical');
      expect(context.rootId.value).toBe('edit-menubar');

      await setProps({ id: undefined });

      expect(menubar.id).toMatch(/^vase-ui-/);
      expect(context.rootId.value).toBe(menubar.id);
    });

    it('gives no context to an optional reader outside a menubar', async () => {
      const OptionalReader = defineComponent(() => {
        const context = useMenubarContext(true);
        return () => (
          <span data-testid="reader">{context === undefined ? 'outside' : 'inside'}</span>
        );
      });

      await render(
        <div>
          <OptionalReader />
          <Menubar>
            <OptionalReader />
          </Menubar>
        </div>,
      );

      expect(screen.getAllByTestId('reader').map((reader) => reader.textContent)).toEqual([
        'outside',
        'inside',
      ]);
    });
  });

  describe('open menus', () => {
    it.each<{ reason: MenuRootChangeEventReason }>([
      { reason: 'sibling-open' },
      { reason: 'list-navigation' },
    ])('stays set after a close with the reason $reason', async ({ reason }) => {
      const first = shallowRef<MockMenu | null>(null);
      const second = shallowRef<MockMenu | null>(null);
      const { container } = await render(
        <Menubar>
          <MenubarMockMenu ref={first} />
          <MenubarMockMenu ref={second} />
        </Menubar>,
      );
      const menubar = container.firstElementChild as HTMLElement;
      first.value!.report(true, 'trigger-press');
      await nextTick();
      expect(menubar).toHaveAttribute('data-has-submenu-open');

      second.value!.report(true, 'trigger-press');
      first.value!.report(false, reason);
      await nextTick();

      expect(menubar).toHaveAttribute('data-has-submenu-open');
    });

    it('is cleared by a close with another reason', async () => {
      const menu = shallowRef<MockMenu | null>(null);
      const { container } = await render(
        <Menubar>
          <MenubarMockMenu ref={menu} />
        </Menubar>,
      );
      const menubar = container.firstElementChild as HTMLElement;
      menu.value!.report(true, 'trigger-press');
      await nextTick();
      expect(menubar).toHaveAttribute('data-has-submenu-open');

      menu.value!.report(false, 'escape-key');
      await nextTick();

      expect(menubar).not.toHaveAttribute('data-has-submenu-open');
    });

    it('ignores a report with no node id', async () => {
      const menu = shallowRef<MockMenu | null>(null);
      const { container } = await render(
        <Menubar>
          <MenubarMockMenu ref={menu} />
        </Menubar>,
      );
      const menubar = container.firstElementChild as HTMLElement;
      expect(menubar).not.toHaveAttribute('data-has-submenu-open');

      menu.value!.report(true, 'trigger-press', { nodeId: undefined });
      await nextTick();

      expect(menubar).not.toHaveAttribute('data-has-submenu-open');
    });

    it('ignores a report of a node below a menu', async () => {
      const menu = shallowRef<MockMenu | null>(null);
      const submenu = shallowRef<MockMenu | null>(null);
      const { container } = await render(
        <Menubar>
          <MenubarMockMenu ref={menu}>
            <MenubarMockMenu ref={submenu} as="span" />
          </MenubarMockMenu>
        </Menubar>,
      );
      const menubar = container.firstElementChild as HTMLElement;
      expect(submenu.value!.parentNodeId).toBe(menu.value!.nodeId);
      expect(menubar).not.toHaveAttribute('data-has-submenu-open');

      submenu.value!.report(true, 'trigger-press');
      await nextTick();

      expect(menubar).not.toHaveAttribute('data-has-submenu-open');
    });

    it('ignores a report on a tree above the menubar', async () => {
      const { TreeProvider, getTree } = createTreeProvider();
      const menu = shallowRef<MockMenu | null>(null);
      const { container } = await render(
        <TreeProvider>
          <Menubar>
            <MenubarMockMenu ref={menu} />
          </Menubar>
        </TreeProvider>,
      );
      const menubar = container.firstElementChild as HTMLElement;
      expect(menu.value!.tree).not.toBe(getTree());
      expect(menubar).not.toHaveAttribute('data-has-submenu-open');

      const details: MenuOpenEventDetails = {
        open: true,
        reason: 'trigger-press',
        nodeId: menu.value!.nodeId,
        parentNodeId: menu.value!.parentNodeId,
      };
      getTree().events.emit('menuopenchange', details);
      await nextTick();

      expect(menubar).not.toHaveAttribute('data-has-submenu-open');
    });
  });

  describe('popup tree', () => {
    it('gives its menus a tree of its own and its node as their parent', async () => {
      const { TreeProvider, getTree } = createTreeProvider();
      const menu = shallowRef<MockMenu | null>(null);
      await render(
        <TreeProvider>
          <Menubar>
            <MenubarMockMenu ref={menu} />
          </Menubar>
        </TreeProvider>,
      );

      const tree = menu.value!.tree!;
      expect(tree).not.toBe(getTree());
      expect(getTree().nodesRef.value).toHaveLength(0);
      expect(tree.nodesRef.value).toHaveLength(2);

      // A node comes before the nodes below it, so each node is found by its id.
      const menubarNode = tree.nodesRef.value.find((node) => node.id === menu.value!.parentNodeId);
      const menuNode = tree.nodesRef.value.find((node) => node.id === menu.value!.nodeId);
      expect(menubarNode).toBeDefined();
      expect(menubarNode!.parentId).toBeNull();
      expect(menuNode!.parentId).toBe(menubarNode!.id);
    });
  });

  describe('keyboard navigation', () => {
    it.each<{
      direction: TextDirection;
      orientation: Orientation;
      nextKey: string;
      prevKey: string;
      otherAxisKey: string;
    }>([
      {
        direction: 'ltr',
        orientation: 'horizontal',
        nextKey: 'ArrowRight',
        prevKey: 'ArrowLeft',
        otherAxisKey: 'ArrowDown',
      },
      {
        direction: 'ltr',
        orientation: 'vertical',
        nextKey: 'ArrowDown',
        prevKey: 'ArrowUp',
        otherAxisKey: 'ArrowRight',
      },
      {
        direction: 'rtl',
        orientation: 'horizontal',
        nextKey: 'ArrowLeft',
        prevKey: 'ArrowRight',
        otherAxisKey: 'ArrowDown',
      },
      {
        direction: 'rtl',
        orientation: 'vertical',
        nextKey: 'ArrowDown',
        prevKey: 'ArrowUp',
        otherAxisKey: 'ArrowLeft',
      },
    ])(
      '$direction, orientation: $orientation',
      async ({ direction, orientation, nextKey, prevKey, otherAxisKey }) => {
        const { user } = await render(
          <DirectionProvider direction={direction}>
            <Menubar dir={direction} orientation={orientation}>
              <MenubarMockMenu data-testid="a" />
              <MenubarMockMenu data-testid="b" />
              <MenubarMockMenu data-testid="c" />
            </Menubar>
          </DirectionProvider>,
        );

        await user.keyboard('[Tab]');
        expect(screen.getByTestId('a')).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);
        expect(screen.getByTestId('b')).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);
        expect(screen.getByTestId('c')).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);
        expect(screen.getByTestId('a')).toHaveFocus();

        await user.keyboard(`[${prevKey}]`);
        expect(screen.getByTestId('c')).toHaveFocus();

        await user.keyboard(`[${otherAxisKey}]`);
        expect(screen.getByTestId('c')).toHaveFocus();
      },
    );

    it('moves to the first and the last item with Home and End', async () => {
      const { user } = await render(
        <Menubar>
          <MenubarMockMenu data-testid="a" />
          <MenubarMockMenu data-testid="b" />
          <MenubarMockMenu data-testid="c" />
        </Menubar>,
      );

      await user.keyboard('[Tab]');
      expect(screen.getByTestId('a')).toHaveFocus();

      await user.keyboard('[End]');
      expect(screen.getByTestId('c')).toHaveFocus();

      await user.keyboard('[Home]');
      expect(screen.getByTestId('a')).toHaveFocus();
    });

    it('does not wrap the focus when loopFocus is false', async () => {
      const { user } = await render(
        <Menubar loopFocus={false}>
          <MenubarMockMenu data-testid="first" />
          <MenubarMockMenu data-testid="last" />
        </Menubar>,
      );

      await user.keyboard('[Tab]');
      expect(screen.getByTestId('first')).toHaveFocus();

      await user.keyboard('[ArrowLeft]');
      expect(screen.getByTestId('first')).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByTestId('last')).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByTestId('last')).toHaveFocus();
    });

    it('does not move the focus when a keydown listener of the consumer prevents the handler', async () => {
      const { user } = await render(
        <Menubar onKeydown={(event) => event.preventVaseUIHandler()}>
          <MenubarMockMenu data-testid="a" />
          <MenubarMockMenu data-testid="b" />
        </Menubar>,
      );

      await user.keyboard('[Tab]');
      expect(screen.getByTestId('a')).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByTestId('a')).toHaveFocus();
    });
  });

  describe('pointer', () => {
    it('moves the focus to the item under the pointer only while a menu is open', async () => {
      const menu = shallowRef<MockMenu | null>(null);
      const { user } = await render(
        <Menubar>
          <MenubarMockMenu ref={menu} data-testid="a" style={noRealPointer} />
          <MenubarMockMenu data-testid="b" style={noRealPointer} />
        </Menubar>,
      );
      await user.keyboard('[Tab]');
      expect(screen.getByTestId('a')).toHaveFocus();

      await fireEvent.mouseMove(screen.getByTestId('b'));
      expect(screen.getByTestId('a')).toHaveFocus();

      menu.value!.report(true, 'trigger-press');
      await fireEvent.mouseMove(screen.getByTestId('b'));
      expect(screen.getByTestId('b')).toHaveFocus();
    });
  });

  describe('KeepAlive', () => {
    it('keeps the open-menu state, the tab stop and the tree nodes across a deactivation', async () => {
      const menu = shallowRef<MockMenu | null>(null);
      const Inner = defineComponent(() => () => (
        <Menubar>
          <MenubarMockMenu ref={menu} data-testid="a" />
          <MenubarMockMenu data-testid="b" />
          <MenubarMockMenu data-testid="c" />
        </Menubar>
      ));
      const Other = defineComponent(() => () => <span data-testid="other" />);
      const App = defineComponent(
        (props: { visible: boolean }) => () => (
          <KeepAlive>{props.visible ? <Inner /> : <Other />}</KeepAlive>
        ),
        { props: ['visible'] },
      );
      const { container, setProps, user } = await render(<App visible />);
      const menubar = screen.getByRole('menubar');
      const context = menu.value!.menubar;
      const tree = menu.value!.tree!;

      await user.keyboard('[Tab]');
      await user.keyboard('[ArrowRight]');
      menu.value!.report(true, 'trigger-press');
      await nextTick();
      expect(menubar).toHaveAttribute('data-has-submenu-open');
      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);
      // The node of the menubar and the nodes of the three menus.
      const nodeIds = tree.nodesRef.value.map((node) => node.id);
      expect(nodeIds).toHaveLength(4);

      await setProps({ visible: false });
      await flushMicrotasks();
      expect(menubar).not.toBeInTheDocument();
      expect(context.hasSubmenuOpen.value).toBe(true);
      expect(tree.nodesRef.value.map((node) => node.id)).toEqual(nodeIds);

      await setProps({ visible: true });
      await flushMicrotasks();

      expect(screen.getByRole('menubar')).toBe(menubar);
      expect(menubar).toHaveAttribute('data-has-submenu-open');
      expect(context.contentElement.value).toBe(menubar);
      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);
      expect(tree.nodesRef.value.map((node) => node.id)).toEqual(nodeIds);
    });
  });

  describe('hydration', () => {
    it.each<{
      name: string;
      props: Record<string, unknown>;
      orientation: Orientation;
    }>([
      { name: 'a menubar with no props', props: {}, orientation: 'horizontal' },
      {
        name: 'a vertical, non-modal menubar',
        props: { id: 'file-menubar', orientation: 'vertical', modal: false },
        orientation: 'vertical',
      },
      { name: 'a disabled menubar', props: { disabled: true }, orientation: 'horizontal' },
    ])('hydrates $name', async ({ props, orientation }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const serverMenubar = parse(serverHtml).firstElementChild as HTMLElement;
      expect(serverMenubar.getAttribute('role')).toBe('menubar');

      const { container } = await hydrate(MenubarHydration, { serverHtml, props });

      const menubar = container.firstElementChild as HTMLElement;
      expect(menubar).toHaveAttribute('role', 'menubar');
      expect(menubar).toHaveAttribute('id', serverMenubar.id);
      expect(menubar).toHaveAttribute('aria-orientation', orientation);
      expect(readTabindexes(container)).toEqual(['0', '-1', '-1']);
    });
  });

  it('keeps focus on an outside target when a triggerless menubar menu closes', async () => {
    const TestComponent = defineComponent(() => {
      const open = shallowRef(true);
      return () => (
        <>
          <button data-testid="outside" type="button">
            Outside
          </button>
          <Menubar>
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean) => {
                open.value = nextOpen;
              }}
            >
              <Menu.Portal keepMounted>
                <Menu.Positioner>
                  <Menu.Popup data-testid="triggerless-menu">
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>
        </>
      );
    });

    const { user } = await render(<TestComponent />);
    const outside = screen.getByTestId('outside');
    const popup = await screen.findByTestId('triggerless-menu');
    expect(popup).toHaveAttribute('data-open');

    await user.click(outside);

    await waitFor(() => {
      expect(popup).toHaveAttribute('data-closed');
    });
    expect(outside).toHaveFocus();
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerMenubar },
    { name: 'detached triggers', Component: DetachedTriggerMenubar },
    { name: 'multiple contained triggers', Component: MultipleContainedTriggersMenubar },
  ])('when using $name', ({ Component: TestMenubar }) => {
    describe.skipIf(isJSDOM)('hover behavior', () => {
      it('should not open submenus on hover when no submenu is already open', async () => {
        await render(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');

        await userEvent.hover(fileTrigger);

        expect(screen.queryByTestId('file-menu')).toBe(null);
      });
    });

    describe('role', () => {
      it('sets role="menubar" on the root element', async () => {
        await render(<TestMenubar />);
        expect(screen.queryByRole('menubar')).not.toBe(null);
      });

      it('sets aria-orientation on the root element', async () => {
        await render(<Menubar orientation="vertical" />);
        expect(screen.getByRole('menubar')).toHaveAttribute('aria-orientation', 'vertical');
      });

      it('sets role="menuitem" on menu triggers', async () => {
        await render(<TestMenubar />);
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(3);
      });
    });
  });

  describe('disabled state', () => {
    it('keeps the menubar reachable when the first trigger is disabled', async () => {
      const { user } = await render(
        <Menubar style={{ display: 'flex' }}>
          <Menu.Root>
            <Menu.Trigger disabled data-testid="file-trigger">
              File
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Open</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root>
            <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Copy</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );

      const fileTrigger = screen.getByTestId('file-trigger');
      const editTrigger = screen.getByTestId('edit-trigger');

      expect(fileTrigger).toHaveAttribute('disabled');
      expect(fileTrigger).toHaveAttribute('tabindex', '-1');
      expect(editTrigger).toHaveAttribute('tabindex', '0');

      // The disabled first trigger must not swallow the only tab stop.
      await user.tab();
      expect(editTrigger).toHaveFocus();
    });

    it('disables menu items while the menubar is disabled', async () => {
      const handleClick = vi.fn();
      const { user } = await render(
        <Menubar disabled>
          <Menu.Root open>
            <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item data-testid="file-item" onClick={handleClick}>
                    Open
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );

      const item = await screen.findByTestId('file-item');
      expect(item).toHaveAttribute('aria-disabled', 'true');

      await user.click(item);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when the menubar context is missing', async () => {
    const ContextConsumer = defineComponent(() => {
      useMenubarContext();
      return () => null;
    });

    await expect(render(<ContextConsumer />)).rejects.toThrow(
      'Vase UI: A part of Menubar must be inside <Menubar>. Without a menubar the part has no menubar state. Put the part inside <Menubar>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
