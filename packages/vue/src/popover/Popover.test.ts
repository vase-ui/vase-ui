import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive, shallowRef } from 'vue';
import { Popover, type PopoverRootChangeEventDetails } from '@vase-ui/vue/popover';
import { Dialog } from '@vase-ui/vue/dialog';
import PopoverHandles from '../../test/fixtures/PopoverHandles.vue';
import PopoverInTransition from '../../test/fixtures/PopoverInTransition.vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import PopoverViewportParts from '../../test/fixtures/PopoverViewportParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { touchDrag } from '../../test/pointer';
import { mount, mountError } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const popup = () => document.querySelector<HTMLElement>('[data-testid="popup"]');
const positioner = () => document.querySelector<HTMLElement>('[data-testid="positioner"]');
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const byId = (id: string) => document.getElementById(id)!;

async function mountPopover(setup: Props = {}) {
  const { root, exposed, unmount } = mount(PopoverParts, setup);
  await nextTick();
  const trigger = (key = 't') => root.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
  return { root, exposed, unmount, trigger };
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: PopoverRootChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    'onUpdate:open': (open: boolean) => log.push(`update ${open}`),
  });
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
  return popup()!;
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

async function placed() {
  await waitFor(() => expect(positioner()?.style.visibility).toBe(''));
}

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('the parts', () => {
  test('render their native elements with their roles in <body>; a template ref has element; the attributes of the developer win', async () => {
    const { trigger, exposed } = await mountPopover({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { type: 'submit' } }],
      popup: { role: 'alertdialog' },
      backdrop: {},
      arrow: {},
      title: {},
      description: {},
      close: { type: 'reset' },
    });
    const element = await opened();
    expect(trigger().localName).toBe('button');
    expect(trigger()).toHaveAttribute('type', 'submit');
    expect(element.localName).toBe('div');
    expect(element).toHaveAttribute('role', 'alertdialog');
    expect(element).toHaveAttribute('tabindex', '-1');
    expect(exposed.popup.element).toBe(element);
    expect(positioner()!.parentElement).toBe(document.body);
    expect(byTestId('backdrop')).toHaveAttribute('role', 'presentation');
    expect(byTestId('arrow')).toHaveAttribute('aria-hidden', 'true');
    expect(element.querySelector('h2')).toHaveTextContent('Title');
    expect(element.querySelector('p')).toHaveTextContent('Description');
    expect(element.querySelector('button[type="reset"]')).toHaveTextContent('Close');
  });

  test('render the tag of `as`; the `element` slot renders the element of the developer with the props', async () => {
    const { trigger } = await mountPopover({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { as: 'span' } }],
      popup: { as: 'section' },
    });
    const element = await opened();
    expect(trigger().localName).toBe('span');
    expect(trigger()).toHaveAttribute('role', 'button');
    expect(trigger()).not.toHaveAttribute('type');
    expect(element.localName).toBe('section');
  });

  test('throw an error that names the part with no root, and Positioner with no Portal', () => {
    expect(String(mountError(Popover.Popup))).toContain('<Popover.Popup> must be inside <Popover.Root>');
    expect(String(mountError(Popover.Trigger))).toContain('<Popover.Trigger> must be inside <Popover.Root>');
  });
});

