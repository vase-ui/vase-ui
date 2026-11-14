import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, inject, KeepAlive, nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  pressWithScreenReader,
  screen,
  useTestInteractions,
  waitSingleFrame,
} from '#test-utils';
import { PopupFixtureContext } from '../../../../test/fixtures/PopupFixture';
import PopupRootPart from '../../../../test/fixtures/PopupRootPart.vue';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { useButton } from '../../../internals/use-button';
import { useTriggerRegistration } from '../popupStoreUtils';
import { useClick } from './useClick';
import type { UseClickProps } from './useClick';
import { useHoverPopupInteraction } from './useHoverPopupInteraction';
import { useHoverTriggerInteraction } from './useHoverTriggerInteraction';

type AppProps = UseClickProps & {
  initialOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean, details: VaseUIChangeEventDetails<string>) => void) | undefined;
  typeable?: boolean | undefined;
  /** Opens the popup for `mouseenter`, as a hover interaction does. */
  hover?: boolean | undefined;
};

const App = defineComponent(
  (props: AppProps) => {
    const open = shallowRef(props.initialOpen ?? false);
    const { refs, context } = useFloating({
      open,
      onOpenChange(nextOpen, details) {
        props.onOpenChange?.(nextOpen, details);
        open.value = nextOpen;
      },
    });
    const { getReferenceProps } = useTestInteractions([
      props.hover
        ? {
            reference: {
              onMouseenter(event: MouseEvent) {
                context.rootStore.setOpen(
                  true,
                  createChangeEventDetails(
                    REASONS.triggerHover,
                    event,
                    event.currentTarget as Element,
                  ),
                );
              },
            },
          }
        : undefined,
      useClick(context.rootStore, props),
    ]);

    return () => {
      const Reference = props.typeable ? 'input' : 'button';

      return (
        <>
          <Reference data-testid="reference" {...getReferenceProps({ ref: refs.setReference })} />
          {open.value && <div role="tooltip" />}
        </>
      );
    };
  },
  {
    props: [
      'initialOpen',
      'onOpenChange',
      'typeable',
      'hover',
      'enabled',
      'event',
      'toggle',
      'ignoreMouse',
      'stickIfOpen',
      'touchOpenDelay',
      'reason',
    ],
  },
);

function createMouseEvent(type: string, options: MouseEventInit = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...options,
  });
}

function createPointerEvent(type: string, pointerType: PointerEvent['pointerType']) {
  const event = createMouseEvent(type) as PointerEvent;
  Object.defineProperty(event, 'pointerType', {
    value: pointerType,
  });
  return event;
}

async function click(element: Element) {
  element.dispatchEvent(createMouseEvent('click'));
  await flushMicrotasks();
}

async function hover(element: Element) {
  element.dispatchEvent(createMouseEvent('mouseover', { relatedTarget: document.body }));
  element.dispatchEvent(createMouseEvent('mouseenter', { relatedTarget: document.body }));
  await flushMicrotasks();
}

async function pressMouse(element: Element) {
  element.dispatchEvent(createPointerEvent('pointerdown', 'mouse'));
  element.dispatchEvent(createMouseEvent('mousedown'));
  element.dispatchEvent(createMouseEvent('click'));
  await flushMicrotasks();
}

// `useClick` takes a mouse `pointerdown` with no pressure and no pressed button for the press of a
// screen reader. A mouse press has both.
const mousePress = { pointerType: 'mouse', pressure: 0.5, buttons: 1 };

// The pointer of the browser stays where a case leaves it, for each later test.
function releasePointerAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
  });
}

/** Waits for the frames that the press of a trigger can request, and for the flush after them. */
async function waitForFrames() {
  await waitSingleFrame();
  await waitSingleFrame();
  await flushMicrotasks();
}

