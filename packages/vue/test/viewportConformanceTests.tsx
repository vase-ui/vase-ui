import { defineComponent, nextTick, shallowRef } from 'vue';
import type { CSSProperties, VNode, VNodeChild } from 'vue';
import type { UserEvent } from '@testing-library/user-event';
import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import { screen } from './queries';
import { waitFor } from './waitFor';
import TextDirectionProvider from '../src/internals/direction-context/TextDirectionProvider.test.vue';
import { isJSDOM } from '../src/common/testUtils';
import type { Side } from '../src/internals/useAnchorPositioning';
import { nextAnimationsRead, nextEndingStyle, nextEvent } from './animation';
import { waitForLaterMillisecond } from './createRenderer';
import type { createRenderer } from './createRenderer';
import { flushMicrotasks } from './flushMicrotasks';
import { wait, waitSingleFrame } from './wait';

// The cases end each transition with `finish()`, so each transition lasts 100 s.
const morphTransitionStyles = `
  [data-transitioning] [data-current] {
    transition: transform 100s linear, opacity 100s linear;
  }
  [data-transitioning] [data-current][data-starting-style] {
    transform: translateX(30%);
    opacity: 0;
  }
  [data-transitioning] [data-previous] {
    transition: transform 100s linear, opacity 100s linear;
  }
  [data-transitioning] [data-previous][data-ending-style] {
    transform: translateX(-30%);
    opacity: 0;
  }
`;

/**
 * Tests the morphing behavior that `usePopupViewport` gives every `*.Viewport` part:
 * the `current`/`previous` containers, the transition attributes, and popup anchoring.
 */
