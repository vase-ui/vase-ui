import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { shallowRef } from 'vue';
import type { ShallowRef, VNodeChild } from 'vue';
import * as Menu from '../../menu/index.parts';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { REASONS } from '../../internals/reasons';
import { createAttribute } from './createAttribute';

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

    it.each([
      { name: 'Tab, trigger tabindex 0', shift: false, tabindex: 0 },
      { name: 'Tab, trigger tabindex -1', shift: false, tabindex: -1 },
      { name: 'Shift+Tab, trigger tabindex 0', shift: true, tabindex: 0 },
      { name: 'Shift+Tab, trigger tabindex -1', shift: true, tabindex: -1 },
    ])(
      'returns the focus to the trigger when no element outside is tabbable ($name)',
      async ({ shift, tabindex }) => {
        const { trigger } = await renderMenu({ tabindex });
        if (shift) {
          trigger.focus();
        }

        await userEvent.tab({ shift });

        expect(trigger).toHaveFocus();
        await waitForClose();
        expect(trigger).toHaveFocus();
        expect(trigger).toHaveAttribute('tabindex', String(tabindex));
      },
    );

    // The close changes the tab order. The guard reads it after the DOM update of the close.
    it.each([
      { name: 'Tab', shift: false },
      { name: 'Shift+Tab', shift: true },
    ])('uses the tab order after the close for $name', async ({ shift }) => {
      const open = shallowRef(true);
      const controls = () => [
        <button data-testid="candidate" disabled={!open.value}>
          Candidate
        </button>,
        <button data-testid="target">Target</button>,
      ];
      const { trigger } = await renderMenu({
        open,
        tabindex: -1,
        before: () => (shift ? controls().reverse() : null),
        after: () => (shift ? null : controls()),
      });
      if (shift) {
        trigger.focus();
      }

      await userEvent.tab({ shift });

      expect(screen.getByTestId('target')).toHaveFocus();
      await waitForClose();
      expect(screen.getByTestId('target')).toHaveFocus();
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
