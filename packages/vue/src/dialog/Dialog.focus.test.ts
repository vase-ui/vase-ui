import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import DialogFieldFocusedAtMount from '../../test/fixtures/DialogFieldFocusedAtMount.vue';
import DialogFocusTargets from '../../test/fixtures/DialogFocusTargets.vue';
import DialogFromItem from '../../test/fixtures/DialogFromItem.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import DialogRemovedChild from '../../test/fixtures/DialogRemovedChild.vue';
import DialogTabStopAfterMount from '../../test/fixtures/DialogTabStopAfterMount.vue';
import { mount } from '../../test/render';
import { waitSingleFrame } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const get = (id: string) => byTestId(id)!;

async function opened() {
  await waitFor(() => expect(byTestId('popup')).not.toBe(null));
  return get('popup');
}

async function closed() {
  await waitFor(() => expect(byTestId('popup')).toBe(null));
}

/** Mounts `DialogFocusTargets` with the reactive props of its popup. */
async function mountTargets(
  modal: boolean | 'trap-focus',
  popup: Props = {},
  portal: Props = {},
  drawer = false,
) {
  const popupProps = reactive<Props>(popup);
  mount(DialogFocusTargets, { modal, popup: popupProps, portal, drawer });
  await nextTick();
  return { trigger: get('trigger'), popupProps };
}

/** Opens with a press of a touch: its `click` has the pointer type of its `pointerdown`. */
function tapOpen(trigger: HTMLElement) {
  trigger.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }),
  );
  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
}

describe.each([
  { name: 'a modal dialog', modal: true },
  { name: "a `'trap-focus'` dialog", modal: 'trap-focus' },
  { name: 'a dialog that is not modal', modal: false },
] as const)('the focus props of $name', ({ modal }) => {
  // A modal dialog makes its trigger inert, and the focus of the trigger then goes to <body>.
  const triggerInUse = modal !== true;

  test('`initialFocus` goes to the first tab stop by default', async () => {
    const { trigger } = await mountTargets(modal);
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(get('inside-1')).toHaveFocus());
  });

  test('`initialFocus` goes to an element', async () => {
    // The kept popup has its elements before the open, as a template ref has them after the mount.
    const { trigger, popupProps } = await mountTargets(modal, {}, { keepMounted: true });
    popupProps.initialFocus = get('inside-2');
    await userEvent.click(trigger);
    await waitFor(() => expect(get('inside-2')).toHaveFocus());
  });

  test.each([
    { returns: 'an element', value: () => get('inside-2'), focused: 'inside-2' },
    { returns: 'true', value: () => true, focused: 'inside-1' },
    { returns: 'null', value: () => null, focused: 'inside-1' },
  ])(
    '`initialFocus` follows a function that returns $returns, and is called one time',
    async ({ value, focused }) => {
      const calls: string[] = [];
      const { trigger } = await mountTargets(modal, {
        initialFocus: (type: string) => {
          calls.push(type);
          return value();
        },
      });
      await userEvent.click(trigger);
      await opened();
      await waitFor(() => expect(get(focused)).toHaveFocus());
      await userEvent.click(get('close'));
      await closed();
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(calls).toEqual(['mouse']);
    },
  );

  test.runIf(triggerInUse)('`initialFocus` false moves no focus', async () => {
    const { trigger } = await mountTargets(modal, { initialFocus: false });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await waitSingleFrame();
    expect(trigger).toHaveFocus();
  });

  test.runIf(triggerInUse)(
    '`initialFocus` gets the type of the open, and a function that returns nothing moves no focus',
    async () => {
      const calls: string[] = [];
      const { trigger } = await mountTargets(modal, {
        initialFocus: (type: string) => {
          calls.push(type);
          return type === 'keyboard' ? get('inside-2') : undefined;
        },
      });
      await userEvent.click(trigger);
      const popup = await opened();
      await waitSingleFrame();
      // WebKit on macOS gives a button no focus at a press, so the case reads that the popup has none.
      expect(popup.contains(document.activeElement)).toBe(false);
      await userEvent.keyboard('{Escape}');
      await closed();
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(get('inside-2')).toHaveFocus());
      await userEvent.keyboard('{Escape}');
      await closed();
      tapOpen(trigger);
      await opened();
      expect(calls).toEqual(['mouse', 'keyboard', 'touch']);
    },
  );

  test('`finalFocus` goes to the trigger by default, and to an element', async () => {
    const { trigger, popupProps } = await mountTargets(modal);
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(get('close'));
    await closed();
    await waitFor(() => expect(trigger).toHaveFocus());
    popupProps.finalFocus = get('outside-target');
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(get('close'));
    await closed();
    await waitFor(() => expect(get('outside-target')).toHaveFocus());
  });

  test.each([
    { returns: 'an element', value: () => get('outside-target'), focused: 'outside-target' },
    { returns: 'true', value: () => true, focused: 'trigger' },
    { returns: 'null', value: () => null, focused: 'trigger' },
  ])(
    '`finalFocus` follows a function that returns $returns, and is called one time',
    async ({ value, focused }) => {
      const calls: string[] = [];
      const { trigger } = await mountTargets(modal, {
        finalFocus: (type: string) => {
          calls.push(type);
          return value();
        },
      });
      await userEvent.click(trigger);
      await opened();
      await userEvent.click(get('close'));
      await closed();
      await waitFor(() => expect(get(focused)).toHaveFocus());
      expect(calls).toHaveLength(1);
    },
  );

  test('`finalFocus` false moves no focus, so the focus of the removed close button goes to <body>', async () => {
    const { trigger } = await mountTargets(modal, { finalFocus: false });
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(get('close'));
    await closed();
    await waitSingleFrame();
    expect(trigger).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
  });

  test('`finalFocus` gets the type of the close', async () => {
    const calls: string[] = [];
    const { trigger } = await mountTargets(modal, {
      finalFocus: (type: string) => {
        calls.push(type);
        return type === 'keyboard' ? get('outside-target') : true;
      },
    });
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(get('close'));
    await closed();
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(get('outside-target')).toHaveFocus());
    expect(calls).toEqual(['mouse', 'keyboard']);
  });

  // A dialog that is not modal closes when the focus leaves it.
  test.runIf(modal === true)(
    'after an `initialFocus` outside the popup, the close gives the focus to `finalFocus`, else to the trigger',
    async () => {
      const { trigger, popupProps } = await mountTargets(modal, {
        initialFocus: () => get('outside-before'),
      });
      for (const [finalFocus, focused] of [
        [undefined, 'trigger'],
        [() => get('outside-target'), 'outside-target'],
      ] as const) {
        popupProps.finalFocus = finalFocus;
        await userEvent.click(trigger);
        await opened();
        await waitSingleFrame();
        await userEvent.click(get('close'));
        await closed();
        await waitFor(() => expect(get(focused)).toHaveFocus());
      }
    },
  );
});

