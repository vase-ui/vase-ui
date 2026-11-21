import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Popover, type PopoverRootChangeEventDetails } from '@vase-ui/vue/popover';
import OpenModalDialog from '../../test/fixtures/OpenModalDialog.vue';
import PopoverHandles from '../../test/fixtures/PopoverHandles.vue';
import PopoverInToolbar from '../../test/fixtures/PopoverInToolbar.vue';
import PopoverInTransition from '../../test/fixtures/PopoverInTransition.vue';
import PopoverPartAlone from '../../test/fixtures/PopoverPartAlone.vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import PopoverViewportParts from '../../test/fixtures/PopoverViewportParts.vue';
import PopoverWithDialog from '../../test/fixtures/PopoverWithDialog.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { movePointerThrough, touchDrag } from '../../test/pointer';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { readWhen } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const popup = () => document.querySelector<HTMLElement>('[data-testid="popup"]');
const positioner = () => document.querySelector<HTMLElement>('[data-testid="positioner"]');
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const byId = (id: string) => document.getElementById(id)!;
/**
 * Appends an element to `<body>` at the bottom left of the view, away from the popup, which opens
 * under its trigger at the top. The element goes away at the end of the case.
 */
function appendOutside<K extends keyof HTMLElementTagNameMap>(tag: K, style = '') {
  const element = document.body.appendChild(document.createElement(tag));
  element.style.cssText = `position: fixed; left: 0; bottom: 0; ${style}`;
  onTestFinished(() => element.remove());
  return element;
}

// The fixed element of a modal popover. A backdrop of an earlier case can still leave.
const BLOCK = 'body > div[role="presentation"]:not([data-testid])';

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

/**
 * Mouse moves with 10 ms between them. A move of the test runner can take more than the 40 ms rest
 * in the triangle of a hover, and the browser runs timers in the order of their ends.
 */
