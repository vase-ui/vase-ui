import { describe, expect, inject, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { reactive } from 'vue';
import ToolbarCompose from '../../test/fixtures/ToolbarCompose.vue';
import ToolbarKeptAlive from '../../test/fixtures/ToolbarKeptAlive.vue';
import { waitForLaterMillisecond } from '../../test/createRenderer';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Scene = InstanceType<typeof ToolbarCompose>['$props']['scene'];

async function mountCompose(scene: Scene) {
  const entries: string[] = [];
  const { root } = mount(ToolbarCompose, {
    scene: reactive(scene),
    log: { add: (entry: string) => entries.push(entry) },
  });
  await settle();
  // A popup is in the body.
  const find = <T extends HTMLElement = HTMLElement>(id: string) =>
    (root.querySelector<T>(`#${id}`) ?? document.querySelector<T>(`#${id}`))!;
  return { root, entries, find, trigger: find('trigger') };
}

const focused = () => (document.activeElement as HTMLElement).id || 'none';
const role = (name: string) => document.querySelector(`[role=${name}]`);

/** Moves the focus from `first` to the trigger with the next key of the toolbar. */
async function focusTrigger(trigger: HTMLElement, next = '{ArrowRight}') {
  trigger.closest('[role=toolbar]')!.querySelector<HTMLElement>('#first')!.focus();
  await userEvent.keyboard(next);
  expect(document.activeElement).toBe(trigger);
}

// In a Vapor app with Vapor parts, Vue 3.6 runs no portal of the older popup families: the portal
// returns a render function, and a Vapor component must return a block.
const olderPortal = inject('app') === 'vapor';

describe.each(['menu', 'popover', 'dialog', 'alert-dialog'] as const)('a trigger: %s', (kind) => {
  const skipped = olderPortal && kind === 'menu';
  const popupRole = {
    menu: 'menu',
    popover: 'dialog',
    dialog: 'dialog',
    'alert-dialog': 'alertdialog',
  }[kind];

  test.skipIf(skipped)(
    'is an item of the toolbar; Enter opens its popup, and Escape closes it and gives the focus back',
    async () => {
      const { entries, trigger } = await mountCompose({ kind });
      expect(trigger).toHaveAttribute('tabindex', '-1');
      expect(trigger).toHaveAttribute('data-orientation', 'horizontal');
      await focusTrigger(trigger);
      await waitForLaterMillisecond(() => userEvent.keyboard('{Enter}'));
      await waitFor(() => expect(role(popupRole)).not.toBeNull());
      await waitFor(() => expect(role(popupRole)!.contains(document.activeElement)).toBe(true));
      await userEvent.keyboard('{ArrowRight}');
      expect(role(popupRole)!.contains(document.activeElement)).toBe(true);
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(focused()).toBe('trigger'));
      expect(entries).toEqual(['open true', 'open false']);
    },
  );

  test.skipIf(skipped)(
    'disabled: has aria-disabled and no disabled, keeps the focus, and a click, Enter and Space do not open it',
    async () => {
      const { entries, trigger } = await mountCompose({ kind, disabled: true });
      expect(trigger).toHaveAttribute('aria-disabled', 'true');
      expect(trigger).not.toHaveAttribute('disabled');
      await userEvent.click(trigger, { force: true });
      await focusTrigger(trigger);
      await userEvent.keyboard('{Enter} {ArrowDown}');
      await settle();
      expect(focused()).toBe('trigger');
      expect(entries).toEqual([]);
      expect(role(popupRole)).toBeNull();
    },
  );
});

describe.skipIf(olderPortal)('a menu trigger', () => {
  test('the arrow keys of the menu move the highlight, and the keys of the toolbar do not reach the menu', async () => {
    const { find, trigger } = await mountCompose({ kind: 'menu' });
    await focusTrigger(trigger);
    await waitForLaterMillisecond(() => userEvent.keyboard('{Enter}'));
    await waitFor(() => expect(focused()).toBe('item-1'));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(focused()).toBe('item-2'));
    expect(find('last')).not.toHaveFocus();
  });

  test('in a vertical toolbar, ArrowDown moves the focus and does not open the menu', async () => {
    const { entries, trigger } = await mountCompose({ kind: 'menu', orientation: 'vertical' });
    await focusTrigger(trigger, '{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()).toBe('last');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(focused()).toBe('first');
    expect(entries).toEqual([]);
  });

  test('with loopFocus false, ArrowDown on the last item does not open the menu', async () => {
    const { entries, trigger } = await mountCompose({
      kind: 'menu',
      orientation: 'vertical',
      loopFocus: false,
      noLast: true,
    });
    await focusTrigger(trigger, '{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await settle();
    expect(focused()).toBe('trigger');
    expect(entries).toEqual([]);
    expect(role('menu')).toBeNull();
  });
});

describe.skipIf(olderPortal)('a select trigger', () => {
  test('ArrowDown of the other axis opens the list; a choice closes it and gives the focus back', async () => {
    const { entries, trigger } = await mountCompose({ kind: 'select' });
    await focusTrigger(trigger);
    await waitForLaterMillisecond(() => userEvent.keyboard('{ArrowDown}'));
    await waitFor(() => expect(focused()).toBe('item-a'));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(focused()).toBe('item-b'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(focused()).toBe('trigger'));
    expect(entries).toEqual(['open true', 'value b', 'open false']);
  });

  test('disabled: the keys and a click do not open the list', async () => {
    const { entries, trigger } = await mountCompose({ kind: 'select', disabled: true });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(trigger, { force: true });
    await focusTrigger(trigger);
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter} ');
    await settle();
    expect(entries).toEqual([]);
  });
});