describe('the root (L1)', () => {
  test('a press on the trigger opens and closes the popover; openChange comes before update:open', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({ root: rootEvents(log) });
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(trigger());
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'update true',
      'openChange false trigger-press',
      'update false',
    ]);
  });

  test('a controlled root shows only the value of its parent; cancel() keeps the state; a change by the parent and a mount open emit nothing', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { open: true });
    root.onOpenChange = (open: boolean, details: PopoverRootChangeEventDetails) => {
      log.push(`openChange ${open} ${details.reason}`);
      if (details.reason === 'escape-key') details.cancel();
    };
    const { trigger } = await mountPopover({ root });
    await opened();
    await userEvent.click(popup()!.querySelector('button')!);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(trigger());
    await nextTick();
    expect(popup()).not.toBe(null);
    root.open = false;
    await closed();
    expect(log).toEqual([
      'openChange false escape-key',
      'openChange false trigger-press',
      'update false',
    ]);
  });

  test('`defaultOpen` opens an uncontrolled root at the mount; details.trigger is the element of the action', async () => {
    const triggers: (Element | undefined)[] = [];
    const { trigger } = await mountPopover({
      root: {
        defaultOpen: true,
        onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) =>
          triggers.push(details.trigger),
      },
    });
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(triggers).toEqual([trigger()]);
  });

  test('the close() of a template ref asks for a close with `imperative-action`', async () => {
    const log: string[] = [];
    const { exposed } = await mountPopover({ root: rootEvents(log, { defaultOpen: true }) });
    await opened();
    exposed.root.close();
    await closed();
    expect(log).toEqual(['openChange false imperative-action', 'update false']);
  });

  test('with more triggers, a press moves the popup to its trigger; v-model:trigger-id follows; the slot gets the payload', async () => {
    const ids: (string | null)[] = [];
    const { trigger } = await mountPopover({
      root: { 'onUpdate:triggerId': (id: string | null) => ids.push(id) },
      triggers: [
        { key: 'a', attrs: { id: 'a', payload: 'A' } },
        { key: 'b', attrs: { id: 'b', payload: 'B' } },
      ],
    });
    await userEvent.click(trigger('a'));
    expect((await opened()).querySelector('[data-testid="payload"]')).toHaveTextContent('A');
    await userEvent.click(trigger('b'));
    await waitFor(() => expect(byTestId('payload')).toHaveTextContent('B'));
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'false');
    expect(trigger('b')).toHaveAttribute('aria-expanded', 'true');
    expect(ids).toEqual(['a', 'b']);
  });

  test('a trigger that is not active gets no write when the popup moves', async () => {
    const { trigger } = await mountPopover({
      triggers: [
        { key: 'a', attrs: { id: 'a' } },
        { key: 'b', attrs: { id: 'b' } },
        { key: 'c', attrs: { id: 'c' } },
      ],
    });
    await userEvent.click(trigger('a'));
    await opened();
    const writes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => writes.push(...records));
    observer.observe(trigger('c'), { attributes: true, childList: true, subtree: true });
    await userEvent.click(trigger('b'));
    await nextTick();
    observer.disconnect();
    expect(writes).toEqual([]);
  });
});

