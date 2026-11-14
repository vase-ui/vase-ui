import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import * as Tooltip from '../index.parts';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isInaccessible,
  isJSDOM,
  nextEvent,
  popupConformanceTests,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { OPEN_DELAY } from '../utils/constants';
import TooltipHydration from './TooltipHydration.test.vue';

type Details = Tooltip.Root.ChangeEventDetails;

function reasons(onOpenChange: ReturnType<typeof vi.fn>) {
  return onOpenChange.mock.calls.map((call) => [call[0], call[1].reason]);
}

function getTrigger(name = 'Trigger') {
  return screen.getByRole('button', { name });
}

function withFakeTimers() {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}

async function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  await flushMicrotasks();
}

type TestTooltipProps = {
  rootProps?: Record<string, unknown>;
  triggerProps?: Record<string, unknown>;
  portalProps?: Record<string, unknown>;
  positionerProps?: Record<string, unknown>;
  popupProps?: Record<string, unknown>;
};

const testTooltipProps: Array<keyof TestTooltipProps> = [
  'rootProps',
  'triggerProps',
  'portalProps',
  'positionerProps',
  'popupProps',
];

// The cases dispatch hover events. The real pointer of the browser can rest on a trigger and send
// events of its own, so each trigger ignores it. A dispatched event still reaches the trigger.
const ignoreRealPointer = { pointerEvents: 'none' } as const;

function renderPortal(props: TestTooltipProps) {
  return (
    <Tooltip.Portal {...props.portalProps}>
      <Tooltip.Positioner data-testid="positioner" {...props.positionerProps}>
        <Tooltip.Popup data-testid="popup" {...props.popupProps}>
          Content
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  );
}

const ContainedTriggerTooltip = defineComponent(
  (props: TestTooltipProps) => () => (
    <Tooltip.Root {...props.rootProps}>
      <Tooltip.Trigger data-testid="trigger" style={ignoreRealPointer} {...props.triggerProps}>
        Toggle
      </Tooltip.Trigger>
      {renderPortal(props)}
    </Tooltip.Root>
  ),
  { props: testTooltipProps },
);

const DetachedTriggerTooltip = defineComponent(
  (props: TestTooltipProps) => {
    const tooltipHandle = Tooltip.createHandle();
    return () => (
      <>
        <Tooltip.Trigger
          data-testid="trigger"
          handle={tooltipHandle}
          style={ignoreRealPointer}
          {...props.triggerProps}
        >
          Toggle
        </Tooltip.Trigger>
        <Tooltip.Root handle={tooltipHandle} {...props.rootProps}>
          {renderPortal(props)}
        </Tooltip.Root>
      </>
    );
  },
  { props: testTooltipProps },
);

const MultipleDetachedTriggersTooltip = defineComponent(
  (props: TestTooltipProps) => {
    const tooltipHandle = Tooltip.createHandle();
    return () => (
      <>
        <Tooltip.Trigger
          data-testid="trigger"
          handle={tooltipHandle}
          style={ignoreRealPointer}
          {...props.triggerProps}
        >
          Toggle
        </Tooltip.Trigger>
        <Tooltip.Trigger data-testid="trigger-2" handle={tooltipHandle} style={ignoreRealPointer}>
          Toggle another
        </Tooltip.Trigger>
        <Tooltip.Root handle={tooltipHandle} {...props.rootProps}>
          {renderPortal(props)}
        </Tooltip.Root>
      </>
    );
  },
  { props: testTooltipProps },
);

// `user.hover` throws for an element with `pointer-events: none`.
const hoverableByUser = { style: { pointerEvents: 'auto' } };