async function moveMouse(points: { x: number; y: number }[]) {
  for (const point of points) {
    const target = document.elementFromPoint(point.x, point.y) ?? document.documentElement;
    target.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        composed: true,
        pointerType: 'mouse',
        clientX: point.x,
        clientY: point.y,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
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

  test('an open root whose other trigger unmounts is open for the trigger that stays', async () => {
    const triggers = reactive([{ key: 'a' }, { key: 'b' }]);
    const { trigger } = await mountPopover({ root: { defaultOpen: true }, triggers });
    await opened();
    expect(trigger('b')).toHaveAttribute('aria-expanded', 'false');
    triggers.splice(0, 1);
    await waitFor(() => expect(trigger('b')).toHaveAttribute('aria-expanded', 'true'));
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
  test('a popup and a backdrop in a <Transition> get the leave classes after a close, and the portal keeps them until each leave ends', async () => {
    const log: string[] = [];
    mount(PopoverInTransition, {
      root: { defaultOpen: true },
      log: { add: (entry: string) => log.push(entry) },
    });
    const element = await opened();
    await waitFor(() => expect(log).toEqual(['after-enter']));
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(element.className).toContain('pop-leave-active');
    expect(byTestId('backdrop').className).toContain('fade-leave-active');
    expect(positioner()).not.toBe(null);
    await waitFor(() => expect(log).toEqual(['after-enter', 'after-leave']));
    expect(document.querySelector('[data-testid="backdrop"]')).not.toBe(null);
    await waitFor(() =>
      expect(log).toEqual(['after-enter', 'after-leave', 'backdrop-after-leave']),
    );
    await waitFor(() => expect(positioner()).toBe(null));
  });

  test('an open while the popup leaves renders one popup and one backdrop, which enter after the leave', async () => {
    const root = reactive<Props>({ open: true });
    mount(PopoverInTransition, { root });
    const first = await opened();
    root.open = false;
    await nextTick();
    root.open = true;
    await nextTick();
    expect([...document.querySelectorAll('[data-testid="popup"]')]).toEqual([first]);
    expect(document.querySelectorAll('[data-testid="backdrop"]')).toHaveLength(1);
    await waitFor(() => expect(popup() ?? first).not.toBe(first));
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

  test('the popup that leaves has the `data-instant` of its close: `dismiss` after Escape, `focus` after a focus that left', async () => {
    const { unmount } = mount(PopoverInTransition, { root: { defaultOpen: true } });
    const element = await opened();
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(element).toHaveAttribute('data-instant', 'dismiss');
    unmount();
    const outside = document.body.appendChild(document.createElement('input'));
    try {
      mount(PopoverInTransition, { root: { defaultOpen: true } });
      const second = await opened();
      await placed();
      second.querySelector('button')!.focus();
      outside.focus();
      await nextTick();
      expect(second).toHaveAttribute('data-instant', 'focus');
    } finally {
      outside.remove();
    }
  });

  test('a kept popup that closes and opens again stays when `keepMounted` turns off', async () => {
    const portal = reactive({ keepMounted: true });
    const { trigger } = await mountPopover({ root: { defaultOpen: true }, portal });
    const element = await opened();
    await userEvent.click(trigger());
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    await userEvent.click(trigger());
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    portal.keepMounted = false;
    await nextTick();
    await nextTick();
    expect(popup()).toBe(element);
  });
});

describe('the portal (L3)', () => {
  test('a portal in a portal with a container goes to that container; `to` of `null` renders nothing; `disabled` renders in place', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    try {
      await mountPopover({
        root: { defaultOpen: true },
        portal: { to: container },
        nested: { root: { defaultOpen: true } },
      });
      await opened();
      await waitFor(() =>
        expect(container.querySelector('[data-testid="nested-popup"]')).not.toBe(null),
      );
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

  test('VUE-135: an attribute with the name of a prop of the internal portal reaches no element, and the portal keeps its focus guards', async () => {
    await mountPopover({
      root: { defaultOpen: true },
      portal: { guards: 'external', 'portal-owner-role': 'menu' },
    });
    await opened();
    // Vue warns in development: the root of the portal is a `<Teleport>`, which takes no attribute.
    expect(takeReportedMessages().join()).toMatch(
      /Extraneous non-props attributes \(guards, portal-owner-role\)/,
    );
    expect(document.querySelector('[guards], [portal-owner-role], [role="menu"]')).toBe(null);
    for (const guard of [positioner()!.previousElementSibling, positioner()!.nextElementSibling]) {
      expect(guard).toHaveAttribute('tabindex', '0');
      expect(guard).toHaveAttribute('aria-hidden', 'true');
    }
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
          onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) =>
            details.allowPropagation(),
        },
      },
    });
    await opened();
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    byTestId('nested-button').focus();
    await userEvent.keyboard('{Escape}');
    await closed();
  });

  test('an Escape that a listener of the developer prevented closes nothing', async () => {
    await mountPopover({
      root: { defaultOpen: true },
      popup: {
        onKeydown: (event: KeyboardEvent) => event.key === 'Escape' && event.preventDefault(),
      },
    });
    const element = await opened();
    element.querySelector('button')!.focus();
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(popup()).not.toBe(null);
  });

  test('an Escape of a text composition closes nothing, also the Escape that WebKit sends after `compositionend`', async () => {
    await mountPopover({ root: { defaultOpen: true } });
    const button = (await opened()).querySelector('button')!;
    const escape = (init: KeyboardEventInit) =>
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, ...init }));
    escape({ isComposing: true });
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- An IME sends the key code 229 while it composes.
    escape({ keyCode: 229 });
    button.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    escape({});
    await nextTick();
    expect(popup()).not.toBe(null);
    // An Escape of the next case comes more than 5 ms after the end of this composition.
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  test('an Escape stops at the popup: a listener of an ancestor gets no Escape, also after cancel()', async () => {
    const keys: string[] = [];
    const root = reactive<Props>({
      defaultOpen: true,
      onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) => details.cancel(),
    });
    const { root: app } = await mountPopover({ root, portal: { disabled: true } });
    app.addEventListener('keydown', (event) => keys.push(event.key));
    const element = await opened();
    await placed();
    element.querySelector('button')!.focus();
    await userEvent.keyboard('{Escape}');
    root.onOpenChange = undefined;
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(keys).toEqual([]);
  });

  test('an Escape in a popover in a modal <dialog> closes only the popover', async () => {
    const dialog = document.body.appendChild(document.createElement('dialog'));
    try {
      dialog.showModal();
      mount(PopoverParts, { root: { defaultOpen: true }, portal: { to: dialog } }, dialog);
      (await opened()).querySelector('button')!.focus();
      await userEvent.keyboard('{Escape}');
      await closed();
      expect(dialog.open).toBe(true);
    } finally {
      dialog.remove();
    }
  });

  test('Escape in a child that calls cancel() and allowPropagation() gives the child one openChange and closes its parent', async () => {
    const log: string[] = [];
    await mountPopover({
      root: rootEvents(log, { defaultOpen: true }),
      nested: {
        root: {
          defaultOpen: true,
          onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) => {
            log.push('child');
            details.cancel();
            details.allowPropagation();
          },
        },
      },
    });
    await opened();
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    byTestId('nested-button').focus();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(log).toEqual(['child', 'openChange false escape-key', 'update false']);
  });

  test('a press outside closes; a drag from the popup to the outside, and from the outside into the popup, closes nothing', async () => {
    const log: string[] = [];
    await mountPopover({ root: rootEvents(log, { defaultOpen: true }) });
    const element = await opened();
    await placed();
    const outside = byId('outside');
    await userEvent.pointer([
      { coords: centerOf(element) },
      '[MouseLeft>]',
      { coords: centerOf(outside) },
      '[/MouseLeft]',
    ]);
    await userEvent.pointer([
      { coords: centerOf(outside) },
      '[MouseLeft>]',
      { coords: centerOf(element) },
      '[/MouseLeft]',
    ]);
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
    const added = appendOutside('button');
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

  test('the focus that moves to an outside element closes the popup with `focus-out` and stays there', async () => {
    const log: string[] = [];
    await mountPopover({ root: rootEvents(log, { defaultOpen: true }) });
    await opened();
    await placed();
    popup()!.querySelector('button')!.focus();
    byId('after').focus();
    await closed();
    expect(log).toEqual(['openChange false focus-out', 'update false']);
    expect(document.activeElement).toBe(byId('after'));
  });

  test('a press on another element of <body> that was there before the open closes the popup', async () => {
    const other = appendOutside('div');
    other.textContent = 'Other';
    try {
      const log: string[] = [];
      await mountPopover({ root: rootEvents(log, { defaultOpen: true }) });
      await opened();
      await userEvent.click(other);
      await closed();
      expect(log).toEqual(['openChange false outside-press', 'update false']);
    } finally {
      other.remove();
    }
  });

  test('a press on the backdrop of a child in a container closes only the child', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    try {
      const log: string[] = [];
      await mountPopover({
        root: rootEvents(log, { defaultOpen: true }),
        portal: { to: container },
        nested: {
          root: { defaultOpen: true, onOpenChange: () => log.push('child') },
          backdrop: { style: 'position: fixed; inset: 0' },
        },
      });
      await waitFor(() =>
        expect(container.querySelector('[data-testid="nested-backdrop"]')).toBeTruthy(),
      );
      await userEvent.click(byTestId('nested-backdrop'), { position: { x: 2, y: 2 } });
      await waitFor(() =>
        expect(document.querySelector('[data-testid="nested-popup"]')).toBe(null),
      );
      expect(popup()).not.toBe(null);
      expect(log).toEqual(['child']);
    } finally {
      container.remove();
    }
  });

  test('a popup in a shadow root closes with `focus-out` when the focus moves to another element of that root; a modal one makes the page outside the host inert', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadow = host.attachShadow({ mode: 'open' });
    const container = shadow.appendChild(document.createElement('div'));
    const input = shadow.appendChild(document.createElement('input'));
    const inShadow = () => container.querySelector<HTMLElement>('[data-testid="popup"]');
    try {
      const log: string[] = [];
      const first = await mountPopover({
        root: rootEvents(log, { defaultOpen: true }),
        portal: { to: container },
      });
      await waitFor(() =>
        expect(
          container.querySelector<HTMLElement>('[data-testid="positioner"]')?.style.visibility,
        ).toBe(''),
      );
      inShadow()!.querySelector('button')!.focus();
      input.focus();
      await waitFor(() => expect(inShadow()).toBe(null));
      expect(log).toEqual(['openChange false focus-out', 'update false']);
      first.unmount();
      await mountPopover({
        root: { defaultOpen: true, modal: true },
        portal: { to: container },
        close: {},
      });
      await waitFor(() => expect(byId('outside')).toHaveAttribute('inert'));
      expect(input).toHaveAttribute('inert');
      expect(host).not.toHaveAttribute('inert');
    } finally {
      host.remove();
    }
  });

  test('a popup in place in a shadow root that is open at the mount closes when the focus moves to another element of that root', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadow = host.attachShadow({ mode: 'open' });
    const container = shadow.appendChild(document.createElement('div'));
    const input = shadow.appendChild(document.createElement('input'));
    const inShadow = () => container.querySelector<HTMLElement>('[data-testid="popup"]');
    try {
      mount(PopoverParts, { root: { defaultOpen: true }, portal: { disabled: true } }, container);
      await waitFor(() =>
        expect(
          container.querySelector<HTMLElement>('[data-testid="positioner"]')?.style.visibility,
        ).toBe(''),
      );
      inShadow()!.querySelector('button')!.focus();
      input.focus();
      await waitFor(() => expect(inShadow()).toBe(null));
    } finally {
      host.remove();
    }
  });

  test('a press on a scrollbar keeps a popover open that closes at the press of an outside element', async ({
    skip,
  }) => {
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = '.scroller::-webkit-scrollbar { width: 12px; height: 12px }';
    const box = (dir: string) => {
      const element = appendOutside(
        'div',
        `overflow: scroll; width: 200px; height: 100px; bottom: ${dir === 'rtl' ? 110 : 0}px`,
      );
      element.className = 'scroller';
      element.dir = dir;
      element.innerHTML = '<div style="width: 400px; height: 400px"></div>';
      return element;
    };
    const ltr = box('ltr');
    const rtl = box('rtl');
    try {
      skip(ltr.offsetWidth === ltr.clientWidth, 'The scrollbars of this browser take no room.');
      const { trigger } = await mountPopover({ root: { modal: 'trap-focus' }, close: {} });
      await userEvent.click(trigger());
      await opened();
      const press = async (x: number, y: number) => {
        await userEvent.pointer([{ coords: { x, y } }, '[MouseLeft>]', '[/MouseLeft]']);
        await nextTick();
        expect(popup()).not.toBe(null);
      };
      const right = ltr.getBoundingClientRect();
      await press(right.right - 6, right.top + 20);
      await press(right.left + 20, right.bottom - 6);
      // The content of a box from right to left starts at the right edge of its client box.
      const left = rtl.getBoundingClientRect();
      const onLeft = rtl.firstElementChild!.getBoundingClientRect().right > left.right - 6;
      await press(onLeft ? left.left + 6 : left.right - 6, left.top + 20);
    } finally {
      ltr.remove();
      rtl.remove();
      style.remove();
    }
  });

  test('a press in a frame closes the popup with `focus-out`; a focused element that leaves the popup closes nothing', async () => {
    const frame = appendOutside('iframe', 'width: 100px; height: 50px');
    try {
      const log: string[] = [];
      await mountPopover({ root: rootEvents(log, { defaultOpen: true }) });
      const element = await opened();
      const extra = element.appendChild(document.createElement('button'));
      extra.focus();
      extra.remove();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(popup()).toBe(element);
      element.querySelector('button')!.focus();
      await userEvent.click(frame);
      await closed();
      expect(log).toEqual(['openChange false focus-out', 'update false']);
    } finally {
      frame.remove();
    }
  });

  test('a move of the focus between two elements outside keeps a popover that a hover opened', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
    });
    byId('before').focus();
    await userEvent.hover(trigger());
    await opened();
    byId('after').focus();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(popup()).not.toBe(null);
  });

  test("a press of the right button outside keeps a `'trap-focus'` popover open", async () => {
    const other = appendOutside('div');
    other.textContent = 'Other';
    try {
      const { trigger } = await mountPopover({ root: { modal: 'trap-focus' }, close: {} });
      await userEvent.click(trigger());
      await opened();
      await userEvent.click(other, { button: 'right' });
      await nextTick();
      expect(popup()).not.toBe(null);
    } finally {
      other.remove();
    }
  });

  test.skipIf(server.browser !== 'chromium')(
    'a touch outside that opens the menu of the system closes nothing at its end, also before 1 s',
    async () => {
      const other = appendOutside('div', 'width: 100px; height: 100px; touch-action: none');
      try {
        await mountPopover({ root: { defaultOpen: true }, popup: { initialFocus: false } });
        await placed();
        // Chromium on Android sends `contextmenu` at a long press of about 650 ms. The protocol
        // injects no long press, so the case sends the event at the press.
        other.addEventListener(
          'pointerdown',
          () => other.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })),
          { once: true },
        );
        await touchDrag(centerOf(other), centerOf(other), 0, 300);
        await nextTick();
        expect(popup()).not.toBe(null);
      } finally {
        other.remove();
      }
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'a touch outside closes at its end after a tap or a drag of more than 5 px, and at a move of more than 10 px; a touch that rests more than 1 s closes nothing',
    async () => {
      const other = appendOutside('div', 'width: 100px; height: 100px; touch-action: none');
      try {
        const events: string[] = [];
        const setup = () => ({
          root: {
            defaultOpen: true,
            onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) =>
              events.push(`${details.reason} ${details.event.type}`),
          },
          popup: { initialFocus: false },
        });
        const point = centerOf(other);
        let current = await mountPopover(setup());
        await placed();
        await touchDrag(point, point, 0, 1200);
        await nextTick();
        expect(popup()).not.toBe(null);
        await touchDrag(point, point, 0);
        await closed();
        current.unmount();
        current = await mountPopover(setup());
        await placed();
        await touchDrag(point, { x: point.x + 8, y: point.y }, 2, 1200);
        await closed();
        current.unmount();
        await mountPopover(setup());
        await placed();
        await touchDrag(point, { x: point.x + 40, y: point.y }, 4);
        await closed();
        expect(events).toEqual([
          'outside-press pointerup',
          'outside-press pointerup',
          'outside-press pointermove',
        ]);
      } finally {
        other.remove();
      }
    },
  );

  test('a popover that a hover opened stays open while the pointer is in its child popup', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
      nested: {},
    });
    await userEvent.hover(trigger());
    await opened();
    await userEvent.click(document.querySelector<HTMLElement>('[data-key="nested"]')!);
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    byTestId('nested-button').dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, composed: true, pointerType: 'mouse' }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).not.toBe(null);
  });
});