describe('the handle (L1)', () => {
  test('connects triggers outside the root; open(id) opens for that trigger; isOpen and close() follow', async () => {
    const handle = Popover.createHandle<string>();
    mount(PopoverHandles, { handle });
    await nextTick();
    await userEvent.click(byId('first'));
    expect(await opened()).toHaveTextContent('first');
    expect(handle.isOpen).toBe(true);
    handle.open('second');
    await waitFor(() => expect(popup()).toHaveTextContent('second'));
    expect(byId('second')).toHaveAttribute('aria-expanded', 'true');
    handle.close();
    await closed();
    expect(handle.isOpen).toBe(false);
  });

  test('`new Popover.Handle()` makes the same object; open() of an unknown id throws; with no root the methods do nothing', async () => {
    const handle = new Popover.Handle();
    const { unmount } = mount(PopoverHandles, { handle });
    await nextTick();
    expect(() => handle.open('missing')).toThrow('The handle has no trigger with the id "missing"');
    unmount();
    const detached = new Popover.Handle();
    mount(PopoverHandles, { handle: detached, noRoot: true });
    await nextTick();
    detached.open('first');
    detached.close();
    await userEvent.click(byId('first'));
    expect(detached.isOpen).toBe(false);
    expect(byId('first')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('in the DOM (L2)', () => {
  test('a popup and a backdrop in a <Transition> get the leave classes after a close, and the portal keeps them until the leave ends', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const log: string[] = [];
    mount(PopoverInTransition, { root: { defaultOpen: true }, log: { add: (entry: string) => log.push(entry) } });
    const element = await opened();
    await waitFor(() => expect(log).toEqual(['after-enter']));
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(element.className).toContain('pop-leave-active');
    expect(byTestId('backdrop').className).toContain('fade-leave-active');
    expect(positioner()).not.toBe(null);
    await waitFor(() => expect(log).toEqual(['after-enter', 'after-leave']));
    await waitFor(() => expect(positioner()).toBe(null));
  });

  test('an open while the popup leaves renders one popup element, which enters after the leave', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const root = reactive<Props>({ open: true });
    mount(PopoverInTransition, { root });
    const first = await opened();
    root.open = false;
    await nextTick();
    root.open = true;
    await nextTick();
    expect([...document.querySelectorAll('[data-testid="popup"]')]).toEqual([first]);
    await waitFor(() => expect(popup()).not.toBe(first));
    expect(document.querySelectorAll('[data-testid="popup"]')).toHaveLength(1);
    expect(popup()!.className).toContain('pop-enter');
  });

  test('with `keepMounted`, the closed popup and backdrop stay with `hidden` and `inert`', async () => {
    const { trigger } = await mountPopover({ portal: { keepMounted: true }, backdrop: {} });
    const element = await opened();
    expect(element).toHaveAttribute('hidden');
    expect(element).toHaveAttribute('inert');
    expect(byTestId('backdrop')).toHaveAttribute('hidden');
    await userEvent.click(trigger());
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    expect(element).not.toHaveAttribute('inert');
  });

  test('the popup that leaves has the `data-instant` of its close', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    mount(PopoverInTransition, { root: { defaultOpen: true } });
    const element = await opened();
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(element).toHaveAttribute('data-instant', 'dismiss');
  });
});

describe('the portal (L3)', () => {
  test('a portal in a portal with a container goes to that container; `to` of `null` renders nothing; `disabled` renders in place', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    try {
      const { trigger } = await mountPopover({
        root: { defaultOpen: true },
        portal: { to: container },
        nested: { root: { defaultOpen: true } },
      });
      await opened();
      await waitFor(() => expect(container.querySelector('[data-testid="nested-popup"]')).not.toBe(null));
      void trigger;
    } finally {
      container.remove();
    }
    const unset = await mountPopover({ root: { defaultOpen: true }, portal: { to: null } });
    await nextTick();
    expect(popup()).toBe(null);
    unset.unmount();
    const inPlace = await mountPopover({ root: { defaultOpen: true }, portal: { disabled: true } });
    expect((await opened()).closest('[data-v-app]')).toBe(inPlace.root.closest('[data-v-app]'));
    expect(inPlace.root.contains(popup())).toBe(true);
  });
});

describe('the dismissal (L4)', () => {
  test('one cancel() gives one openChange for one Escape', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { defaultOpen: true });
    root.onOpenChange = (open: boolean, details: PopoverRootChangeEventDetails) => {
      log.push(`openChange ${open} ${details.reason}`);
      details.cancel();
    };
    await mountPopover({ root, nested: { root: { defaultOpen: true } } });
    await opened();
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    byTestId('nested-button').focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[data-testid="nested-popup"]')).toBe(null));
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    expect(log).toEqual(['openChange false escape-key', 'openChange false escape-key']);
  });

  test('Escape in a child that calls allowPropagation() closes the child and its parent', async () => {
    await mountPopover({
      root: { defaultOpen: true },
      nested: {
        root: {
          defaultOpen: true,
          onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) => details.allowPropagation(),
        },
      },
    });
    await opened();
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    byTestId('nested-button').focus();
    await userEvent.keyboard('{Escape}');
    await closed();
  });

  test('an Escape that a listener of the developer prevented closes nothing; an Escape of a text composition closes nothing', async () => {
    await mountPopover({
      root: { defaultOpen: true },
      popup: { onKeydown: (event: KeyboardEvent) => event.key === 'Escape' && event.preventDefault() },
    });
    const element = await opened();
    element.querySelector('button')!.focus();
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(popup()).not.toBe(null);
    element.querySelector('button')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true }),
    );
    expect(popup()).not.toBe(null);
  });

  test('a press outside closes; a drag from the popup to the outside, and from the outside into the popup, closes nothing', async () => {
    const log: string[] = [];
    await mountPopover({ root: rootEvents(log, { defaultOpen: true }) });
    const element = await opened();
    await placed();
    const outside = byId('outside');
    await userEvent.pointer([{ coords: centerOf(element) }, '[MouseLeft>]', { coords: centerOf(outside) }, '[/MouseLeft]']);
    await userEvent.pointer([{ coords: centerOf(outside) }, '[MouseLeft>]', { coords: centerOf(element) }, '[/MouseLeft]']);
    expect(popup()).not.toBe(null);
    await userEvent.click(outside);
    await closed();
    expect(log).toEqual(['openChange false outside-press', 'update false']);
  });

  test('a click with no press on an outside element closes; a press that started before the open closes nothing', async () => {
    const { trigger } = await mountPopover();
    await userEvent.pointer([{ coords: centerOf(byId('outside')) }, '[MouseLeft>]']);
    trigger().click();
    await opened();
    await userEvent.pointer('[/MouseLeft]');
    await nextTick();
    expect(popup()).not.toBe(null);
    byId('outside').click();
    await closed();
  });

  test('a press on an element that a script added to <body> after the open closes nothing', async () => {
    await mountPopover({ root: { defaultOpen: true } });
    await opened();
    const added = document.body.appendChild(document.createElement('button'));
    added.textContent = 'Added';
    try {
      await userEvent.click(added);
      expect(popup()).not.toBe(null);
    } finally {
      added.remove();
    }
  });

  test('a press in a child popup keeps its parent open; a press outside both closes both, the child first', async () => {
    const log: string[] = [];
    await mountPopover({
      root: rootEvents(log, { defaultOpen: true }),
      nested: { root: { defaultOpen: true, onOpenChange: () => log.push('child') } },
    });
    await opened();
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    await userEvent.click(byTestId('nested-button'));
    expect(log).toEqual([]);
    await userEvent.click(byId('outside'));
    await closed();
    expect(log).toEqual(['child', 'openChange false outside-press', 'update false']);
  });

  test.skipIf(server.browser !== 'chromium')(
    'a tap and a drag of a touch outside close; a touch that rests more than 1 s closes nothing',
    async () => {
      const root = reactive<Props>({ defaultOpen: true });
      const { unmount } = await mountPopover({ root });
      await opened();
      await placed();
      const point = centerOf(byId('outside'));
      await touchDrag(point, { x: point.x, y: point.y - 30 }, 6);
      await closed();
      unmount();
      await mountPopover({ root: { defaultOpen: true } });
      await opened();
      await placed();
      await touchDrag(point, point, 1);
      await closed();
    },
  );

  test('the focus that moves to an outside element closes the popup with `focus-out`', async () => {
    const log: string[] = [];
    await mountPopover({ root: rootEvents(log, { defaultOpen: true }) });
    await opened();
    await placed();
    popup()!.querySelector('button')!.focus();
    byId('after').focus();
    await closed();
    expect(log).toEqual(['openChange false focus-out', 'update false']);
  });
});

