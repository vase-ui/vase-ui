import { afterEach, beforeEach, expect, vi, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { CSSProperties, FunctionalComponent } from 'vue';
import * as PreviewCard from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  nextEvent,
  positionerConformanceTests,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';

const Trigger: FunctionalComponent<PreviewCard.Trigger.Props> = (props, { slots }) => (
  <PreviewCard.Trigger {...props} as="div">
    {slots.default?.()}
  </PreviewCard.Trigger>
);

type RectLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const multilineWrapperStyle = { width: '140px' };
// These tests dispatch pointer coordinates directly. Exclude the real browser cursor so it cannot
// generate a competing hover event over a different inline line.
const multilineTriggerStyle: CSSProperties = {
  display: 'inline',
  lineHeight: '20px',
  pointerEvents: 'none',
};

function expectWithin(actual: number, expected: number, tolerance = 2) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

async function hoverAt(element: Element, clientX: number, clientY: number) {
  await fireEvent.mouseEnter(element, { clientX, clientY });
  await fireEvent.mouseMove(element, { clientX, clientY });
}

// These overrides are safe because each test renders fresh trigger elements before mocking them.
function mockClientRects(element: Element, rects: RectLike[]) {
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const boundingRect = DOMRect.fromRect({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });

  Object.defineProperty(element, 'getClientRects', {
    configurable: true,
    value: () =>
      rects.map((rect) =>
        DOMRect.fromRect({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        }),
      ),
  });

  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => boundingRect,
  });
}