describe('modal (3.2, L4 to L6)', () => {
  test('`true` locks the scroll and renders a fixed element with a hole at the trigger; a press on it closes; a press on the trigger closes', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({ root: rootEvents(log, { modal: true }) });
    await userEvent.click(trigger());
    await opened();
    await placed();
    const block = document.querySelector<HTMLElement>(BLOCK)!;
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
    const { trigger } = await mountPopover({
      root: { modal: true },
      close: { 'data-testid': 'close' },
    });
    await userEvent.click(trigger());
    const element = await opened();
    await waitFor(() => expect(byId('before')).toHaveAttribute('inert'));
    expect(byId('outside')).toHaveAttribute('inert');
    expect(element).toHaveAttribute('aria-modal', 'true');
    expect(trigger().closest('[inert]')).toBe(null);
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.keyboard('{Tab}{Tab}{Tab}');
    expect(document.activeElement).toBe(byTestId('first'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byTestId('close'));
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
    const root = reactive<Props>({ open: true, modal: true });
    await mountPopover({ root });
    await opened();
    await waitFor(() => expect(isScrollLocked()).toBe(true));
    mount(OpenModalDialog);
    root.open = false;
    await closed();
    await nextTick();
    expect(isScrollLocked()).toBe(true);
  });

  test('`true` with no Close leaves the rest of the page in use', async () => {
    const { trigger } = await mountPopover({ root: { modal: true } });
    await userEvent.click(trigger());
    await opened();
    await placed();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(byId('before')).not.toHaveAttribute('inert');
  });

  test('a modal popover leaves its backdrop, its child popups, each `aria-live` region and each alert in use, and keeps an `aria-hidden` of the developer after the close', async () => {
    const wrapper = document.body.appendChild(document.createElement('div'));
    const live = wrapper.appendChild(document.createElement('div'));
    live.setAttribute('aria-live', 'polite');
    const sibling = wrapper.appendChild(document.createElement('div'));
    const alert = document.body.appendChild(document.createElement('div'));
    alert.setAttribute('role', 'alert');
    const hidden = document.body.appendChild(document.createElement('div'));
    hidden.setAttribute('aria-hidden', 'true');
    try {
      const { trigger } = await mountPopover({
        root: { modal: 'trap-focus' },
        close: {},
        backdrop: {},
        nested: { root: { defaultOpen: true } },
      });
      await userEvent.click(trigger());
      await opened();
      await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
      await waitFor(() => expect(byId('outside')).toHaveAttribute('aria-hidden', 'true'));
      expect(live.closest('[aria-hidden]')).toBe(null);
      expect(sibling).toHaveAttribute('aria-hidden', 'true');
      expect(alert).not.toHaveAttribute('aria-hidden');
      expect(byTestId('backdrop')).not.toHaveAttribute('aria-hidden');
      expect(byTestId('nested-popup').closest('[aria-hidden]')).toBe(null);
      await userEvent.keyboard('{Escape}');
      await userEvent.keyboard('{Escape}');
      await closed();
      expect(hidden).toHaveAttribute('aria-hidden', 'true');
    } finally {
      wrapper.remove();
      alert.remove();
      hidden.remove();
    }
  });

  test("`'trap-focus'` with a Close closes at the press of an outside element, before the release", async () => {
    const other = appendOutside('div');
    other.textContent = 'Other';
    try {
      const { trigger } = await mountPopover({ root: { modal: 'trap-focus' }, close: {} });
      await userEvent.click(trigger());
      await opened();
      try {
        await userEvent.pointer([{ coords: centerOf(other) }, '[MouseLeft>]']);
        await closed();
      } finally {
        await userEvent.pointer('[/MouseLeft]');
      }
    } finally {
      other.remove();
    }
  });

  test.skipIf(server.browser !== 'chromium')(
    'a modal popover that a touch opened locks the page only when it is as wide as the view',
    async () => {
      const first = await mountPopover({ root: { modal: true } });
      await touchDrag(centerOf(first.trigger()), centerOf(first.trigger()), 0);
      await opened();
      await placed();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(isScrollLocked()).toBe(false);
      first.unmount();
      const wide = await mountPopover({
        root: { modal: true },
        positioner: { style: 'width: 100vw' },
      });
      await touchDrag(centerOf(wide.trigger()), centerOf(wide.trigger()), 0);
      await opened();
      await waitFor(() => expect(isScrollLocked()).toBe(true));
    },
  );

  test('a double click on the fixed element or the backdrop of a popover that stays open selects no text of the page', async () => {
    const words = document.body.appendChild(document.createElement('p'));
    words.textContent = 'Some words of the page';
    const keepOpen = {
      modal: true,
      defaultOpen: true,
      onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) => details.cancel(),
    };
    try {
      const first = await mountPopover({
        root: keepOpen,
        backdrop: { style: 'position: fixed; inset: 0' },
      });
      await opened();
      await placed();
      await userEvent.dblClick(byTestId('backdrop'), { position: centerOf(words) });
      expect(getSelection()!.toString()).toBe('');
      first.unmount();
      await mountPopover({ root: keepOpen });
      await opened();
      await placed();
      const block = document.querySelector<HTMLElement>(BLOCK)!;
      await userEvent.dblClick(block, { position: centerOf(words) });
      expect(getSelection()!.toString()).toBe('');
    } finally {
      words.remove();
      getSelection()!.removeAllRanges();
    }
  });
});

