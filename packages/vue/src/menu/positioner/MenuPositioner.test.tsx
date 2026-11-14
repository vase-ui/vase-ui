import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, shallowRef, toValue } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menubar } from '@vase-ui/vue/menubar';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  positionerConformanceTests,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import {
  ContextMenuProvider,
  MenubarProvider,
  createContextMenuContext,
  createMenubarContext,
} from '../../../test/fixtures/MenuParentFixture';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import type { UseAnchorPositioningParameters } from '../../internals/useAnchorPositioning';
import { REASONS } from '../../internals/reasons';
import { provideFloatingNode, useFloatingParentNodeId } from '../../utils/popups/tree/FloatingTree';

const useAnchorPositioningSpy = vi.hoisted(() => vi.fn());

vi.mock('../../internals/useAnchorPositioning', async () => {
  const actual = await vi.importActual<typeof import('../../internals/useAnchorPositioning')>(
    '../../internals/useAnchorPositioning',
  );

  return {
    ...actual,
    useAnchorPositioning: ((...args: Parameters<typeof actual.useAnchorPositioning>) => {
      useAnchorPositioningSpy(...args);
      return actual.useAnchorPositioning(...args);
    }) satisfies typeof actual.useAnchorPositioning,
  };
});

/** The options that the positioner gave to `useAnchorPositioning` in its last call, read now. */
function readLastOptions() {
  const options = useAnchorPositioningSpy.mock.lastCall?.[0] as UseAnchorPositioningParameters;
  return {
    side: toValue(options.side),
    align: toValue(options.align),
    sideOffset: toValue(options.sideOffset),
    alignOffset: toValue(options.alignOffset),
    arrowPadding: toValue(options.arrowPadding),
    positionMethod: toValue(options.positionMethod),
    collisionAvoidance: toValue(options.collisionAvoidance),
    shift: toValue(options.shift),
    lazyFlip: toValue(options.lazyFlip),
  };
}

const Trigger: FunctionalComponent<Menu.Trigger.Props> = (props, { slots }) => (
  <Menu.Trigger {...props} as="div" nativeButton={false}>
    {slots.default?.()}
  </Menu.Trigger>
);

// Puts its parts in a node of the popup tree, as a popup that holds a menu does.
const ParentNode = defineComponent({
  props: { id: { type: String, required: true } },
  setup(props, { slots }) {
    provideFloatingNode(() => props.id);
    return () => slots.default?.();
  },
});

