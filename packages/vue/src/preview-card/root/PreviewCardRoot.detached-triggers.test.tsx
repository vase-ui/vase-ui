import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { UserEvent } from '@testing-library/user-event';
import {
  createRenderer,
  detachedTriggersConformanceTests,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  nextEvent,
  randomStringValue,
  screen,
  waitFor,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as PreviewCard from '../index.parts';
import { OPEN_DELAY } from '../utils/constants';

type Details = PreviewCard.Root.ChangeEventDetails;

// Long enough that a slow run cannot end the exit before the case enters a trigger again. A case
// that needs a finished close ends the exit itself.
const CLOSE_TRANSITION_MS = 100_000;

function closeTransitionStyle(name: string) {
  return `
    @keyframes ${name} {
      from { opacity: 1; }
      to { opacity: 0.01; }
    }
    [data-testid="popup"][data-ending-style] {
      animation: ${name} ${CLOSE_TRANSITION_MS}ms linear forwards;
    }
  `;
}

// As the `autoFocus` button of Base UI, the button has the focus before the case starts.
function focusInitialButton() {
  screen.getByRole('button', { name: 'Initial focus' }).focus();
}

/**
 * Records the time from the next `mouseenter` of the trigger to the next open of the card. The
 * open delay runs on a timer, so the case reads the time after the card is open.
 */
function measureOpenDelay(trigger: HTMLElement, openTimes: number[]) {
  let enterTime = Number.NaN;
  const openCount = openTimes.length;
  trigger.addEventListener(
    'mouseenter',
    () => {
      enterTime = performance.now();
    },
    { once: true },
  );
  return () => {
    expect(openTimes.length).toBeGreaterThan(openCount);
    return openTimes[openCount] - enterTime;
  };
}

function finishExit(popup: HTMLElement) {
  for (const animation of popup.getAnimations()) {
    animation.finish();
  }
}

async function startExit(user: UserEvent, trigger: HTMLElement, name: string) {
  // The ending style lasts only while the exit runs, so the case waits for the start of the exit.
  const exit = await nextEvent(screen.getByTestId('popup'), 'animationstart', {
    action: () => user.unhover(trigger),
  });
  expect((exit as AnimationEvent).animationName).toBe(name);
}

describe('<PreviewCard.Root />', () => {
  const { render } = createRenderer();

  detachedTriggersConformanceTests({
    render,
    createHandle: PreviewCard.createHandle,
    Root: PreviewCard.Root,
    Trigger: PreviewCard.Trigger,
    Portal: PreviewCard.Portal,
    Positioner: PreviewCard.Positioner,
    Popup: PreviewCard.Popup,
    // Keeps the real browser pointer from hovering the triggers; the suite dispatches the events.
    triggerProps: { href: '#', delay: 0, closeDelay: 0, style: { pointerEvents: 'none' } },
    openInteractions: ['hover', 'focus'],
    ariaExpanded: false,
    throwOnMissingTrigger: true,
  });

  describe('does not re-render inactive triggers', () => {
    async function renderPreviewCard() {
      const handle = PreviewCard.createHandle();
      const bystander = { renders: 0 };

      await render(
        <div>
          <PreviewCard.Trigger handle={handle} id="trigger-1" href="#" delay={0} closeDelay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger handle={handle} id="trigger-2" href="#" delay={0} closeDelay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger
            handle={handle}
            id="trigger-3"
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => {
                bystander.renders += 1;
                return <a {...props}>Trigger 3</a>;
              },
            }}
          />
          <PreviewCard.Root handle={handle}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );

      bystander.renders = 0;
      return {
        handle,
        bystander,
        trigger1: screen.getByText('Trigger 1'),
        trigger2: screen.getByText('Trigger 2'),
      };
    }

    async function expectOpenedBy(trigger: HTMLElement) {
      expect(await screen.findByTestId('popup')).not.toBe(null);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-popup-open');
      });
    }

    async function expectClosed(trigger: HTMLElement) {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(trigger).not.toHaveAttribute('data-popup-open');
    }

    it('when opened and closed imperatively', async () => {
      const { handle, bystander, trigger1 } = await renderPreviewCard();

      async function openAndClose() {
        handle.open('trigger-1');
        await flushMicrotasks();
        await expectOpenedBy(trigger1);
        handle.close();
        await flushMicrotasks();
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when the popup moves to another trigger', async () => {
      const { handle, bystander, trigger1, trigger2 } = await renderPreviewCard();

      handle.open('trigger-1');
      await flushMicrotasks();
      await expectOpenedBy(trigger1);
      handle.open('trigger-2');
      await flushMicrotasks();
      await expectOpenedBy(trigger2);
      expect(trigger1).not.toHaveAttribute('data-popup-open');
      handle.close();
      await flushMicrotasks();
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });

    it('when focus opens and closes the popup', async () => {
      const { bystander, trigger1 } = await renderPreviewCard();

      async function openAndClose() {
        trigger1.focus();
        await flushMicrotasks();
        await expectOpenedBy(trigger1);
        trigger1.blur();
        await flushMicrotasks();
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when hover opens and closes the popup', async () => {
      const { bystander, trigger1, trigger2 } = await renderPreviewCard();

      await fireEvent.mouseEnter(trigger1);
      await fireEvent.mouseMove(trigger1);
      await expectOpenedBy(trigger1);
      await fireEvent.mouseLeave(trigger1);
      await fireEvent.mouseEnter(trigger2);
      await fireEvent.mouseMove(trigger2);
      await expectOpenedBy(trigger2);
      await fireEvent.mouseLeave(trigger2);
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });
  });

  describe.skipIf(isJSDOM)('handle-backed root ownership', () => {
    it('keeps a default-open root open while a detached trigger migrates after the initial commit', async () => {
      const handle = PreviewCard.createHandle();
      const onOpenChange = vi.fn();

      await render(
        <>
          <PreviewCard.Root
            handle={handle}
            defaultOpen
            defaultTriggerId="trigger"
            onOpenChange={onOpenChange}
          >
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="default-open-content">Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
          <PreviewCard.Trigger handle={handle} id="trigger" href="#">
            Trigger
          </PreviewCard.Trigger>
        </>,
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Trigger' })).toHaveAttribute('data-popup-open');
      });

      expect(handle.isOpen).toBe(true);
      expect(screen.getByTestId('default-open-content')).toHaveAttribute('data-open');
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the preview card immediately when hovering another trigger', async () => {
      const popupId = randomStringValue();
      const { user } = await render(
        <PreviewCard.Root>
          {{
            default: ({ payload }: NumberPayload) => (
              <>
                <button type="button" aria-label="Initial focus" />
                <PreviewCard.Trigger href="#" delay={0} payload={1}>
                  Trigger 1
                </PreviewCard.Trigger>

                {/* delay should be ignored when moving from already active trigger */}
                <PreviewCard.Trigger href="#" delay={2000} payload={2}>
                  Trigger 2
                </PreviewCard.Trigger>

                <PreviewCard.Portal>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup data-testid={popupId}>Content: {payload}</PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </>
            ),
          }}
        </PreviewCard.Root>,
      );
      focusInitialButton();

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
      expect(screen.getByTestId(popupId).textContent).toBe('Content: 1');

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId(popupId).textContent).toBe('Content: 2');
      });
      expect(screen.queryByTestId(popupId)).toBeVisible();
    });

    it('should open again after escape when focusing another trigger', async () => {
      const popupId = randomStringValue();
      const { user } = await render(
        <PreviewCard.Root>
          <button type="button" aria-label="Initial focus" />
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid={popupId}>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      focusInitialButton();

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      trigger1.focus();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });

      trigger2.focus();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
    });

    it('should switch immediately when focusing another trigger while open', async () => {
      await render(
        <PreviewCard.Root>
          {{
            default: ({ payload }: NumberPayload) => (
              <>
                <button type="button" aria-label="Initial focus" />
                <PreviewCard.Trigger href="#" payload={1} delay={0}>
                  Trigger 1
                </PreviewCard.Trigger>
                <PreviewCard.Trigger href="#" payload={2} delay={2000}>
                  Trigger 2
                </PreviewCard.Trigger>

                <PreviewCard.Portal>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup>
                      <span data-testid="content">{payload}</span>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </>
            ),
          }}
        </PreviewCard.Root>,
      );
      focusInitialButton();

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      trigger1.focus();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      trigger2.focus();
      await flushMicrotasks();
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    async function renderTwoTriggers(onOpenChange?: (open: boolean, details: Details) => void) {
      const showFirstTrigger = shallowRef(true);

      const Test = defineComponent(() => () => (
        <div style={{ padding: '50px' }}>
          <PreviewCard.Root defaultOpen defaultTriggerId="trigger-1" onOpenChange={onOpenChange}>
            {{
              default: ({ payload }: NumberPayload) => (
                <>
                  <button type="button" aria-label="Initial focus" />
                  <div style={{ display: 'flex', gap: '120px' }}>
                    {showFirstTrigger.value && (
                      <PreviewCard.Trigger href="#" id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </PreviewCard.Trigger>
                    )}
                    <PreviewCard.Trigger href="#" id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </PreviewCard.Trigger>
                  </div>

                  <PreviewCard.Portal>
                    <PreviewCard.Positioner side="bottom" align="start">
                      <PreviewCard.Popup>
                        <span data-testid="content">{payload}</span>
                      </PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </>
              ),
            }}
          </PreviewCard.Root>
        </div>
      ));

      await render(<Test />);
      focusInitialButton();
      return function removeFirstTrigger() {
        showFirstTrigger.value = false;
      };
    }

    it('should close when the active trigger unmounts', async () => {
      const removeFirstTrigger = await renderTwoTriggers();

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      removeFirstTrigger();
      await flushMicrotasks();

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should remain open when the active trigger unmount close is canceled', async () => {
      const onOpenChange = vi.fn((nextOpen: boolean, details: Details) => {
        if (!nextOpen) {
          details.cancel();
        }
      });
      const removeFirstTrigger = await renderTwoTriggers(onOpenChange);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      removeFirstTrigger();
      await flushMicrotasks();

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'none' }),
        );
      });
      expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('content')).toHaveTextContent('1');
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    it('should reposition to a different trigger when reopened with keepMounted=true', async () => {
      const previewCardHandle = PreviewCard.createHandle();
      const { user } = await render(
        <div style={{ margin: '50px' }}>
          <PreviewCard.Trigger href="#" handle={previewCardHandle} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={previewCardHandle} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={previewCardHandle}>
            <PreviewCard.Portal keepMounted>
              <PreviewCard.Positioner data-testid="positioner" side="bottom" align="start">
                <PreviewCard.Popup>Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const positioner = screen.getByTestId('positioner');

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.getByText('Content')).toBeVisible();
      });

      await waitFor(() => {
        expect(
          Math.abs(positioner.getBoundingClientRect().left - trigger1.getBoundingClientRect().left),
        ).toBeLessThanOrEqual(1);
      });

      await user.unhover(trigger1);

      await waitFor(() => {
        expect(positioner).toHaveAttribute('hidden');
      });

      await user.hover(trigger2);

      await waitFor(() => {
        expect(screen.getByText('Content')).toBeVisible();
      });

      await waitFor(() => {
        expect(
          Math.abs(positioner.getBoundingClientRect().left - trigger2.getBoundingClientRect().left),
        ).toBeLessThanOrEqual(1);
      });
    });

    it('should close when the active detached trigger unmounts', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      const showFirstTrigger = shallowRef(true);

      const Test = defineComponent(() => () => (
        <div style={{ padding: '50px' }}>
          <button type="button" aria-label="Initial focus" />
          <div style={{ display: 'flex', gap: '120px' }}>
            {showFirstTrigger.value && (
              <PreviewCard.Trigger
                href="#"
                handle={testPreviewCard}
                id="trigger-1"
                payload={1}
                delay={0}
              >
                Trigger 1
              </PreviewCard.Trigger>
            )}
            <PreviewCard.Trigger
              href="#"
              handle={testPreviewCard}
              id="trigger-2"
              payload={2}
              delay={0}
            >
              Trigger 2
            </PreviewCard.Trigger>
          </div>

          <PreviewCard.Root handle={testPreviewCard} defaultOpen defaultTriggerId="trigger-1">
            {{
              default: ({ payload }: NumberPayload) => (
                <PreviewCard.Portal>
                  <PreviewCard.Positioner side="bottom" align="start">
                    <PreviewCard.Popup>
                      <span data-testid="content">{payload}</span>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              ),
            }}
          </PreviewCard.Root>
        </div>
      ));

      await render(<Test />);
      focusInitialButton();

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      showFirstTrigger.value = false;
      await flushMicrotasks();

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    async function renderAnimatedCard(name: string, triggerDelays: number[]) {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const testPreviewCard = PreviewCard.createHandle<number>();
      const openTimes: number[] = [];
      const onOpenChangeComplete = vi.fn();

      const { user } = await render(
        <>
          <style>{closeTransitionStyle(name)}</style>
          <button type="button" aria-label="Initial focus" />
          {triggerDelays.map((delay, index) => (
            <PreviewCard.Trigger
              key={index}
              href="#"
              handle={testPreviewCard}
              payload={index + 1}
              delay={delay}
            >
              {`Trigger ${index + 1}`}
            </PreviewCard.Trigger>
          ))}

          <PreviewCard.Root
            handle={testPreviewCard}
            onOpenChange={(open: boolean) => {
              if (open) {
                openTimes.push(performance.now());
              }
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            {{
              default: ({ payload }: NumberPayload) => (
                <PreviewCard.Portal keepMounted>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup data-testid="popup">
                      <span data-testid="content">{payload}</span>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              ),
            }}
          </PreviewCard.Root>
        </>,
      );
      focusInitialButton();

      return { user, openTimes, onOpenChangeComplete };
    }

    it('opens immediately when entering trigger B during trigger A close transition', async () => {
      const name = 'preview-card-a-to-b-close-transition';
      const { user, openTimes } = await renderAnimatedCard(name, [0, OPEN_DELAY]);

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await startExit(user, trigger1, name);

      const openDelay = measureOpenDelay(trigger2, openTimes);
      await user.hover(trigger2);

      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
      expect(openDelay()).toBeLessThan(OPEN_DELAY / 2);
    });

    it('still respects trigger B open delay after trigger A close transition finishes', async () => {
      const name = 'preview-card-a-to-b-post-close-delay';
      const { user, openTimes, onOpenChangeComplete } = await renderAnimatedCard(name, [
        0,
        OPEN_DELAY,
      ]);

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await startExit(user, trigger1, name);

      // Once close transition is done, this should behave like a normal delayed open.
      finishExit(screen.getByTestId('popup'));
      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-ending-style');

      const openDelay = measureOpenDelay(trigger2, openTimes);
      await user.hover(trigger2);

      // Must not open immediately once close transition has finished.
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
      expect(openDelay()).toBeGreaterThanOrEqual(OPEN_DELAY / 2);
    });

    it('reopens immediately when re-hovering trigger A during its close transition', async () => {
      const name = 'preview-card-reopen-during-close';
      const { user, openTimes } = await renderAnimatedCard(name, [OPEN_DELAY]);

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await startExit(user, trigger1, name);

      const openDelay = measureOpenDelay(trigger1, openTimes);
      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
      expect(openDelay()).toBeLessThan(OPEN_DELAY / 2);
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');
      expect(screen.getByTestId('content').textContent).toBe('1');
    });

    it('respects open delay on later same-trigger hovers after close lifecycle finishes', async () => {
      const name = 'preview-card-reopen-during-close-delay';
      const { user, openTimes, onOpenChangeComplete } = await renderAnimatedCard(name, [
        OPEN_DELAY,
      ]);

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });

      // First cycle: close and immediate re-hover during close lifecycle should reopen.
      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });
      await startExit(user, trigger1, name);
      const firstOpenDelay = measureOpenDelay(trigger1, openTimes);
      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
      expect(firstOpenDelay()).toBeLessThan(OPEN_DELAY / 2);
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');

      // Second cycle: once close lifecycle has fully finished, a fresh hover must honor OPEN_DELAY.
      await startExit(user, trigger1, name);
      expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      finishExit(screen.getByTestId('popup'));
      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-ending-style');

      const secondOpenDelay = measureOpenDelay(trigger1, openTimes);
      await user.hover(trigger1);

      // Should not reopen immediately this time.
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
      expect(secondOpenDelay()).toBeGreaterThanOrEqual(OPEN_DELAY / 2);
    });
  });
});