describe('the focus (L7)', () => {
  test('goes to the first tab stop at a press open, to the popup when it has none, and back to the trigger at the close', async () => {
    const { trigger } = await mountPopover();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(trigger());
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = '[data-testid="popup"] button { display: none }';
    onTestFinished(() => style.remove());
    await userEvent.click(trigger());
    const element = await opened();
    await waitFor(() => expect(document.activeElement).toBe(element));
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
    await waitFor(() => expect(document.activeElement).toBe(byTestId('second')));
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
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(trigger());
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('first'));
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

  test('a focus function that gives nothing moves no focus; `initialFocus` gets `keyboard` after a key on the trigger', async () => {
    const calls: string[] = [];
    const { trigger } = await mountPopover({
      popup: {
        initialFocus: (type: string) => {
          calls.push(type);
        },
      },
    });
    trigger().focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await placed();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(trigger());
    expect(calls).toEqual(['keyboard']);
  });

  test('a click with no pointer type, as in Safari before 18.2, takes the type of the press before it', async () => {
    const types: string[] = [];
    const { trigger } = await mountPopover({
      popup: {
        initialFocus: (type: string) => {
          types.push(type);
        },
      },
    });
    await userEvent.click(byId('before'));
    trigger().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await opened();
    await placed();
    await waitFor(() => expect(types).toEqual(['mouse']));
  });

  test('the trigger shows its focus ring after a close with a key', async () => {
    const { trigger } = await mountPopover();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(trigger().matches(':focus-visible')).toBe(true);
  });

  test('the focus that goes back to the trigger scrolls nothing', async () => {
    const spacer = document.body.appendChild(document.createElement('div'));
    spacer.style.height = '3000px';
    try {
      const { trigger } = await mountPopover();
      await userEvent.click(trigger());
      await opened();
      await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
      window.scrollTo({ top: 1000, behavior: 'instant' });
      await userEvent.keyboard('{Escape}');
      await closed();
      expect(window.scrollY).toBe(1000);
    } finally {
      spacer.remove();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  });

  test.skipIf(server.browser !== 'chromium')(
    'a touch open focuses the popup, not its first tab stop',
    async () => {
      const { trigger } = await mountPopover();
      await touchDrag(centerOf(trigger()), centerOf(trigger()), 0);
      const element = await opened();
      await waitFor(() => expect(document.activeElement).toBe(element));
    },
  );

  test('an element with `autofocus` takes the focus at the open', async () => {
    const { trigger } = await mountPopover({ autofocus: true });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('second')));
  });

  test('a press on an outside input closes the popover, and the input keeps the focus', async () => {
    const { trigger } = await mountPopover();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.click(byId('after'));
    await closed();
    expect(document.activeElement).toBe(byId('after'));
  });

  test('Shift+Tab on the trigger of an open popover goes to the element before it', async () => {
    const { trigger } = await mountPopover();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    trigger().focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('before'));
  });

  test('Tab on the trigger of a popover that a hover opened goes to the next element of the page', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
    });
    trigger().focus();
    await userEvent.hover(trigger());
    await opened();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('after'));
  });

  test('Tab from the element before the portal goes to the first tab stop of the popup', async () => {
    await mountPopover({ root: { defaultOpen: true }, popup: { initialFocus: false } });
    await opened();
    await placed();
    byId('outside').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('first'));
  });

  test('Tab from the last tab stop of a popup in place goes to the element after the trigger', async () => {
    const { trigger } = await mountPopover({ portal: { disabled: true } });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.keyboard('{Tab}{Tab}');
    await closed();
    expect(document.activeElement).toBe(byId('after'));
  });
});

