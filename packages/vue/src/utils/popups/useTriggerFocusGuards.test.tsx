import { beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, shallowRef } from 'vue';
import type { ShallowRef, VNodeChild } from 'vue';
import * as Dialog from '../../dialog/index.parts';
import * as Menu from '../../menu/index.parts';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { REASONS } from '../../internals/reasons';
import { createAttribute } from './createAttribute';
import type { FocusOption } from './focus/FloatingFocusManager.vue';

// The children of the element that holds a trigger, in document order. A guard of the trigger is a
// sibling of its element.
function listPlaceOfTrigger(host: Element) {
  return Array.from(host.children, (child) =>
    child.hasAttribute(createAttribute('focus-guard')) ? 'guard' : child.textContent,
  );
}

describe('useTriggerFocusGuards', () => {
  const { render } = createRenderer();

  // The cases press Tab with `userEvent` of `vitest/browser`. A native Tab runs a microtask
  // checkpoint between the blur of the trigger and the focus of the guard, and a synthetic event
  // does not.
  describe('Menu', () => {
    // The menu is controlled, so a case opens it with no press of the trigger.
    async function renderMenu(
      options: {
        open?: ShallowRef<boolean>;
        before?: () => VNodeChild;
        between?: () => VNodeChild;
        after?: () => VNodeChild;
        tabindex?: number;
      } = {},
    ) {
      const open = options.open ?? shallowRef(true);
      const reasons: string[] = [];
      const result = await render(() => (
        <div>
          {options.before?.()}
          <Menu.Root
            modal={false}
            open={open.value}
            triggerId="trigger"
            onOpenChange={(_open, details) => reasons.push(details.reason)}
            onUpdate:open={(nextOpen) => {
              open.value = nextOpen;
            }}
          >
            <Menu.Trigger id="trigger" tabindex={options.tabindex}>
              Toggle
            </Menu.Trigger>
            {options.between?.()}
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <button data-testid="inside">Inside</button>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          {options.after?.()}
        </div>
      ));
      await waitFor(() => {
        expect(screen.getByTestId('inside')).toHaveFocus();
      });
      return { ...result, reasons, trigger: screen.getByRole('button', { name: 'Toggle' }) };
    }

    async function waitForClose() {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    }

    it('puts a guard before and after the trigger only while the trigger owns the open menu', async () => {
      const open = shallowRef(false);
      const triggerId = shallowRef('first');
      await render(() => (
        <Menu.Root modal={false} open={open.value} triggerId={triggerId.value}>
          <div data-testid="first">
            <Menu.Trigger id="first">First</Menu.Trigger>
          </div>
          <div data-testid="second">
            <Menu.Trigger id="second">Second</Menu.Trigger>
          </div>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      const first = screen.getByTestId('first');
      const second = screen.getByTestId('second');
      expect(listPlaceOfTrigger(first)).toEqual(['First']);

      open.value = true;
      await flushMicrotasks();
      expect(listPlaceOfTrigger(first)).toEqual(['guard', 'First', 'guard']);
      expect(listPlaceOfTrigger(second)).toEqual(['Second']);

      triggerId.value = 'second';
      await flushMicrotasks();
      expect(listPlaceOfTrigger(first)).toEqual(['First']);
      expect(listPlaceOfTrigger(second)).toEqual(['guard', 'Second', 'guard']);

      open.value = false;
      await flushMicrotasks();
      expect(listPlaceOfTrigger(second)).toEqual(['Second']);
    });

    it('closes the menu and focuses the element before the trigger for Shift+Tab from the trigger', async () => {
      const { trigger, reasons } = await renderMenu({
        before: () => <button data-testid="before">Before</button>,
      });
      trigger.focus();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await userEvent.tab({ shift: true });

      expect(screen.getByTestId('before')).toHaveFocus();
      expect(reasons).toEqual([REASONS.focusOut]);
      await waitForClose();
      expect(screen.getByTestId('before')).toHaveFocus();
    });

    it('closes the menu and focuses the element after the trigger for Tab from the end of the popup', async () => {
      const { reasons } = await renderMenu({
        after: () => <button data-testid="after">After</button>,
      });

      await userEvent.tab();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(reasons).toEqual([REASONS.focusOut]);
      await waitForClose();
      expect(screen.getByTestId('after')).toHaveFocus();
    });

    it('goes on from the trigger in the tab order for Tab from the end of the popup', async () => {
      await renderMenu({
        between: () => <button data-testid="next">Next</button>,
        after: () => <button data-testid="after">After</button>,
      });

      await userEvent.tab();

      expect(screen.getByTestId('next')).toHaveFocus();
      await waitForClose();
      expect(screen.getByTestId('next')).toHaveFocus();
    });

    it('moves the focus into the popup for Tab from the trigger', async () => {
      const { trigger, reasons } = await renderMenu({
        after: () => <button data-testid="after">After</button>,
      });
      trigger.focus();

      await userEvent.tab();

      expect(screen.getByTestId('inside')).toHaveFocus();
      expect(reasons).toEqual([]);
    });

    // The cases of Base UI for Menu. They open the menu with a press of the trigger.
    describe.each(['forward', 'backward'] as const)('tabbing %s', (direction) => {
      beforeEach(() => {
        // The guards outlive `open` by a microtask only while exit animations run.
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      });

      function renderTestPopup(
        props: {
          tabindex?: number;
          open?: boolean;
          onOpenChange?: (open: boolean) => void;
          class?: string;
          finalFocus?: FocusOption;
        } = {},
      ) {
        return (
          <Menu.Root
            modal={false}
            open={props.open}
            onOpenChange={(nextOpen: boolean) => props.onOpenChange?.(nextOpen)}
          >
            <Menu.Trigger tabindex={props.tabindex}>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup class={props.class} data-testid="popup" finalFocus={props.finalFocus}>
                  <Menu.Item data-testid="inside">Inside</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      }

      async function openPopup() {
        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await userEvent.click(trigger);
        // Menu moves focus to the popup itself.
        await waitFor(() => {
          expect(screen.getByTestId('popup')).toHaveFocus();
        });
        return trigger;
      }

      /** Puts focus on the element the upcoming Tab should leave from. */
      async function focusTabOrigin(trigger: HTMLElement) {
        (direction === 'backward' ? trigger : screen.getByTestId('inside')).focus();
        await flushMicrotasks();
      }

      it.each([
        ['ref', 0],
        ['function', 0],
        ['ref', -1],
        ['function', -1],
      ] as const)(
        'preserves the tab destination after the exit transition with finalFocus as a %s and trigger tabIndex=%s',
        async (finalFocusType, tabindex) => {
          const finalFocusRef = shallowRef<HTMLElement | null>(null);

          await render(() => (
            <div>
              <style>{`
                .popup { transition: opacity 200ms; }
                .popup[data-ending-style] { opacity: 0; }
              `}</style>
              <button data-testid="before">Before</button>
              {renderTestPopup({
                tabindex,
                class: 'popup',
                finalFocus: finalFocusType === 'ref' ? finalFocusRef : () => true,
              })}
              <button data-testid="after">After</button>
              <button
                ref={(element) => {
                  finalFocusRef.value = element as HTMLElement | null;
                }}
              >
                Final focus
              </button>
            </div>
          ));

          const trigger = await openPopup();

          // Menu closes on Shift+Tab from its content, so focus the trigger directly instead.
          await focusTabOrigin(trigger);

          expect(direction === 'backward' ? trigger : screen.getByTestId('inside')).toHaveFocus();
          expect(trigger).toHaveAttribute('aria-expanded', 'true');

          await userEvent.tab({ shift: direction === 'backward' });

          const destination = screen.getByTestId(direction === 'backward' ? 'before' : 'after');
          expect(destination).toHaveFocus();
          await waitFor(() => {
            expect(screen.queryByTestId('popup')).toBe(null);
          });
          expect(destination).toHaveFocus();
          expect(trigger).toHaveAttribute('tabindex', String(tabindex));
        },
      );

      it.each(['disabled', 'tabIndex', 'hidden', 'removed', 'inserted', 'reordered'] as const)(
        'uses the current tab order when an adjacent control is %s during close',
        async (change) => {
          const Fixture = defineComponent(() => {
            const open = shallowRef(false);
            return () => {
              const target = (
                <button key="target" data-testid="target">
                  Target
                </button>
              );
              const candidate = (
                <button
                  key="candidate"
                  disabled={change === 'disabled' && !open.value}
                  tabindex={change === 'tabIndex' && !open.value ? -1 : 0}
                  hidden={change === 'hidden' && !open.value}
                >
                  Candidate
                </button>
              );
              let controls: VNodeChild[];
              if (change === 'inserted') {
                controls = [!open.value && target, candidate];
              } else if (change === 'reordered') {
                controls = open.value ? [candidate, target] : [target, candidate];
              } else {
                controls = [change === 'removed' && !open.value ? null : candidate, target];
              }

              return (
                <div>
                  {direction === 'backward' && controls.reverse()}
                  {renderTestPopup({
                    tabindex: -1,
                    open: open.value,
                    onOpenChange: (nextOpen) => {
                      open.value = nextOpen;
                    },
                  })}
                  {direction === 'forward' && controls}
                </div>
              );
            };
          });

          await render(<Fixture />);
          await focusTabOrigin(await openPopup());
          await userEvent.tab({ shift: direction === 'backward' });

          expect(screen.getByTestId('target')).toHaveFocus();
          await waitFor(() => {
            expect(screen.queryByTestId('popup')).toBe(null);
          });
          expect(screen.getByTestId('target')).toHaveFocus();
        },
      );

      it('preserves the surrounding modal dialog focus trap', async () => {
        await render(() => (
          <div>
            <button>Outside dialog</button>
            <Dialog.Root defaultOpen>
              <Dialog.Portal>
                <Dialog.Popup style={{ position: 'relative' }}>
                  {direction === 'forward' && <button>Inside dialog</button>}
                  {renderTestPopup({ tabindex: -1 })}
                  {direction === 'backward' && <button>Inside dialog</button>}
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        ));

        const destination = screen.getByRole('button', { name: 'Inside dialog' });
        await waitFor(() => {
          expect(destination).toHaveFocus();
        });

        await focusTabOrigin(await openPopup());
        await userEvent.tab({ shift: direction === 'backward' });

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });
        await waitFor(() => {
          expect(destination).toHaveFocus();
        });
      });

      it.each([0, -1])(
        'returns focus to the trigger when no outside element is tabbable and trigger tabIndex=%s',
        async (tabindex) => {
          await render(() => renderTestPopup({ tabindex }));

          const trigger = await openPopup();
          await focusTabOrigin(trigger);

          await userEvent.tab({ shift: direction === 'backward' });

          expect(trigger).toHaveFocus();
          await waitFor(() => {
            expect(screen.queryByTestId('popup')).toBe(null);
          });
          expect(trigger).toHaveFocus();
          expect(trigger).toHaveAttribute('tabindex', String(tabindex));
        },
      );
    });

    it('gives its guards to the store, and takes them back at the close and at the unmount', async () => {
      const shown = shallowRef(true);
      const open = shallowRef(true);
      const probe = createMenuStoreProbe();
      await render(() => (
        <Menu.Root modal={false} open={open.value} triggerId="trigger">
          <probe.Probe />
          {shown.value && <Menu.Trigger id="trigger">Toggle</Menu.Trigger>}
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      await flushMicrotasks();
      const { context } = probe.store;
      const trigger = screen.getByRole('button', { name: 'Toggle' });
      expect(context.beforeTriggerFocusGuardRef.value).toBe(trigger.previousElementSibling);
      expect(context.triggerFocusTargetRef.value).toBe(trigger.nextElementSibling);
      expect(trigger.previousElementSibling).toHaveAttribute(createAttribute('focus-guard'));
      expect(trigger.nextElementSibling).toHaveAttribute(createAttribute('focus-guard'));

      open.value = false;
      await flushMicrotasks();
      expect(context.beforeTriggerFocusGuardRef.value).toBe(null);
      expect(context.triggerFocusTargetRef.value).toBe(null);

      open.value = true;
      await flushMicrotasks();
      expect(context.triggerFocusTargetRef.value).toBe(trigger.nextElementSibling);

      shown.value = false;
      await flushMicrotasks();
      expect(context.beforeTriggerFocusGuardRef.value).toBe(null);
      expect(context.triggerFocusTargetRef.value).toBe(null);
    });

    // Each trigger writes the refs after the DOM update. The trigger that loses the menu must not
    // clear the guards of the trigger that gets it, in either order of the two triggers.
    it.each([
      { name: 'from the first to the second', from: 'first', to: 'second' },
      { name: 'from the second to the first', from: 'second', to: 'first' },
    ])('keeps the guards of the new trigger when the menu moves $name', async ({ from, to }) => {
      const triggerId = shallowRef(from);
      const probe = createMenuStoreProbe();
      await render(() => (
        <Menu.Root modal={false} open triggerId={triggerId.value}>
          <probe.Probe />
          <Menu.Trigger id="first">first</Menu.Trigger>
          <Menu.Trigger id="second">second</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      await flushMicrotasks();

      triggerId.value = to;
      await flushMicrotasks();

      const trigger = screen.getByRole('button', { name: to });
      const { context } = probe.store;
      expect(context.beforeTriggerFocusGuardRef.value).toBe(trigger.previousElementSibling);
      expect(context.triggerFocusTargetRef.value).toBe(trigger.nextElementSibling);
      expect(trigger.nextElementSibling).toHaveAttribute(createAttribute('focus-guard'));
    });

    it('takes its guards back from the store of the old handle when its handle changes', async () => {
      const first = Menu.createHandle();
      const second = Menu.createHandle();
      const handle = shallowRef(first);
      const firstProbe = createMenuStoreProbe();
      await render(() => (
        <div>
          <Menu.Trigger handle={handle.value} id="detached">
            Detached
          </Menu.Trigger>
          <Menu.Root handle={first} modal={false}>
            <firstProbe.Probe />
          </Menu.Root>
          <Menu.Root handle={second} modal={false} />
        </div>
      ));
      first.open('detached');
      await flushMicrotasks();
      const { context } = firstProbe.store;
      const trigger = screen.getByRole('button', { name: 'Detached' });
      expect(context.triggerFocusTargetRef.value).toBe(trigger.nextElementSibling);

      handle.value = second;
      await flushMicrotasks();

      expect(context.beforeTriggerFocusGuardRef.value).toBe(null);
      expect(context.triggerFocusTargetRef.value).toBe(null);
    });
  });
});
