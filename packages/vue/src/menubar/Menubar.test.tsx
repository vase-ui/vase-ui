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
  pressWithTouch,
  renderOnServer,
  screen,
  takeReportedMessages,
  wait,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { platform } from '../common/platform';
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

const isWebKit = platform.engine.webkit;

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

// The focus of the next trigger opens its menu only when the trigger matches `:focus-visible`. After a
// real click of an earlier case, a script focus does not match it. A real Tab sets it, and each later
// script focus keeps it. WebKit does not tab to a button, so the call also focuses the trigger.
async function focusTriggerWithKeyboard(trigger: HTMLElement) {
  await userEvent.tab();
  trigger.focus();
  await flushMicrotasks();
  expect(trigger).toHaveFocus();
}

function createTreeProvider() {
  let tree: ComputedRef<FloatingTreeStore> | undefined;
  const TreeProvider = defineComponent((_, { slots }) => {
    tree = provideFloatingTree();
    return () => slots.default?.();
  });
  return { TreeProvider, getTree: () => tree!.value };
}

type TestMenubarProps = { loopFocus?: boolean; disabled?: boolean };

const ContainedTriggerMenubar = defineComponent(
  (props: TestMenubarProps) => () => (
    <Menubar {...props} style={{ maxWidth: '25vw', display: 'flex' }}>
      <Menu.Root>
        <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="file-menu">
            <Menu.Popup>
              <Menu.Item data-testid="file-item-1">Open</Menu.Item>
              <Menu.Item data-testid="file-item-2">Save</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="share-trigger">Share</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner data-testid="share-menu">
                    <Menu.Popup>
                      <Menu.Item data-testid="share-item-1">Email</Menu.Item>
                      <Menu.Item data-testid="share-item-2">Print</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="edit-menu">
            <Menu.Popup>
              <Menu.Item data-testid="edit-item-1">Copy</Menu.Item>
              <Menu.Item data-testid="edit-item-2">Paste</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger data-testid="view-trigger">View</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="view-menu">
            <Menu.Popup>
              <Menu.Item data-testid="view-item-1">Zoom In</Menu.Item>
              <Menu.Item data-testid="view-item-2">Zoom Out</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="layout-trigger">Layout</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner data-testid="layout-menu">
                    <Menu.Popup>
                      <Menu.RadioGroup defaultValue="single">
                        <Menu.RadioItem value="single" data-testid="layout-item-1">
                          Single column
                        </Menu.RadioItem>
                        <Menu.RadioItem value="two" data-testid="layout-item-2">
                          Two columns
                        </Menu.RadioItem>
                      </Menu.RadioGroup>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menubar>
  ),
  { props: ['loopFocus', 'disabled'] },
);

type RadioItem = {
  type: 'radioItem';
  label: string;
  value: string;
  testId: string;
};

type ContentItem =
  | { type: 'item'; label: string; testId: string }
  | { type: 'submenu'; label: string; testId: string; menuTestId: string; items: ContentItem[] }
  | { type: 'radioGroup'; defaultValue: string; items: RadioItem[] }
  | RadioItem;

type MenuDefinition = {
  label: string;
  triggerTestId: string;
  menuTestId: string;
  items: ContentItem[];
};

const menus: MenuDefinition[] = [
  {
    label: 'File',
    triggerTestId: 'file-trigger',
    menuTestId: 'file-menu',
    items: [
      { type: 'item', label: 'Open', testId: 'file-item-1' },
      { type: 'item', label: 'Save', testId: 'file-item-2' },
      {
        type: 'submenu',
        label: 'Share',
        testId: 'share-trigger',
        menuTestId: 'share-menu',
        items: [
          { type: 'item', label: 'Email', testId: 'share-item-1' },
          { type: 'item', label: 'Print', testId: 'share-item-2' },
        ],
      },
    ],
  },
  {
    label: 'Edit',
    triggerTestId: 'edit-trigger',
    menuTestId: 'edit-menu',
    items: [
      { type: 'item', label: 'Copy', testId: 'edit-item-1' },
      { type: 'item', label: 'Paste', testId: 'edit-item-2' },
    ],
  },
  {
    label: 'View',
    triggerTestId: 'view-trigger',
    menuTestId: 'view-menu',
    items: [
      { type: 'item', label: 'Zoom In', testId: 'view-item-1' },
      { type: 'item', label: 'Zoom Out', testId: 'view-item-2' },
      {
        type: 'submenu',
        label: 'Layout',
        testId: 'layout-trigger',
        menuTestId: 'layout-menu',
        items: [
          {
            type: 'radioGroup',
            defaultValue: 'single',
            items: [
              {
                type: 'radioItem',
                value: 'single',
                label: 'Single column',
                testId: 'layout-item-1',
              },
              { type: 'radioItem', value: 'two', label: 'Two columns', testId: 'layout-item-2' },
            ],
          },
        ],
      },
    ],
  },
];