describe('<PreviewCard.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<PreviewCard.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <PreviewCard.Root open>
          <PreviewCard.Portal>{node}</PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  positionerConformanceTests({
    render,
    defaultCollisionAvoidance: 'popup',
    createComponent: ({
      root,
      trigger,
      positioner: { render: renderPositioner, ...positioner },
      popup,
    }) => (
      <PreviewCard.Root {...root}>
        <Trigger {...trigger}>Trigger</Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner
            {...positioner}
            v-slots={renderPositioner ? { render: renderPositioner } : undefined}
          >
            <PreviewCard.Popup {...popup}>Popup</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
  });

  describe.skipIf(isJSDOM)('multiline inline trigger', () => {
    afterEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
      window.scrollTo(0, 0);
      document.documentElement.style.height = '';
      document.body.style.height = '';
      document.body.style.margin = '';
    });

    it('positions the popup relative to the hovered line of a multiline trigger', async () => {
      await render(
        <div style={multilineWrapperStyle}>
          <PreviewCard.Root>
            <PreviewCard.Trigger delay={0} data-testid="trigger" style={multilineTriggerStyle}>
              This is a long text that will wrap across multiple lines in the trigger element
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                  Preview Content
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      expect(triggerRects.length).toBeGreaterThan(2);

      // Enter over the second line so opening on hover uses the correct inline rect.
      const secondLineRect = triggerRects[1];
      const secondLineCenterX = secondLineRect.left + secondLineRect.width / 2;
      const secondLineCenterY = secondLineRect.top + secondLineRect.height / 2;

      await hoverAt(trigger, secondLineCenterX, secondLineCenterY);

      const positioner = await screen.findByTestId('positioner');
      await waitFor(() => {
        expect(positioner).toBeVisible();
      });

      // The positioner should be positioned relative to the second line,
      // not the first line or the bounding client rect.
      // y-coordinate should be close to the second line's bottom + sideOffset
      const expectedY = secondLineRect.bottom + 5;

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, expectedY);
      });

      // x-coordinate should also be relative to where we hovered on the second line
      const { x: positionerX } = positioner.getBoundingClientRect();
      expect(positionerX).toBeGreaterThanOrEqual(secondLineRect.left - 10);
      expect(positionerX).toBeLessThanOrEqual(secondLineRect.right + 10);
    });

    describe('with delayed opening', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('uses the latest hovered line', async () => {
        await render(
          <div style={multilineWrapperStyle}>
            <PreviewCard.Root>
              <PreviewCard.Trigger delay={100} data-testid="trigger" style={multilineTriggerStyle}>
                This is a long text that will wrap across multiple lines in the trigger element
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                  <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');
        const triggerRects = trigger.getClientRects();

        expect(triggerRects.length).toBeGreaterThan(2);

        const firstLineRect = triggerRects[0];
        const secondLineRect = triggerRects[1];

        await fireEvent.mouseEnter(trigger, {
          clientX: firstLineRect.left + firstLineRect.width / 2,
          clientY: firstLineRect.top + firstLineRect.height / 2,
        });
        await fireEvent.mouseMove(trigger, {
          clientX: firstLineRect.left + firstLineRect.width / 2,
          clientY: firstLineRect.top + firstLineRect.height / 2,
        });
        await fireEvent.mouseMove(trigger, {
          clientX: secondLineRect.left + secondLineRect.width / 2,
          clientY: secondLineRect.top + secondLineRect.height / 2,
        });

        expect(screen.queryByTestId('positioner')).toBe(null);

        await vi.advanceTimersByTimeAsync(100);
        await flushMicrotasks();
        await vi.advanceTimersByTimeAsync(16);
        await flushMicrotasks();

        const positioner = screen.getByTestId('positioner');
        expectWithin(positioner.getBoundingClientRect().y, secondLineRect.bottom + 5);
      });
    });

    it('keeps the popup aligned after page scroll', async () => {
      document.documentElement.style.height = '4000px';
      document.body.style.height = '4000px';
      document.body.style.margin = '0';

      await render(
        <div>
          <div style={{ height: '1200px' }} />
          <div style={multilineWrapperStyle}>
            <PreviewCard.Root>
              <PreviewCard.Trigger delay={0} data-testid="trigger" style={multilineTriggerStyle}>
                This is a long text that will wrap across multiple lines in the trigger element
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                  <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
          <div style={{ height: '1200px' }} />
        </div>,
      );

      window.scrollTo(0, 1000);

      await waitFor(() => {
        expect(window.scrollY).toBe(1000);
      });

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      expect(triggerRects.length).toBeGreaterThan(1);

      const secondLineRect = triggerRects[1];
      const secondLineCenterX = secondLineRect.left + secondLineRect.width / 2;
      const secondLineCenterY = secondLineRect.top + secondLineRect.height / 2;

      await hoverAt(trigger, secondLineCenterX, secondLineCenterY);

      const positioner = await screen.findByTestId('positioner');
      await waitFor(() => {
        expect(positioner).toBeVisible();
      });

      const expectedY = secondLineRect.bottom + 5;

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, expectedY);
      });

      const { x: positionerX } = positioner.getBoundingClientRect();
      expect(positionerX).toBeGreaterThanOrEqual(secondLineRect.left - 10);
      expect(positionerX).toBeLessThanOrEqual(secondLineRect.right + 10);
    });

    it('stays anchored to the opened line while already open', async () => {
      let positionUpdateCount = 0;
      await render(
        <div style={multilineWrapperStyle}>
          <PreviewCard.Root>
            <PreviewCard.Trigger delay={0} data-testid="trigger" style={multilineTriggerStyle}>
              This is a long text that will wrap across multiple lines in the trigger element
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner
                data-testid="positioner"
                side="bottom"
                sideOffset={() => {
                  positionUpdateCount += 1;
                  return 5;
                }}
              >
                <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                  Preview Content
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      expect(triggerRects.length).toBeGreaterThan(2);

      const firstLineRect = triggerRects[0];
      const secondLineRect = triggerRects[1];

      await hoverAt(
        trigger,
        firstLineRect.left + firstLineRect.width / 2,
        firstLineRect.top + firstLineRect.height / 2,
      );

      const positioner = await screen.findByTestId('positioner');
      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, firstLineRect.bottom + 5);
      });
      const positionUpdateCountBeforeReentry = positionUpdateCount;

      await fireEvent.mouseLeave(trigger);
      await hoverAt(
        trigger,
        secondLineRect.left + secondLineRect.width / 2,
        secondLineRect.top + secondLineRect.height / 2,
      );

      window.dispatchEvent(new Event('resize'));
      await waitFor(() => {
        expect(positionUpdateCount).toBeGreaterThan(positionUpdateCountBeforeReentry);
      });

      expectWithin(positioner.getBoundingClientRect().y, firstLineRect.bottom + 5);
    });

    it('keeps the hovered line of an open card when the pointer moves to another line', async () => {
      const sideOffset = shallowRef(5);
      await render(() => (
        <div style={multilineWrapperStyle}>
          <PreviewCard.Root>
            <PreviewCard.Trigger delay={0} data-testid="trigger" style={multilineTriggerStyle}>
              This is a long text that will wrap across multiple lines in the trigger element
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner
                data-testid="positioner"
                side="bottom"
                sideOffset={sideOffset.value}
              >
                <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                  Preview Content
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');
      const [firstLineRect, secondLineRect] = trigger.getClientRects();

      await hoverAt(
        trigger,
        firstLineRect.left + firstLineRect.width / 2,
        firstLineRect.top + firstLineRect.height / 2,
      );
      const positioner = await screen.findByTestId('positioner');
      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, firstLineRect.bottom + 5);
      });

      await fireEvent.mouseMove(trigger, {
        clientX: secondLineRect.left + secondLineRect.width / 2,
        clientY: secondLineRect.top + secondLineRect.height / 2,
      });
      // A new offset starts a position pass, and the place after it shows the line that the pass
      // used.
      sideOffset.value = 15;

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, firstLineRect.bottom + 15);
      });
    });

    it('re-anchors to a newly entered line while reopening during close transition', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const style = `
        @keyframes preview-card-inline-reentry-close-transition {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-inline-reentry-close-transition 1000ms linear forwards;
        }
      `;

      await render(
        <>
          <style>{style}</style>
          <div style={multilineWrapperStyle}>
            <PreviewCard.Root>
              <PreviewCard.Trigger
                delay={0}
                closeDelay={0}
                data-testid="trigger"
                style={multilineTriggerStyle}
              >
                This is a long text that will wrap across multiple lines in the trigger element
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                  <PreviewCard.Popup data-testid="popup" style={{ width: '80px', height: '40px' }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
        </>,
      );

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      expect(triggerRects.length).toBeGreaterThan(2);

      const firstLineRect = triggerRects[0];
      const secondLineRect = triggerRects[1];

      await hoverAt(
        trigger,
        firstLineRect.left + firstLineRect.width / 2,
        firstLineRect.top + firstLineRect.height / 2,
      );

      const positioner = await screen.findByTestId('positioner');
      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, firstLineRect.bottom + 5);
      });

      // The exit lasts only while its animation runs, so the listener records it.
      const popup = screen.getByTestId('popup');
      const exitStart = await nextEvent(popup, 'animationstart', {
        action: () => fireEvent.mouseLeave(trigger),
      });
      const isEndingAtExitStart = (exitStart.target as HTMLElement).hasAttribute(
        'data-ending-style',
      );

      await fireEvent.mouseMove(trigger, {
        clientX: secondLineRect.left + secondLineRect.width / 2,
        clientY: secondLineRect.top + secondLineRect.height / 2,
      });
      await fireEvent.mouseEnter(trigger, {
        clientX: secondLineRect.left + secondLineRect.width / 2,
        clientY: secondLineRect.top + secondLineRect.height / 2,
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, secondLineRect.bottom + 5);
      });
      expect(isEndingAtExitStart).toBe(true);
    });

    it('positions the popup relative to the side-aligned rect when open is controlled', async () => {
      const sideOffset = 5;
      const inlinePopupHeight = 40;

      await render(
        <div style={multilineWrapperStyle}>
          <PreviewCard.Root open>
            <PreviewCard.Trigger delay={0} data-testid="trigger" style={multilineTriggerStyle}>
              This is a long text that will wrap across multiple lines in the trigger element
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner
                data-testid="positioner"
                side="bottom"
                sideOffset={sideOffset}
              >
                <PreviewCard.Popup style={{ width: '80px', height: `${inlinePopupHeight}px` }}>
                  Preview Content
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      expect(triggerRects.length).toBeGreaterThan(1);

      const targetRect = triggerRects[triggerRects.length - 1];
      const expectedY = targetRect.bottom + sideOffset;
      const positioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        expect(positioner).toBeVisible();
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, expectedY);
      });

      const { x: positionerX } = positioner.getBoundingClientRect();
      expect(positionerX).toBeGreaterThanOrEqual(targetRect.left - 10);
      expect(positionerX).toBeLessThanOrEqual(targetRect.right + 10);
    });

    it('clears hovered-line coords after close before controlled reopen of the same trigger', async () => {
      const sideOffset = 5;

      const Test = defineComponent({
        setup() {
          const open = shallowRef(false);
          const triggerId = shallowRef<string | null>(null);

          return () => (
            <div style={multilineWrapperStyle}>
              <PreviewCard.Root
                open={open.value}
                triggerId={triggerId.value}
                onOpenChange={(
                  nextOpen: boolean,
                  eventDetails: PreviewCard.Root.ChangeEventDetails,
                ) => {
                  open.value = nextOpen;
                  triggerId.value = eventDetails.trigger?.id ?? null;
                }}
              >
                <PreviewCard.Trigger
                  delay={0}
                  data-testid="trigger"
                  id="trigger"
                  style={multilineTriggerStyle}
                >
                  This is a long text that will wrap across multiple lines in the trigger element
                </PreviewCard.Trigger>
                <PreviewCard.Portal keepMounted>
                  <PreviewCard.Positioner
                    data-testid="positioner"
                    side="bottom"
                    sideOffset={sideOffset}
                  >
                    <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                      Preview Content
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </PreviewCard.Root>

              <button
                type="button"
                onClick={() => {
                  triggerId.value = 'trigger';
                  open.value = true;
                }}
              >
                Open
              </button>
              <button type="button" onClick={() => (open.value = false)}>
                Close
              </button>
            </div>
          );
        },
      });

      await render(<Test />);
      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      expect(triggerRects.length).toBeGreaterThan(2);

      const secondLineRect = triggerRects[1];
      await hoverAt(
        trigger,
        secondLineRect.left + secondLineRect.width / 2,
        secondLineRect.top + secondLineRect.height / 2,
      );

      const positioner = await screen.findByTestId('positioner');
      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, secondLineRect.bottom + sideOffset);
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(positioner).toHaveAttribute('hidden');
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Open' }));

      const targetRect = triggerRects[triggerRects.length - 1];
      await waitFor(() => {
        expect(positioner).toBeVisible();
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, targetRect.bottom + sideOffset);
      });
    });

    it('ignores stale hovered coords when a controlled trigger switch reuses the popup', async () => {
      const Test = defineComponent({
        setup() {
          const open = shallowRef(false);
          const triggerId = shallowRef<string | null>(null);

          return () => (
            <div>
              <PreviewCard.Root
                open={open.value}
                triggerId={triggerId.value}
                onOpenChange={(
                  nextOpen: boolean,
                  eventDetails: PreviewCard.Root.ChangeEventDetails,
                ) => {
                  open.value = nextOpen;
                  triggerId.value = eventDetails.trigger?.id ?? null;
                }}
              >
                <PreviewCard.Trigger
                  href="#"
                  id="trigger-1"
                  data-testid="trigger-1"
                  delay={0}
                  style={{ display: 'inline', pointerEvents: 'none' }}
                >
                  Trigger 1
                </PreviewCard.Trigger>
                <PreviewCard.Trigger
                  href="#"
                  id="trigger-2"
                  data-testid="trigger-2"
                  delay={0}
                  style={{ display: 'inline', pointerEvents: 'none' }}
                >
                  Trigger 2
                </PreviewCard.Trigger>
                <PreviewCard.Portal>
                  <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                    <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                      Preview Content
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </PreviewCard.Root>

              <button
                type="button"
                onClick={() => {
                  open.value = true;
                  triggerId.value = 'trigger-2';
                }}
              >
                Switch
              </button>
            </div>
          );
        },
      });

      await render(<Test />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      mockClientRects(trigger1, [
        { left: 180, top: 0, right: 220, bottom: 10, width: 40, height: 10 },
        { left: 100, top: 20, right: 160, bottom: 30, width: 60, height: 10 },
      ]);
      mockClientRects(trigger2, [
        { left: 180, top: 100, right: 220, bottom: 110, width: 40, height: 10 },
        { left: 100, top: 120, right: 160, bottom: 130, width: 60, height: 10 },
      ]);

      await hoverAt(trigger1, 200, 5);

      const firstPositioner = await screen.findByTestId('positioner');
      await waitFor(() => {
        expect(firstPositioner).toBeVisible();
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Switch' }));

      const positioner = screen.getByTestId('positioner');

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, 135);
      });

      const { x: positionerX } = positioner.getBoundingClientRect();
      expect(positionerX).toBeGreaterThanOrEqual(90);
      expect(positionerX).toBeLessThanOrEqual(170);
    });

    it('uses the hovered line with a custom anchor in a clipped keepMounted portal', async () => {
      document.body.style.margin = '0';

      const Test = defineComponent({
        setup() {
          const triggerRef = shallowRef(null);
          const portalContainer = shallowRef<HTMLDivElement | null>(null);

          return () => (
            <div>
              <div ref={portalContainer} data-testid="portal-container" />
              <PreviewCard.Root>
                <PreviewCard.Trigger
                  ref={triggerRef}
                  href="#"
                  delay={0}
                  data-testid="trigger"
                  style={{ pointerEvents: 'none' }}
                >
                  Trigger
                </PreviewCard.Trigger>
                <PreviewCard.Portal keepMounted container={portalContainer}>
                  <PreviewCard.Positioner
                    anchor={triggerRef}
                    collisionBoundary={{ x: 0, y: 0, width: 300, height: 120 }}
                    collisionPadding={0}
                    data-testid="positioner"
                    side="bottom"
                    sideOffset={5}
                  >
                    <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                      Preview Content
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </PreviewCard.Root>
            </div>
          );
        },
      });

      await render(<Test />);
      const portalContainer = screen.getByTestId('portal-container');
      const trigger = screen.getByTestId('trigger');
      const positioner = await screen.findByTestId('positioner');

      mockClientRects(trigger, [
        { left: 180, top: 80, right: 220, bottom: 90, width: 40, height: 10 },
        { left: 0, top: 100, right: 60, bottom: 110, width: 60, height: 10 },
      ]);

      await hoverAt(trigger, 30, 105);

      await waitFor(() => {
        expect(positioner).toBeVisible();
      });

      expect(portalContainer).toContainElement(positioner);

      await waitFor(() => {
        expect(positioner).toHaveAttribute('data-side', 'top');
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, 55);
      });
    });
  });

  // In Vue 3.5.12, a `setup` that throws leaves the current instance set, and a later slot then
  // gives a warning. The case that throws thus comes last.
  it('throws a descriptive error when rendered outside <PreviewCard.Portal>', async () => {
    await expect(
      render(
        <PreviewCard.Root open>
          <PreviewCard.Positioner />
        </PreviewCard.Root>,
      ),
    ).rejects.toThrow('Vase UI: <PreviewCard.Positioner> must be inside <PreviewCard.Portal>.');
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
