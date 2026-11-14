import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, Teleport, computed, defineComponent, nextTick, shallowRef, toValue } from 'vue';
import type { FunctionalComponent } from 'vue';
import { ContextMenu } from '@vase-ui/vue/context-menu';
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
import {
  HIDDEN_SCROLLBARS_CSS,
  createScrollDocument,
  getScrollLockRegistry,
  isPageLocked,
} from '../../../test/fixtures/scrollDocument';
import type { ScrollDocument } from '../../../test/fixtures/scrollDocument';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { UseAnchorPositioningParameters } from '../../internals/useAnchorPositioning';
import { REASONS } from '../../internals/reasons';
import { provideFloatingNode, useFloatingParentNodeId } from '../../utils/popups/tree/FloatingTree';
import MenuPositionerScoped from './MenuPositionerScoped.test.vue';

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

  it('enables lazy flipping for a filter menu', async () => {
    useAnchorPositioningSpy.mockClear();
    await render(
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter" />
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    // `'placement'` and not `true`: the filter menu locks the alignment as well as the side, so a
    // popup that flipped once does not jitter back while typing resizes it. Combobox stays on
    // `true` (side only), which is what it shipped with.
    expect(readLastOptions().lazyFlip).toBe('placement');
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

  describe.skipIf(isJSDOM)('prop: anchor', () => {
    function getTransform() {
      return screen.getByTestId('positioner').style.getPropertyValue('transform');
    }

    it('should be placed near the specified element when a ref is passed', async () => {
      const TestComponent = defineComponent(() => {
        const anchor = shallowRef<HTMLElement | null>(null);
        const setAnchor = (element: unknown) => {
          anchor.value = element as HTMLElement | null;
        };

        return () => (
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
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                    <Menu.Item>2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <div data-testid="anchor" style={{ marginTop: '100px' }} ref={setAnchor} />
          </div>
        );
      });

      await render(<TestComponent />);

      const anchorPosition = screen.getByTestId('anchor').getBoundingClientRect();

      await waitFor(() => {
        expect(getTransform()).toBe(
          `translate(${anchorPosition.left}px, ${anchorPosition.bottom}px)`,
        );
      });
    });

    it('should be placed near the specified element when an element is passed', async () => {
      const TestComponent = defineComponent(() => {
        const anchor = shallowRef<HTMLElement | null>(null);
        const handleRef = (element: unknown) => {
          anchor.value = element as HTMLElement | null;
        };

        return () => (
          <div style={{ margin: '50px' }}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner
                  side="bottom"
                  align="start"
                  anchor={anchor.value}
                  arrowPadding={0}
                  data-testid="positioner"
                >
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                    <Menu.Item>2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <div data-testid="anchor" style={{ marginTop: '100px' }} ref={handleRef} />
          </div>
        );
      });

      await render(<TestComponent />);

      const anchorPosition = screen.getByTestId('anchor').getBoundingClientRect();

      await waitFor(() => {
        expect(getTransform()).toBe(
          `translate(${anchorPosition.left}px, ${anchorPosition.bottom}px)`,
        );
      });
    });

    it('should be placed near the specified element when a function returning an element is passed', async () => {
      const TestComponent = defineComponent(() => {
        const anchor = shallowRef<HTMLElement | null>(null);
        const handleRef = (element: unknown) => {
          anchor.value = element as HTMLElement | null;
        };

        const getAnchor = () => anchor.value;

        return () => (
          <div style={{ margin: '50px' }}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner
                  side="bottom"
                  align="start"
                  anchor={getAnchor}
                  arrowPadding={0}
                  data-testid="positioner"
                >
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                    <Menu.Item>2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <div data-testid="anchor" style={{ marginTop: '100px' }} ref={handleRef} />
          </div>
        );
      });

      await render(<TestComponent />);

      const anchorPosition = screen.getByTestId('anchor').getBoundingClientRect();

      await waitFor(() => {
        expect(getTransform()).toBe(
          `translate(${anchorPosition.left}px, ${anchorPosition.bottom}px)`,
        );
      });
    });

    it('should be placed at the specified position', async () => {
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

      const virtualElement = { getBoundingClientRect: () => boundingRect };

      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="start"
              anchor={virtualElement}
              arrowPadding={0}
              data-testid="positioner"
            >
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.Item>2</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await waitFor(() => {
        expect(getTransform()).toBe('translate(200px, 100px)');
      });
    });

    it('should accept a non-memoized function as an anchor', async () => {
      const TestComponent = defineComponent(() => () => (
        <div style={{ margin: '50px' }}>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner
                side="bottom"
                align="start"
                anchor={() => null}
                arrowPadding={0}
                data-testid="positioner"
              >
                <Menu.Popup>
                  <Menu.Item>1</Menu.Item>
                  <Menu.Item>2</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      ));

      await render(<TestComponent />);

      expect(screen.getByTestId('positioner')).toBeInTheDocument();
      expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    });

    it('should react to the anchor changing from a ref to undefined and back', async () => {
      const TestComponent = defineComponent(() => {
        const anchorRef = shallowRef<HTMLElement | null>(null);
        const setAnchorElement = (element: unknown) => {
          anchorRef.value = element as HTMLElement | null;
        };
        // A ref that holds a ref gives the inner ref, so the choice of the anchor is a flag.
        const anchorIsRef = shallowRef(true);

        return () => (
          <div style={{ margin: '50px' }}>
            <button
              type="button"
              onClick={() => {
                anchorIsRef.value = false;
              }}
            >
              undefined
            </button>
            <button
              type="button"
              onClick={() => {
                anchorIsRef.value = true;
              }}
            >
              ref
            </button>
            <Menu.Root open>
              <Menu.Trigger>trigger</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner
                  side="bottom"
                  align="start"
                  anchor={anchorIsRef.value ? anchorRef : undefined}
                  arrowPadding={0}
                  data-testid="positioner"
                >
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                    <Menu.Item>2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <div
              data-testid="anchor"
              style={{ marginTop: '100px', width: '10px', height: '10px' }}
              ref={setAnchorElement}
            />
          </div>
        );
      });

      const { user } = await render(<TestComponent />);

      const anchorElement = screen.getByTestId('anchor');

      const setUndefinedButton = screen.getByRole('button', { name: 'undefined' });
      const setRefButton = screen.getByRole('button', { name: 'ref' });
      const trigger = screen.getByRole('button', { name: 'trigger' });

      let anchorRect = anchorElement.getBoundingClientRect();
      await waitFor(() => {
        expect(getTransform()).toBe(`translate(${anchorRect.left}px, ${anchorRect.bottom}px)`);
      });

      await user.click(setUndefinedButton);

      const triggerRect = trigger.getBoundingClientRect();
      await waitFor(() => {
        expect(getTransform()).toBe(
          `translate(${Math.floor(triggerRect.left)}px, ${triggerRect.bottom}px)`,
        );
      });

      await user.click(setRefButton);

      anchorRect = anchorElement.getBoundingClientRect();
      await waitFor(() => {
        expect(getTransform()).toBe(`translate(${anchorRect.left}px, ${anchorRect.bottom}px)`);
      });
    });
  });

  describe('collision avoidance', () => {
    function SubmenuApp(props: {
      collisionAvoidance?: Menu.Positioner.Props['collisionAvoidance'];
    }) {
      return (
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot open>
                  <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="submenu-positioner" {...props}>
                      <Menu.Popup />
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    function lastCallFor(positioner: HTMLElement) {
      const calls = useAnchorPositioningSpy.mock.calls.filter(
        ([params]) => toValue(params.positionerElement) === positioner,
      );
      return calls[calls.length - 1]?.[0] as UseAnchorPositioningParameters | undefined;
    }

    it('uses the dropdown default for a context menu', async () => {
      await render(
        <ContextMenu.Root>
          <ContextMenu.Trigger>Area</ContextMenu.Trigger>
          <ContextMenu.Portal keepMounted>
            <ContextMenu.Positioner data-testid="positioner">
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const options = lastCallFor(screen.getByTestId('positioner'));
      expect(toValue(options?.collisionAvoidance)).toEqual(DROPDOWN_COLLISION_AVOIDANCE);
    });

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

    it('uses the popup default for a submenu', async () => {
      await render(<SubmenuApp />);

      const options = lastCallFor(screen.getByTestId('submenu-positioner'));
      expect(toValue(options?.collisionAvoidance)).toEqual(POPUP_COLLISION_AVOIDANCE);
    });

    it('uses the collisionAvoidance prop over the default', async () => {
      const collisionAvoidance = { side: 'none', align: 'none' } as const;
      await render(<SubmenuApp collisionAvoidance={collisionAvoidance} />);

      const options = lastCallFor(screen.getByTestId('submenu-positioner'));
      expect(toValue(options?.collisionAvoidance)).toBe(collisionAvoidance);
    });
  });

  it('closes an open submenu with a sibling reason when its controlled parent closes', async () => {
    const onSubmenuOpenChange = vi.fn();
    const open = shallowRef(true);

    const Test = defineComponent({
      setup() {
        return () => (
          <Menu.Root open={open.value}>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.SubmenuRoot defaultOpen onOpenChange={onSubmenuOpenChange}>
                    <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup data-testid="submenu-popup" />
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      },
    });

    await render(<Test />);
    expect(screen.queryByTestId('submenu-popup')).not.toBe(null);

    open.value = false;
    await flushMicrotasks();

    await waitFor(() => {
      expect(onSubmenuOpenChange.mock.lastCall?.[0]).toBe(false);
    });
    expect(onSubmenuOpenChange.mock.lastCall?.[1].reason).toBe('sibling-open');
  });

  describe('defaults of the parent', () => {
    function renderMenu(positioner = {}) {
      useAnchorPositioningSpy.mockClear();
      return render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner {...positioner}>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
    }

    it('uses the dropdown collision avoidance for a menu with no parent', async () => {
      await renderMenu();

      expect(readLastOptions().collisionAvoidance).toEqual(DROPDOWN_COLLISION_AVOIDANCE);
      expect(readLastOptions().collisionAvoidance).not.toEqual(POPUP_COLLISION_AVOIDANCE);
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
      });
      const anchor = toValue(
        toValue(
          (useAnchorPositioningSpy.mock.lastCall?.[0] as UseAnchorPositioningParameters).anchor,
        ),
      );
      expect(anchor).toBe(context.anchor.value);
    });
  });

  describe('layout viewport', () => {
    beforeEach(() => {
      useAnchorPositioningSpy.mockClear();
    });

    it('uses the layout viewport for a root context menu', async () => {
      await render(
        <ContextMenu.Root open>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup>Popup</ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      expect(readLastOptions().shift).toEqual({ crossAxis: true, rootBoundary: 'layoutViewport' });
    });

    it('disables cross-axis shifting when side collision avoidance is flip', async () => {
      await render(
        <ContextMenu.Root open>
          <ContextMenu.Portal>
            <ContextMenu.Positioner collisionAvoidance={{ side: 'flip' }}>
              <ContextMenu.Popup>Popup</ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      expect(readLastOptions().shift).toEqual({ crossAxis: false, rootBoundary: 'layoutViewport' });
    });

    it('preserves explicit context-menu placement and offsets', async () => {
      await render(
        <ContextMenu.Root open>
          <ContextMenu.Portal>
            <ContextMenu.Positioner side="right" align="center" sideOffset={11} alignOffset={13}>
              <ContextMenu.Popup>Popup</ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      expect(readLastOptions()).toMatchObject({
        side: 'right',
        align: 'center',
        sideOffset: 11,
        alignOffset: 13,
      });
    });

    it('uses the visual viewport for a context menu submenu', async () => {
      await render(
        <ContextMenu.Root open>
          <ContextMenu.SubmenuRoot defaultOpen>
            <ContextMenu.Portal>
              <ContextMenu.Positioner>
                <ContextMenu.Popup>Popup</ContextMenu.Popup>
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.SubmenuRoot>
        </ContextMenu.Root>,
      );

      expect(useAnchorPositioningSpy).toHaveBeenCalled();
      expect(readLastOptions().shift).toBe(undefined);
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
    const parentNodeIds: (string | null)[] = [];
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

  describe('scroll lock', () => {
    // The lock and the unlock each wait for a timer of 0 ms. The observers of `waitFor` do not see a
    // document in a frame, so it polls.
    const POLL = { interval: 5, timeout: 3000 };

    function lockCount() {
      return getScrollLockRegistry()?.lockCount ?? 0;
    }

    // The trigger and the portal are in the document of a frame, so the lock changes no style of
    // the test page.
    function createMenu(
      page: ScrollDocument,
      { root = {}, positioner = {} }: { root?: object; positioner?: object } = {},
    ) {
      const probe = createMenuStoreProbe();
      const handle = Menu.createHandle();
      const ModalMenu = defineComponent({
        name: 'ModalMenu',
        setup: () => () => (
          <Menu.Root handle={handle} {...root}>
            <probe.Probe />
            <Teleport to={page.body}>
              <Menu.Trigger id="trigger">Open</Menu.Trigger>
            </Teleport>
            <Menu.Portal container={page.body}>
              <Menu.Positioner {...positioner}>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ),
      });
      return { probe, handle, ModalMenu };
    }

    it('locks the page while a modal menu is open, and unlocks it when the menu closes', async () => {
      const page = await createScrollDocument();
      const { handle, ModalMenu } = createMenu(page);
      await render(<ModalMenu />);

      handle.open('trigger');
      await waitFor(() => expect(isPageLocked(page)).toBe(true), POLL);

      handle.close();
      await waitFor(() => expect(isPageLocked(page)).toBe(false), POLL);
      expect(lockCount()).toBe(0);
    });

    it.each([
      { name: 'modal false', root: { modal: false }, reason: REASONS.triggerPress },
      { name: 'a hover open', root: {}, reason: REASONS.triggerHover },
    ])('does not lock the page for $name', async ({ root, reason }) => {
      const page = await createScrollDocument();
      const { probe, ModalMenu } = createMenu(page, { root });
      await render(<ModalMenu />);

      const trigger = page.doc.getElementById('trigger')!;
      probe.store.setOpen(
        true,
        createChangeEventDetails(reason, new MouseEvent('mousedown'), trigger),
      );
      await flushMicrotasks();

      expect(probe.store.select('open')).toBe(true);
      expect(lockCount()).toBe(0);
    });

    it.each([
      { name: 'as wide as the viewport', width: 'calc(100vw - 10px)', locks: 1 },
      { name: 'narrower than the viewport', width: '240px', locks: 0 },
    ])('locks the page for a touch open only when the popup is $name', async ({ width, locks }) => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const { probe, handle, ModalMenu } = createMenu(page, { positioner: { style: { width } } });
      await render(<ModalMenu />);
      probe.store.set('openMethod', 'touch');

      handle.open('trigger');
      await flushMicrotasks();

      expect(probe.store.select('positionerElement')).not.toBe(null);
      expect(lockCount()).toBe(locks);
    });

    // A trigger in a menubar is an item of the composite of the menubar. The menu thus opens from
    // its store, with an element of the frame as the trigger.
    it.each([
      { name: 'a modal menubar', modal: true, locks: 1 },
      { name: 'a menubar that is not modal', modal: false, locks: 0 },
    ])('follows the modal state of $name', async ({ modal, locks }) => {
      const page = await createScrollDocument();
      const probe = createMenuStoreProbe();
      await render(
        <MenubarProvider context={createMenubarContext({ modal: computed(() => modal) })}>
          <Menu.Root>
            <probe.Probe />
            <Menu.Portal container={page.body}>
              <Menu.Positioner>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </MenubarProvider>,
      );

      probe.store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerPress, undefined, page.reference),
      );
      await flushMicrotasks();

      expect(probe.store.select('modal')).toBe(false);
      expect(lockCount()).toBe(locks);
    });

    it('VUE-5: releases the lock while KeepAlive holds the menu, and takes it back after', async () => {
      const page = await createScrollDocument();
      const show = shallowRef(true);
      const { ModalMenu } = createMenu(page, {
        root: { defaultOpen: true, defaultTriggerId: 'trigger' },
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      await render(() => (
        <KeepAlive>{show.value ? <ModalMenu key="menu" /> : <Other key="other" />}</KeepAlive>
      ));
      await waitFor(() => expect(isPageLocked(page)).toBe(true), POLL);

      show.value = false;
      await waitFor(() => expect(isPageLocked(page)).toBe(false), POLL);

      show.value = true;
      await waitFor(() => expect(isPageLocked(page)).toBe(true), POLL);
    });
  });

  describe('VUE-61: the positioner of a modal menu has one root node', () => {
    it('gives the scope id, v-show and a custom directive of the consumer to the positioner', async () => {
      const shown = shallowRef(true);
      await render(() => <MenuPositionerScoped shown={shown.value} />);
      const positioner = screen.getByTestId('positioner');

      expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      expect(getComputedStyle(positioner).outlineStyle).toBe('dashed');
      expect(positioner).toHaveAttribute('data-mark', 'marked');
      expect(positioner.style.display).not.toBe('none');

      shown.value = false;
      await nextTick();

      expect(positioner.style.display).toBe('none');
    });
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

      await waitFor(() => {
        expect(side).toBe('bottom');
      });
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

      await waitFor(() => {
        expect(side).toBe('inline-end');
      });
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
