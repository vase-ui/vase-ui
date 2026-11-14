import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { Teleport, computed, defineComponent, shallowRef } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
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
  waitForPositioned,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
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
      <Tooltip.Trigger data-testid="trigger" {...props.triggerProps}>
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
        <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...props.triggerProps}>
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
        <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...props.triggerProps}>
          Toggle
        </Tooltip.Trigger>
        <Tooltip.Trigger data-testid="trigger-2" handle={tooltipHandle}>
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
        <Tooltip.Trigger delay={0}>Toggle</Tooltip.Trigger>
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
          {props.showTrigger && <Tooltip.Trigger>Toggle</Tooltip.Trigger>}
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
            {props.showTrigger && <Tooltip.Trigger handle={handle}>Toggle</Tooltip.Trigger>}
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
            triggerProps={{ delay: 0 }}
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
      it('toggles instant animations for adjacent tooltips only while opening', async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        // A long transition keeps the exit running until the final assertion, even on slow runs.
        const style = `
          .tooltip {
            transition: opacity 10s;
          }
          .tooltip[data-starting-style],
          .tooltip[data-ending-style] {
            opacity: 0;
          }

          .tooltip[data-instant] {
            transition: none;
          }
        `;

        const { user } = await render(
          <Tooltip.Provider>
            <style>{style}</style>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="trigger-1" delay={0}>
                First
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup class="tooltip" data-testid="popup-1">
                    First tooltip
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="trigger-2" delay={0}>
                Second
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup class="tooltip" data-testid="popup-2">
                    Second tooltip
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>,
        );

        const firstTrigger = screen.getByTestId('trigger-1');
        const secondTrigger = screen.getByTestId('trigger-2');

        await user.hover(firstTrigger);

        const firstPopup = await screen.findByTestId('popup-1');
        expect(firstPopup.dataset.instant).toBe(undefined);

        await user.unhover(firstTrigger);
        await user.hover(secondTrigger);

        const secondPopup = await screen.findByTestId('popup-2');

        await waitFor(() => {
          expect(secondPopup.dataset.instant).toBe('delay');
        });
        expect(secondPopup.getAnimations().length).toBe(0);
        // Closing from the starting style would exit from `opacity: 0` and never start a transition.
        // The starting style lasts only one frame, so the case waits for the opacity that stays.
        await waitFor(() => {
          expect(getComputedStyle(secondPopup).opacity).toBe('1');
        });

        // The ending style lasts only while the exit runs, so the case waits for the start of the
        // exit transition.
        await nextEvent(secondPopup, 'transitionrun', {
          action: () => user.unhover(secondTrigger),
        });

        expect(secondPopup.dataset.endingStyle).toBe('');
        expect(secondPopup.dataset.instant).toBe(undefined);
        expect(secondPopup.getAnimations().length).toBe(1);
      });

      it('unmounts an exiting tooltip when another tooltip opens', async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        const handleFirstOpenChange = vi.fn();

        const style = `
          .tooltip[data-ending-style] {
            transition: opacity 10s;
            opacity: 0;
          }

          .tooltip[data-instant] {
            transition: none;
          }
        `;

        const { user } = await render(
          <Tooltip.Provider timeout={30000}>
            <style>{style}</style>
            {['First', 'Second'].map((name, index) => (
              <Tooltip.Root
                key={name}
                onOpenChange={index === 0 ? handleFirstOpenChange : undefined}
              >
                <Tooltip.Trigger data-testid={`trigger-${index + 1}`} delay={0}>
                  {name}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup class="tooltip" data-testid={`popup-${index + 1}`}>
                      {name} tooltip
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            ))}
          </Tooltip.Provider>,
        );

        const firstTrigger = screen.getByTestId('trigger-1');
        const secondTrigger = screen.getByTestId('trigger-2');

        await user.hover(firstTrigger);

        const firstPopup = await screen.findByTestId('popup-1');

        // The exit runs only while its transition runs, so the case waits for the start of the
        // transition.
        await nextEvent(firstPopup, 'transitionrun', {
          action: () => user.unhover(firstTrigger),
        });
        expect(firstPopup.getAnimations().length).toBe(1);

        await user.hover(secondTrigger);
        await screen.findByTestId('popup-2');

        await waitFor(() => {
          expect(screen.queryByTestId('popup-1')).toBe(null);
        });
        // The first tooltip was already closing, so it reports only its open and its hover close.
        expect(handleFirstOpenChange).toHaveBeenCalledTimes(2);
      });

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

    describe('prop: disableHoverablePopup', () => {
      it('applies pointer-events: none to the positioner when `disableHoverablePopup = true`', async () => {
        await render(
          <TestTooltip rootProps={{ disableHoverablePopup: true }} triggerProps={{ delay: 0 }} />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('none');
      });

      it('does not apply pointer-events: none to the positioner when `disableHoverablePopup = false`', async () => {
        await render(
          <TestTooltip rootProps={{ disableHoverablePopup: false }} triggerProps={{ delay: 0 }} />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('');
      });
    });

    describe('prop: trackCursorAxis', () => {
      it('makes the positioner inert when tracking both axes', async () => {
        await render(
          <TestTooltip rootProps={{ trackCursorAxis: 'both' }} triggerProps={{ delay: 0 }} />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('none');
      });

      it('keeps the positioner hoverable when tracking a single axis', async () => {
        await render(
          <TestTooltip rootProps={{ trackCursorAxis: 'x' }} triggerProps={{ delay: 0 }} />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await hoverTrigger(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('');
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
            <Tooltip.Trigger handle={tooltip} id="trigger" delay={0}>
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

  const cursorTrigger = { width: '300px', height: '40px' };

  function getCenterX(element: Element) {
    const rect = element.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }

  it.skipIf(isJSDOM)(
    'tracks the cursor on the first delayed hover when trackCursorAxis is x',
    async () => {
      await render(
        <div style={{ paddingTop: '100px', paddingLeft: '40px' }}>
          <Tooltip.Root trackCursorAxis="x">
            <Tooltip.Trigger delay={100} style={cursorTrigger}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner" side="bottom">
                <Tooltip.Popup style={{ width: '40px', height: '20px' }}>Tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const cursorX = triggerRect.left + 240;
      const cursorY = triggerRect.top + 20;

      await fireEvent.pointerDown(trigger, {
        pointerType: 'mouse',
        clientX: cursorX,
        clientY: cursorY,
      });
      await fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      await fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      const positioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        expect(Math.abs(getCenterX(positioner) - cursorX)).toBeLessThanOrEqual(2);
      });
    },
  );

  it.skipIf(isJSDOM)(
    'stops tracking the cursor after trackCursorAxis is disabled while closed',
    async () => {
      const App = defineComponent(() => {
        const trackCursorAxis = shallowRef<'none' | 'x'>('x');

        return () => (
          <div style={{ paddingTop: '100px', paddingLeft: '40px' }}>
            <button onClick={() => (trackCursorAxis.value = 'none')}>Disable tracking</button>
            <Tooltip.Root trackCursorAxis={trackCursorAxis.value}>
              <Tooltip.Trigger delay={100} style={cursorTrigger}>
                Trigger
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner data-testid="positioner" side="bottom">
                  <Tooltip.Popup style={{ width: '40px', height: '20px' }}>Tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        );
      });

      const { user } = await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const cursorX = triggerRect.left + 240;
      const cursorY = triggerRect.top + 20;

      await fireEvent.pointerDown(trigger, {
        pointerType: 'mouse',
        clientX: cursorX,
        clientY: cursorY,
      });
      await fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      await fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      const trackedPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        expect(Math.abs(getCenterX(trackedPositioner) - cursorX)).toBeLessThanOrEqual(2);
      });

      await fireEvent.mouseLeave(trigger);
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Disable tracking' }));

      await fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      await fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      const untrackedPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const triggerCenterX = triggerRect.left + triggerRect.width / 2;
        expect(Math.abs(getCenterX(untrackedPositioner) - triggerCenterX)).toBeLessThanOrEqual(2);
      });
    },
  );

  it.skipIf(isJSDOM)(
    'updates the tracked cursor position after closing and reopening',
    async () => {
      await render(
        <div style={{ paddingTop: '100px', paddingLeft: '40px' }}>
          <Tooltip.Root trackCursorAxis="x">
            <Tooltip.Trigger delay={100} style={cursorTrigger}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner" side="bottom">
                <Tooltip.Popup style={{ width: '40px', height: '20px' }}>Tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const firstCursorX = triggerRect.left + 240;
      const secondCursorX = triggerRect.left + 60;
      const cursorY = triggerRect.top + 20;

      await fireEvent.pointerDown(trigger, {
        pointerType: 'mouse',
        clientX: firstCursorX,
        clientY: cursorY,
      });
      await fireEvent.mouseEnter(trigger, { clientX: firstCursorX, clientY: cursorY });
      await fireEvent.mouseMove(trigger, { clientX: firstCursorX, clientY: cursorY });

      const firstPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        expect(Math.abs(getCenterX(firstPositioner) - firstCursorX)).toBeLessThanOrEqual(2);
      });

      await fireEvent.mouseLeave(trigger);
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });

      await fireEvent.mouseEnter(trigger, { clientX: secondCursorX, clientY: cursorY });
      await fireEvent.mouseMove(trigger, { clientX: secondCursorX, clientY: cursorY });

      const secondPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        expect(Math.abs(getCenterX(secondPositioner) - secondCursorX)).toBeLessThanOrEqual(2);
      });
    },
  );

  describe.skipIf(isJSDOM)('cursor anchor after a close', () => {
    const App = defineComponent(
      (props: { keepMounted?: boolean }) => {
        const open = shallowRef(false);

        return () => (
          <div style={{ paddingTop: '100px', paddingLeft: '40px' }}>
            <button onClick={() => (open.value = true)}>Open</button>
            <button onClick={() => (open.value = false)}>Close</button>
            <Tooltip.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean) => (open.value = nextOpen)}
              trackCursorAxis="x"
            >
              <Tooltip.Trigger delay={0} style={cursorTrigger}>
                Trigger
              </Tooltip.Trigger>
              <Tooltip.Portal keepMounted={props.keepMounted}>
                <Tooltip.Positioner data-testid="positioner" side="bottom">
                  <Tooltip.Popup style={{ width: '40px', height: '20px' }}>Tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        );
      },
      { props: ['keepMounted'] },
    );

    function getPositionerCenterX() {
      return getCenterX(screen.getByTestId('positioner'));
    }

    it('anchors a reopen without a pointer to the last cursor position', async () => {
      await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const cursorX = triggerRect.left + 240;
      const cursorY = triggerRect.top + 20;

      await fireEvent.pointerDown(trigger, {
        pointerType: 'mouse',
        clientX: cursorX,
        clientY: cursorY,
      });
      await fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      await fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      await waitFor(() => {
        expect(Math.abs(getPositionerCenterX() - cursorX)).toBeLessThanOrEqual(2);
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await screen.findByTestId('positioner');

      await waitFor(() => {
        expect(Math.abs(getPositionerCenterX() - cursorX)).toBeLessThanOrEqual(2);
      });
    });

    it('keeps following the cursor while a kept-mounted tooltip is closed', async () => {
      await render(<App keepMounted />);

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const firstCursorX = triggerRect.left + 240;
      const secondCursorX = triggerRect.left + 60;
      const cursorY = triggerRect.top + 20;

      await fireEvent.pointerDown(trigger, {
        pointerType: 'mouse',
        clientX: firstCursorX,
        clientY: cursorY,
      });
      await fireEvent.mouseEnter(trigger, { clientX: firstCursorX, clientY: cursorY });
      await fireEvent.mouseMove(trigger, { clientX: firstCursorX, clientY: cursorY });

      await waitFor(() => {
        expect(Math.abs(getPositionerCenterX() - firstCursorX)).toBeLessThanOrEqual(2);
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.getByTestId('positioner')).toHaveAttribute('data-closed');
      });

      await fireEvent.mouseMove(document.body, { clientX: secondCursorX, clientY: cursorY });

      await fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await waitFor(() => {
        expect(screen.getByTestId('positioner')).toHaveAttribute('data-open');
      });

      await waitFor(() => {
        expect(Math.abs(getPositionerCenterX() - secondCursorX)).toBeLessThanOrEqual(2);
      });
    });
  });

  describe.skipIf(isJSDOM)('hoverable popup', () => {
    const HoverableTooltip = defineComponent(
      (props: { disableHoverablePopup?: boolean }) => () => (
        <div style={{ paddingTop: '100px', paddingLeft: '100px' }}>
          <Tooltip.Root disableHoverablePopup={props.disableHoverablePopup}>
            <Tooltip.Trigger delay={0} closeDelay={0} style={{ width: '120px', height: '40px' }}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner" side="bottom" sideOffset={0}>
                <Tooltip.Popup data-testid="popup" style={{ width: '120px', height: '40px' }}>
                  Content
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <button type="button">Outside</button>
        </div>
      ),
      { props: ['disableHoverablePopup'] },
    );

    async function openByHover() {
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      const popup = await screen.findByTestId('popup');
      const positioner = screen.getByTestId('positioner');
      // The safe polygon reads the place of the popup.
      await waitForPositioned(positioner);
      return { trigger, popup, positioner };
    }

    function center(element: Element) {
      const rect = element.getBoundingClientRect();
      return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    }

    it('survives the trip from the trigger to the popup, then closes after leaving it', async () => {
      await render(<HoverableTooltip />);

      const { trigger, popup, positioner } = await openByHover();

      await fireEvent.mouseLeave(trigger, center(popup));
      await fireEvent.mouseEnter(positioner);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).not.toBe(null);

      await fireEvent.mouseLeave(positioner, {
        relatedTarget: document.body,
        ...center(screen.getByRole('button', { name: 'Outside' })),
      });

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    });

    it('closes on that same trip when `disableHoverablePopup` is set', async () => {
      await render(<HoverableTooltip disableHoverablePopup />);

      const { trigger, popup, positioner } = await openByHover();

      await fireEvent.mouseLeave(trigger, center(popup));
      await fireEvent.mouseEnter(positioner);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('keeps the tooltip open when moving across spaced triggers without a closeDelay', async () => {
    const testTooltip = Tooltip.createHandle();
    const { user } = await render(
      <Tooltip.Provider timeout={400}>
        <div style={{ display: 'flex', gap: '32px' }}>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 3
          </Tooltip.Trigger>
        </div>

        <Tooltip.Root handle={testTooltip}>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Tooltip Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const [trigger1, trigger2, trigger3] = screen.getAllByRole('button');

    await user.hover(trigger1);
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    await user.unhover(trigger1);
    await user.hover(trigger2);
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    await fireEvent.mouseLeave(trigger2, {
      relatedTarget: document.body,
      clientX: 120,
      clientY: 0,
    });
    await user.hover(trigger3);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    await fireEvent.mouseMove(document.body, { clientX: 300, clientY: 0 });

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });
  });

  it('closes a tooltip that is still open when another tooltip in the group opens', async () => {
    const handleFirstOpenChange = vi.fn();
    const { user } = await render(
      <Tooltip.Provider>
        <Tooltip.Root onOpenChange={handleFirstOpenChange}>
          <Tooltip.Trigger delay={0} closeDelay={10000}>
            First
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>First tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger delay={0}>Second</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Second tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    await user.hover(screen.getByRole('button', { name: 'First' }));
    await screen.findByText('First tooltip');
    // The close delay keeps the first tooltip open after the pointer leaves.
    await user.unhover(screen.getByRole('button', { name: 'First' }));
    expect(screen.queryByText('First tooltip')).not.toBe(null);

    await user.hover(screen.getByRole('button', { name: 'Second' }));
    await screen.findByText('Second tooltip');

    await waitFor(() => {
      expect(screen.queryByText('First tooltip')).toBe(null);
    });
    expect(handleFirstOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: REASONS.none }),
    );
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
          <Tooltip.Trigger delay={0}>Trigger</Tooltip.Trigger>
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
            <Tooltip.Trigger>Trigger</Tooltip.Trigger>
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
        <div>
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

  describe('prop changes', () => {
    it('makes the positioner inert when `disableHoverablePopup` or `trackCursorAxis` changes', async () => {
      const disableHoverablePopup = shallowRef(false);
      const trackCursorAxis = shallowRef<'none' | 'both'>('none');
      await render(() => (
        <Tooltip.Root
          open
          disableHoverablePopup={disableHoverablePopup.value}
          trackCursorAxis={trackCursorAxis.value}
        >
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          {renderPortal({})}
        </Tooltip.Root>
      ));
      await flushMicrotasks();
      const positioner = screen.getByTestId('positioner');
      expect(positioner.style.pointerEvents).toBe('');

      disableHoverablePopup.value = true;
      await flushMicrotasks();
      expect(positioner.style.pointerEvents).toBe('none');

      disableHoverablePopup.value = false;
      trackCursorAxis.value = 'both';
      await flushMicrotasks();
      expect(positioner.style.pointerEvents).toBe('none');
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

describe('nested tooltips', () => {
  const { render } = createRenderer();
  withFakeTimers();

  it('should not open the outer tooltip when hovering over a nested tooltip trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(innerTrigger, { clientX: 10, clientY: 10 });
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 10, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not open the outer tooltip when moving between sibling nested triggers', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-a-trigger">Inner A</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-a-popup">Inner A tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-b-trigger">Inner B</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-b-popup">Inner B tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerATrigger = screen.getByTestId('inner-a-trigger');
    const innerBTrigger = screen.getByTestId('inner-b-trigger');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerEnter(innerATrigger, { pointerType: 'mouse', clientX: 30, clientY: 10 });
    await fireEvent.mouseEnter(innerATrigger);
    await fireEvent.mouseOver(innerATrigger);
    await fireEvent.mouseMove(innerATrigger, { clientX: 30, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-a-popup')).not.toBe(null);
    expect(screen.queryByTestId('inner-b-popup')).toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    await fireEvent.mouseOut(innerATrigger, { relatedTarget: innerBTrigger });
    // React makes a leave event of the trigger from the `mouseout` event. A browser also sends
    // `mouseleave`, and the trigger listens to it.
    await fireEvent.mouseLeave(innerATrigger, { relatedTarget: innerBTrigger });
    await fireEvent.pointerEnter(innerBTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerBTrigger);
    await fireEvent.mouseOver(innerBTrigger);
    await fireEvent.mouseMove(innerBTrigger, { clientX: 50, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-a-popup')).toBe(null);
    expect(screen.getByTestId('inner-b-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not open ancestor tooltips when hovering over a third-level nested trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="grandparent-trigger" as="span">
          Grandparent
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="parent-trigger" as="span">
              Parent
              <Tooltip.Root>
                <Tooltip.Trigger data-testid="child-trigger">Child</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="child-popup">Child tooltip</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="parent-popup">Parent tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="grandparent-popup">Grandparent tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const grandparentTrigger = screen.getByTestId('grandparent-trigger');
    const parentTrigger = screen.getByTestId('parent-trigger');
    const childTrigger = screen.getByTestId('child-trigger');

    await fireEvent.pointerEnter(grandparentTrigger, {
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    });
    await fireEvent.mouseEnter(grandparentTrigger);
    await fireEvent.pointerEnter(parentTrigger, { pointerType: 'mouse', clientX: 30, clientY: 10 });
    await fireEvent.mouseEnter(parentTrigger);
    await fireEvent.pointerEnter(childTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(childTrigger);
    await fireEvent.mouseOver(childTrigger);
    await fireEvent.mouseMove(childTrigger, { clientX: 50, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('child-popup')).not.toBe(null);
    expect(screen.queryByTestId('parent-popup')).toBe(null);
    expect(screen.queryByTestId('grandparent-popup')).toBe(null);
  });

  it('should open the outer tooltip when moving from a nested trigger to the parent area with zero delay', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span" delay={0}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    await fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should not open a disabled outer tooltip when moving from a nested trigger to the parent area with zero delay', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span" delay={0} disabled>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    await fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should reopen the delayed outer tooltip when moving from a nested trigger to the parent area', async () => {
    const delay = 100;

    await render(
      <Tooltip.Provider delay={delay}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" as="span">
            <span data-testid="outer-area">Outer</span>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger" delay={delay * 10}>
                Inner
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    await tick(delay);

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await tick(delay);

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('does not announce an open outer tooltip again when the nested reopen fires', async () => {
    const delay = 100;
    const onOpenChange = vi.fn();
    const open = shallowRef(false);

    const App = defineComponent(() => () => (
      <div>
        <button data-testid="open-outer" onClick={() => (open.value = true)} type="button" />
        <Tooltip.Provider delay={delay}>
          <Tooltip.Root
            open={open.value}
            onOpenChange={(nextOpen: boolean, eventDetails: Details) => {
              onOpenChange(nextOpen, eventDetails);
              open.value = nextOpen;
            }}
          >
            <Tooltip.Trigger data-testid="outer-trigger" as="span">
              <span data-testid="outer-area">Outer</span>
              <Tooltip.Root>
                <Tooltip.Trigger data-testid="inner-trigger" delay={delay * 10}>
                  Inner
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
    ));

    await render(<App />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    // No move on the inner trigger, so the outer trigger starts no rest timer of its own.
    await fireEvent.mouseOver(innerTrigger);

    // Move back to the parent area so the local reopen is scheduled but not yet due.
    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    // The tooltip is opened from the outside before the pending reopen fires.
    await fireEvent.click(screen.getByTestId('open-outer'));
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    await tick(delay);

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('should support nested triggers inside a detached parent trigger', async () => {
    const delay = 100;
    const rowHandle = Tooltip.createHandle<string>();

    await render(
      <Tooltip.Provider delay={delay}>
        <Tooltip.Trigger handle={rowHandle} payload="Row" data-testid="outer-trigger" as="div">
          <span data-testid="outer-area">Row</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={0}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>

        <Tooltip.Root handle={rowHandle}>
          {{
            default: ({ payload }: { payload: string | undefined }) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="outer-popup">{payload} tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            ),
          }}
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const outerArea = screen.getByTestId('outer-area');
    const innerTrigger = screen.getByTestId('inner-trigger');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    await tick(delay);

    expect(screen.getByTestId('inner-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await tick(delay);

    expect(screen.getByTestId('outer-popup')).toHaveTextContent('Row tooltip');
  });

  it('should not reopen the outer tooltip when rapidly moving back to a nested trigger', async () => {
    const delay = 100;

    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span" delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    await tick(delay);

    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await tick(delay / 2);

    await fireEvent.mouseOut(outerArea, { relatedTarget: innerTrigger });
    await fireEvent.mouseOver(innerTrigger);

    await tick(delay / 2);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not reopen the outer tooltip when hovering the nested tooltip popup', async () => {
    const delay = 100;

    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span" delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={0}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    await tick(delay);
    await flushMicrotasks();

    const innerPopup = screen.getByTestId('inner-popup');
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    await fireEvent.mouseOver(innerPopup);

    await tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should cancel the pending parent reopen when the pointer leaves the parent trigger', async () => {
    const delay = 100;

    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span" delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    await tick(delay);

    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await tick(delay / 2);

    await fireEvent.mouseLeave(outerTrigger, { relatedTarget: document.body });

    await tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not open the outer tooltip when the pointer moves onto a nested trigger before the delay expires', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    await fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    await tick(OPEN_DELAY / 2);

    await fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    await fireEvent.pointerMove(innerTrigger, { clientX: 50, clientY: 10 });
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should restart the parent delay when moving from a nested trigger to the parent area', async () => {
    const delay = 100;

    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span" delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={delay * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const outerArea = screen.getByTestId('outer-area');
    const innerTrigger = screen.getByTestId('inner-trigger');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    await tick(delay / 2);

    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await tick(delay / 2);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    await tick(delay / 2);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should close the outer tooltip when the pointer moves from outer area onto a nested trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // Open the outer tooltip with a hover of the outer area.
    await fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    // Move onto the inner trigger. The `mouseover` event bubbles to the outer trigger, which finds
    // the nested trigger and closes its tooltip.
    await fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should keep a focus-opened outer tooltip open when hovering over a nested trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger
          data-testid="outer-trigger"
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => (
              <span {...props} tabindex={0}>
                <span>Outer</span>
                <Tooltip.Root>
                  <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
                    Inner
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </span>
            ),
          }}
        />
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    outerTrigger.focus();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should keep a controlled-open outer tooltip open when hovering over a nested trigger', async () => {
    const onOpenChange = vi.fn();

    await render(
      <Tooltip.Root open onOpenChange={onOpenChange}>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          <span>Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    await flushMicrotasks();

    const innerTrigger = screen.getByTestId('inner-trigger');

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('should not open the outer tooltip when focusing a nested tooltip trigger', async () => {
    await render(
      <Tooltip.Provider delay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" as="div">
            row label
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger">button with tooltip</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">inner popup</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">outer popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const innerTrigger = screen.getByTestId('inner-trigger');

    innerTrigger.focus();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should close a focus-opened inner tooltip when the inner trigger loses focus', async () => {
    await render(
      <Tooltip.Provider delay={0}>
        <Tooltip.Root open={false}>
          <Tooltip.Trigger data-testid="outer-trigger" as="div">
            row label
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger">button with tooltip</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">inner popup</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <button data-testid="after">button</button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">outer popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const innerTrigger = screen.getByTestId('inner-trigger');
    const after = screen.getByTestId('after');

    innerTrigger.focus();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);

    after.focus();
    await flushMicrotasks();
    await tick(OPEN_DELAY);

    expect(screen.queryByTestId('inner-popup')).toBe(null);
  });

  it('should allow the parent tooltip to open when a nested trigger is disabled', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" disabled>
              Inner (disabled)
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    await fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    // A disabled nested trigger does not keep the outer tooltip closed.
    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(screen.queryByTestId('inner-popup')).toBe(null);
  });

  it('should not open the outer tooltip when hovering over a nested trigger inside a shadow root', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);

    try {
      await render(
        <Teleport to={container}>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="outer-trigger" as="span">
              Outer
              <Tooltip.Root>
                <Tooltip.Trigger data-testid="inner-trigger" as="div">
                  Inner
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Teleport>,
      );

      const outerTrigger = shadowRoot.querySelector('[data-testid="outer-trigger"]') as HTMLElement;
      const innerTrigger = shadowRoot.querySelector('[data-testid="inner-trigger"]') as HTMLElement;
      const innerShadowRoot = innerTrigger.attachShadow({ mode: 'open' });
      const innerShadowTarget = document.createElement('span');
      innerShadowTarget.textContent = 'Inner shadow target';
      innerShadowRoot.appendChild(innerShadowTarget);

      // Hover the outer trigger, so the outer tooltip starts its open delay.
      await fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
      await fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
      await fireEvent.mouseEnter(outerTrigger);
      await fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

      // Before the delay ends, move onto a target in the shadow root of the inner trigger. The
      // composed `mouseover` event bubbles to the outer trigger. The search goes out of the shadow
      // tree, finds the marker of the inner trigger, and keeps the outer tooltip closed.
      await fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
      await fireEvent.mouseEnter(innerTrigger);
      innerShadowTarget.dispatchEvent(
        new MouseEvent('mouseover', {
          bubbles: true,
          composed: true,
          clientX: 50,
          clientY: 10,
        }),
      );
      await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

      await tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('outer-popup')).toBe(null);
    } finally {
      host.remove();
      await flushMicrotasks();
    }
  });

  it('falls back to the event target when the composed path is empty', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // Start the open delay of the outer tooltip. Then only the rule of nested triggers keeps it closed.
    await fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse' });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.mouseMove(outerTrigger);

    // `composedPath()` is empty after the dispatch of an event ends.
    const mouseOverEvent = new MouseEvent('mouseover', { bubbles: true, composed: true });
    Object.defineProperty(mouseOverEvent, 'composedPath', { value: () => [] });
    innerTrigger.dispatchEvent(mouseOverEvent);

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should open the outer tooltip when hovering over the non-nested area', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');

    await fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(screen.queryByTestId('inner-popup')).toBe(null);
  });

  it('should not reopen the outer tooltip via the local reopen path for touch pointers', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span" delay={0}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    // A touch interaction sets the pointer type of the outer trigger to 'touch'.
    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'touch', clientX: 10, clientY: 10 });
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'touch', clientX: 50, clientY: 10 });
    await fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    // Move from the inner trigger back to the outer area. The local reopen needs a mouse-like
    // pointer, so a touch pointer starts no reopen.
    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should allow mouse hover after leaving a touch interaction', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span" delay={0}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    // Start with a touch interaction, then leave the trigger before the next hover.
    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'touch', clientX: 10, clientY: 10 });
    await fireEvent.mouseLeave(outerTrigger, { relatedTarget: document.body });

    // The touch before it does not block a later hover with mouse events only.
    await fireEvent.mouseOver(innerTrigger);
    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should not open the outer tooltip when moving from the outer popup to a nested trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // Open the outer tooltip with a hover.
    await fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    const outerPopup = screen.getByTestId('outer-popup');
    expect(outerPopup).not.toBe(null);

    // Hover the outer popup, which the portal puts outside the trigger.
    await fireEvent.pointerEnter(outerPopup, { pointerType: 'mouse', clientX: 200, clientY: 200 });
    await fireEvent.mouseOver(outerPopup);

    await flushMicrotasks();

    // Move back onto the nested trigger. The `mouseover` event bubbles to the outer trigger, which
    // closes its tooltip.
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should suppress the safePolygon-driven open while a nested trigger is hovered', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" as="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    await fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    await fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);
    // More moves on the inner trigger bubble to the outer trigger. Its hover composable opens the
    // tooltip on a move, unless `shouldOpen` returns `false`.
    await fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });
    await fireEvent.mouseMove(innerTrigger, { clientX: 51, clientY: 10 });

    await tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should support nested triggers with a Provider delay={0}', async () => {
    await render(
      <Tooltip.Provider delay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" as="span">
            <span data-testid="outer-area">Outer</span>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    await fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    await fireEvent.mouseEnter(outerTrigger);
    await fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    await fireEvent.mouseEnter(innerTrigger);
    await fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
    expect(screen.getByTestId('inner-popup')).not.toBe(null);

    await fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    await fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });
});