describe.each([
  { family: 'dialog', drawer: false },
  { family: 'drawer', drawer: true },
])('VUE-230: a modal $family', ({ drawer }) => {
  test.each([
    { name: '`initialFocus` false', initialFocus: () => false },
    {
      name: 'an `initialFocus` element outside the popup',
      initialFocus: () => get('outside-target'),
    },
  ])(
    'with $name gives the focus to <body> and none to an outside element; Tab goes to the first tab stop of the popup, and the close gives the focus to the trigger',
    async ({ initialFocus }) => {
      const { trigger, popupProps } = await mountTargets(true, {}, {}, drawer);
      const outside = get('outside-target') as HTMLInputElement;
      let focuses = 0;
      outside.addEventListener('focus', () => (focuses += 1));
      popupProps.initialFocus = initialFocus();
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await opened();
      await waitSingleFrame();
      expect(trigger.closest('[inert]')).not.toBe(null);
      expect(document.activeElement).toBe(document.body);
      await userEvent.keyboard('ab');
      expect(outside.value).toBe('');
      expect(focuses).toBe(0);
      await userEvent.keyboard('{Tab}');
      await waitFor(() => expect(get('inside-1')).toHaveFocus());
      await userEvent.keyboard('{Escape}');
      await closed();
      await waitFor(() => expect(trigger).toHaveFocus());
    },
  );

  test('with `initialFocus` false takes the focus from a text field outside, so typed text does not reach it', async () => {
    const { trigger } = await mountTargets(true, { initialFocus: false }, {}, drawer);
    const outside = get('outside-target') as HTMLInputElement;
    outside.focus();
    trigger.click();
    await opened();
    await waitSingleFrame();
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard('ab');
    expect(outside.value).toBe('');
  });
});

