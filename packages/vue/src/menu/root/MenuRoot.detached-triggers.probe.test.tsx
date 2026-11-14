// A temporary probe of the hover close of `MenuRoot.detached-triggers.test.tsx`. The next commit removes it.
// It repeats the case REPEATS times and logs every transition event, attribute change, open
// change and pointer boundary event after the unhover. A case that fails prints its log.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createRenderer,
  isJSDOM,
  nextAnimationsRead,
  nextEvent,
  screen,
  waitFor,
  waitForPositioned,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Menu from '../index.parts';

const LONG_ANIMATION_MS = 100_000;
const REPEATS = 300;

const styles = `
  .positioner { transition: top 120ms linear, left 120ms linear, transform 120ms linear; }
  .popup { opacity: 1; transition: opacity ${LONG_ANIMATION_MS}ms linear; }
  .popup[data-ending-style] { opacity: 0; }
  .positioner[data-instant], .popup[data-instant] { transition: none; }
`;

describe.skipIf(isJSDOM)('probe: hover close after a trigger switch', () => {
  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
  });

  const { render } = createRenderer();

  it.each(Array.from({ length: REPEATS }, (_, index) => ({ name: String(index) })))(
    'repeat $name',
    async () => {
      const log: unknown[] = [];
      const start = performance.now();
      const now = () => Math.round((performance.now() - start) * 10) / 10;
      let recording = false;
      const testMenu = Menu.createHandle<number>();
      const describeTarget = (target: EventTarget | null) =>
        target instanceof Element
          ? (target.getAttribute('data-testid') ?? target.textContent?.slice(0, 12) ?? target.tagName.toLowerCase())
          : String(target);
      const onPointer = (event: MouseEvent) => {
        if (recording || event.isTrusted) {
          log.push({
            t: now(),
            type: event.type,
            trusted: event.isTrusted,
            target: describeTarget(event.target),
            x: event.clientX,
            y: event.clientY,
          });
        }
      };
      const pointerTypes = [
        'pointerover',
        'pointerout',
        'pointerenter',
        'pointerleave',
        'mouseover',
        'mouseout',
        'mouseenter',
        'mouseleave',
        'mousemove',
        'pointermove',
      ];
      for (const type of pointerTypes) {
        document.addEventListener(type, onPointer as EventListener, true);
      }

      const utils = await render(
        <div style={{ position: 'relative', width: '400px', height: '200px' }}>
          <style>{styles}</style>
          <Menu.Trigger
            handle={testMenu}
            payload={1}
            openOnHover
            delay={0}
            style={{ position: 'absolute', top: '20px', left: '20px' }}
          >
            Trigger 1
          </Menu.Trigger>
          <Menu.Trigger
            handle={testMenu}
            payload={2}
            openOnHover
            delay={0}
            style={{ position: 'absolute', top: '20px', left: '220px' }}
          >
            Trigger 2
          </Menu.Trigger>
          <Menu.Root
            handle={testMenu}
            onOpenChange={(open: boolean, details: Menu.Root.ChangeEventDetails) => {
              log.push({ t: now(), openChange: open, reason: details.reason, event: details.event?.type, trusted: details.event?.isTrusted });
            }}
          >
            {{
              default: ({ payload }: { payload: number | undefined }) => (
                <Menu.Portal>
                  <Menu.Positioner data-testid="positioner" class="positioner">
                    <Menu.Popup
                      data-testid="popup"
                      class="popup"
                      v-slots={{
                        render: ({ props }: { props: HTMLProps; state: Menu.Popup.State }) => (
                          <div {...props}>
                            <Menu.Item data-testid="content">{payload}</Menu.Item>
                          </div>
                        ),
                      }}
                    />
                  </Menu.Positioner>
                </Menu.Portal>
              ),
            }}
          </Menu.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await utils.user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });
      const positioner = screen.getByTestId('positioner');
      await waitForPositioned(positioner);
      await waitFor(() => {
        expect(positioner.style.transition).not.toBe('none');
      });
      await nextAnimationsRead(positioner, { action: () => utils.user.hover(trigger2) });
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'trigger-change');
      });

      const popup = screen.getByTestId('popup');
      const popupState = () => ({
        ending: popup.hasAttribute('data-ending-style'),
        instant: popup.getAttribute('data-instant'),
        open: popup.hasAttribute('data-open'),
        connected: popup.isConnected,
      });
      const onTransition = (event: TransitionEvent) => {
        log.push({
          t: now(),
          type: event.type,
          target: describeTarget(event.target),
          property: event.propertyName,
          elapsed: event.elapsedTime,
          ...popupState(),
        });
      };
      const transitionTypes = ['transitionrun', 'transitionstart', 'transitioncancel', 'transitionend'];
      for (const type of transitionTypes) {
        document.addEventListener(type, onTransition as EventListener, true);
      }
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          log.push({ t: now(), attribute: record.attributeName, ...popupState() });
        }
      });
      observer.observe(popup, {
        attributeFilter: ['data-ending-style', 'data-instant', 'data-open', 'data-closed'],
      });

      log.push({ t: now(), mark: 'unhover', ...popupState() });
      recording = true;
      const event = await nextEvent(popup, 'transitionrun', {
        action: () => utils.user.unhover(trigger2),
      });
      const ending = popup.hasAttribute('data-ending-style');
      log.push({ t: now(), mark: 'resolved', target: describeTarget(event.target), ...popupState() });

      observer.disconnect();
      for (const type of transitionTypes) {
        document.removeEventListener(type, onTransition as EventListener, true);
      }
      for (const type of pointerTypes) {
        document.removeEventListener(type, onPointer as EventListener, true);
      }

      if (!ending) {
        console.log(`PROBE FAILURE\n${JSON.stringify(log, null, 1)}`);
      }
      expect(ending).toBe(true);
    },
  );
});