describe('<Menu.Positioner />', () => {
  const { render } = createRenderer();

  it('leaves lazy flipping off for a plain menu', async () => {
    useAnchorPositioningSpy.mockClear();
    await render(
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    expect(readLastOptions().lazyFlip).toBe(false);
  });

  describeConformance(<Menu.Positioner />, () => ({
    render: (node) => {
      return render(
        <Menu.Root open>
          <Menu.Portal>{node}</Menu.Portal>
        </Menu.Root>,
      );
    },
    refInstanceof: window.HTMLDivElement,
  }));

  describe('prop: anchor', () => {
    function getTransform() {
      return screen.getByTestId('positioner').style.getPropertyValue('transform');
    }

    it('places the positioner against the element of an anchor ref', async () => {
      const anchor = shallowRef<HTMLElement | null>(null);
      const setAnchor = (element: unknown) => {
        anchor.value = element as HTMLElement | null;
      };

      await render(() => (
        <div style={{ margin: '50px' }}>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner
                side="bottom"
                align="start"
                anchor={anchor}
                arrowPadding={0}
                data-testid="positioner"
              >
                <Menu.Popup>Popup</Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <div data-testid="anchor" style={{ marginTop: '100px' }} ref={setAnchor} />
        </div>
      ));

      const anchorPosition = screen.getByTestId('anchor').getBoundingClientRect();

      await waitFor(() => {
        expect(getTransform()).toBe(
          `translate(${anchorPosition.left}px, ${anchorPosition.bottom}px)`,
        );
      });
    });

    it('places the positioner against a virtual anchor', async () => {
      const boundingRect = {
        x: 200,
        y: 100,
        top: 100,
        left: 200,
        bottom: 100,
        right: 200,
        height: 0,
        width: 0,
        toJSON: () => {},
      };

      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="start"
              anchor={{ getBoundingClientRect: () => boundingRect }}
              arrowPadding={0}
              data-testid="positioner"
            >
              <Menu.Popup>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await waitFor(() => {
        expect(getTransform()).toBe('translate(200px, 100px)');
      });
    });
  });

  describe('collision avoidance', () => {
    function lastCallFor(positioner: HTMLElement) {
      const calls = useAnchorPositioningSpy.mock.calls.filter(
        ([params]) => toValue(params.positionerElement) === positioner,
      );
      return calls[calls.length - 1]?.[0] as UseAnchorPositioningParameters | undefined;
    }

    it('uses the dropdown default for a menubar menu', async () => {
      await render(
        <Menubar>
          <Menu.Root open>
            <Menu.Trigger>File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner data-testid="positioner">
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );

      const options = lastCallFor(screen.getByTestId('positioner'));
      expect(toValue(options?.collisionAvoidance)).toEqual(DROPDOWN_COLLISION_AVOIDANCE);
    });
  });

  describe('defaults of the parent', () => {
    function renderMenu(parent: 'menubar' | 'context-menu' | undefined, positioner = {}) {
      const menu = (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner {...positioner}>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );

      useAnchorPositioningSpy.mockClear();
      if (parent === 'menubar') {
        return render(<MenubarProvider context={createMenubarContext()}>{menu}</MenubarProvider>);
      }
      if (parent === 'context-menu') {
        return render(
          <ContextMenuProvider context={createContextMenuContext()}>{menu}</ContextMenuProvider>,
        );
      }
      return render(menu);
    }

    it.each([
      { name: 'no parent', parent: undefined },
      { name: 'a context menu', parent: 'context-menu' as const },
    ])('uses the dropdown collision avoidance for a menu in $name', async ({ parent }) => {
      await renderMenu(parent);

      expect(readLastOptions().collisionAvoidance).toEqual(DROPDOWN_COLLISION_AVOIDANCE);
      expect(readLastOptions().collisionAvoidance).not.toEqual(POPUP_COLLISION_AVOIDANCE);
    });

    it('uses the collisionAvoidance prop over the default', async () => {
      const collisionAvoidance = { side: 'none', align: 'none' } as const;
      await renderMenu(undefined, { collisionAvoidance });

      expect(readLastOptions().collisionAvoidance).toBe(collisionAvoidance);
    });

    it('aligns a menu in a menubar to its start', async () => {
      useAnchorPositioningSpy.mockClear();
      await render(
        <MenubarProvider context={createMenubarContext()}>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </MenubarProvider>,
      );

      expect(readLastOptions().align).toBe('start');
    });

    it('uses the anchor, the offsets and the fixed method of a context menu', async () => {
      const context = createContextMenuContext();
      useAnchorPositioningSpy.mockClear();
      await render(
        <ContextMenuProvider context={context}>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </ContextMenuProvider>,
      );

      expect(readLastOptions()).toMatchObject({
        align: 'start',
        alignOffset: 2,
        sideOffset: -5,
        arrowPadding: 0,
        positionMethod: 'fixed',
        shift: { crossAxis: true, rootBoundary: 'layoutViewport' },
      });
      const anchor = toValue(
        toValue(
          (useAnchorPositioningSpy.mock.lastCall?.[0] as UseAnchorPositioningParameters).anchor,
        ),
      );
      expect(anchor).toBe(context.anchor.value);
    });

    it('disables cross-axis shifting for a context menu when side collision avoidance is flip', async () => {
      await renderMenu('context-menu', { collisionAvoidance: { side: 'flip' } });

      expect(readLastOptions().shift).toEqual({ crossAxis: false, rootBoundary: 'layoutViewport' });
    });

    it('keeps the explicit placement and offsets of a context menu', async () => {
      await renderMenu('context-menu', {
        side: 'right',
        align: 'center',
        sideOffset: 11,
        alignOffset: 13,
      });

      expect(readLastOptions()).toMatchObject({
        side: 'right',
        align: 'center',
        sideOffset: 11,
        alignOffset: 13,
      });
    });
  });

  describe('events of the popup tree', () => {
    async function renderOpenMenu(onOpenChange = vi.fn(), parentNodeId?: string) {
      const probe = createMenuStoreProbe();
      const menu = (
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <probe.Probe />
          <Menu.Trigger id="trigger">Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
      await render(parentNodeId ? <ParentNode id={parentNodeId}>{menu}</ParentNode> : menu);
      return { probe, events: probe.store.select('floatingTreeRoot').events };
    }

    it('closes the menu with the reason of its parent when the parent closes', async () => {
      const onOpenChange = vi.fn();
      const { events } = await renderOpenMenu(onOpenChange, 'parent');

      events.emit('menuopenchange', {
        open: false,
        nodeId: 'parent',
        parentNodeId: null,
        reason: REASONS.escapeKey,
      });

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.escapeKey);
    });

    it('closes the menu with the sibling reason when its parent closes with no reason', async () => {
      const onOpenChange = vi.fn();
      const { events } = await renderOpenMenu(onOpenChange, 'parent');

      events.emit('menuopenchange', {
        open: false,
        nodeId: 'parent',
        parentNodeId: null,
        reason: null,
      });

      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.siblingOpen);
    });

    it('stays open when a node that is not its parent closes', async () => {
      const onOpenChange = vi.fn();
      const { events } = await renderOpenMenu(onOpenChange, 'parent');

      events.emit('menuopenchange', {
        open: false,
        nodeId: 'other',
        parentNodeId: null,
        reason: null,
      });

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('closes the menu when a sibling menu opens', async () => {
      const onOpenChange = vi.fn();
      const { events } = await renderOpenMenu(onOpenChange);

      events.emit('menuopenchange', {
        open: true,
        nodeId: 'sibling',
        parentNodeId: null,
        reason: null,
      });

      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.siblingOpen);
    });

    it('turns the hover off while a child menu opens', async () => {
      const { probe, events } = await renderOpenMenu();
      expect(probe.store.select('hoverEnabled')).toBe(true);

      events.emit('menuopenchange', {
        open: true,
        nodeId: 'child',
        parentNodeId: probe.store.select('floatingNodeId'),
        reason: null,
      });

      expect(probe.store.select('hoverEnabled')).toBe(false);
    });

    it('closes the menu when an item of its parent menu is hovered', async () => {
      const onOpenChange = vi.fn();
      const { events } = await renderOpenMenu(onOpenChange, 'parent');

      events.emit('itemhover', { nodeId: 'parent', target: document.body });

      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.siblingOpen);
    });

    it('closes the menu after the close delay, unless the trigger of the menu is hovered again', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const onOpenChange = vi.fn();
      const { probe, events } = await renderOpenMenu(onOpenChange, 'parent');
      probe.store.set('closeDelay', 100);
      const trigger = screen.getByRole('button', { name: 'Open' });

      events.emit('itemhover', { nodeId: 'parent', target: document.body });
      vi.advanceTimersByTime(99);
      expect(onOpenChange).not.toHaveBeenCalled();
      events.emit('itemhover', { nodeId: 'parent', target: trigger });
      vi.advanceTimersByTime(100);
      expect(onOpenChange).not.toHaveBeenCalled();

      events.emit('itemhover', { nodeId: 'parent', target: document.body });
      vi.advanceTimersByTime(100);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.siblingOpen);
    });

    it('ignores the hover of an item of another menu', async () => {
      const onOpenChange = vi.fn();
      const { events } = await renderOpenMenu(onOpenChange, 'parent');

      events.emit('itemhover', { nodeId: 'other', target: document.body });

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('tells the tree about each change of its open state', async () => {
      const open = shallowRef(true);
      const probe = createMenuStoreProbe();
      await render(() => (
        <Menu.Root open={open.value}>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      const listener = vi.fn();
      probe.store.select('floatingTreeRoot').events.on('menuopenchange', listener);

      open.value = false;
      await flushMicrotasks();

      expect(listener).toHaveBeenCalledWith({
        open: false,
        nodeId: probe.store.select('floatingNodeId'),
        parentNodeId: null,
        reason: null,
      });
    });
  });

  describe('tree of a detached trigger', () => {
    // The portal keeps the parts mounted, so they are on the tree of the root when the trigger
    // gives the store another tree.
    async function renderDetachedMenu(onOpenChange = vi.fn()) {
      const handle = Menu.createHandle();
      const probe = createMenuStoreProbe();
      await render(
        <div>
          <ParentNode id="parent">
            <Menu.Trigger handle={handle} id="detached">
              Detached
            </Menu.Trigger>
          </ParentNode>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <probe.Probe />
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>,
      );
      const rootTree = probe.store.select('floatingTreeRoot');

      async function open() {
        handle.open('detached');
        await flushMicrotasks();
        const tree = probe.store.select('floatingTreeRoot');
        expect(tree).not.toBe(rootTree);
        return tree;
      }

      return { handle, probe, rootTree, open };
    }

    it.each([
      {
        name: 'a close event',
        event: 'close',
        data: { domEvent: undefined, reason: REASONS.itemPress },
        reason: REASONS.itemPress,
      },
      {
        name: 'the close of its parent',
        event: 'menuopenchange',
        data: { open: false, nodeId: 'parent', parentNodeId: null, reason: REASONS.escapeKey },
        reason: REASONS.escapeKey,
      },
      {
        name: 'the open of a sibling',
        event: 'menuopenchange',
        data: { open: true, nodeId: 'sibling', parentNodeId: 'parent', reason: null },
        reason: REASONS.siblingOpen,
      },
      {
        name: 'the hover of an item of its parent',
        event: 'itemhover',
        data: { nodeId: 'parent', target: document.body },
        reason: REASONS.siblingOpen,
      },
    ])(
      'listens to the tree that the trigger gives to the menu: $name',
      async ({ event, data, reason }) => {
        const onOpenChange = vi.fn();
        const { open } = await renderDetachedMenu(onOpenChange);
        const tree = await open();
        onOpenChange.mockClear();

        tree.events.emit(event, data);

        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(reason);
      },
    );

    it('tells the tree that the trigger gives to the menu about each open change', async () => {
      const { handle, probe, rootTree, open } = await renderDetachedMenu();
      const onRootTree = vi.fn();
      rootTree.events.on('menuopenchange', onRootTree);

      const tree = await open();
      const nodeId = probe.store.select('floatingNodeId');
      const onTree = vi.fn();
      tree.events.on('menuopenchange', onTree);
      handle.close();
      await flushMicrotasks();

      expect(onTree).toHaveBeenCalledWith(
        expect.objectContaining({ open: false, nodeId, parentNodeId: 'parent' }),
      );
      expect(onRootTree).not.toHaveBeenCalled();
    });
  });

  it('reports the highlighted item again when the item registry settles', async () => {
    const onItemHighlighted = vi.fn();
    const showItem = shallowRef(false);
    const probe = createMenuStoreProbe();
    // An element that registers in the list of the positioner, as an item part does.
    const TestItem = defineComponent({
      setup() {
        const { ref } = useCompositeListItem({ label: () => 'Test item' });
        return () => <div role="menuitem" ref={ref as (element: unknown) => void} />;
      },
    });
    await render(() => (
      <Menu.Root open onItemHighlighted={onItemHighlighted}>
        <probe.Probe />
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>{showItem.value ? <TestItem /> : null}</Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    probe.store.setActiveIndex(0, REASONS.keyboard);
    await flushMicrotasks();
    expect(onItemHighlighted).not.toHaveBeenCalled();

    showItem.value = true;

    await waitFor(() => {
      expect(onItemHighlighted).toHaveBeenCalledTimes(1);
    });
    expect(onItemHighlighted.mock.lastCall?.[0]).toBe(screen.getByRole('menuitem'));
    expect(onItemHighlighted.mock.lastCall?.[1].label).toBe('Test item');
  });

  it('gives its positioning context to the node of the menu while it is mounted', async () => {
    const mounted = shallowRef(true);
    const probe = createMenuStoreProbe();
    await render(() => (
      <Menu.Root open>
        <probe.Probe />
        <Menu.Portal>{mounted.value ? <Menu.Positioner /> : null}</Menu.Portal>
      </Menu.Root>
    ));
    const readContext = () =>
      probe.store
        .select('floatingTreeRoot')
        .nodesRef.value.find((node) => node.id === probe.store.select('floatingNodeId'))?.context;
    await waitFor(() => {
      expect(readContext()?.nodeId).toBe(probe.store.select('floatingNodeId'));
    });

    mounted.value = false;
    await flushMicrotasks();

    expect(readContext()).toBe(undefined);
  });

  it('gives the node of the menu to the parts below it', async () => {
    const parentNodeIds: Array<string | null> = [];
    const NodeProbe = defineComponent({
      setup() {
        const parentNodeId = useFloatingParentNodeId();
        parentNodeIds.push(parentNodeId.value);
        return () => null;
      },
    });
    const probe = createMenuStoreProbe();
    await render(
      <Menu.Root open>
        <probe.Probe />
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <NodeProbe />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    expect(probe.store.select('floatingNodeId')).toBeTruthy();
    expect(parentNodeIds).toEqual([probe.store.select('floatingNodeId')]);
  });

  it('marks the positioner and the popup of an Escape close as instant', async () => {
    await render(
      <Menu.Root defaultOpen>
        <Menu.Portal keepMounted>
          <Menu.Positioner data-testid="positioner">
            <Menu.Popup data-testid="popup" />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
    expect(screen.getByTestId('positioner')).not.toHaveAttribute('data-instant');

    await fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(screen.getByTestId('positioner')).toHaveAttribute('data-instant', 'dismiss');
    expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'dismiss');
  });

  const triggerStyle = { width: '72px', height: '36px' };
  const popupStyle = { width: '52px', height: '24px' };

  describe.skipIf(isJSDOM)('Menubar parent', () => {
    it('uses bottom as the default side when the menubar is horizontal', async () => {
      let side = 'none';

      await render(
        <Menubar>
          <Menu.Root open>
            <Trigger style={triggerStyle}>File</Trigger>
            <Menu.Portal>
              <Menu.Positioner
                sideOffset={(data) => {
                  side = data.side;
                  return 0;
                }}
              >
                <Menu.Popup style={popupStyle}>Open</Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );

      expect(side).toBe('bottom');
    });

    it('uses inline-end as the default side when the menubar is vertical', async () => {
      let side = 'none';

      await render(
        <Menubar orientation="vertical">
          <Menu.Root open>
            <Trigger style={triggerStyle}>File</Trigger>
            <Menu.Portal>
              <Menu.Positioner
                sideOffset={(data) => {
                  side = data.side;
                  return 0;
                }}
              >
                <Menu.Popup style={popupStyle}>Open</Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );

      expect(side).toBe('inline-end');
    });
  });

  positionerConformanceTests({
    render,
    createComponent: ({
      root,
      trigger,
      positioner: { render: renderPositioner, ...positioner },
      popup,
    }) => (
      <Menu.Root {...root}>
        <Trigger {...trigger}>Trigger</Trigger>
        <Menu.Portal>
          <Menu.Positioner
            {...positioner}
            v-slots={renderPositioner ? { render: renderPositioner } : undefined}
          >
            <Menu.Popup {...popup}>Popup</Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  });

  it('is not nested for a menu with no parent menu', async () => {
    await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner data-testid="positioner">
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    expect(screen.getByTestId('positioner')).not.toHaveAttribute('data-nested');
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when rendered outside Menu.Portal', async () => {
    await expect(
      render(
        <Menu.Root open>
          <Menu.Positioner />
        </Menu.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Menu.Positioner> must be inside <Menu.Portal>. Without a portal the positioner does not know if it stays mounted. Put the positioner inside <Menu.Portal>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