describe('the focus of a dialog', () => {
  test('a touch open focuses the popup and not its first field', async () => {
    const trigger = (await mountTargets(false)).trigger;
    tapOpen(trigger);
    const popup = await opened();
    await waitFor(() => expect(popup).toHaveFocus());
    expect(get('inside-1')).not.toHaveFocus();
  });

  test('goes to a box that takes a tab stop in the update after its mount', async () => {
    mount(DialogTabStopAfterMount);
    await waitFor(() => expect(get('box')).toHaveFocus());
  });

  test('moves no focus when the dialog closes in the update of its open', async () => {
    const { exposed } = mount(DialogParts, {
      root: { modal: false },
      popup: { initialFocus: () => document.getElementById('outside') },
    });
    await nextTick();
    const trigger = document.querySelector<HTMLElement>('[data-key="t"]')!;
    trigger.focus();
    trigger.click();
    // This callback runs after the update of the open, and before the first focus.
    void nextTick(() => exposed.root.close());
    await closed();
    await waitSingleFrame();
    expect(trigger).toHaveFocus();
  });

  test('goes to the popup when a field that took the focus at its own mount leaves', async () => {
    const scene = reactive({ field: true });
    mount(DialogFieldFocusedAtMount, { scene });
    await waitFor(() => expect(get('field')).toHaveFocus());
    await waitSingleFrame();
    scene.field = false;
    await waitFor(() => expect(get('popup')).toHaveFocus());
  });

  test('goes to the popup when the focused button unmounts at its `pointerdown`, and an outside press still closes', async () => {
    mount(DialogRemovedChild);
    await opened();
    await waitFor(() => expect(get('remove')).toHaveFocus());
    get('remove').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 }),
    );
    await waitFor(() => expect(get('popup')).toHaveFocus());
    await userEvent.pointer({ coords: { x: 5, y: 5 }, keys: '[MouseLeft]' });
    await closed();
  });

  test.each([
    { name: 'the select', source: 'select' },
    { name: 'the select, with a kept dialog', source: 'select', keepMountedDialog: true },
    { name: 'the kept menu', source: 'menu', keepMountedMenu: true },
    {
      name: 'the menu, whose item is a trigger with a handle',
      source: 'menu',
      detachedTrigger: true,
    },
    {
      name: 'the kept menu, which the press did not focus',
      source: 'menu',
      keepMountedMenu: true,
      pressKeepsFocus: true,
    },
  ] as const)(
    'goes back to the trigger of $name whose item opened the dialog',
    async ({ name: _, ...props }) => {
      mount(DialogFromItem, props);
      await nextTick();
      await userEvent.click(get('source-trigger'));
      const item = await waitFor(() => {
        const found = [
          ...document.querySelectorAll<HTMLElement>('[role="option"], [role="menuitem"]'),
        ].find(
          (element) => element.textContent?.trim() === 'Custom' && !element.closest('[hidden]'),
        );
        expect(found).toBeTruthy();
        return found!;
      });
      await userEvent.click(item);
      await waitFor(() => expect(get('close')).toHaveFocus());
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(get('source-trigger')).toHaveFocus());
    },
  );
});

describe('the focus ring of a dialog', () => {
  const ringed = (element: Element) => element.matches(':focus-visible');

  test.each([
    { name: 'an input', markup: '<input aria-label="New">' },
    { name: 'a textarea', markup: '<textarea aria-label="New"></textarea>' },
    { name: 'an element with contenteditable', markup: '<div contenteditable="true">New</div>' },
  ])('a press open gives $name its ring', async ({ markup }) => {
    const { trigger } = await mountTargets(false, {
      initialFocus: () => {
        get('popup').insertAdjacentHTML('beforeend', markup);
        return get('popup').lastElementChild as HTMLElement;
      },
    });
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(get('popup').lastElementChild).toHaveFocus());
    expect(ringed(get('popup').lastElementChild!)).toBe(true);
  });

  test.each([
    { name: 'a button', markup: '<button>New</button>' },
    { name: 'a checkbox', markup: '<input type="checkbox" aria-label="New">' },
    { name: 'a range', markup: '<input type="range" aria-label="New">' },
  ])('a press open after Tab gives $name that `initialFocus` names no ring', async ({ markup }) => {
    const { trigger } = await mountTargets(false, {
      initialFocus: () => {
        get('popup').insertAdjacentHTML('beforeend', markup);
        return get('popup').lastElementChild as HTMLElement;
      },
    });
    get('outside-before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(trigger);
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(get('popup').lastElementChild).toHaveFocus());
    expect(ringed(get('popup').lastElementChild!)).toBe(false);
  });

  test('a touch open after Tab gives the popup no ring', async () => {
    const { trigger } = await mountTargets(false);
    get('outside-before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(trigger);
    tapOpen(trigger);
    const popup = await opened();
    await waitFor(() => expect(popup).toHaveFocus());
    expect(ringed(popup)).toBe(false);
  });

  // After a press, a focus by script from a key listener has the ring in Chromium and WebKit, and
  // in Firefox only with `focusVisible: true` (test/measurements/popup.test.ts).
  test('an open by code after a press and a key leaves the ring of the first focus to the browser', async () => {
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    mount(DialogParts, { root, popup: { initialFocus: () => get('button') } });
    await nextTick();
    const opener = document.getElementById('outside')!;
    await userEvent.click(opener);
    opener.addEventListener('click', () => (root.open = true));
    // WebKit gives a pressed button no focus.
    opener.focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await waitFor(() => expect(get('button')).toHaveFocus());
    expect(ringed(get('button'))).toBe(server.browser !== 'firefox');
  });
});

describe('an Escape of a text composition', () => {
  test.each([
    { name: '`isComposing`', init: { isComposing: true, keyCode: 27 } },
    { name: 'the key code 229', init: { isComposing: false, keyCode: 229 } },
  ])('identified by $name closes nothing', async ({ init }) => {
    const log: string[] = [];
    mount(DialogParts, {
      root: { defaultOpen: true, onOpenChange: (open: boolean) => log.push(String(open)) },
    });
    await opened();
    await waitFor(() => expect(get('field')).toHaveFocus());
    get('field').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...init }),
    );
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('a composition that ends with no `compositionend` lets the next Escape close', async () => {
    mount(DialogParts, { root: { defaultOpen: true } });
    await opened();
    await waitFor(() => expect(get('field')).toHaveFocus());
    get('field').dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    await userEvent.keyboard('{Escape}');
    await closed();
  });
});