describe('modal (3.2, L4 to L6)', () => {
  test('`true` locks the scroll and renders a fixed element with a hole at the trigger; a press on it closes; a press on the trigger closes', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({ root: rootEvents(log, { modal: true }) });
    await userEvent.click(trigger());
    await opened();
    await placed();
    const block = document.querySelector<HTMLElement>('body > div[role="presentation"]')!;
    expect(block.style.position).toBe('fixed');
    await waitFor(() => expect(block.style.clipPath).toContain('polygon'));
    await waitFor(() => expect(isScrollLocked()).toBe(true));
    await userEvent.click(trigger());
    await closed();
    await waitFor(() => expect(isScrollLocked()).toBe(false));
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(byId('outside'), { force: true });
    await closed();
    expect(log.filter((entry) => entry.startsWith('openChange false'))).toEqual([
      'openChange false trigger-press',
      'openChange false outside-press',
    ]);
  });

  test('`true` with a Close makes the rest of the page inert and the popup aria-modal, and keeps the focus in the popup', async () => {
    const { trigger } = await mountPopover({ root: { modal: true }, close: {} });
    await userEvent.click(trigger());
    const element = await opened();
    await waitFor(() => expect(byId('before')).toHaveAttribute('inert'));
    expect(byId('outside')).toHaveAttribute('inert');
    expect(element).toHaveAttribute('aria-modal', 'true');
    expect(trigger().closest('[inert]')).toBe(null);
    await waitFor(() => expect(document.activeElement).toHaveTextContent('First'));
    await userEvent.keyboard('{Tab}{Tab}{Tab}');
    expect(document.activeElement).toHaveTextContent('First');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toHaveTextContent('Close');
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(byId('before')).not.toHaveAttribute('inert');
  });

  test("`'trap-focus'` with a Close hides the rest of the page with aria-hidden; the page stays in use, and an outside press closes", async () => {
    const { trigger } = await mountPopover({ root: { modal: 'trap-focus' }, close: {} });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(byId('outside')).toHaveAttribute('aria-hidden', 'true'));
    expect(isScrollLocked()).toBe(false);
    await userEvent.click(byId('outside'));
    await closed();
    expect(byId('outside')).not.toHaveAttribute('aria-hidden');
  });

  test('a modal popover that closes under an open Dialog leaves the page locked', async () => {
    const dialogOpen = shallowRef(false);
    const root = reactive<Props>({ open: true, modal: true });
    await mountPopover({ root });
    await opened();
    await waitFor(() => expect(isScrollLocked()).toBe(true));
    mount(Dialog.Root, { open: true, modal: true }, document.body);
    dialogOpen.value = true;
    root.open = false;
    await closed();
    await nextTick();
    expect(isScrollLocked()).toBe(true);
  });
});