describe('the trigger (L8)', () => {
  test('a disabled trigger opens nothing; Enter and Space open a trigger that is not a button', async () => {
    const { trigger, unmount } = await mountPopover({
      triggers: [{ key: 't', attrs: { disabled: true } }],
    });
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

  test('VUE-73: a popup that unmounts while the popover is open leaves no aria-controls and no sentinel', async () => {
    const scene = reactive({ popup: true });
    const { trigger } = await mountPopover({ root: { defaultOpen: true }, scene });
    const element = await opened();
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-controls', element.id));
    scene.popup = false;
    await closed();
    await nextTick();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).not.toHaveAttribute('aria-controls');
    expect(document.querySelectorAll('span[tabindex="0"][aria-hidden="true"]')).toHaveLength(0);
  });
});

describe('the hover (L9)', () => {
  test('VUE-171: a pointer that crosses another hover trigger in the triangle to the popup moves nothing; one that rests there moves the popup', async () => {
    const { trigger } = await mountPopover({
      triggers: [
        { key: 'a', attrs: { id: 'a', openOnHover: true, delay: 0 } },
        { key: 'b', attrs: { id: 'b', openOnHover: true, delay: 0 } },
      ],
      popup: { style: 'width: 400px; height: 100px' },
    });
    await userEvent.hover(trigger('a'));
    const element = await opened();
    await placed();
    const start = centerOf(trigger('a'));
    const box = element.getBoundingClientRect();
    const to = { x: box.right - 10, y: box.top + 10 };
    // From the trigger across the trigger `b`, toward the far corner of the popup.
    const points = Array.from({ length: 12 }, (_, index) => {
      const t = (index + 1) / 12;
      return { x: start.x + (to.x - start.x) * t, y: start.y + (to.y - start.y) * t };
    });
    const crossed = points.find((point) =>
      trigger('b').contains(document.elementFromPoint(point.x, point.y)),
    );
    expect(crossed).toBeDefined();
    await movePointerThrough(start, points);
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'true');
    expect(trigger('b')).toHaveAttribute('aria-expanded', 'false');
    await movePointerThrough(to, [crossed!]);
    await waitFor(() => expect(trigger('b')).toHaveAttribute('aria-expanded', 'true'));
  });

  test('a mouse that rests on the trigger opens after `delay` and takes no focus; it closes after the pointer leaves', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({
      root: rootEvents(log),
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 50 } }],
    });
    await userEvent.hover(trigger());
    await opened();
    await placed();
    await new Promise((resolve) => requestAnimationFrame(resolve));
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

  test.each(['bottom', 'top', 'right', 'left'] as const)(
    'with the popup on the %s side, a move on the trigger and a move in the triangle to the popup keep it open; a move out of the triangle closes it',
    async (side) => {
      const { trigger } = await mountPopover({
        triggers: [
          { key: 't', attrs: { openOnHover: true, delay: 0, style: 'margin: 150px 200px' } },
        ],
        positioner: { side, sideOffset: 20, collisionAvoidance: { side: 'none' } },
      });
      await userEvent.hover(trigger());
      const element = await opened();
      await placed();
      const box = trigger().getBoundingClientRect();
      const center = centerOf(trigger());
      const step = {
        bottom: { x: 0, y: 1 },
        top: { x: 0, y: -1 },
        right: { x: 1, y: 0 },
        left: { x: -1, y: 0 },
      }[side];
      const reach = { x: box.width / 2 + 5, y: box.height / 2 + 5 };
      const edge = { x: center.x + step.x * reach.x, y: center.y + step.y * reach.y };
      const away = { x: center.x - step.x * reach.x, y: center.y - step.y * reach.y };
      const to = centerOf(element);
      await moveMouse([{ x: center.x + 2, y: center.y }]);
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(popup()).toBe(element);
      await moveMouse([edge, { x: (edge.x + to.x) / 2, y: (edge.y + to.y) / 2 }, to]);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(popup()).toBe(element);
      await moveMouse([center, edge, away]);
      await closed();
    },
  );

  test('a press in the first 500 ms after a hover open keeps the popover open as after a press', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
    });
    // A press command can come more than 500 ms after the open on a busy machine. The click of the
    // DOM comes in the task of the open.
    const pressed = readWhen(
      () => popup() !== null,
      () => {
        trigger().click();
        return popup();
      },
    );
    await userEvent.hover(trigger());
    const element = await pressed;
    await nextTick();
    expect(popup()).toBe(element);
    expect(trigger()).toHaveAttribute('data-pressed');
  });

  test.skipIf(server.browser !== 'chromium')(
    'a touch that rests on the trigger for `delay` opens the popover as a press, with no hover open',
    async () => {
      const log: string[] = [];
      const { trigger } = await mountPopover({
        root: rootEvents(log),
        triggers: [{ key: 't', attrs: { openOnHover: true, delay: 50 } }],
      });
      await touchDrag(centerOf(trigger()), centerOf(trigger()), 0, 600);
      await opened();
      expect(log).toEqual(['openChange true trigger-press', 'update true']);
    },
  );

  test('a hover opens nothing on a trigger with aria-disabled', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0, 'aria-disabled': 'true' } }],
    });
    await userEvent.hover(trigger());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).toBe(null);
  });

  test('a modal popover that a hover opened has no fixed element, no lock and no inert page; the backdrop lets the pointer through', async () => {
    const { trigger } = await mountPopover({
      root: { modal: true },
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
      backdrop: {},
      close: {},
    });
    await userEvent.hover(trigger());
    await opened();
    await placed();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(positioner()!.previousElementSibling).toBe(byTestId('backdrop'));
    expect(byTestId('backdrop').style.pointerEvents).toBe('none');
    expect(isScrollLocked()).toBe(false);
    expect(byId('before')).not.toHaveAttribute('inert');
  });

  test('a pointer that moves from one hover trigger to another moves the popup to that trigger at once', async () => {
    const { trigger } = await mountPopover({
      triggers: [
        { key: 'a', attrs: { id: 'a', openOnHover: true, delay: 40 } },
        { key: 'b', attrs: { id: 'b', openOnHover: true, delay: 10_000 } },
      ],
    });
    await userEvent.hover(trigger('a'));
    await opened();
    await userEvent.hover(trigger('b'));
    await waitFor(() => expect(trigger('b')).toHaveAttribute('aria-expanded', 'true'));
    await moveMouse([centerOf(trigger('b'))]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(popup()).not.toBe(null);
  });

  test('a hover on the trigger while the popup leaves after a hover close opens the popover at once; the popup enters after the leave', async () => {
    const log: string[] = [];
    const trigger = reactive<Props>({ openOnHover: true, delay: 0 });
    mount(PopoverInTransition, { root: rootEvents(log), trigger });
    const element = document.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    await userEvent.hover(element);
    const first = await opened();
    trigger.delay = 10_000;
    // The hover comes in the task where the leave starts. A close in the enter reverses its
    // transition, so the leave can end in some milliseconds, before a command ends.
    const reopened = readWhen(
      () => first.classList.contains('pop-leave-active'),
      () => element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    );
    await userEvent.hover(appendOutside('button'));
    await reopened;
    await nextTick();
    expect(log.at(-2)).toBe('openChange true trigger-hover');
    await waitFor(() => expect(popup() ?? first).not.toBe(first));
  });

  test('a hover asks for nothing while the popover is open with no active trigger', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({
      root: rootEvents(log, { defaultOpen: true }),
      triggers: [
        { key: 'a', attrs: { openOnHover: true, delay: 0 } },
        { key: 'b', attrs: { openOnHover: true, delay: 0 } },
      ],
    });
    await opened();
    await userEvent.hover(appendOutside('button'));
    for (const key of ['a', 'b']) {
      await userEvent.hover(trigger(key));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(log).toEqual([]);
    expect(document.querySelectorAll('[aria-expanded="true"]')).toHaveLength(0);
  });

  test('a hover opens after the pointer rests on the trigger for `delay`; a pointer that leaves before that opens nothing', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 60 } }],
    });
    const center = centerOf(trigger());
    const send = (type: string, x = center.x) =>
      trigger().dispatchEvent(
        new PointerEvent(type, { pointerType: 'mouse', clientX: x, clientY: center.y }),
      );
    send('pointerenter');
    await new Promise((resolve) => setTimeout(resolve, 20));
    send('pointerleave');
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(popup()).toBe(null);
    send('pointerenter');
    for (let index = 1; index <= 4; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      send('pointermove', center.x + index);
    }
    expect(popup()).toBe(null);
    await opened();
  });

  test('a popover that a hover opened closes when the pointer leaves the page', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
    });
    await userEvent.hover(trigger());
    await opened();
    document.documentElement.dispatchEvent(
      new PointerEvent('pointerleave', { pointerType: 'mouse' }),
    );
    await closed();
  });

  test('a hover close comes `closeDelay` after the pointer left, also while the pointer moves', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0, closeDelay: 60 } }],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await placed();
    const outside = centerOf(byId('outside'));
    const moves = Array.from({ length: 12 }, (_, index) => ({
      x: outside.x + index,
      y: outside.y,
    }));
    await moveMouse([centerOf(element), ...moves]);
    expect(popup()).toBe(null);
  });

  test('a pointer that comes back to the trigger keeps the time of the hover open: a press after 500 ms closes', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await placed();
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.hover(element);
    await userEvent.hover(trigger());
    await new Promise((resolve) => setTimeout(resolve, 20));
    await userEvent.click(trigger());
    await closed();
  });

  test('a popover with `openOnHover` that a press opened stays open after the pointer leaves its trigger', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 300, closeDelay: 0 } }],
    });
    await userEvent.click(trigger());
    await opened();
    await placed();
    await moveMouse([centerOf(trigger()), centerOf(byId('outside'))]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(popup()).not.toBe(null);
  });

  test('a popover with `openOnHover` that `defaultOpen` opened closes after the pointer leaves its trigger', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({
      root: rootEvents(log, { defaultOpen: true }),
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0, closeDelay: 0 } }],
    });
    await opened();
    await placed();
    await userEvent.hover(trigger());
    await userEvent.hover(byId('outside'));
    await closed();
    expect(log).toEqual(['openChange false trigger-hover', 'update false']);
  });

  test('a hover on the trigger while the popup leaves after a hover close opens it with no delay', async () => {
    mount(PopoverInTransition, {
      root: { defaultOpen: true },
      trigger: { openOnHover: true, delay: 5000, closeDelay: 0 },
    });
    await opened();
    await placed();
    const trigger = document.querySelector<HTMLElement>('[aria-haspopup="dialog"]')!;
    await userEvent.hover(trigger);
    // The hover comes in the task where the leave starts: the leave of 100 ms can end before a
    // command ends.
    const atReopen = readWhen(
      () => trigger.getAttribute('aria-expanded') === 'false',
      async () => {
        const leaving = popup();
        trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
        await nextTick();
        return { leaving, expanded: trigger.getAttribute('aria-expanded') };
      },
    );
    await userEvent.pointer({ coords: { x: innerWidth - 2, y: innerHeight - 2 } });
    const { leaving, expanded } = await atReopen;
    expect(leaving).not.toBe(null);
    expect(expanded).toBe('true');
  });

  test('an Escape stops the pending hover open of another trigger', async () => {
    const { trigger } = await mountPopover({
      triggers: [
        { key: 'a', attrs: { id: 'a' } },
        { key: 'b', attrs: { id: 'b', openOnHover: true, delay: 100 } },
      ],
    });
    await userEvent.click(trigger('a'));
    await opened();
    trigger('b').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await userEvent.keyboard('{Escape}');
    await closed();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(popup()).toBe(null);
  });
});

