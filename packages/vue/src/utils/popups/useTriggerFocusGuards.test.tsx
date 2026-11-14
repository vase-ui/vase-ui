import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, shallowRef } from 'vue';
import type { ShallowRef, VNodeChild } from 'vue';
import * as Dialog from '../../dialog/index.parts';
import * as Menu from '../../menu/index.parts';
import * as Popover from '../../popover/index.parts';
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
  describe.each([
    { name: 'Popover', Component: Popover },
    { name: 'Menu', Component: Menu },
  ])('$name', ({ name, Component }) => {
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
        <Component.Root
          modal={false}
          open={props.open}
          onOpenChange={(nextOpen: boolean) => props.onOpenChange?.(nextOpen)}
        >
          <Component.Trigger tabindex={props.tabindex}>Toggle</Component.Trigger>
          <Component.Portal>
            <Component.Positioner>
              <Component.Popup
                class={props.class}
                data-testid="popup"
                finalFocus={props.finalFocus}
              >
                {name === 'Menu' ? (
                  <Menu.Item data-testid="inside">Inside</Menu.Item>
                ) : (
                  <button data-testid="inside">Inside</button>
                )}
              </Component.Popup>
            </Component.Positioner>
          </Component.Portal>
        </Component.Root>
      );
    }

    async function openPopup() {
      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await userEvent.click(trigger);
      // Menu moves focus to the popup itself; Popover moves it to the first tabbable inside.
      await waitFor(() => {
        expect(screen.getByTestId(name === 'Popover' ? 'inside' : 'popup')).toHaveFocus();
      });
      return trigger;
    }

    describe.each(['forward', 'backward'] as const)('tabbing %s', (direction) => {
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

          if (direction === 'backward' && name === 'Popover') {
            await userEvent.tab({ shift: true });
          } else {
            // Menu closes on Shift+Tab from its content, so focus the trigger directly instead.
            await focusTabOrigin(trigger);
          }

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
  });

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

  // The `open` prop of the root does not change, so the close that a guard asks for has no effect.
  // `placement` puts the portal right after the trigger, right before it, or (`detached`) after the
  // element that follows the trigger.
  interface OpenOptions {
    content?: 'text' | 'button' | undefined;
    placement?: 'beside' | 'before' | 'detached' | undefined;
    before?: boolean | undefined;
    after?: boolean | undefined;
    tabindex?: number | undefined;
  }

  async function renderOpenPopover(options: OpenOptions = {}) {
    const { content = 'text', placement = 'beside', before, after, tabindex } = options;
    const reasons: string[] = [];
    const renderPortal = () => (
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup initialFocus={false}>
            {content === 'button' ? <button data-testid="inside">Inside</button> : 'Text'}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    );
    await render(() => (
      <div>
        {before && <button data-testid="before">Before</button>}
        <Popover.Root
          open
          triggerId="trigger"
          onOpenChange={(_open, details) => reasons.push(details.reason)}
        >
          {placement === 'before' && renderPortal()}
          <Popover.Trigger id="trigger" tabindex={tabindex}>
            Toggle
          </Popover.Trigger>
          {placement === 'beside' && renderPortal()}
          {after && <button data-testid="after">After</button>}
          {placement === 'detached' && renderPortal()}
        </Popover.Root>
      </div>
    ));
    await flushMicrotasks();
    return { reasons, trigger: screen.getByRole('button', { name: 'Toggle' }) };
  }

  // The items of a menu have `tabindex="-1"`, so a menu with items has no tabbable element.
  async function renderOpenMenu(options: OpenOptions = {}) {
    const { content = 'text', placement = 'beside', before, after, tabindex } = options;
    const reasons: string[] = [];
    const renderPortal = () => (
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            {content === 'button' ? (
              <button data-testid="inside">Inside</button>
            ) : (
              <Menu.Item>Item</Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    );
    await render(() => (
      <div>
        {before && <button data-testid="before">Before</button>}
        <Menu.Root
          modal={false}
          open
          triggerId="trigger"
          onOpenChange={(_open, details) => reasons.push(details.reason)}
        >
          {placement === 'before' && renderPortal()}
          <Menu.Trigger id="trigger" tabindex={tabindex}>
            Toggle
          </Menu.Trigger>
          {placement === 'beside' && renderPortal()}
          {after && <button data-testid="after">After</button>}
          {placement === 'detached' && renderPortal()}
        </Menu.Root>
      </div>
    ));
    // A menu moves the focus into its popup when it opens. The cases start after that move.
    await waitFor(() => {
      expect(screen.getByRole('menu')).toContainElement(document.activeElement as HTMLElement);
    });
    return { reasons, trigger: screen.getByRole('button', { name: 'Toggle' }) };
  }

  const FOCUS_MOVE_LIMIT = 50;

  // Records the elements that get the focus. After `FOCUS_MOVE_LIMIT` moves, it stops the listeners
  // of the guards. A sequence of moves with no end then fails its case, and the page does not stop.
  function trackFocus() {
    const targets: Element[] = [];
    const controller = new AbortController();
    document.addEventListener(
      'focusin',
      (event) => {
        targets.push(event.target as Element);
        if (targets.length >= FOCUS_MOVE_LIMIT) {
          event.stopImmediatePropagation();
        }
      },
      { capture: true, signal: controller.signal },
    );
    onTestFinished(() => controller.abort());
    return {
      get moves() {
        return targets.length;
      },
      get portalGuards() {
        return targets.filter((target) => target.getAttribute('data-type') === 'outside');
      },
    };
  }

  // While the popup stays open, the search for the next element skips the guards of the portal, so
  // no guard of the portal sends the focus back into the popup.
  function expectNoReentry(focus: ReturnType<typeof trackFocus>) {
    expect(focus.moves).toBeLessThan(FOCUS_MOVE_LIMIT);
    expect(focus.portalGuards).toEqual([]);
  }

  async function pressTab(shift = false) {
    await userEvent.tab({ shift });
    await flushMicrotasks();
  }

  describe.each([
    { name: 'Popover', renderOpen: renderOpenPopover },
    { name: 'Menu', renderOpen: renderOpenMenu },
  ])('VUE-63: $name that stays open', ({ renderOpen }) => {
    it.each([
      { name: 'beside the trigger', placement: 'beside' as const },
      { name: 'detached', placement: 'detached' as const },
    ])(
      'skips a popup with no tabbable element for Tab from the trigger ($name)',
      async ({ placement }) => {
        const { trigger, reasons } = await renderOpen({ placement, after: true });
        trigger.focus();
        const focus = trackFocus();

        await pressTab();

        expect(screen.getByTestId('after')).toHaveFocus();
        expect(reasons).toEqual([REASONS.focusOut]);
        expectNoReentry(focus);
      },
    );

    it.each([
      { name: 'beside the trigger', placement: 'beside' as const },
      { name: 'detached', placement: 'detached' as const },
    ])(
      'goes through the popup to the element after the trigger for Tab ($name)',
      async ({ placement }) => {
        const { trigger, reasons } = await renderOpen({
          content: 'button',
          placement,
          after: true,
        });
        trigger.focus();
        const focus = trackFocus();

        await pressTab();
        expect(screen.getByTestId('inside')).toHaveFocus();
        expect(reasons).toEqual([]);

        await pressTab();
        expect(screen.getByTestId('after')).toHaveFocus();
        expect(reasons).toEqual([REASONS.focusOut]);
        expectNoReentry(focus);
      },
    );

    it.each([
      { name: 'before the trigger', placement: 'before' as const },
      { name: 'detached', placement: 'detached' as const },
    ])(
      'goes to the element before the trigger for Shift+Tab from the trigger ($name)',
      async ({ placement }) => {
        const { trigger, reasons } = await renderOpen({ placement, before: true });
        trigger.focus();
        const focus = trackFocus();

        await pressTab(true);

        expect(screen.getByTestId('before')).toHaveFocus();
        expect(reasons).toEqual([REASONS.focusOut]);
        expectNoReentry(focus);
      },
    );

    // The portal makes its content untabbable when the focus leaves it, and tabbable again when the
    // focus comes back. The second pass must be the same as the first.
    it('passes a popup with no tabbable element in both directions, and again', async () => {
      const { trigger, reasons } = await renderOpen({ after: true });
      const after = screen.getByTestId('after');
      trigger.focus();
      const focus = trackFocus();

      await pressTab();
      expect(after).toHaveFocus();

      await pressTab(true);
      expect(trigger).toHaveFocus();

      await pressTab();
      expect(after).toHaveFocus();
      expect(reasons).toEqual([REASONS.focusOut, REASONS.focusOut]);
      expect(focus.moves).toBeLessThan(FOCUS_MOVE_LIMIT);
    });

    // The trigger is the only element that the Tab key reaches outside the popup. The search goes
    // round the document, so it meets the content of the popup too.
    it.each([
      { name: 'Tab, trigger tabindex 0', shift: false, tabindex: 0 },
      { name: 'Tab, trigger tabindex -1', shift: false, tabindex: -1 },
      { name: 'Shift+Tab, trigger tabindex 0', shift: true, tabindex: 0 },
      { name: 'Shift+Tab, trigger tabindex -1', shift: true, tabindex: -1 },
      {
        name: 'Shift+Tab, popup with a button',
        shift: true,
        tabindex: 0,
        content: 'button' as const,
      },
    ])(
      'keeps the focus on the trigger when no other element is tabbable ($name)',
      async ({ shift, tabindex, content }) => {
        const { trigger, reasons } = await renderOpen({ tabindex, content });
        trigger.focus();
        const focus = trackFocus();

        await pressTab(shift);

        expect(trigger).toHaveFocus();
        expect(reasons).toEqual([REASONS.focusOut]);
        expectNoReentry(focus);
      },
    );

    it('gives the focus to the trigger for Tab from the end of the popup when no other element is tabbable', async () => {
      const { trigger, reasons } = await renderOpen({ content: 'button' });
      screen.getByTestId('inside').focus();
      const focus = trackFocus();

      await pressTab();

      expect(trigger).toHaveFocus();
      expect(reasons).toEqual([REASONS.focusOut]);
      expectNoReentry(focus);
    });
  });

  // The search skips only the outside guards of a portal. The inside guards of the outer popup then
  // take the focus on to the element after the outer trigger.
  it('VUE-63: goes past the outer popup to the element after its trigger for Tab from a nested trigger', async () => {
    const reasons: string[] = [];
    await render(() => (
      <div>
        <Popover.Root defaultOpen defaultTriggerId="outer">
          <Popover.Trigger id="outer">Outer</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup initialFocus={false}>
                <Popover.Root
                  open
                  triggerId="inner"
                  onOpenChange={(_open, details) => reasons.push(details.reason)}
                >
                  <Popover.Trigger id="inner">Inner</Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner>
                      <Popover.Popup initialFocus={false}>Text</Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <button data-testid="after">After</button>
      </div>
    ));
    await flushMicrotasks();
    screen.getByRole('button', { name: 'Inner' }).focus();
    const focus = trackFocus();

    await pressTab();

    expect(screen.getByTestId('after')).toHaveFocus();
    expect(reasons).toEqual([REASONS.focusOut]);
    expectNoReentry(focus);
  });

  // The search skips the outside guards of a portal only while the popup stays open. The popup of
  // this trigger closes, so the outside guard of the other popup takes the focus into that popup.
  it('VUE-63: goes into the next open popup for Tab from the trigger of a popup that closes', async () => {
    const reasons: string[] = [];
    await render(() => (
      <div>
        <Popover.Root
          defaultOpen
          defaultTriggerId="closes"
          onOpenChange={(_open, details) => reasons.push(details.reason)}
        >
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup initialFocus={false}>Text</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
          <Popover.Trigger id="closes">Closes</Popover.Trigger>
        </Popover.Root>
        <Popover.Root open triggerId="open">
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup initialFocus={false}>
                <button data-testid="inside">Inside</button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
          <Popover.Trigger id="open">Open</Popover.Trigger>
        </Popover.Root>
      </div>
    ));
    await flushMicrotasks();
    const trigger = screen.getByRole('button', { name: 'Closes' });
    trigger.focus();

    await pressTab();

    expect(screen.getByTestId('inside')).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(reasons).toEqual([REASONS.focusOut]);
  });
});