export function viewportConformanceTests(config: ViewportTestConfig) {
  const { createComponent, render, openOn } = config;

  async function activateTrigger(trigger: HTMLElement, user: UserEvent) {
    if (openOn === 'click') {
      await user.click(trigger);
      return;
    }

    await waitSingleFrame();
    trigger.focus();
    // The focus out of another trigger starts a 0 ms timer that must not close the popup.
    await wait(0);
  }

  describe('Viewport conformance', () => {
    it('renders children in the `current` container by default', async () => {
      await render(
        createComponent({
          root: { open: true },
          triggers: [{ children: 'Trigger' }],
          viewport: { 'data-testid': 'viewport' },
          renderContent: () => <div data-testid="content">Content</div>,
        }),
      );

      const currentContainer = (await screen.findByTestId('content')).closest('[data-current]');
      expect(currentContainer).not.toBe(null);
      expect(currentContainer!.textContent).toBe('Content');
      expect(document.querySelector('[data-previous]')).toBe(null);

      const viewport = screen.getByTestId('viewport');
      expect(viewport).not.toHaveAttribute('data-transitioning');
      expect(viewport).not.toHaveAttribute('data-activation-direction');
    });

    it('remounts the `current` container when the active trigger changes', async () => {
      const { user } = await render(
        createComponent({
          triggers: [
            { payload: 'first', 'data-testid': 'trigger1', children: 'Trigger 1' },
            { payload: 'second', 'data-testid': 'trigger2', children: 'Trigger 2' },
          ],
          renderContent: (payload) => [
            payload === 'first' ? (
              <img data-testid="payload-image-1" src="about:blank" alt="Preview 1" />
            ) : null,
            payload === 'second' ? (
              <img data-testid="payload-image-2" src="about:blank" alt="Preview 2" />
            ) : null,
          ],
        }),
      );

      const firstImage = await waitForLaterMillisecond(async () => {
        await activateTrigger(screen.getByTestId('trigger1'), user);
        return screen.findByTestId('payload-image-1');
      });
      const firstContainer = firstImage.closest('[data-current]');
      expect(firstContainer).not.toBe(null);

      await activateTrigger(screen.getByTestId('trigger2'), user);

      await waitFor(() => {
        expect(screen.getByTestId('payload-image-2').closest('[data-current]')).not.toBe(null);
      });
      expect(screen.getByTestId('payload-image-2').closest('[data-current]')).not.toBe(
        firstContainer,
      );
    });

    it('does not restart a transition when the active trigger remounts while closed and retained (strict: $strict)', async () => {
      const Test = defineComponent({
        props: { triggerKey: { type: String, required: true } },
        setup: (props) => () =>
          createComponent({
            root: {
              defaultOpen: true,
              defaultTriggerId: 'trigger',
              onOpenChange: (open, eventDetails) => {
                if (!open) {
                  eventDetails.preventUnmountOnClose();
                }
              },
            },
            triggers: [{ key: props.triggerKey, id: 'trigger', children: 'Trigger' }],
            popup: { 'data-testid': 'popup' },
            viewport: { 'data-testid': 'viewport' },
            renderContent: () => 'Content',
          }),
      });

      const { user, rerender } = await render(<Test triggerKey="a" />);

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      });

      await rerender(<Test triggerKey="b" />);

      expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      expect(screen.getByTestId('viewport')).not.toHaveAttribute('data-transitioning');
      expect(document.querySelector('[data-previous]')).toBe(null);
    });

    it.each([
      {
        side: 'top',
        direction: 'ltr',
        expected: { position: 'absolute', bottom: '0px', left: '0px' },
      },
      {
        side: 'top',
        direction: 'rtl',
        expected: { position: 'absolute', bottom: '0px', left: '0px' },
      },
      { side: 'bottom', direction: 'ltr', expected: {} },
      { side: 'bottom', direction: 'rtl', expected: {} },
      {
        side: 'left',
        direction: 'ltr',
        expected: { position: 'absolute', top: '0px', right: '0px' },
      },
      {
        side: 'left',
        direction: 'rtl',
        expected: { position: 'absolute', top: '0px', right: '0px' },
      },
      { side: 'right', direction: 'ltr', expected: {} },
      { side: 'right', direction: 'rtl', expected: {} },
      {
        side: 'inline-start',
        direction: 'ltr',
        expected: { position: 'absolute', top: '0px', right: '0px' },
      },
      { side: 'inline-start', direction: 'rtl', expected: {} },
      { side: 'inline-end', direction: 'ltr', expected: {} },
      {
        side: 'inline-end',
        direction: 'rtl',
        expected: { position: 'absolute', top: '0px', right: '0px' },
      },
    ] satisfies AnchoringCase[])(
      'anchors the popup for side=$side in $direction mode',
      async ({ side, direction, expected }) => {
        await render(
          <TextDirectionProvider direction={direction}>
            {createComponent({
              root: { open: true },
              triggers: [{ children: 'Trigger' }],
              positioner: { side, collisionAvoidance: { side: 'none' } },
              popup: { 'data-testid': 'popup' },
              renderContent: () => 'Content',
            })}
          </TextDirectionProvider>,
        );

        // The positioner shows the popup after its first position pass. The side is then final.
        const popup = await screen.findByTestId('popup');
        await waitFor(() => {
          expect(popup).toBeVisible();
        });

        const { style } = popup;
        expect(style.position).toBe(expected.position ?? '');
        expect(style.top).toBe(expected.top ?? '');
        expect(style.right).toBe(expected.right ?? '');
        expect(style.bottom).toBe(expected.bottom ?? '');
        expect(style.left).toBe(expected.left ?? '');
      },
    );

    describe.skipIf(isJSDOM)('morphing containers', () => {
      beforeEach(() => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      });

      afterEach(() => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
      });

      function renderPositionedTriggers(
        first: TriggerPosition,
        second: TriggerPosition,
        animationDuration: string,
      ) {
        return render(
          <div>
            <style>{getMorphAnimationStyles(animationDuration)}</style>
            {createComponent({
              triggers: [
                {
                  payload: 0,
                  'data-testid': 'trigger1',
                  style: getTriggerStyle(first),
                  children: 'Trigger 1',
                },
                {
                  payload: 1,
                  'data-testid': 'trigger2',
                  style: getTriggerStyle(second),
                  children: 'Trigger 2',
                },
              ],
              viewport: { 'data-testid': 'viewport' },
              renderContent: (payload) => (
                <div data-testid="content">Content {payload as number}</div>
              ),
            })}
          </div>,
        );
      }

      it('creates morphing containers during transitions', async () => {
        const { user } = await renderPositionedTriggers(
          { top: 10, left: 10 },
          { top: 100, left: 200 },
          '100s',
        );

        await waitForLaterMillisecond(async () => {
          await activateTrigger(screen.getByTestId('trigger1'), user);
          await waitFor(() => {
            expect(screen.getByText('Content 0')).toBeVisible();
          });
        });
        const viewport = screen.getByTestId('viewport');
        expect(viewport).not.toHaveAttribute('data-transitioning');
        expect(viewport).not.toHaveAttribute('data-activation-direction');

        await activateTrigger(screen.getByTestId('trigger2'), user);

        let previousContainer: HTMLElement | null = null;
        await waitFor(() => {
          previousContainer = document.querySelector('[data-previous]');
          expect(previousContainer).not.toBe(null);
        });

        expect(viewport).toHaveAttribute('data-transitioning', '');
        expect(getActivationDirectionTokens(viewport)).toEqual(['right', 'down']);
        expect(previousContainer).toHaveAttribute('inert');
        expect(previousContainer!.textContent).toBe('Content 0');
        expect(previousContainer!.style.getPropertyValue('--popup-width')).toMatch(
          /^\d+(?:\.\d+)?px$/,
        );
        expect(previousContainer!.style.getPropertyValue('--popup-height')).toMatch(
          /^\d+(?:\.\d+)?px$/,
        );

        const currentContainer = document.querySelector('[data-current]');
        expect(currentContainer).not.toBe(null);
        expect(currentContainer!.textContent).toBe('Content 1');

        // Allow `useAnimationsFinished` to begin waiting before the animations finish.
        await waitSingleFrame();
        await waitSingleFrame();
        // The part removes the previous container in the microtasks after the animations end.
        finishAnimations();
        await flushMicrotasks();
        expect(document.querySelector('[data-previous]')).toBe(null);

        expect(viewport).not.toHaveAttribute('data-transitioning');
        expect(document.querySelector('[data-current]')).toBeVisible();
        expect(screen.getByText('Content 1')).toBeVisible();
      });

      it('sets `data-activation-direction` from the previous to the new trigger', async () => {
        // `getActivationDirection` unit tests cover every direction and the tolerance.
        // This case checks the measured trigger centers reach the attribute.
        const { user } = await renderPositionedTriggers(
          { top: 100, left: 200 },
          { top: 10, left: 10 },
          '0.2s',
        );

        await waitForLaterMillisecond(async () => {
          await activateTrigger(screen.getByTestId('trigger1'), user);
          await waitFor(() => {
            expect(screen.getByText('Content 0')).toBeVisible();
          });
        });

        await activateTrigger(screen.getByTestId('trigger2'), user);

        await waitFor(() => {
          expect(getActivationDirectionTokens(screen.getByTestId('viewport'))).toEqual([
            'left',
            'up',
          ]);
        });
      });

      it('creates morphing containers after a kept-mounted popup closes and reopens', async () => {
        const open = shallowRef(false);
        const exitEnd = Promise.withResolvers<void>();

        const { user } = await render(() => (
          <div>
            <style>{getMorphAnimationStyles('100s')}</style>
            {createComponent({
              root: {
                open: open.value,
                onOpenChange: (nextOpen) => {
                  open.value = nextOpen;
                },
                onOpenChangeComplete: (nextOpen) => {
                  if (!nextOpen) {
                    exitEnd.resolve();
                  }
                },
              },
              triggers: [
                { payload: 0, 'data-testid': 'trigger1', children: 'Trigger 1' },
                { payload: 1, 'data-testid': 'trigger2', children: 'Trigger 2' },
              ],
              portal: { keepMounted: true },
              popup: { 'data-testid': 'popup' },
              renderContent: (payload) => `Content ${payload as number}`,
            })}
          </div>
        ));

        const trigger1 = screen.getByTestId('trigger1');
        const trigger2 = screen.getByTestId('trigger2');

        await activateTrigger(trigger1, user);
        await waitFor(() => {
          expect(screen.getByText('Content 0')).toBeVisible();
        });

        await activateTrigger(trigger2, user);
        await waitFor(() => {
          expect(document.querySelector('[data-previous]')).not.toBe(null);
        });
        // Allow `useAnimationsFinished` to begin waiting before the animations finish.
        await waitSingleFrame();
        await waitSingleFrame();
        finishAnimations();
        await flushMicrotasks();
        expect(document.querySelector('[data-previous]')).toBe(null);

        open.value = false;
        await exitEnd.promise;
        // A kept-mounted positioner gets `hidden` when the exit completes.
        await waitFor(() => {
          expect(screen.getByTestId('popup').closest('[hidden]')).toBeInstanceOf(HTMLElement);
        });
        expect(screen.getByTestId('popup')).not.toHaveAttribute('data-ending-style');

        await activateTrigger(trigger1, user);
        await waitFor(() => {
          expect(screen.getByText('Content 0')).toBeVisible();
        });

        await activateTrigger(trigger2, user);

        let previousContainer: HTMLElement | null = null;
        await waitFor(() => {
          previousContainer = document.querySelector('[data-previous]');
          expect(previousContainer).not.toBe(null);
        });

        expect(previousContainer!.textContent).toBe('Content 0');
        finishAnimations();
        await waitFor(() => {
          expect(screen.getByText('Content 1')).toBeVisible();
        });
      });

      it('shows the latest content after rapid trigger changes', async () => {
        const { user } = await render(
          <div>
            <style>{getMorphAnimationStyles('100s')}</style>
            {createComponent({
              triggers: [
                { payload: 1, 'data-testid': 'trigger1', children: 'Trigger 1' },
                { payload: 2, 'data-testid': 'trigger2', children: 'Trigger 2' },
                { payload: 3, 'data-testid': 'trigger3', children: 'Trigger 3' },
              ],
              renderContent: (payload) => `Content ${payload as number}`,
            })}
          </div>,
        );

        const trigger1 = screen.getByTestId('trigger1');

        await waitForLaterMillisecond(async () => {
          await activateTrigger(trigger1, user);
          await screen.findByText('Content 1', { selector: '[data-current]' });
        });
        await activateTrigger(screen.getByTestId('trigger2'), user);
        // A trigger that opens on `mousedown`, such as `Menu.Trigger`, changes the popup in the
        // frame after the press. On a busy page, the clicks can end before that frame. Wait for
        // `Content 3`, so that `Content 1` comes only from the last click.
        await waitForLaterMillisecond(async () => {
          await activateTrigger(screen.getByTestId('trigger3'), user);
          await screen.findByText('Content 3', { selector: '[data-current]' });
        });
        await activateTrigger(trigger1, user);

        const content = await screen.findByText('Content 1', { selector: '[data-current]' });
        finishAnimations();
        await waitFor(() => {
          expect(content).toBeVisible();
        });
      });

      it('keeps the latest transition active during rapid trigger changes', async () => {
        const { user } = await render(
          <div>
            <style>{getMorphAnimationStyles('100s')}</style>
            {createComponent({
              triggers: [
                { payload: 1, 'data-testid': 'trigger1', children: 'Trigger 1' },
                { payload: 2, 'data-testid': 'trigger2', children: 'Trigger 2' },
                { payload: 3, 'data-testid': 'trigger3', children: 'Trigger 3' },
              ],
              viewport: { 'data-testid': 'viewport' },
              renderContent: (payload) => `Content ${payload as number}`,
            })}
          </div>,
        );

        await activateTrigger(screen.getByTestId('trigger1'), user);
        await waitFor(() => {
          expect(screen.getByText('Content 1')).toBeVisible();
        });
        // The containers have an animation only while the viewport transitions, so the first
        // `animationstart` comes from the morph.
        await waitForLaterMillisecond(() =>
          nextEvent(screen.getByTestId('viewport'), 'animationstart', {
            action: () => activateTrigger(screen.getByTestId('trigger2'), user),
          }),
        );
        // Allow `useAnimationsFinished` to begin waiting before replacing the current container.
        await waitSingleFrame();
        const secondContainer = screen.getByText('Content 2').closest('[data-current]');
        expect(secondContainer?.getAnimations()).toHaveLength(1);

        // The viewport keeps one container for the previous content, and that container has the
        // ending style of the first switch. A frame after the switch, the containers move from
        // starting to ending styles. The wait resolves only for an ending style of this switch.
        const previousContainer = document.querySelector('[data-previous]')!;
        await nextEndingStyle(previousContainer, {
          action: () => activateTrigger(screen.getByTestId('trigger3'), user),
        });

        const currentContainer = screen.getByText('Content 3').closest('[data-current]');
        expect(currentContainer?.getAnimations()).toHaveLength(1);
        expect(screen.getByTestId('viewport')).toHaveAttribute('data-transitioning', '');
        expect(document.querySelector('[data-previous]')).toHaveTextContent('Content 2');
        expect(document.querySelector('[data-previous]')).toHaveAttribute('data-ending-style', '');
        expect(currentContainer).not.toHaveAttribute('data-starting-style');
      });

      it('cleans up the transition when a lagging payload remounts the current container', async () => {
        const payload2 = shallowRef<string | undefined>(undefined);

        const { user } = await render(() => (
          <div>
            <style>{morphTransitionStyles}</style>
            {createComponent({
              triggers: [
                {
                  'data-testid': 'trigger1',
                  style: getTriggerStyle({ top: 10, left: 10 }),
                  children: 'Trigger 1',
                },
                {
                  payload: payload2.value,
                  'data-testid': 'trigger2',
                  style: getTriggerStyle({ top: 100, left: 200 }),
                  children: 'Trigger 2',
                },
              ],
              viewport: { 'data-testid': 'viewport' },
              renderContent: (payload) => `Content ${String(payload)}`,
            })}
          </div>
        ));

        await waitForLaterMillisecond(async () => {
          await activateTrigger(screen.getByTestId('trigger1'), user);
          await waitFor(() => {
            expect(document.querySelector('[data-current]')).not.toBe(null);
          });
        });
        const viewport = screen.getByTestId('viewport');
        const runs = recordTransitionRuns(viewport);

        // The morph is in progress: the previous snapshot exists and both containers
        // are running their (long) transitions.
        await nextEvent(viewport, 'transitionrun', {
          action: () => activateTrigger(screen.getByTestId('trigger2'), user),
        });
        // The browser sends the `transitionrun` events of one update together, before the next task.
        await flushMicrotasks();
        expect(runs).toContain(document.querySelector('[data-previous]'));
        expect(runs).toContain(document.querySelector('[data-current]'));

        // Allow `useAnimationsFinished` to begin waiting before the container is replaced.
        await waitSingleFrame();
        await waitSingleFrame();

        const containerBeforePayload = document.querySelector('[data-current]');

        // The payload for the already-active trigger arrives a render later, which
        // bumps the content key and remounts the current container mid-morph.
        payload2.value = 'ready';
        await nextTick();

        const remountedContainer = document.querySelector('[data-current]')!;
        expect(remountedContainer).not.toBe(containerBeforePayload);
        expect(remountedContainer.textContent).toBe('Content ready');

        // The remounted container must restart its entry transition, otherwise the
        // cleanup watcher finds nothing to await and truncates the exit transition.
        const awaitedAnimations = await nextAnimationsRead(remountedContainer);
        expect(awaitedAnimations.length).toBeGreaterThanOrEqual(1);

        // The previous container's exit transition is still running, so it must not
        // have been torn down in the frames right after the remount.
        await waitSingleFrame();
        await waitSingleFrame();
        await waitSingleFrame();
        await waitSingleFrame();
        expect(document.querySelector('[data-previous]')).not.toBe(null);

        // Finish the live animations so the cleanup watcher can settle.
        finishAnimations();
        await flushMicrotasks();
        expect(document.querySelector('[data-previous]')).toBe(null);

        expect(viewport).not.toHaveAttribute('data-transitioning');
      });
    });
  });
}