describe('the placement (L10)', () => {
  test.each(['inline-end', 'inline-start'] as const)(
    'writes the side, the alignment and the variables; `%s` follows the direction of the positioner',
    async (side) => {
      await mountPopover({
        root: { defaultOpen: true },
        triggers: [{ key: 't', attrs: { style: 'margin: 0 150px' } }],
        positioner: { side, align: 'start', dir: 'rtl' },
      });
      await opened();
      await placed();
      const element = positioner()!;
      expect(element).toHaveAttribute('data-side', side);
      expect(element).toHaveAttribute('data-align', 'start');
      expect(element.style.getPropertyValue('--anchor-width')).toMatch(/px$/);
      expect(element.style.getPropertyValue('--available-height')).toMatch(/px$/);
      const trigger = document.querySelector('[data-key="t"]')!.getBoundingClientRect();
      const place = element.getBoundingClientRect();
      if (side === 'inline-end') expect(place.right).toBeLessThanOrEqual(trigger.left + 1);
      else expect(place.left).toBeGreaterThanOrEqual(trigger.right - 1);
    },
  );

  test('the popup stays at its place after its trigger leaves the DOM', async () => {
    const triggers = reactive([{ key: 't' }]);
    await mountPopover({ root: { defaultOpen: true }, triggers });
    await opened();
    await placed();
    const place = positioner()!.getBoundingClientRect().toJSON();
    triggers.splice(0, 1);
    await nextTick();
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(positioner()!.getBoundingClientRect().toJSON()).toEqual(place);
  });

  test('a popup that leaves stays at its place when its trigger moves', async () => {
    const log: string[] = [];
    mount(PopoverInTransition, {
      root: { defaultOpen: true },
      log: { add: (entry: string) => log.push(entry) },
    });
    await opened();
    await waitFor(() => expect(log).toEqual(['after-enter']));
    const place = positioner()!.getBoundingClientRect().toJSON();
    // The move and the check start in the task where the leave starts: the leave of 100 ms can end
    // before a command ends.
    const placeInLeave = readWhen(
      () => popup()?.classList.contains('pop-leave-active') === true,
      async () => {
        document.querySelector<HTMLElement>('[aria-haspopup="dialog"]')!.style.marginLeft = '100px';
        await new Promise((resolve) => setTimeout(resolve, 60));
        return positioner()!.getBoundingClientRect().toJSON();
      },
    );
    await userEvent.keyboard('{Escape}');
    expect(await placeInLeave).toEqual(place);
  });

  describe('at an anchor', () => {
    let anchor: HTMLElement;
    function placeAnchor(style: string) {
      anchor = document.body.appendChild(document.createElement('div'));
      anchor.style.cssText = `position: fixed; ${style}`;
      return anchor;
    }
    afterEach(() => anchor.remove());

    test('`anchor` places the popup at another element', async () => {
      placeAnchor('left: 300px; top: 200px; width: 50px; height: 20px');
      await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor, align: 'start' },
        popup: { style: 'width: 100px' },
      });
      await opened();
      await placed();
      const place = positioner()!.getBoundingClientRect();
      expect([Math.round(place.left), Math.round(place.top)]).toEqual([300, 220]);
    });

    test('a popup with a `max-height` from `--available-height` opens on the side where its capped height fits', async () => {
      placeAnchor(`left: 100px; top: ${innerHeight - 170}px; width: 50px; height: 20px`);
      await mountPopover({
        root: { defaultOpen: true },
        positioner: {
          anchor,
          style: 'max-height: min(120px, var(--available-height)); overflow: hidden',
        },
        popup: { style: 'height: 200px' },
      });
      await opened();
      await placed();
      expect(positioner()).toHaveAttribute('data-side', 'bottom');
    });

    test('the first frame shows a popup on the top side at its place, with the height that `--available-height` caps', async () => {
      placeAnchor('left: 100px; top: 300px; width: 50px; height: 20px');
      const root = reactive<Props>({ open: false });
      await mountPopover({
        root,
        positioner: {
          anchor,
          side: 'top',
          collisionAvoidance: { side: 'none' },
          style: 'max-height: var(--available-height); overflow: hidden',
        },
        popup: { style: `height: ${innerHeight}px` },
      });
      root.open = true;
      const first = await new Promise<DOMRect>((resolve) =>
        requestAnimationFrame(() => resolve(positioner()!.getBoundingClientRect())),
      );
      expect(Math.round(first.bottom)).toBe(300);
    });

    test('`--anchor-width` covers the device pixels of an anchor at a fractional place', async () => {
      placeAnchor('left: 10.3px; top: 200px; width: 100.4px; height: 20px');
      await mountPopover({ root: { defaultOpen: true }, positioner: { anchor } });
      await opened();
      await placed();
      const rect = anchor.getBoundingClientRect();
      const ratio = devicePixelRatio;
      const covered =
        (Math.round((rect.x + rect.width) * ratio) - Math.round(rect.x * ratio)) / ratio;
      expect(covered).not.toBe(rect.width);
      expect(positioner()!.style.getPropertyValue('--anchor-width')).toBe(`${covered}px`);
    });

    test('an aligned popup moves so that its arrow points at a small anchor; an arrow that cannot point at the center is `data-uncentered`; a large `arrowPadding` keeps the arrow in the popup', async () => {
      const arrow = { style: 'width: 20px; height: 10px' };
      // A popup with a fractional width has an arrow a fraction of a pixel off the center.
      const sized = { style: 'width: 100px' };
      placeAnchor('left: 300px; top: 200px; width: 10px; height: 10px');
      const first = await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor, align: 'start' },
        popup: sized,
        arrow,
      });
      await opened();
      await placed();
      await waitFor(() => expect(byTestId('arrow').style.left).toMatch(/px$/));
      expect(Math.round(positioner()!.getBoundingClientRect().left)).toBe(290);
      expect(byTestId('arrow')).not.toHaveAttribute('data-uncentered');
      first.unmount();
      anchor.style.left = '0px';
      const second = await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor },
        popup: sized,
        arrow,
      });
      await opened();
      await placed();
      await waitFor(() => expect(byTestId('arrow')).toHaveAttribute('data-uncentered'));
      second.unmount();
      anchor.style.left = '300px';
      await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor, arrowPadding: 1000 },
        arrow,
      });
      await opened();
      await placed();
      await waitFor(() => expect(byTestId('arrow').style.left).toMatch(/px$/));
      const popupBox = popup()!.getBoundingClientRect();
      const arrowBox = byTestId('arrow').getBoundingClientRect();
      expect(arrowBox.right).toBeLessThanOrEqual(popupBox.right + 1);
    });

    test('an arrow that mounts while the popup is open points at the center of the anchor', async () => {
      placeAnchor('left: 300px; top: 200px; width: 50px; height: 20px');
      const later = reactive({ arrow: false });
      await mountPopover({ root: { defaultOpen: true }, positioner: { anchor }, later });
      await opened();
      await placed();
      later.arrow = true;
      await waitFor(() => {
        const arrow = document.querySelector('[data-testid="arrow"]')!.getBoundingClientRect();
        expect(Math.abs(arrow.left + arrow.width / 2 - 325)).toBeLessThanOrEqual(1);
      });
    });

    test('the alignment flips at the edge of the view; with `side: shift`, the popup shifts and keeps its alignment, and grows from the anchor', async () => {
      placeAnchor(`left: ${innerWidth - 40}px; top: 200px; width: 20px; height: 20px`);
      const wide = { style: 'width: 200px' };
      const first = await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor, align: 'start' },
        popup: wide,
      });
      await opened();
      await placed();
      expect(positioner()).toHaveAttribute('data-align', 'end');
      first.unmount();
      await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor, align: 'start', collisionAvoidance: { side: 'shift' } },
        popup: wide,
      });
      await opened();
      await placed();
      expect(positioner()).toHaveAttribute('data-align', 'start');
      expect(positioner()!.style.getPropertyValue('--transform-origin')).not.toMatch(/^0%/);
    });

    test('with `side: shift`, a popup that a shift moved over its anchor grows from the center of the anchor', async () => {
      placeAnchor(`left: 300px; top: ${innerHeight - 30}px; width: 50px; height: 20px`);
      await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor, sideOffset: 4, collisionAvoidance: { side: 'shift' } },
        popup: { style: 'height: 200px' },
      });
      await opened();
      await placed();
      expect(positioner()!.style.getPropertyValue('--transform-origin')).not.toMatch(/ -4px$/);
    });

    test('a popup stays at an anchor that left the view; with `sticky`, it shifts into the view', async () => {
      placeAnchor('left: -150px; top: 200px; width: 100px; height: 20px');
      const first = await mountPopover({ root: { defaultOpen: true }, positioner: { anchor } });
      await opened();
      await placed();
      expect(Math.round(positioner()!.getBoundingClientRect().left)).toBe(-50);
      first.unmount();
      await mountPopover({ root: { defaultOpen: true }, positioner: { anchor, sticky: true } });
      await opened();
      await placed();
      expect(Math.round(positioner()!.getBoundingClientRect().left)).toBe(5);
    });

    test('a popup that fits on neither side of its axis goes to the end side of the other axis', async () => {
      placeAnchor(`left: 100px; top: ${innerHeight / 2}px; width: 50px; height: 20px`);
      await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor },
        popup: { style: `height: ${innerHeight + 50}px; width: 100px` },
      });
      await opened();
      await placed();
      expect(positioner()).toHaveAttribute('data-side', 'right');
    });

    test('a fixed popup follows its anchor at a scroll of the page; `disableAnchorTracking` stops it', async () => {
      placeAnchor('left: 100px; top: 200px; width: 50px; height: 20px');
      anchor.style.position = 'absolute';
      const spacer = document.body.appendChild(document.createElement('div'));
      spacer.style.height = '3000px';
      try {
        const tracked = await mountPopover({
          root: { defaultOpen: true },
          positioner: { anchor, positionMethod: 'fixed', align: 'start' },
        });
        await opened();
        await placed();
        window.scrollTo({ top: 50, behavior: 'instant' });
        await waitFor(() =>
          expect(Math.round(positioner()!.getBoundingClientRect().top)).toBe(170),
        );
        tracked.unmount();
        window.scrollTo({ top: 0, behavior: 'instant' });
        await mountPopover({
          root: { defaultOpen: true },
          positioner: {
            anchor,
            positionMethod: 'fixed',
            align: 'start',
            disableAnchorTracking: true,
          },
        });
        await opened();
        await placed();
        window.scrollTo({ top: 50, behavior: 'instant' });
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(Math.round(positioner()!.getBoundingClientRect().top)).toBe(220);
      } finally {
        spacer.remove();
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
  });
});

