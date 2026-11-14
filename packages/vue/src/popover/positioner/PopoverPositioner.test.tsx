import { describe, expect, it, onTestFinished } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { CSSProperties, FunctionalComponent, PropType, VNodeChild } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import * as Tooltip from '../../tooltip/index.parts';
import { useFloatingParentNodeId, useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import type { FloatingTreeType } from '../../utils/popups/types';
import * as Popover from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  positionerConformanceTests,
  screen,
  takeReportedMessages,
  waitFor,
  waitForPositioned,
  waitSingleFrame,
} from '#test-utils';

const Trigger: FunctionalComponent<Popover.Trigger.Props> = (props, { slots }) => (
  <Popover.Trigger {...props} as="div" nativeButton={false}>
    {slots.default?.()}
  </Popover.Trigger>
);

describe('<Popover.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>{node}</Popover.Portal>
        </Popover.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  const popupWidth = 52;
  const popupHeight = 24;
  const anchorWidth = 72;
  const anchorHeight = 36;
  const triggerStyle: CSSProperties = { width: `${anchorWidth}px`, height: `${anchorHeight}px` };
  const popupStyle: CSSProperties = { width: `${popupWidth}px`, height: `${popupHeight}px` };

  positionerConformanceTests({
    render,
    defaultCollisionAvoidance: 'popup',
    createComponent: ({
      root,
      trigger,
      positioner: { render: renderPositioner, ...positioner },
      popup,
    }) => (
      <Popover.Root {...root}>
        <Trigger {...trigger}>Trigger</Trigger>
        <Popover.Portal>
          <Popover.Positioner
            {...positioner}
            v-slots={renderPositioner ? { render: renderPositioner } : undefined}
          >
            <Popover.Popup {...popup}>Popup</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
  });

  it.skipIf(isJSDOM)('remains anchored if keepMounted=false', async () => {
    const top = shallowRef(0);
    await render(() => (
      <Popover.Root open>
        <Trigger
          style={{ width: '100px', height: '100px', position: 'relative', top: `${top.value}px` }}
        >
          Trigger
        </Trigger>
        <Popover.Portal>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup style={{ width: '100px', height: '100px' }}>Popup</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const positioner = await screen.findByTestId('positioner');

    const initial = { x: 5, y: 100 };
    const final = { x: 5, y: 200 };

    await waitFor(() => {
      expect(positioner.getBoundingClientRect()).toMatchObject(initial);
    });

    top.value = 100;

    await waitFor(() => {
      expect(positioner.getBoundingClientRect()).toMatchObject(final);
    });
  });

  it.skipIf(isJSDOM)('remains anchored if keepMounted=true', async () => {
    const top = shallowRef(0);
    await render(() => (
      <Popover.Root open>
        <Trigger
          style={{ width: '100px', height: '100px', position: 'relative', top: `${top.value}px` }}
        >
          Trigger
        </Trigger>
        <Popover.Portal keepMounted>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup style={{ width: '100px', height: '100px' }}>Popup</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const positioner = await screen.findByTestId('positioner');

    const initial = { x: 5, y: 100 };
    const final = { x: 5, y: 200 };

    await waitFor(() => {
      expect(positioner.getBoundingClientRect()).toMatchObject(initial);
    });

    top.value = 100;

    await waitFor(() => {
      expect(positioner.getBoundingClientRect()).toMatchObject(final);
    });
  });

  it.skipIf(isJSDOM)('does not follow the anchor when its ancestor scrolls', async () => {
    await render(
      <div data-testid="scroller" style={{ height: '72px', overflow: 'auto' }}>
        <div style={{ height: '200px' }}>
          <Popover.Root open>
            <Trigger data-testid="trigger" style={triggerStyle}>
              Trigger
            </Trigger>
            <Popover.Portal>
              <Popover.Positioner data-testid="positioner" disableAnchorTracking>
                <Popover.Popup style={popupStyle}>Popup</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>,
    );

    const scroller = screen.getByTestId('scroller');
    const trigger = screen.getByTestId('trigger');
    const positioner = await screen.findByTestId('positioner');
    await waitForPositioned(positioner);
    const initialTriggerY = trigger.getBoundingClientRect().y;
    const initialPositionerY = positioner.getBoundingClientRect().y;

    scroller.scrollTop = 20;
    await waitSingleFrame();
    await waitSingleFrame();
    await flushMicrotasks();

    expect(trigger.getBoundingClientRect().y).toBe(initialTriggerY - 20);
    expect(positioner.getBoundingClientRect().y).toBe(initialPositionerY);
  });

  it.skipIf(isJSDOM)('observes a custom anchor for keepMounted auto-updates', async () => {
    const originalResizeObserver = window.ResizeObserver;
    const observedElements: Element[] = [];

    class TestResizeObserver {
      observe(element: Element) {
        observedElements.push(element);
      }

      unobserve() {}

      disconnect() {}
    }

    window.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
    onTestFinished(() => {
      window.ResizeObserver = originalResizeObserver;
    });

    const anchor = shallowRef<HTMLElement | null>(null);
    await render(() => (
      <Popover.Root open>
        <Trigger data-testid="trigger" style={{ width: '100px', height: '100px' }}>
          Trigger
        </Trigger>
        <div
          ref={(element) => {
            anchor.value = element as HTMLElement | null;
          }}
          data-testid="custom-anchor"
          style={{ width: '50px', height: '50px', position: 'relative' }}
        >
          Anchor
        </div>
        <Popover.Portal keepMounted>
          <Popover.Positioner data-testid="positioner" anchor={anchor.value}>
            <Popover.Popup style={{ width: '100px', height: '100px' }}>Popup</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const customAnchor = screen.getByTestId('custom-anchor');

    await waitFor(() => {
      expect(observedElements).toContain(customAnchor);
    });
  });

  it.skipIf(isJSDOM)(
    'remains anchored to the trigger when closing from a tooltip trigger close',
    async () => {
      const testPopover = Popover.createHandle();
      const open = shallowRef(true);

      const App = defineComponent(() => () => (
        <>
          <Popover.Trigger
            handle={testPopover}
            id="trigger-1"
            style={{ width: '100px', height: '100px' }}
          >
            Trigger
          </Popover.Trigger>
          <Popover.Root
            handle={testPopover}
            open={open.value}
            triggerId="trigger-1"
            onOpenChange={(nextOpen, eventDetails) => {
              if (!nextOpen) {
                eventDetails.preventUnmountOnClose();
              }
              open.value = nextOpen;
            }}
          >
            <Popover.Portal>
              <Popover.Positioner data-testid="positioner">
                <Popover.Popup data-testid="popup" style={{ width: '160px', height: '120px' }}>
                  <Popover.Close
                    v-slots={{
                      render: ({ props }: { props: Record<string, unknown> }) => (
                        <Tooltip.Root>
                          <Tooltip.Trigger {...props}>Close</Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Positioner>
                              <Tooltip.Popup>Tooltip</Tooltip.Popup>
                            </Tooltip.Positioner>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      ),
                    }}
                  />
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>
      ));

      const { user } = await render(<App />);
      const positioner = await screen.findByTestId('positioner');
      await waitForPositioned(positioner);
      const initialRect = positioner.getBoundingClientRect();

      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitSingleFrame();
      await waitSingleFrame();
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });

      const closingRect = positioner.getBoundingClientRect();
      expect(Math.abs(closingRect.x - initialRect.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(closingRect.y - initialRect.y)).toBeLessThanOrEqual(1);
    },
  );

  describe.skipIf(isJSDOM)('transform origin', () => {
    function getTransformOrigin() {
      return screen.getByTestId('positioner').style.getPropertyValue('--transform-origin');
    }

    // Each case renders one open popover. The props of the positioner and the styles of the
    // trigger and the popup are the differences between the cases.
    async function renderPopover(options: {
      trigger?: CSSProperties;
      positioner?: Popover.Positioner.Props & { dir?: string };
      popup?: CSSProperties;
      popupContent?: () => VNodeChild;
      rtl?: boolean;
    }) {
      const popover = (
        <Popover.Root open>
          <Trigger style={options.trigger ?? { ...triggerStyle, margin: '50px' }}>Trigger</Trigger>
          <Popover.Portal>
            <Popover.Positioner data-testid="positioner" {...options.positioner}>
              <Popover.Popup style={options.popup ?? popupStyle}>
                {options.popupContent?.()}
                Popup
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      );
      await render(
        options.rtl ? (
          <div dir="rtl">
            <DirectionProvider direction="rtl">{popover}</DirectionProvider>
          </div>
        ) : (
          popover
        ),
      );
      await waitForPositioned(await screen.findByTestId('positioner'));
    }

    async function expectTransformOrigin(expected: string) {
      await waitFor(() => {
        expect(getTransformOrigin()).toBe(expected);
      });
    }

    it('points to the anchor center for center alignment', async () => {
      await renderPopover({});

      await expectTransformOrigin(`${popupWidth / 2}px 0px`);
    });

    it('points to the popup start edge for start alignment', async () => {
      await renderPopover({ positioner: { align: 'start' } });

      await expectTransformOrigin('0% 0px');
    });

    it('points to the popup logical start edge for start alignment in RTL', async () => {
      await renderPopover({ positioner: { align: 'start', dir: 'rtl' }, rtl: true });

      await expectTransformOrigin('100% 0px');
    });

    it('uses the floating element direction for RTL alignment', async () => {
      await renderPopover({ positioner: { align: 'start', dir: 'rtl' } });

      await expectTransformOrigin('100% 0px');
    });

    it('points to the popup end edge for end alignment', async () => {
      await renderPopover({ positioner: { align: 'end' } });

      await expectTransformOrigin('100% 0px');
    });

    it('points to the popup logical end edge for end alignment in RTL', async () => {
      await renderPopover({ positioner: { align: 'end', dir: 'rtl' }, rtl: true });

      await expectTransformOrigin('0% 0px');
    });

    it('places the side coordinate first for horizontal sides', async () => {
      await renderPopover({ positioner: { side: 'right', align: 'start' } });

      await expectTransformOrigin('0px 0%');
    });

    it('points to the popup end edge for horizontal end alignment', async () => {
      await renderPopover({
        trigger: { ...triggerStyle, position: 'fixed', left: '200px', top: '50px' },
        positioner: { side: 'left', align: 'end', sideOffset: 7 },
      });

      await expectTransformOrigin('calc(100% + 7px) 100%');
    });

    it('accounts for sideOffset', async () => {
      await renderPopover({ positioner: { align: 'start', sideOffset: 7 } });

      await expectTransformOrigin('0% -7px');
    });

    it('accounts for sideOffset on top side', async () => {
      await renderPopover({
        trigger: { ...triggerStyle, position: 'fixed', left: '50px', top: '200px' },
        positioner: { align: 'start', side: 'top', sideOffset: 7 },
      });

      await expectTransformOrigin('0% calc(100% + 7px)');
    });

    it('keeps the popup start edge as the origin with alignOffset', async () => {
      const alignOffset = 7;
      await renderPopover({ positioner: { align: 'start', alignOffset } });

      await expectTransformOrigin('0% 0px');
      const trigger = screen.getByText('Trigger');
      const positioner = screen.getByTestId('positioner');
      const anchorRect = trigger.getBoundingClientRect();
      const positionerRect = positioner.getBoundingClientRect();

      expect(positionerRect.left - anchorRect.left).toBe(alignOffset);
    });

    it('does not let the virtual arrow displace the popup on a narrow anchor', async () => {
      await renderPopover({
        trigger: { width: '2px', height: '20px', position: 'fixed', left: '50px', top: '50px' },
        positioner: { align: 'start', arrowPadding: 20 },
      });

      await expectTransformOrigin('0% 0px');
      const trigger = screen.getByText('Trigger');
      const positioner = screen.getByTestId('positioner');

      // The arrow padding must not move a popup that has no arrow to keep off its corners.
      expect(positioner.getBoundingClientRect().left).toBe(trigger.getBoundingClientRect().left);
    });

    it('points to the flipped edge when the alignment flips', async () => {
      await renderPopover({
        trigger: { ...triggerStyle, position: 'fixed', top: '50px', right: '4px' },
        positioner: { align: 'start', collisionAvoidance: { align: 'flip' } },
        popup: { ...popupStyle, width: '240px' },
      });

      await expectTransformOrigin('100% 0px');
      expect(screen.getByTestId('positioner').getAttribute('data-align')).toBe('end');
    });

    it('keeps the popup start edge as the origin for a 1px cross-axis shift', async () => {
      await renderPopover({
        trigger: {
          ...triggerStyle,
          position: 'fixed',
          left: `calc(100vw - ${popupWidth - 1}px)`,
          top: '50px',
        },
        positioner: { align: 'start', collisionAvoidance: { align: 'shift' }, collisionPadding: 0 },
      });

      await expectTransformOrigin('0% 0px');
      const trigger = screen.getByText('Trigger');
      const positioner = screen.getByTestId('positioner');
      const anchorRect = trigger.getBoundingClientRect();
      const positionerRect = positioner.getBoundingClientRect();

      expect(Math.round(positionerRect.left - anchorRect.left)).toBe(-1);
    });

    it('points to the anchor center when start alignment is shifted on the cross axis', async () => {
      const shiftedPopupWidth = 240;
      await renderPopover({
        trigger: { ...triggerStyle, position: 'fixed', top: '50px', right: '10px' },
        positioner: { align: 'start', collisionAvoidance: { align: 'shift' } },
        popup: { ...popupStyle, width: `${shiftedPopupWidth}px` },
      });

      const trigger = screen.getByText('Trigger');
      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expect(positioner.getBoundingClientRect().left).toBeLessThan(
          trigger.getBoundingClientRect().left,
        );
      });
      const anchorRect = trigger.getBoundingClientRect();
      const positionerRect = positioner.getBoundingClientRect();

      await expectTransformOrigin(`${anchorRect.x + anchorWidth / 2 - positionerRect.x}px 0px`);
    });

    it('points to the anchor center when end alignment is shifted on the cross axis', async () => {
      const shiftedPopupWidth = 240;
      await renderPopover({
        trigger: { ...triggerStyle, position: 'fixed', left: '10px', top: '50px' },
        positioner: { align: 'end', collisionAvoidance: { align: 'shift' } },
        popup: { ...popupStyle, width: `${shiftedPopupWidth}px` },
      });

      const trigger = screen.getByText('Trigger');
      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expect(positioner.getBoundingClientRect().right).toBeGreaterThan(
          trigger.getBoundingClientRect().right,
        );
      });
      const anchorRect = trigger.getBoundingClientRect();
      const positionerRect = positioner.getBoundingClientRect();

      await expectTransformOrigin(`${anchorRect.x + anchorWidth / 2 - positionerRect.x}px 0px`);
    });

    it('points to the anchor center when horizontal alignment is shifted on the cross axis', async () => {
      const shiftedPopupHeight = 120;
      await renderPopover({
        trigger: { ...triggerStyle, position: 'fixed', left: '50px', bottom: '10px' },
        positioner: { side: 'right', align: 'start', collisionAvoidance: { align: 'shift' } },
        popup: { ...popupStyle, height: `${shiftedPopupHeight}px` },
      });

      const trigger = screen.getByText('Trigger');
      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expect(positioner.getBoundingClientRect().top).toBeLessThan(
          trigger.getBoundingClientRect().top,
        );
      });
      const anchorRect = trigger.getBoundingClientRect();
      const positionerRect = positioner.getBoundingClientRect();

      await expectTransformOrigin(`0px ${anchorRect.y + anchorHeight / 2 - positionerRect.y}px`);
    });

    it('points to the arrow when present regardless of alignment', async () => {
      const arrowSize = 10;
      await renderPopover({
        positioner: { align: 'start' },
        popupContent: () => (
          <Popover.Arrow style={{ width: `${arrowSize}px`, height: `${arrowSize}px` }} />
        ),
      });

      // With start alignment the anchor's center sits half an anchor width into the popup.
      await expectTransformOrigin(`${anchorWidth / 2}px 0px`);
    });

    it('points to the anchor center when the popup is shifted to overlap the anchor', async () => {
      await renderPopover({
        trigger: { ...triggerStyle, position: 'fixed', left: '50px', bottom: '10px' },
        positioner: { collisionAvoidance: { side: 'shift' } },
      });

      const trigger = screen.getByText('Trigger');
      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expect(positioner.getBoundingClientRect().top).toBeLessThan(
          trigger.getBoundingClientRect().bottom,
        );
      });
      const anchorRect = trigger.getBoundingClientRect();
      const positionerRect = positioner.getBoundingClientRect();

      await expectTransformOrigin(
        `${popupWidth / 2}px ${anchorRect.y + anchorHeight / 2 - positionerRect.y}px`,
      );
    });
  });

  it('makes the node of a popover in its popup a child of its own node', async () => {
    const nodeIds: Record<string, string | null> = {};
    let tree: FloatingTreeType | null = null;
    // A part that gives the test the id of the node that the positioner above it provides.
    const NodeProbe = defineComponent({
      props: { name: { type: String as PropType<string>, required: true } },
      setup(props) {
        nodeIds[props.name] = useFloatingParentNodeId().value;
        tree = useFloatingTree().value;
        return () => null;
      },
    });

    await render(
      <Popover.Root open>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <NodeProbe name="parent" />
              <Popover.Root open>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup>
                      <NodeProbe name="child" />
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    // Each portal renders its popup in the flush after its mount.
    await waitFor(() => {
      expect(nodeIds.child).toEqual(expect.any(String));
    });

    expect(nodeIds.parent).toEqual(expect.any(String));
    const childNode = tree!.nodesRef.value.find((node) => node.id === nodeIds.child);
    expect(childNode?.parentId).toBe(nodeIds.parent);
  });

  // In Vue 3.5.12, a `setup` that throws leaves the current instance set, and each later case of
  // the file then gets a warning about a slot. The case thus comes last.
  it('throws a descriptive error when rendered outside <Popover.Portal>', async () => {
    await expect(
      render(
        <Popover.Root open>
          <Popover.Positioner />
        </Popover.Root>,
      ),
    ).rejects.toThrow('Vase UI: <Popover.Positioner> must be inside <Popover.Portal>.');
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