describe('a popover', () => {
  test('a press on a disabled Toolbar.Button closes the open popover', async () => {
    const { entries, trigger, find } = await mountCompose({ kind: 'popover' });
    await waitForLaterMillisecond(() => userEvent.click(trigger));
    await waitFor(() => expect(find('popup')).not.toBeNull());
    await userEvent.click(find('disabled'), { force: true });
    await waitFor(() => expect(entries).toEqual(['open true', 'open false']));
  });
});

describe('a tooltip trigger', () => {
  test('in a disabled Toolbar.Button, opens at a hover', async () => {
    const { trigger, find } = await mountCompose({ kind: 'tooltip', disabled: true });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.hover(trigger);
    await waitFor(() => expect(find('popup')).not.toBeNull());
  });
});

describe('a toggle', () => {
  test('in Toolbar.Button: a click presses it; disabled, a click and Space change nothing', async () => {
    const { trigger } = await mountCompose({ kind: 'toggle' });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-pressed', 'true');

    const disabled = await mountCompose({ kind: 'toggle', disabled: true });
    expect(disabled.trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(disabled.trigger, { force: true });
    disabled.trigger.focus();
    await userEvent.keyboard(' {Enter}');
    expect(disabled.trigger).toHaveAttribute('aria-pressed', 'false');
  });

  test('of a group, in a disabled Toolbar.Button: one item that a click and Space do not change', async () => {
    const { trigger, find } = await mountCompose({ kind: 'toggle-group', disabled: true });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(trigger, { force: true });
    await focusTrigger(trigger);
    await userEvent.keyboard(' ');
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    expect(await keys('{ArrowRight}', '{ArrowRight}')).toEqual(['one', 'last']);
    expect(find('one')).toHaveAttribute('aria-pressed', 'true');
  });
});

async function keys(...pressed: string[]) {
  const steps: string[] = [];
  for (const key of pressed) {
    await userEvent.keyboard(key);
    steps.push(focused());
  }
  return steps;
}

describe('a control in Toolbar.Input', () => {
  test('a switch: a click and Space change it, and Enter does not; disabled, nothing changes it', async () => {
    const { entries, trigger } = await mountCompose({ kind: 'switch' });
    await userEvent.click(trigger);
    await focusTrigger(trigger);
    await userEvent.keyboard(' {Enter}');
    expect(entries).toEqual(['checked true', 'checked false']);

    const disabled = await mountCompose({ kind: 'switch', disabled: true });
    expect(disabled.trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(disabled.trigger, { force: true });
    disabled.trigger.focus();
    await userEvent.keyboard(' ');
    expect(disabled.entries).toEqual([]);
  });

  test('radios of a named group: the keys of the toolbar check nothing; Tab and Shift+Tab reach the toolbar at the checked radio', async () => {
    const { find } = await mountCompose({ kind: 'radio' });
    find('left').focus();
    expect(await keys('{ArrowRight}')).toEqual(['center']);
    expect(find<HTMLInputElement>('left').checked).toBe(true);
    expect(await keys('{Tab}')).toEqual(['after']);
    expect(await keys('{Shift>}{Tab}{/Shift}')).toEqual(['left']);
    // ArrowDown is of the other axis, so the radio group moves the focus and checks.
    find('before').focus();
    expect(await keys('{Tab}', '{ArrowDown}')).toEqual(['left', 'center']);
    expect(find<HTMLInputElement>('center').checked).toBe(true);
  });

  test('a number field input: in a vertical toolbar, ArrowUp and ArrowDown move the focus and do not step; in a horizontal one, they step', async () => {
    const vertical = await mountCompose({ kind: 'number-field', orientation: 'vertical' });
    await focusTrigger(vertical.trigger, '{ArrowDown}');
    expect(await keys('{ArrowDown}')).toEqual(['last']);
    expect(vertical.entries).toEqual([]);

    const horizontal = await mountCompose({ kind: 'number-field' });
    horizontal.trigger.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(focused()).toBe('trigger');
    expect(horizontal.entries).toEqual(['value 6']);
  });

  test('a disabled number field input keeps the focus, and the keys do not step it', async () => {
    const { entries, trigger } = await mountCompose({ kind: 'number-field', disabled: true });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    trigger.focus();
    await userEvent.keyboard('{ArrowUp}1');
    expect(entries).toEqual([]);
    expect((trigger as HTMLInputElement).value).toBe('5');
  });
});

describe('the tab stop in a KeepAlive branch', () => {
  async function mountBranches() {
    const scene = reactive({ branch: 'a' as 'a' | 'b' });
    mount(ToolbarKeptAlive, { scene });
    await settle();
    const show = async (branch: 'a' | 'b') => {
      scene.branch = branch;
      await settle();
    };
    const focus = async (id: string) => {
      document.querySelector<HTMLElement>(`#${id}`)!.focus();
      await settle();
    };
    return { show, focus };
  }

  test('moves to the first item when KeepAlive holds its branch: Tab reaches the toolbar, and the keys follow the document', async () => {
    const { show, focus } = await mountBranches();
    // `KeepAlive` holds both branches, so a switch adds no item.
    await show('b');
    await show('a');
    await focus('a1');
    await show('b');
    await focus('before');
    expect(
      await keys('{Tab}', '{ArrowRight}', '{ArrowRight}', '{ArrowRight}', '{ArrowRight}'),
    ).toEqual(['first', 'b1', 'b2', 'last', 'first']);
  });

  test('comes back when its branch shows again, and the keys follow the document', async () => {
    const { show, focus } = await mountBranches();
    await focus('a1');
    await show('b');
    await show('a');
    await focus('before');
    expect(
      await keys('{Tab}', '{ArrowRight}', '{ArrowRight}', '{ArrowRight}', '{ArrowRight}'),
    ).toEqual(['a1', 'a2', 'last', 'first', 'a1']);
  });
});