function renderMenuContentItem(item: ContentItem, key: string) {
  switch (item.type) {
    case 'item':
      return (
        <Menu.Item data-testid={item.testId} key={key}>
          {item.label}
        </Menu.Item>
      );
    case 'submenu':
      return (
        <Menu.SubmenuRoot key={key}>
          <Menu.SubmenuTrigger data-testid={item.testId}>{item.label}</Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner data-testid={item.menuTestId}>
              <Menu.Popup>
                {item.items.map((subItem, subIndex) =>
                  renderMenuContentItem(subItem, `${key}.${subIndex}`),
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      );
    case 'radioGroup':
      return (
        <Menu.RadioGroup defaultValue={item.defaultValue} key={key}>
          {item.items.map((radioItem, radioIndex) =>
            renderMenuContentItem(radioItem, `${key}.${radioIndex}`),
          )}
        </Menu.RadioGroup>
      );
    case 'radioItem':
      return (
        <Menu.RadioItem value={item.value} data-testid={item.testId} key={key}>
          {item.label}
        </Menu.RadioItem>
      );
  }
}

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
                <Menu.Popup>
                  {(menu?.items ?? []).map((item, index) =>
                    renderMenuContentItem(item, `item-${index}`),
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>,
          ],
        }}
      />
    ),
  { props: ['handle'] },
);