describe('more behaviors of the parts', () => {
  test('the popup is named by its title and described by its description; an attribute of the developer wins', async () => {
    const { unmount } = await mountPopover({
      root: { defaultOpen: true },
      title: { id: 'name' },
      description: { id: 'about' },
    });
    const element = await opened();
    expect(element).toHaveAttribute('aria-labelledby', 'name');
    expect(element).toHaveAttribute('aria-describedby', 'about');
    unmount();
    await mountPopover({
      root: { defaultOpen: true },
      title: { id: 'name' },
      popup: { 'aria-labelledby': 'own' },
    });
    expect(await opened()).toHaveAttribute('aria-labelledby', 'own');
  });

  test('the popup is named by a title that replaces another one', async () => {
    const title = reactive({ key: 'a', id: 'title-a' });
    await mountPopover({ root: { defaultOpen: true }, title });
    const element = await opened();
    expect(element).toHaveAttribute('aria-labelledby', 'title-a');
    Object.assign(title, { key: 'b', id: 'title-b' });
    await nextTick();
    await nextTick();
    expect(element.querySelector('h2')).toHaveAttribute('id', 'title-b');
    expect(element).toHaveAttribute('aria-labelledby', 'title-b');
  });

  test('a press on Close closes with `close-press`; a disabled Close closes nothing', async () => {
    const log: string[] = [];
    const close = reactive<Props>({ disabled: true });
    await mountPopover({ root: rootEvents(log, { defaultOpen: true }), close });
    const element = await opened();
    await placed();
    const button = element.querySelector<HTMLElement>('button:last-of-type')!;
    expect(button).toHaveTextContent('Close');
    await userEvent.click(button, { force: true });
    expect(popup()).not.toBe(null);
    close.disabled = false;
    await nextTick();
    await userEvent.click(button);
    await closed();
    expect(log).toEqual(['openChange false close-press', 'update false']);
  });

  test('a press on the backdrop of a child closes only the child', async () => {
    const log: string[] = [];
    await mountPopover({
      root: rootEvents(log, { defaultOpen: true }),
      nested: { root: { defaultOpen: true, modal: true, onOpenChange: () => log.push('child') } },
    });
    await opened();
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    await placed();
    const block = [...document.querySelectorAll<HTMLElement>(BLOCK)].at(-1)!;
    await waitFor(() => expect(block.style.clipPath).toContain('polygon'));
    await userEvent.click(block, { position: { x: 2, y: 2 } });
    await waitFor(() => expect(document.querySelector('[data-testid="nested-popup"]')).toBe(null));
    expect(popup()).not.toBe(null);
    expect(log).toEqual(['child']);
  });

  test('VUE-61: a modal popover renders no fixed element and locks nothing while it has no positioner', async () => {
    await mountPopover({ root: { defaultOpen: true, modal: true }, noPortal: true });
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.querySelector(BLOCK)).toBe(null);
    expect(isScrollLocked()).toBe(false);
  });

  test('the focus goes back to the element that had it before the open when the trigger left the DOM', async () => {
    const triggers = reactive([{ key: 't' }]);
    const { trigger } = await mountPopover({ triggers });
    byId('before').focus();
    trigger().click();
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    triggers.splice(0, 1);
    await nextTick();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(byId('before'));
  });

  test('`finalFocus` of `false` moves no focus at the close; `initialFocus` of `false` moves no focus at the open', async () => {
    const { trigger } = await mountPopover({ popup: { initialFocus: false, finalFocus: false } });
    await userEvent.click(trigger());
    await opened();
    await placed();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // WebKit gives a pressed button no focus.
    expect(popup()!.contains(document.activeElement)).toBe(false);
    popup()!.querySelector('button')!.focus();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(document.body);
  });

  test('a trigger in a disabled fieldset opens nothing; its state follows the fieldset', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
    });
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    trigger().before(fieldset);
    fieldset.append(trigger());
    await waitFor(() => expect(trigger()).toBeDisabled());
    await userEvent.click(trigger(), { force: true });
    await userEvent.hover(trigger(), { force: true });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(popup()).toBe(null);
  });

  test('a hover closes the popover when the pointer moves to another trigger that does not open on hover', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({
      root: rootEvents(log),
      triggers: [
        { key: 'a', attrs: { id: 'a', openOnHover: true, delay: 0 } },
        { key: 'b', attrs: { id: 'b' } },
      ],
    });
    await userEvent.hover(trigger('a'));
    await opened();
    await userEvent.hover(trigger('b'));
    await closed();
    expect(log.at(-2)).toBe('openChange false trigger-hover');
  });

  test('a pending hover open stops at a close request of a closed root', async () => {
    const { trigger, exposed } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 80 } }],
    });
    // The close request comes in the task of the `pointerenter`, after the listener of the trigger:
    // the open waits 80 ms, and a command can take more time.
    trigger().addEventListener('pointerenter', () => exposed.root.close(), { once: true });
    await userEvent.hover(trigger());
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(popup()).toBe(null);
  });

  test('a press after 500 ms closes a popover that a hover opened', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
    });
    await userEvent.hover(trigger());
    await opened();
    await new Promise((resolve) => setTimeout(resolve, 550));
    await userEvent.click(trigger());
    await closed();
  });

  test('the instant state is `click` after a key on the trigger, and empty after a press', async () => {
    const { trigger } = await mountPopover();
    trigger().focus();
    await userEvent.keyboard('{Enter}');
    const element = await opened();
    expect(element).toHaveAttribute('data-instant', 'click');
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.click(trigger());
    expect(await opened()).not.toHaveAttribute('data-instant');
  });

  test('the transform origin is the edge that faces the anchor, and the aligned edge of a popup with no arrow', async () => {
    await mountPopover({
      root: { defaultOpen: true },
      positioner: { align: 'start', sideOffset: 4 },
    });
    await opened();
    await placed();
    expect(positioner()!.style.getPropertyValue('--transform-origin')).toBe('0% -4px');
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
    await waitFor(() =>
      expect(byTestId('viewport')).toHaveAttribute('data-activation-direction', 'right '),
    );
    await waitFor(() => expect(element.querySelectorAll('.content')).toHaveLength(1));
    expect(element.querySelector('.content')).toHaveTextContent('Two');
    expect(log).toContain('leave');
    expect(log).toContain('enter');
  });

  test('a move gives the popup its old size, then its new size, and no size when its animation ends; then the popup has `data-instant` of `trigger-change`', async () => {
    mount(PopoverViewportParts, {});
    await nextTick();
    await userEvent.click(byId('one'));
    const element = await opened();
    await placed();
    await waitFor(() => expect(element.getAnimations()).toEqual([]));
    const old = `${element.offsetHeight}px`;
    const popupSizes: string[] = [];
    const positionerSizes: string[] = [];
    const record = (list: string[], value: string) => {
      if (list.at(-1) !== value) list.push(value);
    };
    let animated = false;
    const observer = new MutationObserver(() => {
      record(popupSizes, element.style.getPropertyValue('--popup-height'));
      record(positionerSizes, positioner()!.style.getPropertyValue('--positioner-height'));
      if (element.getAnimations().length > 0) {
        animated = true;
        expect(element).not.toHaveAttribute('data-instant');
        expect(element.style.getPropertyValue('--popup-height')).not.toBe('');
      }
    });
    observer.observe(element, { attributes: true });
    observer.observe(positioner()!, { attributes: true });
    await userEvent.click(byId('two'));
    await waitFor(() => expect(element).toHaveAttribute('data-instant', 'trigger-change'));
    observer.disconnect();
    const [start, next, end] = popupSizes;
    expect([popupSizes.length, start, end]).toEqual([3, old, '']);
    expect(next).not.toBe(old);
    expect(positionerSizes).toEqual([old, next, `${element.offsetHeight}px`]);
    expect(animated).toBe(true);
  });

  test.each(['top', 'left'] as const)(
    'a popup with a viewport on the %s side has insets from the edges that face the trigger',
    async (side) => {
      mount(PopoverViewportParts, {
        positioner: { side, sideOffset: 4, collisionAvoidance: { side: 'none' } },
      });
      await nextTick();
      await userEvent.click(byId('two'));
      await opened();
      await placed();
      const trigger = byId('two').getBoundingClientRect();
      const place = positioner()!.getBoundingClientRect();
      if (side === 'top') {
        expect(positioner()!.style.bottom).toMatch(/px$/);
        expect(Math.round(place.bottom)).toBe(Math.round(trigger.top - 4));
      } else {
        expect(positioner()!.style.right).toMatch(/px$/);
        expect(Math.round(place.right)).toBe(Math.round(trigger.left - 4));
      }
    },
  );

  test('a parent that closes and opens the root after a move gives the new popup no `data-instant`', async () => {
    const root = reactive<Props>({
      open: false,
      'onUpdate:open': (open: boolean) => (root.open = open),
    });
    mount(PopoverViewportParts, { root });
    await nextTick();
    await userEvent.click(byId('one'));
    await opened();
    await userEvent.click(byId('two'));
    await waitFor(() => expect(popup()).toHaveAttribute('data-instant', 'trigger-change'));
    root.open = false;
    await closed();
    root.open = true;
    expect(await opened()).not.toHaveAttribute('data-instant');
  });
});