describe('<Tooltip.Root />', () => {
  const { render } = createRenderer();

  it('keeps the payload while a controlled reopen moves to another trigger', async () => {
    const handle = Tooltip.createHandle<string>();
    const payloads: Array<string | undefined> = [];
    const state = shallowRef<{ open: boolean; triggerId: string | null }>({
      open: true,
      triggerId: 'first',
    });

    const App = defineComponent({
      setup: () => () => (
        <>
          <Tooltip.Trigger handle={handle} id="first" payload="First">
            First
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={handle} id="second" payload="Second">
            Second
          </Tooltip.Trigger>
          <Tooltip.Root handle={handle} open={state.value.open} triggerId={state.value.triggerId}>
            {{
              default: ({ payload }: { payload: string | undefined }) => {
                payloads.push(payload);
                return (
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup>{payload}</Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                );
              },
            }}
          </Tooltip.Root>
        </>
      ),
    });

    await render(<App />);
    await flushMicrotasks();
    state.value = { open: false, triggerId: null };
    await flushMicrotasks();

    payloads.length = 0;
    state.value = { open: true, triggerId: 'second' };
    await flushMicrotasks();

    expect(payloads).not.toContain(undefined);
    expect(payloads.at(-1)).toBe('Second');
  });

  popupConformanceTests({
    createComponent: (props) => (
      <Tooltip.Root {...props.root}>
        <Tooltip.Trigger {...props.trigger}>Open menu</Tooltip.Trigger>
        <Tooltip.Portal {...props.portal}>
          <Tooltip.Positioner>
            <Tooltip.Popup {...props.popup}>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
    render,
    triggerMouseAction: 'hover',
  });

  it('marks the popup data-instant dismiss when Escape closes it', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger delay={0} style={ignoreRealPointer}>
          Toggle
        </Tooltip.Trigger>
        <Tooltip.Portal keepMounted>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Toggle' });

    trigger.focus();
    await flushMicrotasks();
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
    });

    await fireEvent.keyDown(trigger, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
    });
    expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'dismiss');
  });

  describe('trigger unmount during the open delay', () => {
    withFakeTimers();

    const ContainedApp = defineComponent(
      (props: { showTrigger: boolean }) => () => (
        <Tooltip.Root>
          {props.showTrigger && <Tooltip.Trigger style={ignoreRealPointer}>Toggle</Tooltip.Trigger>}
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ),
      { props: ['showTrigger'] },
    );

    const DetachedApp = defineComponent(
      (props: { showTrigger: boolean }) => {
        const handle = Tooltip.createHandle();
        return () => (
          <>
            {props.showTrigger && (
              <Tooltip.Trigger handle={handle} style={ignoreRealPointer}>
                Toggle
              </Tooltip.Trigger>
            )}
            <Tooltip.Root handle={handle}>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>Content</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </>
        );
      },
      { props: ['showTrigger'] },
    );

    it.each([
      { name: 'contained trigger', App: ContainedApp },
      { name: 'detached trigger', App: DetachedApp },
    ])('does not open once the hovered $name has unmounted', async ({ App }) => {
      const { setProps } = await render(<App showTrigger />);

      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await tick(1);

      await setProps({ showTrigger: false });

      await tick(OPEN_DELAY);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).toBe(null);
    });
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerTooltip },
    { name: 'detached triggers', Component: DetachedTriggerTooltip },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersTooltip },
  ])('when using $name', ({ Component: TestTooltip }) => {
    async function hoverTrigger(trigger: HTMLElement, pointerType = 'mouse') {
      await fireEvent.pointerDown(trigger, { pointerType });
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
    }

    describe('uncontrolled open', () => {
      withFakeTimers();

      it('should open when the trigger is hovered', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('does not open when a touch pointer hovers the trigger', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger, 'touch');

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should close when the trigger is unhovered', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        await fireEvent.mouseLeave(trigger);

        await flushMicrotasks();
        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should open when the trigger is focused', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        await flushMicrotasks();

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is blurred', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        await flushMicrotasks();

        await tick(OPEN_DELAY);
        await flushMicrotasks();

        trigger.blur();
        await flushMicrotasks();

        await tick(OPEN_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('controlled open', () => {
      withFakeTimers();

      function renderControlled(handleChange: (open: boolean) => void) {
        const App = defineComponent(() => {
          const open = shallowRef(false);

          return () => (
            <TestTooltip
              rootProps={{
                open: open.value,
                onOpenChange: (nextOpen: boolean) => {
                  handleChange(open.value);
                  open.value = nextOpen;
                },
              }}
            />
          );
        });

        return render(<App />);
      }

      it('should call onOpenChange when the open state changes', async () => {
        const handleChange = vi.fn();

        await renderControlled(handleChange);

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.mouseLeave(trigger);

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0][0]).toBe(false);
        expect(handleChange.mock.calls[1][0]).toBe(true);
      });

      it('does not call onOpenChange again when the trigger is re-hovered while open', async () => {
        const handleChange = vi.fn();

        await renderControlled(handleChange);

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange).toHaveBeenCalledTimes(1);

        // Hovering the already-open trigger again doesn't request another open.
        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange).toHaveBeenNthCalledWith(1, false);
      });
    });

    describe('prop: defaultOpen', () => {
      it('closes when the trigger is unhovered after opening by default', async () => {
        await render(<TestTooltip rootProps={{ defaultOpen: true }} />);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.mouseLeave(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('prop: delay', () => {
      withFakeTimers();

      it('should open after rest delay', async () => {
        await render(<TestTooltip triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        await tick(100);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: closeDelay', () => {
      withFakeTimers();

      it('should close after delay', async () => {
        await render(<TestTooltip triggerProps={{ closeDelay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.mouseLeave(trigger);

        expect(screen.getByText('Content')).not.toBe(null);

        await tick(100);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('preventUnmountOnClose()', () => {
      it('does not prevent unmounting on later closes', async () => {
        let preventNextClose = true;
        const { user } = await render(
          <TestTooltip
            rootProps={{
              onOpenChange: (open: boolean, details: Details) => {
                if (!open && preventNextClose) {
                  preventNextClose = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
            triggerProps={{
              delay: 0,
              closeDelay: 0,
              ...hoverableByUser,
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await screen.findByTestId('positioner');

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('positioner')).toHaveAttribute('data-closed');
        });

        await user.hover(trigger);

        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });
      });
    });

    describe('prop: actionsRef', () => {
      function actionsRef() {
        const ref = { current: undefined as Tooltip.Root.Actions | undefined };
        const setRef = (instance: unknown) => {
          ref.current = instance as Tooltip.Root.Actions;
        };
        return { ref, setRef };
      }

      it('unmounts the tooltip when the `unmount` method is called', async () => {
        const actions = actionsRef();

        const { user } = await render(
          <TestTooltip
            rootProps={{
              ref: actions.setRef,
              onOpenChange: (_open: boolean, details: Details) => {
                details.preventUnmountOnClose();
              },
            }}
            triggerProps={hoverableByUser}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await screen.findByTestId('positioner');

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('positioner')).toHaveAttribute('data-closed');
        });

        actions.ref.current!.unmount();
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });
      });

      it('closes the tooltip when the `close` method is called', async () => {
        const onOpenChange = vi.fn();
        const actions = actionsRef();

        const { user } = await render(
          <TestTooltip
            rootProps={{ ref: actions.setRef, onOpenChange }}
            triggerProps={{ delay: 0, ...hoverableByUser }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await screen.findByTestId('popup');

        actions.ref.current!.close();
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });

        expect(trigger).not.toHaveAttribute('data-popup-open');
        expect(onOpenChange).toHaveBeenLastCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.imperativeAction }),
        );
      });
    });

    describe.skipIf(isJSDOM)('animations', () => {
      it('inline opacity: 0 is removed before user CSS transitions run', async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        // The inline opacity: 0 applied before positioning must be removed
        // before CSS transitions start, so it does not trigger an unwanted
        // opacity transition.
        const style = `
          .tooltip {
            transition: opacity 200ms;
            opacity: 1;
          }
        `;

        const { user } = await render(
          <Tooltip.Root>
            <style>{style}</style>
            <Tooltip.Trigger data-testid="trigger" delay={0}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup class="tooltip" data-testid="popup">
                  Tooltip
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>,
        );

        await user.hover(screen.getByTestId('trigger'));

        const popup = await screen.findByTestId('popup');

        // Opacity should be 1 immediately — no unwanted fade from 0 to 1.
        // No opacity transition should be running.
        await waitFor(() => {
          const opacityAnimations = popup
            .getAnimations()
            .filter((a) => (a as CSSTransition).transitionProperty === 'opacity');
          expect({
            opacity: Number(getComputedStyle(popup).opacity),
            opacityAnimationCount: opacityAnimations.length,
          }).toEqual({ opacity: 1, opacityAnimationCount: 0 });
        });
      });
    });

    describe('prop: disabled', () => {
      it('should not open when disabled', async () => {
        await render(<TestTooltip rootProps={{ disabled: true }} triggerProps={{ delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        trigger.focus();
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not open on focus when the trigger is disabled', async () => {
        await render(<TestTooltip triggerProps={{ disabled: true, delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        await flushMicrotasks();
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should close if open when becoming disabled', async () => {
        const App = defineComponent(() => {
          const disabled = shallowRef(false);
          return () => (
            <div>
              <TestTooltip
                rootProps={{ defaultOpen: true, disabled: disabled.value }}
                triggerProps={{ delay: 0 }}
              />
              <button
                data-testid="disabled"
                onClick={() => {
                  disabled.value = true;
                }}
              />
            </div>
          );
        });

        await render(<App />);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);

        const disabledButton = screen.getByTestId('disabled');
        await fireEvent.click(disabledButton);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('reopens when re-enabled if the disabled close was canceled', async () => {
        const disabled = shallowRef(false);

        const App = defineComponent(() => () => (
          <TestTooltip
            rootProps={{
              defaultOpen: true,
              disabled: disabled.value,
              onOpenChange: (open: boolean, details: Details) => {
                if (!open && details.reason === REASONS.disabled) {
                  details.cancel();
                }
              },
            }}
            triggerProps={{ delay: 0 }}
          />
        ));

        await render(<App />);
        await flushMicrotasks();
        expect(screen.queryByText('Content')).not.toBe(null);

        disabled.value = true;
        await flushMicrotasks();
        expect(screen.queryByText('Content')).toBe(null);

        disabled.value = false;
        await flushMicrotasks();
        expect(screen.queryByText('Content')).not.toBe(null);
      });

      it('does not report the open completion again when it toggles on a kept-mounted open tooltip', async () => {
        const onOpenChangeComplete = vi.fn();
        const { setProps } = await render(
          <TestTooltip
            rootProps={{ open: true, disabled: false, onOpenChangeComplete }}
            portalProps={{ keepMounted: true }}
          />,
        );
        await waitFor(() => {
          expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
        });
        onOpenChangeComplete.mockClear();

        await setProps({
          rootProps: { open: true, disabled: true, onOpenChangeComplete },
          portalProps: { keepMounted: true },
        });
        await setProps({
          rootProps: { open: true, disabled: false, onOpenChangeComplete },
          portalProps: { keepMounted: true },
        });
        await flushMicrotasks();

        expect(onOpenChangeComplete).not.toHaveBeenCalledWith(true);
      });

      it('does not throw error when combined with defaultOpen', async () => {
        await render(<TestTooltip rootProps={{ defaultOpen: true, disabled: true }} />);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('marks the trigger as disabled when the root is disabled', async () => {
        await render(<TestTooltip rootProps={{ disabled: true }} />);

        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute(
          'data-trigger-disabled',
        );
      });

      it('keeps the tooltip disabled when the root is disabled and the trigger opts back in', async () => {
        const onOpenChange = vi.fn();
        await render(
          <TestTooltip
            rootProps={{ disabled: true, onOpenChange }}
            triggerProps={{ disabled: false, delay: 0 }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        expect(trigger).toHaveAttribute('data-trigger-disabled');

        await hoverTrigger(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
        expect(onOpenChange).not.toHaveBeenCalled();
      });
    });

    describe.skipIf(isJSDOM)('instant animations', () => {
      it('marks the popup as instant when opened by focus, but not when opened by hover', async () => {
        await render(<TestTooltip triggerProps={{ delay: 0, closeDelay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        await flushMicrotasks();
        await flushMicrotasks();

        expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'focus');

        trigger.blur();
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });

        await hoverTrigger(trigger);

        await screen.findByTestId('popup');

        expect(screen.getByTestId('popup')).not.toHaveAttribute('data-instant');
      });
    });

    describe('BaseUIChangeEventDetails', () => {
      it('allowPropagation() prevents stopPropagation on Escape while still closing', async () => {
        const stopPropagationSpy = vi.spyOn(Event.prototype, 'stopPropagation');

        await render(
          <TestTooltip
            rootProps={{
              defaultOpen: true,
              onOpenChange: (nextOpen: boolean, eventDetails: Details) => {
                if (!nextOpen && eventDetails.reason === REASONS.escapeKey) {
                  eventDetails.allowPropagation();
                }
              },
            }}
            triggerProps={{ delay: 0 }}
          />,
        );
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.keyDown(document.body, { key: 'Escape' });

        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });

        expect(stopPropagationSpy).toHaveBeenCalledTimes(0);
        stopPropagationSpy.mockRestore();
      });
    });

    describe('dismissal', () => {
      withFakeTimers();

      it('should close when Escape is pressed', async () => {
        const onOpenChange = vi.fn();
        await render(
          <TestTooltip
            rootProps={{ defaultOpen: true, onOpenChange }}
            triggerProps={{ delay: 0 }}
          />,
        );
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.keyDown(document.body, { key: 'Escape' });

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.escapeKey }),
        );
      });

      it('should not open when the trigger was clicked before delay duration', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await tick(OPEN_DELAY / 2);

        await fireEvent.click(trigger);

        await tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not open when the trigger receives pointerdown before delay duration', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY / 2);

        await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });

        await tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should open when the trigger was clicked before delay duration and closeOnClick is false', async () => {
        await render(<TestTooltip triggerProps={{ closeOnClick: false }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await tick(OPEN_DELAY / 2);

        await fireEvent.click(trigger);

        await tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is clicked after delay duration', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.click(trigger);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not close when the trigger is clicked after delay duration and closeOnClick is false', async () => {
        await render(<TestTooltip triggerProps={{ closeOnClick: false }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.click(trigger);

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('reopens on hover after the trigger is clicked closed', async () => {
        await render(<TestTooltip triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.click(trigger);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        // Re-enter with mouse events only. A fresh pointerenter can be missed
        // after the click-driven close, but hover should still work.
        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });
  });

  describe('preventUnmountOnClose()', () => {
    it('unmounts on a normal close after a prevented close and initially open remount', async () => {
      const tooltip = Tooltip.createHandle();
      const showRoot = shallowRef(true);
      const remountOpen = shallowRef(false);
      let preventNextUnmount = true;

      const App = defineComponent({
        setup: () => () => (
          <>
            {/* The real pointer of the browser can rest on the trigger and open the tooltip. */}
            <Tooltip.Trigger
              handle={tooltip}
              id="trigger"
              delay={0}
              style={{ pointerEvents: 'none' }}
            >
              Toggle
            </Tooltip.Trigger>
            <button type="button" onClick={() => tooltip.open('trigger')}>
              Open tooltip
            </button>
            <button type="button" onClick={() => tooltip.close()}>
              Close tooltip
            </button>
            <button
              type="button"
              onClick={() => {
                showRoot.value = false;
              }}
            >
              Unmount root
            </button>
            <button
              type="button"
              onClick={() => {
                remountOpen.value = true;
                showRoot.value = true;
              }}
            >
              Remount open
            </button>
            {showRoot.value && (
              <Tooltip.Root
                handle={tooltip}
                defaultOpen={remountOpen.value}
                defaultTriggerId="trigger"
                onOpenChange={(open: boolean, details: Details) => {
                  if (!open && preventNextUnmount) {
                    preventNextUnmount = false;
                    details.preventUnmountOnClose();
                  }
                }}
              >
                <Tooltip.Portal>
                  <Tooltip.Positioner data-testid="positioner">
                    <Tooltip.Popup>Content</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </>
        ),
      });

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await user.click(screen.getByRole('button', { name: 'Open tooltip' }));
      await screen.findByTestId('positioner');

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      // The positioner stays mounted, so the attribute of its closed state stays too.
      await waitFor(() => {
        expect(screen.getByTestId('positioner')).toHaveAttribute('data-closed');
      });
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(screen.queryByTestId('positioner')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Remount open' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-popup-open');
      });
      await flushMicrotasks();
      expect(screen.queryByTestId('positioner')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });
    });
  });

  describe('close requests', () => {
    it('reports the active trigger for an Escape close', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Tooltip.Root defaultOpen onOpenChange={onOpenChange}>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );
      await flushMicrotasks();
      expect(screen.queryByText('Content')).not.toBe(null);

      await user.keyboard('[Escape]');

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
      expect(onOpenChange.mock.calls[0][1].trigger).toBe(
        screen.getByRole('button', { name: 'Trigger' }),
      );
    });
  });

  describe('hover changes', () => {
    it('shows the popup after the awaited hover event', async () => {
      await render(
        <Tooltip.Root>
          <Tooltip.Trigger delay={0} style={ignoreRealPointer}>
            Trigger
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      await fireEvent.mouseEnter(trigger);

      expect(screen.queryByText('Content')).not.toBe(null);
    });

    it.skipIf(isJSDOM)(
      'reopens immediately when re-hovering the trigger during its close transition',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        // Long enough that a slow run can't finish the close before the re-enter.
        const closeTransitionMs = 10_000;
        const style = `
          @keyframes tooltip-reopen-during-close {
            from {
              opacity: 1;
            }
            to {
              opacity: 0.01;
            }
          }

          [data-testid="popup"][data-ending-style] {
            animation: tooltip-reopen-during-close ${closeTransitionMs}ms linear forwards;
          }
        `;

        const { user } = await render(
          <>
            <style>{style}</style>
            <Tooltip.Root>
              <Tooltip.Trigger delay={OPEN_DELAY}>Trigger</Tooltip.Trigger>
              <Tooltip.Portal keepMounted>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </>,
        );

        const trigger = screen.getByRole('button', { name: 'Trigger' });

        await user.hover(trigger);
        await waitFor(() => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
        });

        // The ending style lasts only while the exit runs, so the case waits for the start of the
        // exit animation.
        const exit = await nextEvent(screen.getByTestId('popup'), 'animationstart', {
          action: () => user.unhover(trigger),
        });
        expect((exit as AnimationEvent).animationName).toBe('tooltip-reopen-during-close');

        await user.hover(trigger);

        // Well under the open delay, so only the close-transition fast path can reopen it.
        await waitFor(
          () => {
            expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
          },
          { timeout: 200 },
        );
        expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');
      },
    );
  });

  describe('open state', () => {
    it('follows `v-model:open`, and emits `openChange` before `update:open`', async () => {
      const open = shallowRef(false);
      const events: unknown[][] = [];
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root
            open={open.value}
            onOpenChange={(next: boolean, details: Details) => {
              events.push(['openChange', next, details.reason]);
            }}
            {...{
              'onUpdate:open': (next: boolean) => {
                events.push(['update:open', next]);
                open.value = next;
              },
            }}
          >
            <Tooltip.Trigger style={{ pointerEvents: 'none' }}>Trigger</Tooltip.Trigger>
          </Tooltip.Root>
        ),
      });
      const { user } = await render(<App />);
      expect(getTrigger()).not.toHaveAttribute('data-popup-open');

      open.value = true;
      await flushMicrotasks();
      expect(getTrigger()).toHaveAttribute('data-popup-open');
      expect(events).toEqual([]);

      await user.keyboard('[Escape]');
      await flushMicrotasks();

      expect(getTrigger()).not.toHaveAttribute('data-popup-open');
      expect(events).toEqual([
        ['openChange', false, 'escape-key'],
        ['update:open', false],
      ]);
    });

    it('does not emit `update:open` for a canceled change, and stays open', async () => {
      const onUpdateOpen = vi.fn();
      const { user } = await render(
        <Tooltip.Root
          defaultOpen
          onOpenChange={(_next: boolean, details: Details) => details.cancel()}
          {...{ 'onUpdate:open': onUpdateOpen }}
        >
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
        </Tooltip.Root>,
      );
      await flushMicrotasks();

      await user.keyboard('[Escape]');
      await flushMicrotasks();

      expect(onUpdateOpen).not.toHaveBeenCalled();
      expect(getTrigger()).toHaveAttribute('data-popup-open');
    });

    it('gives the trigger an id and no ARIA attribute', async () => {
      await render(
        <Tooltip.Root defaultOpen>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
        </Tooltip.Root>,
      );
      await flushMicrotasks();
      const trigger = getTrigger();

      expect(trigger.id).not.toBe('');
      expect(trigger.getAttributeNames().filter((name) => name.startsWith('aria-'))).toEqual([]);
    });
  });

  describe('dismissal', () => {
    it('closes on a press outside the trigger', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <div>
          <button>Outside</button>
          <Tooltip.Root defaultOpen onOpenChange={onOpenChange}>
            <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          </Tooltip.Root>
        </div>,
      );
      await flushMicrotasks();

      await user.click(getTrigger('Outside'));

      expect(reasons(onOpenChange)).toEqual([[false, 'outside-press']]);
    });
  });

  describe('prop: disabled', () => {
    it('closes an open tooltip with the reason `disabled` at the mount, and marks its trigger while it is disabled', async () => {
      const disabled = shallowRef(true);
      const onOpenChange = vi.fn();
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root defaultOpen disabled={disabled.value} onOpenChange={onOpenChange}>
            <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          </Tooltip.Root>
        ),
      });
      await render(<App />);
      await flushMicrotasks();
      const trigger = getTrigger();

      expect(reasons(onOpenChange)).toEqual([[false, 'disabled']]);
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-trigger-disabled', '');

      disabled.value = false;
      await flushMicrotasks();
      expect(trigger).not.toHaveAttribute('data-trigger-disabled');
    });

    it('marks a trigger with its own `disabled`, and not the other triggers', async () => {
      await render(
        <Tooltip.Root>
          <Tooltip.Trigger disabled>One</Tooltip.Trigger>
          <Tooltip.Trigger>Two</Tooltip.Trigger>
        </Tooltip.Root>,
      );

      expect(getTrigger('One')).toHaveAttribute('data-trigger-disabled', '');
      expect(getTrigger('Two')).not.toHaveAttribute('data-trigger-disabled');
    });
  });

  describe('handle', () => {
    it('VUE-34: a `computed` that reads `isOpen` follows the tooltip and the root', async () => {
      const handle = Tooltip.createHandle<string>();
      const isOpen = computed(() => handle.isOpen);
      expect(isOpen.value).toBe(false);
      const { unmount } = await render(
        <div style={{ pointerEvents: 'none' }}>
          <Tooltip.Trigger handle={handle} id="one">
            One
          </Tooltip.Trigger>
          <Tooltip.Root handle={handle} />
        </div>,
      );
      await flushMicrotasks();

      handle.open('one');
      expect(isOpen.value).toBe(true);
      handle.close();
      expect(isOpen.value).toBe(false);
      handle.open('one');
      expect(isOpen.value).toBe(true);

      unmount();
      expect(isOpen.value).toBe(false);
    });
  });

  describe('active trigger', () => {
    it('has no payload while it is open with no active trigger', async () => {
      const open = shallowRef(true);
      const triggerId = shallowRef<string | null>('one');
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root open={open.value} triggerId={triggerId.value}>
            {{
              default: ({ payload }: { payload: string | undefined }) => [
                <Tooltip.Trigger id="one" payload="first">
                  One
                </Tooltip.Trigger>,
                <Tooltip.Trigger id="two" payload="second">
                  Two
                </Tooltip.Trigger>,
                <span data-testid="payload">{payload ?? 'none'}</span>,
              ],
            }}
          </Tooltip.Root>
        ),
      });
      await render(<App />);
      await waitFor(() => {
        expect(screen.getByTestId('payload').textContent).toBe('first');
      });

      triggerId.value = null;
      await flushMicrotasks();

      expect(screen.getByTestId('payload').textContent).toBe('none');
    });
  });

  describe('instant type', () => {
    it('marks a kept popup as instant while it closes because its active trigger unmounts', async () => {
      const showFirst = shallowRef(true);
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root defaultOpen defaultTriggerId="one">
            {showFirst.value ? <Tooltip.Trigger id="one">One</Tooltip.Trigger> : null}
            <Tooltip.Trigger id="two">Two</Tooltip.Trigger>
            <Tooltip.Portal keepMounted>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ),
      });
      await render(<App />);
      const popup = await screen.findByTestId('popup');
      await flushMicrotasks();
      expect(popup).not.toHaveAttribute('data-instant');

      // The mark lasts only for the exit, so an observer records each value that it replaces.
      const replacedValues: Array<string | null> = [];
      const observer = new MutationObserver((records) => {
        replacedValues.push(...records.map((record) => record.oldValue));
      });
      observer.observe(popup, { attributeFilter: ['data-instant'], attributeOldValue: true });
      onTestFinished(() => observer.disconnect());

      showFirst.value = false;
      await waitFor(() => {
        expect(isInaccessible(popup)).toBe(true);
      });
      await flushMicrotasks();

      expect(replacedValues).toEqual([null, 'delay']);
      expect(popup).not.toHaveAttribute('data-instant');
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a closed tooltip', props: {}, payload: 'none' },
      // The first trigger that registers claims the tooltip after the mount.
      {
        name: 'an open tooltip with no trigger id',
        props: { defaultOpen: true },
        payload: 'first',
      },
      {
        name: 'an open tooltip with a trigger id',
        props: { defaultOpen: true, defaultTriggerId: 'two' },
        payload: 'second',
      },
      {
        name: 'a closed tooltip that stays mounted',
        props: { keepMounted: true },
        payload: 'none',
      },
    ])('hydrates the server HTML of $name', async ({ props, payload }) => {
      const serverHtml = await renderOnServer('src/tooltip/root/TooltipHydration.test.vue', props);

      const { container } = await hydrate(TooltipHydration, { serverHtml, props });

      expect(container.querySelector('[data-testid="payload"]')?.textContent).toBe(payload);
    });
  });
});