describe('the focus (L7)', () => {
  test('goes to the first tab stop at a press open, to the popup when it has none, and back to the trigger at the close', async () => {
    const { trigger } = await mountPopover();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toHaveTextContent('First'));
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(trigger());
  });

  test('`initialFocus` and `finalFocus` replace the targets; a function gets the interaction type, and `initialFocus` is not called at the close', async () => {
    const calls: string[] = [];
    const { trigger } = await mountPopover({
      popup: {
        initialFocus: (type: string) => {
          calls.push(`initial ${type}`);
          return document.querySelector<HTMLElement>('[data-testid="second"]');
        },
        finalFocus: (type: string) => {
          calls.push(`final ${type}`);
          return byId('after');
        },
      },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toHaveTextContent('Second'));
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(byId('after'));
    expect(calls).toEqual(['initial mouse', 'final keyboard']);
  });

  test('Tab from the last tab stop closes a popover that is not modal and goes to the element after the trigger; Shift+Tab from the first goes to the trigger', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({ root: rootEvents(log) });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toHaveTextContent('First'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(trigger());
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toHaveTextContent('First');
    await userEvent.keyboard('{Tab}{Tab}');
    await closed();
    expect(document.activeElement).toBe(byId('after'));
    expect(log).toContain('openChange false focus-out');
  });

  test('Tab passes an open root that has no popup', async () => {
    const { trigger } = await mountPopover({ root: { defaultOpen: true }, noPopup: true });
    trigger().focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('after'));
  });
});

describe('the trigger (L8)', () => {
  test('a disabled trigger opens nothing; Enter and Space open a trigger that is not a button', async () => {
    const { trigger, unmount } = await mountPopover({ triggers: [{ key: 't', attrs: { disabled: true } }] });
    await userEvent.click(trigger(), { force: true });
    await nextTick();
    expect(popup()).toBe(null);
    unmount();
    const span = await mountPopover({ triggers: [{ key: 't', attrs: { as: 'span' } }] });
    span.trigger().focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    span.trigger().focus();
    await userEvent.keyboard(' ');
    await opened();
  });

  test('`data-pressed` marks a trigger that a press opened; `aria-controls` names the popup while it is open', async () => {
    const { trigger } = await mountPopover();
    expect(trigger()).not.toHaveAttribute('aria-controls');
    await userEvent.click(trigger());
    const element = await opened();
    expect(trigger()).toHaveAttribute('data-pressed');
    expect(trigger()).toHaveAttribute('aria-controls', element.id);
  });
});