function useFakeTimers() {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/** Lets the touch delay and the next frame pass on the fake clock. */
async function runWaits() {
  vi.advanceTimersByTime(100);
  vi.advanceTimersToNextFrame();
  await flushMicrotasks();
}

/** The `pointerdown` and the `mousedown` of a press, with no `click`. */
async function pressMouseDown(element: Element) {
  element.dispatchEvent(createPointerEvent('pointerdown', 'mouse'));
  element.dispatchEvent(createMouseEvent('mousedown'));
  await flushMicrotasks();
}

async function pressTouch(element: Element) {
  await fireEvent.pointerDown(element, { pointerType: 'touch' });
  await fireEvent.click(element);
}

const Other = defineComponent({ setup: () => () => <p>other</p> });

/** A trigger that registers with a popup root and presses with `useClick`. */
const ClickTrigger = defineComponent(
  (props: { id: string }) => {
    const store = inject(PopupFixtureContext)!;
    const { registerTrigger } = useTriggerRegistration(() => props.id, store);
    const { reference } = useClick(store);

    return () => (
      <button
        {...reference}
        id={props.id}
        data-testid={props.id}
        ref={(element) => registerTrigger(element as Element | null)}
      />
    );
  },
  { props: ['id'] },
);

/** Shows the popup of a popup root with its active trigger. */
const PopupProbe = defineComponent(() => {
  const store = inject(PopupFixtureContext)!;

  return () =>
    store.select('open') ? (
      <div data-testid="popup" data-trigger={store.select('activeTriggerId')} />
    ) : null;
});

/** A trigger that is a `div`, with the keyboard activation of `useButton`. */
const DivButtonApp = defineComponent(() => {
  const open = shallowRef(false);
  const { refs, context } = useFloating({
    open,
    onOpenChange(nextOpen) {
      open.value = nextOpen;
    },
  });
  const { getButtonProps, buttonRef } = useButton({ native: false });
  const { reference } = useClick(context.rootStore);

  return () => (
    <>
      <div
        {...getButtonProps(reference)}
        tabindex={0}
        ref={(element) => {
          buttonRef(element as HTMLElement | null);
          refs.setReference(element);
        }}
      />
      {open.value && <div role="tooltip" />}
    </>
  );
});

describe('useClick', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback): number => {
        callback(0);
        return 0;
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens and closes on repeated clicks', async () => {
    await render(<App />);

    const button = screen.getByRole('button');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await click(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps open on repeated clicks when toggle is false', async () => {
    await render(<App toggle={false} />);

    const button = screen.getByRole('button');

    await click(button);
    await click(button);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('opens from the mousedown event path', async () => {
    await render(<App event="mousedown" />);

    const button = screen.getByRole('button');

    await pressMouse(button);
    await flushMicrotasks();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('closes from the mousedown event path', async () => {
    await render(<App event="mousedown" initialOpen />);

    const button = screen.getByRole('button');

    await pressMouse(button);
    await flushMicrotasks();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('ignores the click event after mousedown when event is mousedown-only', async () => {
    await render(<App event="mousedown-only" />);

    const button = screen.getByRole('button');

    await pressMouse(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('ignores mouse input when ignoreMouse is true', async () => {
    await render(<App ignoreMouse />);

    const button = screen.getByRole('button');

    await fireEvent.pointerDown(button, mousePress);
    await fireEvent.click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('delays touch opening when touchOpenDelay is set', async () => {
    vi.useFakeTimers();

    await render(<App touchOpenDelay={100} />);

    const button = screen.getByRole('button');

    await fireEvent.pointerDown(button, { pointerType: 'touch' });
    await fireEvent.click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    vi.advanceTimersByTime(100);
    await flushMicrotasks();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('delays touch opening from the deferred mousedown event path', async () => {
    vi.useFakeTimers();

    await render(<App event="mousedown" touchOpenDelay={100} />);

    const button = screen.getByRole('button');

    button.dispatchEvent(createPointerEvent('pointerdown', 'touch'));
    button.dispatchEvent(createMouseEvent('mousedown'));
    button.dispatchEvent(createMouseEvent('click'));
    await flushMicrotasks();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    vi.advanceTimersToNextFrame();
    await flushMicrotasks();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    vi.advanceTimersByTime(100);
    await flushMicrotasks();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('does not delay touch closing', async () => {
    vi.useFakeTimers();

    await render(<App initialOpen touchOpenDelay={100} />);

    const button = screen.getByRole('button');

    await fireEvent.pointerDown(button, { pointerType: 'touch' });
    await fireEvent.click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses the configured reason', async () => {
    const onOpenChange = vi.fn();

    await render(<App onOpenChange={onOpenChange} reason={REASONS.inputPress} typeable />);

    await click(screen.getByRole('textbox'));

    expect(onOpenChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: REASONS.inputPress }),
    );
  });

  function createHoverClickApp(stickIfOpen: boolean) {
    return defineComponent({
      setup() {
        const open = shallowRef(false);
        const { refs, context } = useFloating({
          open,
          onOpenChange(nextOpen) {
            open.value = nextOpen;
          },
        });
        const hoverReferenceProps = useHoverTriggerInteraction(context.rootStore, {
          triggerElement: refs.reference,
        });
        useHoverPopupInteraction(context.rootStore);
        const { getReferenceProps, getFloatingProps } = useTestInteractions([
          { reference: hoverReferenceProps },
          useClick(context.rootStore, { stickIfOpen }),
        ]);

        return () => (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {open.value && <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />}
          </>
        );
      },
    });
  }

  it('stickIfOpen true keeps a hover-opened popup open on first click', async () => {
    const HoverClickApp = createHoverClickApp(true);
    await render(<HoverClickApp />);

    const button = screen.getByRole('button');

    await hover(button);
    await click(button);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('stickIfOpen false closes a hover-opened popup on first click', async () => {
    const HoverClickApp = createHoverClickApp(false);
    await render(<HoverClickApp />);

    const button = screen.getByRole('button');

    await hover(button);
    await click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('useClick in Vue', () => {
  const { render } = createRenderer();

  describe('the mousedown path', () => {
    it('opens for a real press, and the click of that press does not close the popup', async () => {
      releasePointerAfterTest();
      const onOpenChange = vi.fn();
      await render(<App event="mousedown" onOpenChange={onOpenChange} />);

      await userEvent.click(screen.getByRole('button'));
      await waitForFrames();

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it('does not open for a press of the right button', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(<App event="mousedown" onOpenChange={onOpenChange} />);

      await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('button') });
      await waitForFrames();

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('opens a typeable trigger in the same task, with no frame', async () => {
      await render(<App event="mousedown" typeable />);
      const input = screen.getByRole('textbox');

      input.dispatchEvent(createPointerEvent('pointerdown', 'mouse'));
      await fireEvent.mouseDown(input);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('stickIfOpen', () => {
    it.each([
      { name: 'true', stickIfOpen: true, outcome: 'keeps it open', states: [true, true, false] },
      { name: 'false', stickIfOpen: false, outcome: 'closes it', states: [true, false, true] },
      {
        name: 'not given',
        stickIfOpen: undefined,
        outcome: 'keeps it open',
        states: [true, true, false],
      },
    ])(
      'the first click on a popup that a hover opened $outcome when stickIfOpen is $name',
      async ({ stickIfOpen, states }) => {
        await render(<App hover stickIfOpen={stickIfOpen} />);
        const button = screen.getByRole('button');
        const isOpen = () => screen.queryByRole('tooltip') !== null;

        await fireEvent.mouseEnter(button);
        const afterHover = isOpen();
        await click(button);
        const afterFirstClick = isOpen();
        await click(button);

        expect([afterHover, afterFirstClick, isOpen()]).toEqual(states);
      },
    );

    it('reads a getter at each press', async () => {
      const stickIfOpen = shallowRef(false);
      await render(<App hover stickIfOpen={() => stickIfOpen.value} />);
      const button = screen.getByRole('button');

      await fireEvent.mouseEnter(button);
      await click(button);
      const afterFirstPress = screen.queryByRole('tooltip') !== null;

      stickIfOpen.value = true;
      await fireEvent.mouseEnter(button);
      await click(button);

      expect([afterFirstPress, screen.queryByRole('tooltip') !== null]).toEqual([false, true]);
    });
  });

  describe('triggers', () => {
    it('keeps the popup open for a press on a second trigger, and makes that trigger active', async () => {
      await render(
        <PopupRootPart>
          <ClickTrigger id="first" />
          <ClickTrigger id="second" />
          <PopupProbe />
        </PopupRootPart>,
      );

      await click(screen.getByTestId('first'));
      expect(screen.getByTestId('popup')).toHaveAttribute('data-trigger', 'first');

      await click(screen.getByTestId('second'));
      expect(screen.getByTestId('popup')).toHaveAttribute('data-trigger', 'second');
    });

    it('presses the store that a getter gives at the press', async () => {
      const onFirstChange = vi.fn();
      const onSecondChange = vi.fn();
      const useSecond = shallowRef(false);
      const Trigger = defineComponent(() => {
        const first = useFloating({ onOpenChange: onFirstChange }).context.rootStore;
        const second = useFloating({ onOpenChange: onSecondChange }).context.rootStore;
        const { reference } = useClick(() => (useSecond.value ? second : first));

        return () => <button {...reference} />;
      });
      await render(<Trigger />);
      const button = screen.getByRole('button');

      await click(button);
      useSecond.value = true;
      await click(button);

      expect([onFirstChange.mock.calls.length, onSecondChange.mock.calls.length]).toEqual([1, 1]);
    });
  });

  describe('the keyboard', () => {
    it('does not drop the click of a key that follows a mouse pointerdown with no click', async () => {
      await render(<App ignoreMouse />);
      const button = screen.getByRole('button');

      await fireEvent.pointerDown(button, mousePress);
      await fireEvent.keyDown(button, { key: 'Enter' });
      await fireEvent.click(button);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it.each([
      { name: 'Enter', key: '{Enter}' },
      { name: 'Space', key: ' ' },
    ])('opens the popup for $name on a button', async ({ key }) => {
      await render(<App />);
      const button = screen.getByRole('button');

      button.focus();
      await userEvent.keyboard(key);
      await flushMicrotasks();

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('opens the popup for Enter on a div with the props of useButton', async () => {
      await render(<DivButtonApp />);
      const button = screen.getByRole('button');

      button.focus();
      await userEvent.keyboard('{Enter}');
      await flushMicrotasks();

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('a press of a screen reader', () => {
    it('opens the popup in the same task, with no frame, and focuses the trigger', async () => {
      await render(<App event="mousedown" ignoreMouse />);
      const button = screen.getByRole('button');

      await pressWithScreenReader(button);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(button).toHaveFocus();
    });

    it('does not focus the trigger when the mousedown is prevented', async () => {
      await render(<App event="mousedown" />);
      const button = screen.getByRole('button');
      const preventDefault = (event: Event) => event.preventDefault();
      document.addEventListener('mousedown', preventDefault, true);
      onTestFinished(() => document.removeEventListener('mousedown', preventDefault, true));

      await pressWithScreenReader(button);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(button).not.toHaveFocus();
    });

    it('drops the press of a pen when ignoreMouse is true', async () => {
      const onOpenChange = vi.fn();
      await render(<App event="mousedown" ignoreMouse onOpenChange={onOpenChange} />);
      const button = screen.getByRole('button');

      await fireEvent.pointerDown(button, { pointerType: 'pen', pressure: 0.5 });
      await fireEvent.mouseDown(button);
      await waitForFrames();

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('options', () => {
    it.each([
      { name: 'the click path', event: 'click' },
      { name: 'the mousedown path', event: 'mousedown' },
    ] as const)('opens no popup by $name while enabled is false', async ({ event }) => {
      const onOpenChange = vi.fn();
      await render(<App enabled={false} event={event} onOpenChange={onOpenChange} />);

      await pressMouse(screen.getByRole('button'));
      await waitForFrames();

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('applies `enabled` to the next press', async () => {
      const enabled = shallowRef(false);
      await render(<App enabled={enabled} />);
      const button = screen.getByRole('button');

      await click(button);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      enabled.value = true;
      await click(button);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('applies `event` to the next press', async () => {
      const event = shallowRef<'click' | 'mousedown'>('click');
      await render(<App event={event} />);
      const button = screen.getByRole('button');

      await pressMouseDown(button);
      await waitForFrames();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      event.value = 'mousedown';
      await pressMouseDown(button);
      await waitForFrames();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('applies `toggle` to the next press', async () => {
      const toggle = shallowRef(true);
      await render(<App toggle={toggle} />);
      const button = screen.getByRole('button');

      await click(button);
      toggle.value = false;
      await click(button);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('applies `touchOpenDelay` to the next press', async () => {
      useFakeTimers();
      const touchOpenDelay = shallowRef(0);
      await render(<App touchOpenDelay={touchOpenDelay} />);
      const button = screen.getByRole('button');

      await pressTouch(button);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await pressTouch(button);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      touchOpenDelay.value = 100;
      await pressTouch(button);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      vi.advanceTimersByTime(100);
      await flushMicrotasks();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('a press that waits', () => {
    const waits = [
      { name: 'the touch delay', props: { touchOpenDelay: 100 }, press: pressTouch },
      { name: 'the frame', props: { event: 'mousedown' }, press: pressMouseDown },
    ] as const;

    it.each(waits)(
      'does not open the popup when KeepAlive deactivates the part during $name',
      async ({ props, press }) => {
        useFakeTimers();
        const onOpenChange = vi.fn();
        const page = shallowRef('trigger');
        await render(() => (
          <KeepAlive>
            {page.value === 'trigger' ? (
              <App key="trigger" {...props} onOpenChange={onOpenChange} />
            ) : (
              <Other key="other" />
            )}
          </KeepAlive>
        ));
        await press(screen.getByRole('button'));

        page.value = 'other';
        await nextTick();
        await runWaits();
        page.value = 'trigger';
        await nextTick();
        await runWaits();

        expect(onOpenChange).not.toHaveBeenCalled();
      },
    );

    it.each(waits)(
      'does not open the popup when the part unmounts during $name',
      async ({ props, press }) => {
        useFakeTimers();
        const onOpenChange = vi.fn();
        const { unmount } = await render(<App {...props} onOpenChange={onOpenChange} />);
        await press(screen.getByRole('button'));

        unmount();
        await runWaits();

        expect(onOpenChange).not.toHaveBeenCalled();
      },
    );
  });
});