describe('in a toolbar', () => {
  const button = (name: string) =>
    [...document.querySelectorAll('button')].find((element) => element.textContent === name)!;

  test('does not relay composite keys from the popup to the toolbar', async () => {
    mount(PopoverInToolbar);
    await nextTick();
    // The toolbar moves its focus with the same key, so the last assertion does not come from a
    // toolbar that takes no key.
    button('First').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(button('Open'));
    await userEvent.keyboard('{Enter}');
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(button('Inside')));
    await userEvent.keyboard('{ArrowRight}');
    await nextTick();
    expect(document.activeElement).toBe(button('Inside'));
  });

  test('keeps composite keys working inside the popup content', async () => {
    mount(PopoverInToolbar, { content: 'input' });
    await nextTick();
    await userEvent.click(button('Open'));
    await opened();
    const input = document.querySelector<HTMLInputElement>('[data-testid="popup"] input')!;
    await waitFor(() => expect(document.activeElement).toBe(input));
    input.setSelectionRange(0, 0);
    await userEvent.keyboard('{ArrowRight}');
    expect(input.selectionStart).toBe(1);
    expect(document.activeElement).toBe(input);
  });

  test('keeps the focus in a popup that a portal puts in the toolbar', async () => {
    mount(PopoverInToolbar, { defaultOpen: true, portalInToolbar: true });
    const element = await opened();
    expect(document.querySelector('[role="toolbar"]')!.contains(element)).toBe(true);
    button('Inside').focus();
    await userEvent.keyboard('{ArrowRight}');
    await nextTick();
    expect(document.activeElement).toBe(button('Inside'));
  });
});

describe('with a dialog', () => {
  const press = async (element: Element) =>
    userEvent.pointer({ coords: centerOf(element), keys: '[MouseLeft]' });
  const button = (text: string) =>
    [...document.querySelectorAll('button')].find((element) => element.textContent === text)!;
  const popover = () => document.querySelector('[data-testid="popover"]');

  test.each([true, false])(
    'VUE-4: a press on the backdrop of a dialog with modal=%s in a popover closes only the dialog',
    async (modal) => {
      const log = new Set<string>();
      mount(PopoverWithDialog, {
        variant: 'dialog-in-popover',
        dialog: { defaultOpen: true, modal },
        log,
      });
      await waitFor(() => expect(byTestId('dialog')).toBeTruthy());
      await press(byTestId('backdrop'));
      await waitFor(() => expect(document.querySelector('[data-testid="dialog"]')).toBe(null));
      expect(byTestId('popover')).toBeTruthy();
      expect([...log]).toEqual(['dialog false outside-press']);
    },
  );

  test('a press on the backdrop of a modal popover in a dialog closes only the popover', async () => {
    const log = new Set<string>();
    mount(PopoverWithDialog, { variant: 'popover-in-dialog', dialog: { modal: false }, log });
    await waitFor(() => expect(document.querySelector('[data-testid="popover"]')).not.toBe(null));
    await press(byTestId('backdrop'));
    await waitFor(() => expect(document.querySelector('[data-testid="popover"]')).toBe(null));
    expect(byTestId('dialog')).toBeTruthy();
    expect([...log]).toEqual(['popover false outside-press']);
  });

  test('Escape closes a dialog in a popover after a press on its backdrop, and the popover stays', async () => {
    const log = new Set<string>();
    mount(PopoverWithDialog, {
      variant: 'dialog-in-popover',
      dialog: { disablePointerDismissal: true },
      log,
    });
    await waitFor(() => expect(popover()).not.toBe(null));
    await userEvent.click(button('Open dialog'));
    await waitFor(() => expect(byTestId('input')).toHaveFocus());
    await press(byTestId('backdrop'));
    expect(byTestId('input')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[data-testid="dialog"]')).toBe(null));
    expect(byTestId('popover')).toBeTruthy();
    expect([...log]).toEqual(['dialog true trigger-press', 'dialog false escape-key']);
  });

  test.each([
    { name: 'a press on a button', submits: false },
    { name: 'Enter in a field of a form', submits: true },
  ])(
    'a popover stays open at $name in a modal dialog outside its tree that opened after it',
    async ({ submits }) => {
      const log = new Set<string>();
      mount(PopoverWithDialog, { variant: 'dialog-after', log });
      await waitFor(() => expect(popover()).not.toBe(null));
      await userEvent.click(button('Open dialog'));
      await waitFor(() => expect(byTestId('input')).toHaveFocus());
      if (submits) await userEvent.keyboard('{Enter}');
      else await press(button('Inside dialog'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(byTestId('dialog')).toBeTruthy();
      expect(byTestId('popover')).toBeTruthy();
      expect([...log]).toEqual(submits ? ['submit'] : []);
    },
  );

  test('a press in a modal dialog that opened before the popover closes the popover', async () => {
    const log = new Set<string>();
    mount(PopoverWithDialog, { variant: 'dialog-before', log });
    await waitFor(() => expect(byTestId('dialog')).toBeTruthy());
    await userEvent.click(button('Open popover'));
    await waitFor(() => expect(popover()).not.toBe(null));
    await press(button('Inside dialog'));
    await waitFor(() => expect(popover()).toBe(null));
    expect(byTestId('dialog')).toBeTruthy();
    expect([...log]).toEqual(['popover true trigger-press', 'popover false outside-press']);
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('a part outside its parent', () => {
  test('throws an error that names the part with no root, and Positioner with no Portal', () => {
    expect(String(mountError(PopoverPartAlone, { part: 'Popup' }))).toContain(
      '<Popover.Popup> must be inside <Popover.Root>',
    );
    expect(String(mountError(PopoverPartAlone, { part: 'Trigger' }))).toContain(
      '<Popover.Trigger> must be inside <Popover.Root>',
    );
    expect(String(mountError(PopoverPartAlone, { part: 'Positioner', inRoot: true }))).toContain(
      '<Popover.Positioner> must be inside <Popover.Portal>',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