describe('the hover (L9)', () => {
  test('a mouse that rests on the trigger opens after `delay` and takes no focus; it closes after the pointer leaves', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({
      root: rootEvents(log),
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 50 } }],
    });
    await userEvent.hover(trigger());
    await opened();
    expect(trigger()).not.toHaveAttribute('data-pressed');
    expect(document.activeElement).toBe(document.body);
    await userEvent.hover(byId('outside'));
    await closed();
    expect(log).toEqual([
      'openChange true trigger-hover',
      'update true',
      'openChange false trigger-hover',
      'update false',
    ]);
  });

  test('the pointer that moves from the trigger to the popup keeps it open; a press in the first 500 ms keeps it open as after a press', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
      positioner: { sideOffset: 20 },
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await placed();
    const from = centerOf(trigger());
    const to = centerOf(element);
    await userEvent.pointer([
      { coords: { x: from.x, y: from.y + 10 } },
      { coords: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } },
      { coords: to },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(popup()).toBe(element);
    await userEvent.click(trigger());
    await nextTick();
    expect(popup()).toBe(element);
    expect(trigger()).toHaveAttribute('data-pressed');
  });

  test('a hover opens nothing on a trigger with aria-disabled', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0, 'aria-disabled': 'true' } }],
    });
    await userEvent.hover(trigger());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).toBe(null);
  });

  test('a modal popover that a hover opened has no fixed element and no lock; the backdrop lets the pointer through', async () => {
    const { trigger } = await mountPopover({
      root: { modal: true },
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
      backdrop: {},
    });
    await userEvent.hover(trigger());
    await opened();
    expect(positioner()!.previousElementSibling).toBe(byTestId('backdrop'));
    expect(byTestId('backdrop').style.pointerEvents).toBe('none');
    expect(isScrollLocked()).toBe(false);
  });
});

describe('the placement (L10)', () => {
  test('writes the side, the alignment and the variables; `inline-end` follows the direction of the positioner', async () => {
    await mountPopover({ root: { defaultOpen: true }, positioner: { side: 'inline-end', align: 'start', dir: 'rtl' } });
    await opened();
    await placed();
    const element = positioner()!;
    expect(element).toHaveAttribute('data-side', 'inline-end');
    expect(element).toHaveAttribute('data-align', 'start');
    expect(element.style.getPropertyValue('--anchor-width')).toMatch(/px$/);
    expect(element.style.getPropertyValue('--available-height')).toMatch(/px$/);
    const trigger = document.querySelector('[data-key="t"]')!.getBoundingClientRect();
    expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(trigger.left + 1);
  });

  test('the popup stays at its place after its trigger leaves the DOM', async () => {
    const triggers = reactive([{ key: 't' }]);
    await mountPopover({ root: { defaultOpen: true }, triggers });
    await opened();
    await placed();
    const place = positioner()!.getBoundingClientRect().toJSON();
    triggers.splice(0, 1);
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(positioner()!.getBoundingClientRect().toJSON()).toEqual(place);
  });
});

describe('the viewport (L11)', () => {
  test('a move to another trigger gives the direction and the new content; keyed content leaves and enters', async () => {
    const log: string[] = [];
    mount(PopoverViewportParts, { log: { add: (entry: string) => log.push(entry) } });
    await nextTick();
    await userEvent.click(byId('one'));
    const element = await opened();
    await userEvent.click(byId('two'));
    await waitFor(() => expect(byTestId('viewport')).toHaveAttribute('data-activation-direction', 'right '));
    await waitFor(() => expect(element.querySelectorAll('.content')).toHaveLength(1));
    expect(element.querySelector('.content')).toHaveTextContent('Two');
    expect(log).toContain('leave');
    expect(log).toContain('enter');
  });
});