const DetachedTriggerMenubar = defineComponent(
  (props: TestMenubarProps) => {
    const menuHandle = Menu.createHandle<MenuDefinition>();
    return () => (
      <>
        <Menubar {...props} style={{ maxWidth: '25vw', display: 'flex' }}>
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
  },
  { props: ['loopFocus', 'disabled'] },
);

const MultipleContainedTriggersMenubar = defineComponent(
  (props: TestMenubarProps) => () => (
    <Menubar {...props} style={{ maxWidth: '25vw', display: 'flex' }}>
      <DynamicMenu>
        {menus.map((menu) => (
          <Menu.Trigger payload={menu} key={menu.label} data-testid={menu.triggerTestId}>
            {menu.label}
          </Menu.Trigger>
        ))}
      </DynamicMenu>
    </Menubar>
  ),
  { props: ['loopFocus', 'disabled'] },
);

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
          <MenubarMockMenu ref={menu} data-testid="a" />
          <MenubarMockMenu data-testid="b" />
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

  it('ignores a delayed touch click immediately after focus opens another menu', async () => {
    const { user } = await render(<ContainedTriggerMenubar />);

    await user.click(screen.getByTestId('file-trigger'));
    await screen.findByTestId('file-menu');

    const editTrigger = screen.getByTestId('edit-trigger');

    // The focus-open below starts a 300ms wall-clock cooldown during which touch clicks
    // are ignored. Freeze timers so the cooldown cannot expire before the first click
    // on a loaded machine, and advance past its expiry explicitly.
    vi.useFakeTimers();
    try {
      editTrigger.focus();
      await flushMicrotasks();
      screen.getByTestId('edit-menu');

      await fireEvent(
        editTrigger,
        new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' }),
      );
      expect(screen.queryByTestId('edit-menu')).not.toBe(null);

      vi.advanceTimersByTime(310);
      await flushMicrotasks();
    } finally {
      vi.useRealTimers();
    }

    await fireEvent(
      editTrigger,
      new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' }),
    );

    await waitFor(() => {
      expect(screen.queryByTestId('edit-menu')).toBe(null);
    });
  });

  it('keeps a controlled menu open on a delayed touch click it ignores, until the cooldown ends', async () => {
    const onEditOpenChange = vi.fn();

    const ControlledEditMenubar = defineComponent(() => {
      const editOpen = shallowRef(false);
      return () => (
        <Menubar>
          <Menu.Root>
            <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner data-testid="file-menu">
                <Menu.Popup>
                  <Menu.Item>Open</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root
            open={editOpen.value}
            onOpenChange={(nextOpen: boolean, eventDetails: Menu.Root.ChangeEventDetails) => {
              onEditOpenChange(nextOpen, eventDetails.reason);
              editOpen.value = nextOpen;
            }}
          >
            <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner data-testid="edit-menu">
                <Menu.Popup>
                  <Menu.Item>Copy</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>
      );
    });

    const { user } = await render(<ControlledEditMenubar />);

    await user.click(screen.getByTestId('file-trigger'));
    await screen.findByTestId('file-menu');

    const editTrigger = screen.getByTestId('edit-trigger');

    // Freeze timers so the 300ms touch-click cooldown started by the focus-open is still
    // active when the trigger is clicked.
    vi.useFakeTimers();
    try {
      editTrigger.focus();
      await flushMicrotasks();
      screen.getByTestId('edit-menu');
      expect(onEditOpenChange).toHaveBeenLastCalledWith(true, 'trigger-focus');

      await fireEvent(
        editTrigger,
        new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' }),
      );
      expect(onEditOpenChange).toHaveBeenLastCalledWith(true, 'trigger-focus');
      expect(editTrigger).toHaveAttribute('data-popup-open');

      vi.advanceTimersByTime(310);
      await flushMicrotasks();
    } finally {
      vi.useRealTimers();
    }

    // Once the cooldown ends, a touch click closes the menu again.
    await fireEvent(
      editTrigger,
      new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' }),
    );

    expect(onEditOpenChange).toHaveBeenLastCalledWith(false, 'trigger-press');
    await waitFor(() => {
      expect(screen.queryByTestId('edit-menu')).toBe(null);
    });
  });

  it('closes on a touch item click immediately after focus opens another menu', async () => {
    const { user } = await render(<ContainedTriggerMenubar />);

    await user.click(screen.getByTestId('file-trigger'));
    await screen.findByTestId('file-menu');

    // Freeze timers so the 300ms touch-click cooldown started by the focus-open is still
    // active when the item is clicked.
    vi.useFakeTimers();
    try {
      screen.getByTestId('edit-trigger').focus();
      await flushMicrotasks();
      // The item mounts with the menu. Vue skips its listener for an event of that millisecond.
      await waitForLaterMillisecond();

      await fireEvent(
        screen.getByTestId('edit-item-1'),
        new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' }),
      );
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => {
      expect(screen.queryByTestId('edit-menu')).toBe(null);
    });
  });

  it('renders contained top-level portal ownership as an allowed menubar child', async () => {
    const { user } = await render(<ContainedTriggerMenubar />);

    await user.click(screen.getByTestId('file-trigger'));

    const fileMenu = await screen.findByTestId('file-menu');
    const fileMenuPortal = fileMenu.closest('[data-vase-ui-portal]');
    const fileMenuPortalId = fileMenuPortal?.id ?? '';
    const owner = screen.getByRole('menubar').querySelector('span[aria-owns]');

    expect(fileMenuPortalId).not.toBe('');
    expect(owner).toHaveAttribute('role', 'group');
    expect(owner).not.toHaveAttribute('aria-hidden');
    expect(owner).toHaveAttribute('aria-owns', fileMenuPortalId);
  });

  it('renders detached top-level portal ownership without an accessibility role', async () => {
    const { user } = await render(<DetachedTriggerMenubar />);

    await user.click(screen.getByTestId('file-trigger'));

    const fileMenu = await screen.findByTestId('file-menu');
    const fileMenuPortal = fileMenu.closest('[data-vase-ui-portal]');
    const fileMenuPortalId = fileMenuPortal?.id ?? '';
    const owner = fileMenu.ownerDocument.querySelector('span[aria-owns]');

    expect(fileMenuPortalId).not.toBe('');
    expect(owner).toHaveAttribute('aria-owns', fileMenuPortalId);
    // The portal renders outside the menubar, so the `group` workaround would only add a stray
    // accessible group.
    expect(screen.getByRole('menubar')).not.toContainElement(owner as HTMLElement | null);
    expect(owner).not.toHaveAttribute('role');
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
    // WebKit does not focus a button on a click (https://bugs.webkit.org/show_bug.cgi?id=22261).
    // When a hover opens the next menu, the focus returns to the first trigger and opens the first
    // menu again. A menubar with one menu for all triggers has no first menu to open again.
    const skipsContainedInWebKit = isWebKit && TestMenubar === ContainedTriggerMenubar;

    describe.skipIf(isJSDOM)('click interactions', () => {
      it('should open the menu after clicking on its trigger and close it when clicking again', async () => {
        await render(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');

        await userEvent.click(fileTrigger, { delay: 30 });
        await screen.findByTestId('file-menu');

        // Click again to close the menu
        await userEvent.click(fileTrigger, { delay: 30 });
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('hover behavior', () => {
      it('should not open submenus on hover when no submenu is already open', async () => {
        await render(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');

        await userEvent.hover(fileTrigger);

        expect(screen.queryByTestId('file-menu')).toBe(null);
      });

      it.skipIf(skipsContainedInWebKit)(
        'should open submenus on hover when another submenu is already open',
        async () => {
          await render(<TestMenubar />);

          // First click to open the file menu
          const fileTrigger = screen.getByTestId('file-trigger');
          await userEvent.click(fileTrigger);

          await screen.findByTestId('file-menu');
          await waitFor(() => {
            expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
          });

          // Now hover over the edit trigger, it should open because a submenu is already open
          const editTrigger = screen.queryByTestId('edit-trigger');
          expect(editTrigger).not.toBe(null);

          await userEvent.hover(editTrigger as HTMLElement);

          await waitFor(() => {
            expect(screen.queryByTestId('edit-menu')).not.toBe(null);
          });

          // The file menu should now be closed
          expect(screen.queryByTestId('file-menu')).toBe(null);

          // Continue hovering to the view trigger
          const viewTrigger = screen.getByTestId('view-trigger');
          await userEvent.hover(viewTrigger);

          await waitFor(() => {
            expect(screen.queryByTestId('view-menu')).not.toBe(null);
          });

          // The edit menu should now be closed
          expect(screen.queryByTestId('edit-menu')).toBe(null);
        },
      );

      it('should open nested submenus on hover when parent menu is open', async () => {
        await render(<TestMenubar />);

        // First click to open the file menu
        const fileTrigger = screen.getByTestId('file-trigger');
        await userEvent.click(fileTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('file-menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
        });

        await wait(50);

        // Now hover over the share submenu trigger
        const shareTrigger = await screen.findByTestId('share-trigger');
        await userEvent.hover(shareTrigger);

        // The share submenu should open
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.toBe(null);
        });
      });

      it('should open another menu on hover when a nested submenu is open', async () => {
        await render(<TestMenubar />);

        // First click to open the file menu
        const fileTrigger = screen.getByTestId('file-trigger');
        await userEvent.click(fileTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('file-menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
        });

        // Now hover over the share submenu trigger
        const shareTrigger = await screen.findByTestId('share-trigger');
        await userEvent.hover(shareTrigger);

        // The share submenu should open
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.toBe(null);
        });

        // Hover over the first item in the share submenu
        await userEvent.hover(screen.getByTestId('share-item-1'));

        // Now hover over the edit menubar trigger
        const editTrigger = screen.getByTestId('edit-trigger');
        await userEvent.hover(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });

        expect(screen.queryByTestId('file-menu')).toBe(null);
        expect(screen.queryByTestId('share-menu')).toBe(null);
      });
    });

    describe('focus behavior', () => {
      it('focuses a menubar item without immediately opening the menu', async () => {
        const { user } = await render(<TestMenubar />);

        await user.tab();

        const fileTrigger = screen.getByTestId('file-trigger');
        await waitFor(() => {
          expect(fileTrigger).toHaveFocus();
        });
        expect(screen.queryByTestId('file-menu')).toBe(null);

        await wait(50);

        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('closeOnClick on nested items behavior', () => {
      it('should respect closeOnClick on nested items when the menu was opened on click', async () => {
        await render(<TestMenubar />);

        const viewTrigger = screen.getByTestId('view-trigger');

        await userEvent.click(viewTrigger, { delay: 30 });
        await screen.findByTestId('view-menu');

        const layoutTrigger = screen.getByTestId('layout-trigger');
        await userEvent.hover(layoutTrigger);

        await screen.findByTestId('layout-menu');

        const layoutItem2 = screen.getByTestId('layout-item-2');
        await userEvent.click(layoutItem2, { delay: 30 });

        // The layout menu should not close after clicking an item
        await waitFor(() => {
          expect(screen.queryByTestId('layout-menu')).not.toBe(null);
        });
      });

      // https://github.com/mui/base-ui/issues/2092
      it.skipIf(skipsContainedInWebKit)(
        'should respect closeOnClick on nested items when the menu was opened on hover',
        async () => {
          await render(<TestMenubar />);

          const fileTrigger = screen.getByTestId('file-trigger');
          const viewTrigger = screen.getByTestId('view-trigger');

          await userEvent.click(fileTrigger, { delay: 30 });
          await screen.findByTestId('file-menu');

          await userEvent.hover(viewTrigger);
          await screen.findByTestId('view-menu');

          const layoutTrigger = screen.getByTestId('layout-trigger');
          await userEvent.hover(layoutTrigger);

          await screen.findByTestId('layout-menu');

          const layoutItem2 = screen.getByTestId('layout-item-2');
          await userEvent.click(layoutItem2, { delay: 30 });

          // The layout menu should not close after clicking an item
          await waitFor(() => {
            expect(screen.queryByTestId('layout-menu')).not.toBe(null);
          });
        },
      );
    });

    describe('keyboard interactions', () => {
      it('should navigate between menubar items with arrow keys', async () => {
        const { user } = await render(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const editTrigger = screen.getByTestId('edit-trigger');

        // First focus the file trigger
        fileTrigger.focus();
        await flushMicrotasks();

        // Check that file trigger has focus
        await waitFor(() => {
          expect(fileTrigger).toHaveFocus();
        });

        // Use arrow right to navigate to edit trigger
        await user.keyboard('{ArrowRight}');

        // Wait for the edit trigger to get focus
        await waitFor(() => {
          expect(editTrigger).toHaveFocus();
        });
      });

      it('moves focus to the first and last triggers with Home and End', async () => {
        const { user } = await render(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const viewTrigger = screen.getByTestId('view-trigger');

        fileTrigger.focus();
        await flushMicrotasks();

        await user.keyboard('{End}');
        await waitFor(() => {
          expect(viewTrigger).toHaveFocus();
        });

        await user.keyboard('{Home}');
        await waitFor(() => {
          expect(fileTrigger).toHaveFocus();
        });
      });

      it('should open the menu with Space key', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus the file trigger
        fileTrigger.focus();
        await flushMicrotasks();

        // Press Space key to open menu
        await user.keyboard(' ');

        // Menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });
      });

      it('should navigate within the menu using arrow keys', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu
        fileTrigger.focus();
        await flushMicrotasks();
        await user.keyboard('{Enter}');

        // File menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        // First item should be focused automatically
        const firstItem = screen.getByTestId('file-item-1');
        await waitFor(() => {
          expect(firstItem).toHaveFocus();
        });

        // Navigate down to second item
        await user.keyboard('{ArrowDown}');
        const secondItem = screen.getByTestId('file-item-2');
        await waitFor(() => {
          expect(secondItem).toHaveFocus();
        });

        // Navigate down to submenu trigger
        await user.keyboard('{ArrowDown}');
        const shareTrigger = screen.getByTestId('share-trigger');
        await waitFor(() => {
          expect(shareTrigger).toHaveFocus();
        });
      });

      it('should open the submenu with right arrow key', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu
        fileTrigger.focus();
        await flushMicrotasks();
        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        await waitFor(() => {
          expect(screen.getByTestId('file-item-1')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('file-item-2')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('share-trigger')).toHaveFocus();
        });

        // Arrow right should open submenu
        await user.keyboard('{ArrowRight}');

        // Share submenu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.toBe(null);
        });

        // First submenu item should be focused
        const submenuItem = screen.getByTestId('share-item-1');
        await waitFor(() => {
          expect(submenuItem).toHaveFocus();
        });
      });

      it.skipIf(isJSDOM)('should close the menu with Escape key', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu
        fileTrigger.focus();
        await flushMicrotasks();

        await user.keyboard('{Enter}');

        // Menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        // Press Escape to close
        await user.keyboard('{Escape}');

        // Menu should be closed
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });
      });

      it('should close submenu with left arrow key and return focus to submenu trigger', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu
        fileTrigger.focus();
        await flushMicrotasks();
        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.getByTestId('file-item-1')).toHaveFocus();
        });

        // Navigate to submenu trigger
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('file-item-2')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');

        const shareTrigger = screen.getByTestId('share-trigger');
        await waitFor(() => {
          expect(shareTrigger).toHaveFocus();
        });

        // Open submenu
        await user.keyboard('{ArrowRight}');
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.toBe(null);
        });
        // The submenu focuses its first item a frame after opening.
        await waitFor(() => {
          expect(screen.getByTestId('share-item-1')).toHaveFocus();
        });

        // Close submenu with left arrow
        await user.keyboard('{ArrowLeft}');

        // Submenu should be closed
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).toBe(null);
        });

        // Focus should return to submenu trigger
        expect(shareTrigger).toHaveFocus();
      });

      it('closes open submenus when navigating to the next menubar item with ArrowRight', async () => {
        const rootOnOpenChange = vi.fn();
        const submenuOnOpenChange = vi.fn();
        const nextOnOpenChange = vi.fn();

        const SpyMenubar = defineComponent(() => () => (
          <Menubar>
            <Menu.Root onOpenChange={rootOnOpenChange}>
              <Menu.Trigger data-testid="menubar-file-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="menubar-file-menu">
                  <Menu.Popup>
                    <Menu.Item data-testid="menubar-file-item">Item 1</Menu.Item>
                    <Menu.SubmenuRoot onOpenChange={submenuOnOpenChange}>
                      <Menu.SubmenuTrigger data-testid="menubar-submenu-trigger">
                        Share
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="menubar-submenu-menu">
                          <Menu.Popup>
                            <Menu.Item data-testid="menubar-submenu-item">Email</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Menu.Root onOpenChange={nextOnOpenChange}>
              <Menu.Trigger data-testid="menubar-next-trigger">Edit</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="menubar-next-menu">
                  <Menu.Popup>
                    <Menu.Item>Edit Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>
        ));

        const { user } = await render(<SpyMenubar />);
        const fileTrigger = screen.getByTestId('menubar-file-trigger');

        await focusTriggerWithKeyboard(fileTrigger);
        await user.keyboard('{Enter}');
        await screen.findByTestId('menubar-file-menu');

        await waitFor(() => {
          expect(screen.getByTestId('menubar-file-item')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');
        const submenuTrigger = screen.getByTestId('menubar-submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger).toHaveFocus();
        });

        await user.keyboard('{ArrowRight}');
        await screen.findByTestId('menubar-submenu-menu');

        await waitFor(() => {
          expect(screen.getByTestId('menubar-submenu-item')).toHaveFocus();
        });

        await user.keyboard('{ArrowRight}');

        await screen.findByTestId('menubar-next-menu');

        await waitFor(() => {
          expect(screen.queryByTestId('menubar-submenu-menu')).toBe(null);
        });

        await waitFor(() => {
          expect(screen.queryByTestId('menubar-file-menu')).toBe(null);
        });

        expect(submenuOnOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(rootOnOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(nextOnOpenChange.mock.lastCall?.[0]).toBe(true);
      });

      it('should navigate between menus using left/right arrow keys when menus are open', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu
        await focusTriggerWithKeyboard(fileTrigger);
        await user.keyboard('{Enter}');

        // File menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        // Navigate right to edit menu
        await user.keyboard('{ArrowRight}');

        // File menu should close, edit menu should open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });
        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });
      });
    });

    describe('mixed mouse and keyboard interactions', () => {
      it('should allow keyboard navigation after opening a menu with mouse click', async () => {
        const { user } = await render(<TestMenubar />);

        // Open the menu with a mouse click
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        // Menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        // Navigate with keyboard
        await user.keyboard('{ArrowDown}');
        const firstItem = screen.getByTestId('file-item-1');
        await waitFor(() => {
          expect(firstItem).toHaveFocus();
        });

        // Continue navigation
        await user.keyboard('{ArrowDown}');
        const secondItem = screen.getByTestId('file-item-2');
        await waitFor(() => {
          expect(secondItem).toHaveFocus();
        });
      });

      it('should allow clicking a menu trigger then navigating to another menu with keyboard', async () => {
        const { user } = await render(<TestMenubar />);

        // Open the file menu with a mouse click
        const fileTrigger = screen.getByTestId('file-trigger');
        await focusTriggerWithKeyboard(fileTrigger);
        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        // Navigate to edit menu with keyboard
        await user.keyboard('{ArrowRight}');

        // File menu should close, edit menu should open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });
        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });
      });
    });

    describe('touch interactions', () => {
      it('closes the entire tree on a single outside press after opening a submenu', async () => {
        await render(
          <div>
            <TestMenubar />
            <button data-testid="outside">Outside</button>
          </div>,
        );

        const fileTrigger = screen.getByTestId('file-trigger');
        await pressWithTouch(fileTrigger);

        await screen.findByTestId('file-menu');

        const shareTrigger = await screen.findByTestId('share-trigger');
        await pressWithTouch(shareTrigger);

        await screen.findByTestId('share-menu');

        const outside = screen.getByTestId('outside');
        await pressWithTouch(outside);

        // The submenu lives inside the file menu, so it is gone once the file menu closes.
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });
        expect(screen.queryByTestId('share-menu')).toBe(null);
      });
    });

    describe.skipIf(isJSDOM)('scroll locking', () => {
      it.each([
        { name: 'unmounted while closed', keepMounted: false },
        { name: 'kept mounted while closed', keepMounted: true },
      ])(
        'applies scroll lock when a touch-opened submenu $name covers the viewport width',
        async ({ keepMounted }) => {
          await render(
            <Menubar modal style={{ display: 'flex' }}>
              <Menu.Root>
                <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
                <Menu.Portal keepMounted={keepMounted}>
                  <Menu.Positioner data-testid="file-menu" style={{ width: 'calc(100vw - 10px)' }}>
                    <Menu.Popup>
                      <Menu.Item>Open</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Menubar>,
          );

          const trigger = screen.getByTestId('file-trigger');

          await pressWithTouch(trigger);

          const menu = await screen.findByRole('menu');
          const doc = menu.ownerDocument;

          await waitFor(() => {
            expect(isScrollLocked(doc)).toBe(true);
          });
        },
      );

      it('does not apply scroll lock when a touch-opened submenu is narrower than the viewport', async () => {
        await render(
          <Menubar modal style={{ display: 'flex' }}>
            <Menu.Root>
              <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="file-menu" style={{ width: '240px' }}>
                  <Menu.Popup>
                    <Menu.Item>Open</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>,
        );

        const trigger = screen.getByTestId('file-trigger');

        await pressWithTouch(trigger);

        const menu = await screen.findByRole('menu');
        const doc = menu.ownerDocument;

        // The lock waits for a timer of 0 ms.
        await wait(0);

        expect(isScrollLocked(doc)).toBe(false);
      });

      it('updates scroll lock when handing off between top-level touch-opened menus', async () => {
        await render(
          <Menubar modal style={{ display: 'flex' }}>
            <Menu.Root>
              <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="file-menu" style={{ width: 'calc(100vw - 10px)' }}>
                  <Menu.Popup>
                    <Menu.Item>Open</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Menu.Root>
              <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="edit-menu" style={{ width: '240px' }}>
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
        const doc = fileTrigger.ownerDocument;

        await pressWithTouch(fileTrigger);

        await screen.findByTestId('file-menu');

        await waitFor(() => {
          expect(isScrollLocked(doc)).toBe(true);
        });

        await pressWithTouch(editTrigger);

        await screen.findByTestId('edit-menu');

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });

        await waitFor(() => {
          expect(isScrollLocked(doc)).toBe(false);
        });
      });
    });

    describe('prop: loopFocus', () => {
      describe('when loopFocus == true', () => {
        it('should loop around to the first item after the last one', async () => {
          const { user } = await render(<TestMenubar loopFocus />);

          const firstItem = screen.getByTestId('file-trigger');
          firstItem.focus();
          await flushMicrotasks();

          await user.keyboard('{ArrowRight}');
          await user.keyboard('{ArrowRight}');

          const lastItem = screen.getByTestId('view-trigger');
          expect(lastItem).toHaveFocus();

          await user.keyboard('{ArrowRight}');
          expect(firstItem).toHaveFocus();
        });

        it('should loop around to the last item after the first one', async () => {
          const { user } = await render(<TestMenubar loopFocus />);

          const fileTrigger = screen.getByTestId('file-trigger');
          fileTrigger.focus();
          await flushMicrotasks();

          await waitFor(() => {
            expect(fileTrigger).toHaveFocus();
          });

          await user.keyboard('{ArrowLeft}');
          const lastItem = screen.getByTestId('view-trigger');
          await waitFor(() => {
            expect(lastItem).toHaveFocus();
          });
        });
      });

      describe('when loopFocus == false', () => {
        it('should stay on the last item when navigating beyond it', async () => {
          const { user } = await render(<TestMenubar loopFocus={false} />);

          const fileTrigger = screen.getByTestId('file-trigger');
          fileTrigger.focus();
          await flushMicrotasks();

          await user.keyboard('{ArrowRight}');
          await waitFor(() => {
            expect(screen.queryByTestId('edit-trigger')).not.toBe(null);
          });

          await user.keyboard('{ArrowRight}');

          const lastItem = screen.getByTestId('view-trigger');
          await waitFor(() => {
            expect(lastItem).toHaveFocus();
          });

          await user.keyboard('{ArrowRight}');
          await waitFor(() => {
            expect(lastItem).toHaveFocus();
          });
        });

        it('should stay on the first item when navigating before it', async () => {
          const { user } = await render(<TestMenubar loopFocus={false} />);

          const firstItem = screen.getByTestId('file-trigger');
          firstItem.focus();
          await flushMicrotasks();

          await user.keyboard('{ArrowLeft}');
          expect(firstItem).toHaveFocus();
        });
      });
    });

    describe('prop: disabled', () => {
      it('disables child menus when menubar is disabled', async () => {
        const { user } = await render(<TestMenubar disabled />);

        const fileTrigger = screen.getByTestId('file-trigger');

        // Trigger should be disabled
        expect(fileTrigger).toHaveAttribute('disabled');

        // It should not be reachable via Tab
        await user.tab();
        expect(fileTrigger).not.toHaveFocus();
        expect(document.body).toHaveFocus();

        // Clicking should not open the menu
        await user.click(fileTrigger);
        await waitSingleFrame();
        await flushMicrotasks();
        expect(screen.queryByTestId('file-menu')).toBe(null);
      });
    });

    it.skipIf(isJSDOM || skipsContainedInWebKit)(
      'correctly opens new menu on hover after clicking on its trigger and entering from hover (#2222)',
      async () => {
        await render(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const editTrigger = screen.getByTestId('edit-trigger');
        await userEvent.click(fileTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
        });

        await userEvent.hover(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });

        await userEvent.click(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).not.toHaveAttribute('data-has-submenu-open');
        });

        await userEvent.click(fileTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
        });

        await userEvent.hover(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });
      },
    );

    describe('role', () => {
      it('sets role="menubar" on the root element', async () => {
        await render(<TestMenubar />);
        expect(screen.queryByRole('menubar')).not.toBe(null);
      });

      it('sets aria-orientation on the root element', async () => {
        await render(<Menubar orientation="vertical" />);
        expect(screen.getByRole('menubar')).toHaveAttribute('aria-orientation', 'vertical');
      });

      it('moves between triggers with the main-axis arrow keys when vertical', async () => {
        const { user } = await render(
          <Menubar orientation="vertical">
            <Menu.Root>
              <Menu.Trigger data-testid="first-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>New</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Menu.Root>
              <Menu.Trigger data-testid="second-trigger">Edit</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Undo</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>,
        );

        const firstTrigger = screen.getByTestId('first-trigger');
        firstTrigger.focus();
        await flushMicrotasks();

        await user.keyboard('[ArrowDown]');

        expect(screen.getByTestId('second-trigger')).toHaveFocus();
        expect(screen.queryByRole('menu')).toBe(null);
      });

      it.each([
        { direction: 'ltr', openKey: 'ArrowRight', oppositeKey: 'ArrowLeft' },
        { direction: 'rtl', openKey: 'ArrowLeft', oppositeKey: 'ArrowRight' },
      ] as const)(
        'opens a menu of a vertical $direction menubar with $openKey',
        async ({ direction, openKey, oppositeKey }) => {
          const { user } = await render(
            <DirectionProvider direction={direction}>
              <Menubar orientation="vertical">
                <Menu.Root>
                  <Menu.Trigger data-testid="first-trigger">File</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>New</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </Menubar>
            </DirectionProvider>,
          );

          const firstTrigger = screen.getByTestId('first-trigger');
          firstTrigger.focus();
          await flushMicrotasks();

          await user.keyboard(`[${oppositeKey}]`);
          expect(screen.queryByRole('menu')).toBe(null);

          await user.keyboard(`[${openKey}]`);

          await screen.findByRole('menu');
        },
      );

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