/**
 * `data-activation-direction` is a space-separated token list matched with `~=` selectors, so
 * compare its tokens rather than the exact string.
 */
function getActivationDirectionTokens(viewport: HTMLElement) {
  return (viewport.getAttribute('data-activation-direction') ?? '').split(' ').filter(Boolean);
}

function getMorphAnimationStyles(duration: string) {
  return `
    [data-transitioning] [data-previous] {
      animation: slide-out ${duration} ease-out forwards;
    }
    [data-transitioning] [data-current] {
      animation: slide-in ${duration} ease-out forwards;
    }
    @keyframes slide-out {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(-30%); opacity: 0; }
    }
    @keyframes slide-in {
      from { transform: translateX(30%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
}

function finishAnimations() {
  for (const container of document.querySelectorAll('[data-previous], [data-current]')) {
    container.getAnimations().forEach((animation) => animation.finish());
  }
}

/**
 * Records the target of each `transitionrun` event of the containers. A transition can end before
 * a case reads `getAnimations()`, and the record stays.
 */
function recordTransitionRuns(viewport: HTMLElement) {
  const targets: EventTarget[] = [];
  viewport.addEventListener('transitionrun', (event) => {
    if (event.target !== null) {
      targets.push(event.target);
    }
  });
  return targets;
}

interface TriggerPosition {
  top: number;
  left: number;
}

function getTriggerStyle({ top, left }: TriggerPosition): CSSProperties {
  return {
    position: 'absolute',
    top: `${top}px`,
    left: `${left}px`,
    width: '100px',
    height: '50px',
  };
}

interface AnchoringCase {
  side: Side;
  direction: 'ltr' | 'rtl';
  expected: Pick<CSSProperties, 'position' | 'top' | 'right' | 'bottom' | 'left'>;
}

export interface ViewportTestConfig {
  /**
   * Returns the component tree: a Root whose default slot receives the payload,
   * one Trigger per entry in `triggers`, and Portal > Positioner > Popup > Viewport,
   * with `renderContent(payload)` as the Viewport's children.
   * Spread each `props` entry on its part. Add props the component needs to open
   * instantly on `openOn` (for example `delay={0}`).
   */
  createComponent: (props: ViewportTestProps) => VNode;
  /**
   * Render function returned from `createRenderer`.
   */
  render: ReturnType<typeof createRenderer>['render'];
  /**
   * How a trigger opens the popup or switches it to that trigger.
   */
  openOn: 'click' | 'focus';
}

export interface ViewportTestProps {
  root?: {
    open?: boolean;
    defaultOpen?: boolean;
    defaultTriggerId?: string;
    onOpenChange?: (open: boolean, eventDetails: { preventUnmountOnClose(): void }) => void;
    onOpenChangeComplete?: (open: boolean) => void;
  };
  triggers: ViewportTestTriggerProps[];
  portal?: { keepMounted?: boolean };
  positioner?: { side?: Side; collisionAvoidance?: { side: 'none' } };
  popup?: { 'data-testid'?: string };
  viewport?: { 'data-testid'?: string };
  renderContent: (payload: unknown) => VNodeChild;
}

export interface ViewportTestTriggerProps {
  key?: string;
  id?: string;
  payload?: unknown;
  'data-testid'?: string;
  style?: CSSProperties;
  children: string;
}
