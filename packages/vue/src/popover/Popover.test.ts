import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Popover, type PopoverRootChangeEventDetails } from '@vase-ui/vue/popover';
import OpenModalDialog from '../../test/fixtures/OpenModalDialog.vue';
import PopoverCloseTooltip from '../../test/fixtures/PopoverCloseTooltip.vue';
import PopoverHandles from '../../test/fixtures/PopoverHandles.vue';
import PopoverInToolbar from '../../test/fixtures/PopoverInToolbar.vue';
import PopoverInTransition from '../../test/fixtures/PopoverInTransition.vue';
import PopoverPartAlone from '../../test/fixtures/PopoverPartAlone.vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import PopoverViewportParts from '../../test/fixtures/PopoverViewportParts.vue';
import PopoverWithNestedPopup from '../../test/fixtures/PopoverWithNestedPopup.vue';
import PopoverWithDialog from '../../test/fixtures/PopoverWithDialog.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { firePointer, movePointerThrough, touchDrag } from '../../test/pointer';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { scaleOrigin } from '../../test/scaleOrigin';
import {
  finishAnimations,
  mostMatches,
  opacityUntilRest,
  shownOpacity,
} from '../../test/animation';
import { readWhen, waitSingleFrame } from '../../test/wait';
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

  test('a Close outside the popup renders its button while the popover is closed', async () => {
    const { root } = mount(PopoverPartAlone, { part: 'Close', inRoot: true });
    await nextTick();
    expect(root.querySelector('button')).toHaveAttribute('type', 'button');
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

describe('the root', () => {
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

  test('a press on the trigger closes the popover, and the element of `finalFocus` gets the focus', async () => {
    const { trigger } = await mountPopover({ popup: { finalFocus: () => byId('before') } });
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(trigger());
    await closed();
    expect(document.activeElement).toBe(byId('before'));
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

  test('`open` wins over `defaultOpen`; cancel() of an open keeps the popover closed; close() of a closed root emits nothing', async () => {
    const first = await mountPopover({ root: { defaultOpen: true, open: false } });
    await nextTick();
    expect(popup()).toBe(null);
    first.unmount();
    const log: string[] = [];
    const root = rootEvents(log);
    root.onOpenChange = (open: boolean, details: PopoverRootChangeEventDetails) => {
      log.push(`openChange ${open} ${details.reason}`);
      details.cancel();
    };
    const { trigger, exposed } = await mountPopover({ root });
    await userEvent.click(trigger());
    await nextTick();
    expect(popup()).toBe(null);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).not.toHaveAttribute('data-pressed');
    exposed.root.close();
    expect(log).toEqual(['openChange true trigger-press']);
  });

  test('a popup with an `id` of the developer has it, and the trigger names it in `aria-controls`; `defaultTriggerId` of the second trigger gives its payload', async () => {
    const { trigger } = await mountPopover({
      root: { defaultOpen: true, defaultTriggerId: 'b' },
      triggers: [
        { key: 'a', attrs: { id: 'a', payload: 'A' } },
        { key: 'b', attrs: { id: 'b', payload: 'B' } },
      ],
      popup: { id: 'TestId' },
    });
    const element = await opened();
    expect(element).toHaveAttribute('id', 'TestId');
    expect(trigger('b')).toHaveAttribute('aria-controls', 'TestId');
    expect(byTestId('payload')).toHaveTextContent('B');
  });

  test('a move to another trigger keeps the popup element; after the active trigger leaves, a close names no trigger', async () => {
    const triggers: (Element | undefined)[] = [];
    const list = reactive([
      { key: 'a', attrs: { id: 'a' } },
      { key: 'b', attrs: { id: 'b' } },
    ]);
    const { trigger } = await mountPopover({
      root: {
        onOpenChange: (open: boolean, details: PopoverRootChangeEventDetails) =>
          !open && triggers.push(details.trigger),
      },
      triggers: list,
    });
    await userEvent.click(trigger('a'));
    const element = await opened();
    await placed();
    const place = positioner();
    await userEvent.click(trigger('b'));
    await waitFor(() => expect(trigger('b')).toHaveAttribute('aria-expanded', 'true'));
    expect(popup()).toBe(element);
    expect(positioner()).toBe(place);
    list.splice(1, 1);
    await nextTick();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(triggers).toEqual([undefined]);
  });

  test('a close after the parent moved the popup to another trigger keeps that trigger and its payload', async () => {
    const root = reactive<Props>({ open: true, triggerId: 'a' });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    const { trigger } = await mountPopover({
      root,
      triggers: [
        { key: 'a', attrs: { id: 'a', payload: 'A' } },
        { key: 'b', attrs: { id: 'b', payload: 'B' } },
      ],
      portal: { keepMounted: true },
    });
    const element = await opened();
    root.triggerId = 'b';
    await waitFor(() => expect(trigger('b')).toHaveAttribute('aria-expanded', 'true'));
    await placed();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    expect(trigger('b')).toHaveAttribute('aria-expanded', 'false');
    expect(byTestId('payload')).toHaveTextContent('B');
  });

  test('a parent that closes the root at its mount, or in the update after a press opens it, leaves no popup', async () => {
    const root = reactive<Props>({ open: true });
    const first = await mountPopover({ root });
    root.open = false;
    await closed();
    expect(first.trigger()).toHaveAttribute('aria-expanded', 'false');
    first.unmount();
    const refusing = reactive<Props>({
      open: false,
      'onUpdate:open': (open: boolean) => {
        refusing.open = open;
        if (open) void nextTick(() => (refusing.open = false));
      },
    });
    const { trigger } = await mountPopover({ root: refusing });
    await userEvent.click(trigger());
    await closed();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  test('a popup in a <Transition> that the parent closes at the mount does not render, and the portal keeps no element', async () => {
    const log: string[] = [];
    const root = reactive<Props>({ open: true });
    mount(PopoverInTransition, { root, log: { add: (entry: string) => log.push(entry) } });
    root.open = false;
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(popup()).toBe(null);
    expect(positioner()).toBe(null);
    expect(document.querySelector('[data-testid="backdrop"]')).toBe(null);
    expect(log).toEqual([]);
  });

  test('the details of a close name the active trigger: a press on Close, a press outside and Escape', async () => {
    const triggers: (string | undefined)[] = [];
    const { trigger } = await mountPopover({
      root: {
        onOpenChange: (open: boolean, details: PopoverRootChangeEventDetails) =>
          !open && triggers.push(`${details.reason} ${details.trigger?.id}`),
      },
      triggers: [
        { key: 'a', attrs: { id: 'a' } },
        { key: 'b', attrs: { id: 'b' } },
      ],
      close: { 'data-testid': 'close' },
    });
    await userEvent.click(trigger('b'));
    await opened();
    await userEvent.click(byTestId('close'));
    await closed();
    await userEvent.click(trigger('b'));
    await opened();
    await userEvent.click(byId('outside'));
    await closed();
    await userEvent.click(trigger('b'));
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(triggers).toEqual(['close-press b', 'outside-press b', 'escape-key b']);
  });

  test('cancel() at a press on Close keeps the popover open for its trigger', async () => {
    const triggers: (Element | undefined)[] = [];
    const { trigger } = await mountPopover({
      root: {
        onOpenChange: (open: boolean, details: PopoverRootChangeEventDetails) => {
          if (open || details.reason !== 'close-press') return;
          triggers.push(details.trigger);
          details.cancel();
        },
      },
      triggers: [
        { key: 'a', attrs: { id: 'a' } },
        { key: 'b', attrs: { id: 'b' } },
      ],
      close: { 'data-testid': 'close' },
    });
    await userEvent.click(trigger('b'));
    await opened();
    await userEvent.click(byTestId('close'));
    await nextTick();
    expect(popup()).not.toBe(null);
    expect(trigger('b')).toHaveAttribute('aria-expanded', 'true');
    expect(triggers).toEqual([trigger('b')]);
  });

  test('a press on Close names the element of the last active trigger when `trigger-id` names no trigger, and no trigger when no trigger had it', async () => {
    const triggers: (Element | undefined)[] = [];
    const onOpenChange = (_: boolean, details: PopoverRootChangeEventDetails) =>
      triggers.push(details.trigger);
    const root = reactive<Props>({ open: true, triggerId: 'a', onOpenChange });
    const first = await mountPopover({
      root,
      triggers: [{ key: 'a', attrs: { id: 'a' } }],
      close: { 'data-testid': 'close' },
    });
    await opened();
    root.triggerId = 'missing';
    await nextTick();
    await userEvent.click(byTestId('close'));
    expect(triggers).toEqual([first.trigger('a')]);
    first.unmount();
    triggers.length = 0;
    await mountPopover({
      root: { defaultOpen: true, defaultTriggerId: 'missing', onOpenChange },
      triggers: [],
      close: { 'data-testid': 'close' },
    });
    await opened();
    // A popup with no anchor has no place, and it stays hidden.
    byTestId('close').click();
    await closed();
    expect(triggers).toEqual([undefined]);
  });

  test('after a close by a trigger, an open by the parent keeps that trigger: a press on it closes the popover, and the focus goes back to it', async () => {
    const root = reactive<Props>({
      open: false,
      'onUpdate:open': (open: boolean) => (root.open = open),
    });
    const { trigger } = await mountPopover({
      root,
      triggers: [
        { key: 'a', attrs: { id: 'a' } },
        { key: 'b', attrs: { id: 'b' } },
      ],
    });
    await userEvent.click(trigger('a'));
    await opened();
    await userEvent.click(trigger('a'));
    await closed();
    root.open = true;
    await opened();
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(trigger('a'));
    await closed();
    (document.activeElement as HTMLElement).blur();
    root.open = true;
    await opened();
    await placed();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(trigger('a'));
  });
});

describe('the handle', () => {
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

  test('a close and an open in one task keep the popup, which takes the focus again', async () => {
    const handle = Popover.createHandle<string>();
    mount(PopoverHandles, { handle });
    await nextTick();
    await userEvent.click(byId('first'));
    const element = await opened();
    await waitFor(() => expect(element).toHaveFocus());
    handle.close();
    expect(element).not.toHaveFocus();
    handle.open('second');
    await waitFor(() => expect(element).toHaveFocus());
    expect(popup()).toBe(element);
    expect(element).toHaveTextContent('second');
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
    expect(takeReportedMessages()).toEqual([
      'console.warn: Vase UI: `open()` of a handle found no mounted root with this handle. The call does nothing.',
    ]);
    await userEvent.click(byId('first'));
    expect(detached.isOpen).toBe(false);
    expect(byId('first')).toHaveAttribute('aria-expanded', 'false');
  });

  test('a handle follows its root when the root unmounts and mounts again', async () => {
    const handle = Popover.createHandle();
    const first = mount(PopoverHandles, { handle });
    await nextTick();
    first.unmount();
    mount(PopoverHandles, { handle, noRoot: true });
    await nextTick();
    handle.open('first');
    expect(handle.isOpen).toBe(false);
    expect(takeReportedMessages()).toEqual([
      'console.warn: Vase UI: `open()` of a handle found no mounted root with this handle. The call does nothing.',
    ]);
    mount(PopoverHandles, { handle });
    await nextTick();
    handle.open('second');
    expect(await opened()).toHaveTextContent('second');
    expect(handle.isOpen).toBe(true);
  });

  test('a second press on a trigger outside the root closes the popover', async () => {
    mount(PopoverHandles, { handle: Popover.createHandle() });
    await nextTick();
    await userEvent.click(byId('second'));
    await opened();
    await userEvent.click(byId('second'));
    await closed();
    expect(byId('second')).toHaveAttribute('aria-expanded', 'false');
  });

  test('open(id) in the `onMounted` of a child of the root opens the popover', async () => {
    const handle = Popover.createHandle();
    mount(PopoverHandles, { handle, atMount: () => handle.open('inside') });
    expect(await opened()).toBeTruthy();
    expect(handle.isOpen).toBe(true);
    expect(byId('inside')).toHaveAttribute('aria-expanded', 'true');
  });

  test('a parent that opens the root for a trigger with no focus change gives the focus to that trigger at the close', async () => {
    const root = reactive<Props>({
      open: false,
      triggerId: null,
      'onUpdate:open': (open: boolean) => (root.open = open),
      'onUpdate:triggerId': (id: string | null) => (root.triggerId = id),
    });
    const { trigger } = await mountPopover({
      root,
      triggers: [
        { key: 'a', attrs: { id: 'a' } },
        { key: 'b', attrs: { id: 'b' } },
      ],
      close: { 'data-testid': 'close' },
    });
    await userEvent.click(trigger('a'));
    await opened();
    await userEvent.click(byTestId('close'));
    await closed();
    expect(document.activeElement).toBe(trigger('a'));
    trigger('a').blur();
    root.triggerId = 'b';
    root.open = true;
    await opened();
    await placed();
    await userEvent.click(byTestId('close'));
    await closed();
    expect(document.activeElement).toBe(trigger('b'));
  });
});

describe('in the DOM', () => {
  test('a popup and a backdrop in a <Transition> get the leave classes after a close, and the portal keeps them until each leave ends', async () => {
    // The leaves of 100 ms and 250 ms can end before the command ends. So the case reads the page
    // when the leave of the popup starts, and when it ends.
    const log: string[] = [];
    const backdropsAtPopupEnd: (Element | null)[] = [];
    mount(PopoverInTransition, {
      root: { defaultOpen: true },
      log: {
        add(entry: string) {
          log.push(entry);
          if (entry === 'after-leave') {
            backdropsAtPopupEnd.push(document.querySelector('[data-testid="backdrop"]'));
          }
        },
      },
    });
    const element = await opened();
    const backdrop = byTestId('backdrop');
    await waitFor(() => expect(log).toEqual(['after-enter']));
    const atLeave = readWhen(
      () => element.classList.contains('pop-leave-active') || !element.isConnected,
      () => ({
        classes: [element.className, backdrop.className],
        positioner: positioner(),
      }),
    );
    await userEvent.keyboard('{Escape}');
    const { classes, positioner: positionerAtLeave } = await atLeave;
    expect(classes[0]).toContain('pop-leave-active');
    expect(classes[1]).toContain('fade-leave-active');
    expect(positionerAtLeave).not.toBe(null);
    await waitFor(() =>
      expect(log).toEqual(['after-enter', 'after-leave', 'backdrop-after-leave']),
    );
    expect(backdropsAtPopupEnd).toEqual([backdrop]);
    await waitFor(() => expect(positioner()).toBe(null));
  });

  test('an open while the popup leaves keeps the popup and the backdrop, which go back from where they are', async () => {
    const log = new Set<string>();
    const root = reactive<Props>({ open: true });
    mount(PopoverInTransition, {
      root,
      popup: { class: 'slow' },
      backdrop: { class: 'slow' },
      log,
    });
    const first = await opened();
    const backdrop = byTestId('backdrop');
    await Promise.all([finishAnimations(first), finishAnimations(backdrop)]);
    await waitFor(() => expect(log.has('after-enter')).toBe(true));
    const popups = mostMatches('[data-testid="popup"]');
    root.open = false;
    await waitFor(() => expect(shownOpacity(first)).toBeLessThan(0.8));
    const atOpen = [first, backdrop].map(shownOpacity);
    root.open = true;
    const frames = await opacityUntilRest([first, backdrop]);
    expect(popup()).toBe(first);
    expect(byTestId('backdrop')).toBe(backdrop);
    expect(popups()).toBe(1);
    expect(log.has('after-leave') || log.has('backdrop-after-leave')).toBe(false);
    frames.forEach((opacities, index) => {
      expect(Math.min(...opacities)).toBeGreaterThan(atOpen[index]! - 0.15);
      expect(opacities.at(-1)).toBe(1);
    });
  });

  test('an open by another trigger while the popup leaves shows the same popup at that trigger, with its payload, in the first frame', async () => {
    mount(PopoverInTransition, {
      trigger: { payload: 'first' },
      second: { payload: 'second' },
      popup: { class: 'slow' },
    });
    await nextTick();
    const triggers = ['trigger', 'second-trigger'].map(byTestId);
    await userEvent.click(triggers[0]!);
    const element = await opened();
    await placed();
    await finishAnimations(element);
    await waitFor(() => expect(element).not.toHaveClass('pop-enter-active'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(element).toHaveClass('pop-leave-active'));
    triggers[1]!.click();
    await nextTick();
    const firstFrame = await new Promise<{ payload: string; offset: number }>((resolve) =>
      requestAnimationFrame(() => {
        const box = positioner()!.getBoundingClientRect();
        const anchor = triggers[1]!.getBoundingClientRect();
        resolve({
          payload: byTestId('payload').textContent,
          offset: box.left + box.width / 2 - (anchor.left + anchor.width / 2),
        });
      }),
    );
    expect(popup()).toBe(element);
    expect(firstFrame.payload).toBe('second');
    expect(Math.abs(firstFrame.offset)).toBeLessThan(1);
  });

  test('the popup that leaves keeps the payload of its close when the parent clears the trigger', async () => {
    const root = reactive<Props>({
      triggerId: 'a',
      'onUpdate:triggerId': (id: string | null) => (root.triggerId = id),
      onOpenChange: (open: boolean) => {
        if (!open) root.triggerId = null;
      },
    });
    mount(PopoverInTransition, {
      root,
      trigger: { id: 'a', payload: 'first' },
      second: { id: 'b', payload: 'second' },
      popup: { class: 'slow' },
    });
    await nextTick();
    await userEvent.click(byTestId('trigger'));
    const element = await opened();
    await finishAnimations(element);
    await waitFor(() => expect(element).not.toHaveClass('pop-enter-active'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(element).toHaveClass('pop-leave-active'));
    expect(root.triggerId).toBe(null);
    await nextTick();
    expect(byTestId('payload')).toHaveTextContent('first');
  });

  test('an open while the popup leaves gives the focus to the popup again', async () => {
    mount(PopoverInTransition, { popup: { class: 'slow' } });
    await nextTick();
    const trigger = byTestId('trigger');
    await userEvent.click(trigger);
    const element = await opened();
    const inside = element.querySelector('button')!;
    await waitFor(() => expect(inside).toHaveFocus());
    await finishAnimations(element);
    await waitFor(() => expect(element).not.toHaveClass('pop-enter-active'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(element).toHaveClass('pop-leave-active'));
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await waitFor(() => expect(inside).toHaveFocus());
    expect(popup()).toBe(element);
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

describe('the portal', () => {
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

  test('a portal whose `to` is `null` at first renders in the container that it gets later, and moves to a new container', async () => {
    const first = document.body.appendChild(document.createElement('div'));
    const second = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => {
      first.remove();
      second.remove();
    });
    const portal = reactive<Props>({ to: null });
    await mountPopover({ root: { defaultOpen: true }, portal });
    await nextTick();
    expect(popup()).toBe(null);
    portal.to = first;
    await waitFor(() => expect(first.contains(popup())).toBe(true));
    portal.to = second;
    await waitFor(() => expect(second.contains(popup())).toBe(true));
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

describe('the dismissal', () => {
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

  test('an Escape that closes the popover has its default prevented; an Escape that cancel() keeps has not', async () => {
    const root = reactive<Props>({
      defaultOpen: true,
      onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) => details.cancel(),
    });
    await mountPopover({ root });
    const button = (await opened()).querySelector('button')!;
    const escape = () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      button.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(escape()).toBe(false);
    root.onOpenChange = undefined;
    await nextTick();
    expect(escape()).toBe(true);
    await closed();
  });

  test('a click outside closes the popover also when the target stops its propagation', async () => {
    const other = appendOutside('div');
    other.textContent = 'Other';
    other.addEventListener('click', (event) => event.stopPropagation());
    other.addEventListener('pointerdown', (event) => event.stopPropagation());
    await mountPopover({ root: { defaultOpen: true } });
    await opened();
    await placed();
    await userEvent.click(other);
    await closed();
  });

  test('of two popovers that are not nested, a press in the later one keeps the earlier open, and a press in the earlier one closes the later; Escape closes the later one first', async () => {
    const earlier = await mountPopover({
      root: { defaultOpen: true },
      popup: { 'data-name': 'earlier' },
    });
    await placed();
    const later = await mountPopover({
      root: { defaultOpen: true },
      popup: { 'data-name': 'later' },
    });
    const named = (name: string) => document.querySelector<HTMLElement>(`[data-name="${name}"]`);
    await waitFor(() => expect(named('later')).not.toBe(null));
    const laterPopup = named('later')!;
    // The later popup opens under the trigger of its own app, below the earlier app.
    await waitFor(() =>
      expect(laterPopup.closest<HTMLElement>('[data-testid="positioner"]')!.style.visibility).toBe(
        '',
      ),
    );
    await userEvent.click(laterPopup.querySelector('p') ?? laterPopup, {
      position: { x: 2, y: 2 },
    });
    expect(named('earlier')).not.toBe(null);
    expect(named('later')).not.toBe(null);
    named('later')!.querySelector('button')!.blur();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(named('later')).toBe(null));
    expect(named('earlier')).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(named('earlier')).toBe(null));
    later.unmount();
    earlier.unmount();
  });

  test('a close of a child popover by a key, then a focus that leaves both popups, closes the parent with `focus-out`', async () => {
    const log: string[] = [];
    await mountPopover({ root: rootEvents(log, { defaultOpen: true }), nested: {} });
    await opened();
    await placed();
    await userEvent.click(document.querySelector<HTMLElement>('[data-key="nested"]')!);
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[data-testid="nested-popup"]')).toBe(null));
    byId('after').focus();
    await closed();
    expect(log).toEqual(['openChange false focus-out', 'update false']);
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

  test('an Escape after a composition that ended with no `compositionend` closes the popover', async () => {
    const log: string[] = [];
    await mountPopover({ root: rootEvents(log, { defaultOpen: true }) });
    const element = await opened();
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    element.querySelector('button')!.focus();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(log).toEqual(['openChange false escape-key', 'update false']);
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
    'a touch outside closes at the `pointerup` of a tap, also of a tap that moves 8 px; a touch that rests more than 1 s or that moves 9 px closes nothing',
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
        const current = await mountPopover(setup());
        await placed();
        await touchDrag(point, point, 0, 1200);
        await touchDrag(point, { x: point.x + 9, y: point.y }, 3);
        await nextTick();
        expect(popup()).not.toBe(null);
        await touchDrag(point, point, 0);
        await closed();
        current.unmount();
        await mountPopover(setup());
        await placed();
        await touchDrag(point, { x: point.x + 8, y: point.y }, 2);
        await closed();
        expect(events).toEqual(['outside-press pointerup', 'outside-press pointerup']);
      } finally {
        other.remove();
      }
    },
  );

  test('VUE-172: a dispatched touch outside closes at the `pointerup` of a tap; a touch that moves more than 8 px, that rests 1 s, that opens the menu of the system or that the browser cancels closes nothing', async () => {
    const other = appendOutside('div', 'width: 100px; height: 100px');
    const events: string[] = [];
    await mountPopover({
      root: {
        defaultOpen: true,
        onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) =>
          events.push(`${details.reason} ${details.event.type}`),
      },
      popup: { initialFocus: false },
    });
    await placed();
    const { x, y } = centerOf(other);
    const touch = { pointerType: 'touch', isPrimary: true, clientX: x, clientY: y };
    const moved = { ...touch, clientX: x + 6, clientY: y + 6 };
    await firePointer.down(other, { ...touch, timeStamp: 1000 });
    await firePointer.move(other, { ...moved, timeStamp: 1050 });
    await firePointer.up(other, { ...moved, timeStamp: 1100 });
    await firePointer.down(other, { ...touch, timeStamp: 2000 });
    await firePointer.up(other, { ...touch, timeStamp: 3000 });
    await firePointer.down(other, { ...touch, timeStamp: 4000 });
    await firePointer.cancel(other, { ...touch, timeStamp: 4050 });
    await firePointer.down(other, { ...touch, timeStamp: 4500 });
    other.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    await firePointer.up(other, { ...touch, timeStamp: 4600 });
    expect(events).toEqual([]);
    await firePointer.down(other, { ...touch, timeStamp: 5000 });
    await firePointer.up(other, { ...touch, timeStamp: 5999 });
    await closed();
    expect(events).toEqual(['outside-press pointerup']);
  });

  test('a press on a backdrop closes at its release and not at the press; so does a press on the fixed element of a modal popover', async () => {
    const log: string[] = [];
    const first = await mountPopover({
      root: rootEvents(log, { defaultOpen: true }),
      backdrop: { style: 'position: fixed; inset: 0' },
    });
    await opened();
    await placed();
    const point = { x: innerWidth / 2, y: innerHeight - 60 };
    expect(document.elementFromPoint(point.x, point.y)).toBe(byTestId('backdrop'));
    await userEvent.pointer([{ coords: point }, '[MouseLeft>]']);
    await nextTick();
    expect(popup()).not.toBe(null);
    expect(log).toEqual([]);
    await userEvent.pointer('[/MouseLeft]');
    await closed();
    expect(log).toEqual(['openChange false outside-press', 'update false']);
    first.unmount();
    log.length = 0;
    const modal = await mountPopover({ root: rootEvents(log, { modal: true }) });
    await userEvent.click(modal.trigger());
    await opened();
    await placed();
    expect(document.elementFromPoint(point.x, point.y)).toBe(document.querySelector(BLOCK));
    await userEvent.pointer([{ coords: point }, '[MouseLeft>]']);
    await nextTick();
    expect(popup()).not.toBe(null);
    await userEvent.pointer('[/MouseLeft]');
    await closed();
    expect(log.at(-2)).toBe('openChange false outside-press');
  });

  test('a popup in a shadow root closes at a press on another element of that root and at a press outside the host, with the reason `outside-press` and its trigger', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadow = host.attachShadow({ mode: 'open' });
    const container = shadow.appendChild(document.createElement('div'));
    const other = shadow.appendChild(document.createElement('div'));
    other.textContent = 'Other';
    other.style.cssText = 'position: fixed; left: 0; bottom: 0';
    const outside = appendOutside('div', 'left: 200px');
    outside.textContent = 'Outside';
    const inShadow = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    try {
      for (const [target, modal] of [
        [other, false],
        [outside, false],
        [outside, 'trap-focus'],
      ] as const) {
        const triggers: string[] = [];
        const { unmount } = mount(
          PopoverParts,
          {
            root: {
              defaultOpen: true,
              modal,
              onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) =>
                triggers.push(`${details.reason} ${details.trigger?.textContent?.trim()}`),
            },
            portal: { to: container },
            popup: { initialFocus: modal ? undefined : false },
            ...(modal && { close: {} }),
          },
          container,
        );
        await waitFor(() => expect(inShadow('positioner')?.style.visibility).toBe(''));
        await userEvent.click(target);
        await waitFor(() => expect(inShadow('popup')).toBe(null));
        expect(triggers).toEqual(['outside-press t']);
        unmount();
      }
    } finally {
      host.remove();
    }
  });

  test('VUE-221: a press on an outside element that takes the focus closes a popover that is not modal at the release, with `outside-press`', async () => {
    const log: string[] = [];
    await mountPopover({ root: rootEvents(log, { defaultOpen: true }) });
    await opened();
    await placed();
    byTestId('first').focus();
    try {
      await userEvent.pointer([{ coords: centerOf(byId('after')) }, '[MouseLeft>]']);
      await nextTick();
      expect(document.activeElement).toBe(byId('after'));
      expect(popup()).not.toBe(null);
    } finally {
      await userEvent.pointer('[/MouseLeft]');
    }
    await closed();
    expect(document.activeElement).toBe(byId('after'));
    expect(log).toEqual(['openChange false outside-press', 'update false']);
  });

  test('VUE-221: an outside press closes the popover also when a capture listener of the document stops its click; details.cancel() keeps it open', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { defaultOpen: true });
    const { trigger } = await mountPopover({ root });
    await opened();
    await placed();
    const stop = (event: Event) => event.stopPropagation();
    document.addEventListener('click', stop, true);
    onTestFinished(() => document.removeEventListener('click', stop, true));
    await userEvent.click(byId('outside'));
    await closed();
    expect(log).toEqual(['openChange false outside-press', 'update false']);
    root.onOpenChange = (open: boolean, details: PopoverRootChangeEventDetails) => {
      log.push(`openChange ${open} ${details.reason}`);
      if (!open) details.cancel();
    };
    document.removeEventListener('click', stop, true);
    await userEvent.click(trigger());
    await opened();
    await placed();
    document.addEventListener('click', stop, true);
    log.length = 0;
    await userEvent.click(byId('outside'));
    await waitFor(() => expect(log).toEqual(['openChange false outside-press']));
    await nextTick();
    expect(popup()).not.toBe(null);
  });

  test.skipIf(server.browser !== 'chromium')(
    'a touch that scrolls in a child popup keeps both popups open',
    async () => {
      await mountPopover({
        root: { defaultOpen: true },
        nested: { root: { defaultOpen: true }, popup: { style: 'height: 60px; overflow: auto' } },
      });
      await opened();
      await placed();
      await waitFor(() => expect(byTestId('nested-positioner').style.visibility).toBe(''));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const start = centerOf(byTestId('nested-button'));
      await touchDrag(start, { x: start.x, y: start.y - 40 });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector('[data-testid="nested-popup"]')).not.toBe(null);
      expect(popup()).not.toBe(null);
    },
  );

  test('a press that starts in a child popup and ends outside keeps both popups open; a press in the parent popup closes the child', async () => {
    const log: string[] = [];
    await mountPopover({
      root: rootEvents(log, { defaultOpen: true }),
      nested: { root: { defaultOpen: true, onOpenChange: () => log.push('child') } },
    });
    await opened();
    await placed();
    await waitFor(() => expect(byTestId('nested-positioner').style.visibility).toBe(''));
    // The parent popup can take its place again after the child opens, so the press waits for the
    // frame after that.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await userEvent.pointer([
      { coords: centerOf(byTestId('nested-button')) },
      '[MouseLeft>]',
      { coords: centerOf(byId('outside')) },
      '[/MouseLeft]',
    ]);
    await nextTick();
    expect(log).toEqual([]);
    expect(document.querySelector('[data-testid="nested-popup"]')).not.toBe(null);
    expect(popup()).not.toBe(null);
    await userEvent.click(byTestId('second'));
    await waitFor(() => expect(document.querySelector('[data-testid="nested-popup"]')).toBe(null));
    expect(popup()).not.toBe(null);
    expect(log).toEqual(['child']);
  });

  test('a press outside closes a popover after a press removed its focused element', async () => {
    const other = appendOutside('div');
    other.textContent = 'Other';
    await mountPopover({ root: { defaultOpen: true, modal: 'trap-focus' }, close: {} });
    const element = await opened();
    await placed();
    const first = byTestId('first');
    await waitFor(() => expect(document.activeElement).toBe(first));
    first.addEventListener('pointerdown', () => first.remove(), { once: true });
    await userEvent.pointer([{ coords: centerOf(first) }, '[MouseLeft>]', '[/MouseLeft]']);
    expect(popup()).toBe(element);
    await userEvent.click(other);
    await closed();
  });

  test('a popover that a key opened after a touch in its popup closes at a click with no press outside', async () => {
    const { trigger } = await mountPopover();
    await userEvent.click(trigger());
    const element = await opened();
    element.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', button: 0 }),
    );
    element.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', button: 0 }),
    );
    await userEvent.keyboard('{Escape}');
    await closed();
    trigger().focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await placed();
    byId('outside').click();
    await closed();
  });

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

describe('modal', () => {
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

  test.each([
    { name: 'the trigger', selector: '[data-key="t"]', focused: true },
    { name: 'an outside input', selector: '#before', focused: false },
  ])(
    '`true` with a Close gives the focus to an `initialFocus` element outside the popup that stays in use, and none to one that becomes inert: $name',
    async ({ selector, focused }) => {
      const element = () => document.querySelector<HTMLElement>(selector)!;
      await mountPopover({
        root: { defaultOpen: true, modal: true },
        close: {},
        popup: { initialFocus: element },
      });
      await opened();
      await placed();
      await waitFor(() => expect(byId('before')).toHaveAttribute('inert'));
      await waitSingleFrame();
      expect(document.activeElement).toBe(focused ? element() : document.body);
    },
  );

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

  // Firefox takes the scroll of `<body>` (useScrollLock.ts), and the margin of `<body>` moves the
  // popup.
  test.skipIf(server.browser === 'firefox')(
    'a nested modal popover that locks a scrolled page whose scrollbars take room leaves the open popover in place',
    async () => {
      const style = document.head.appendChild(document.createElement('style'));
      // The page scrolls on both axes. At the offset below, the trigger is in the view.
      style.textContent = 'body { margin: 8px; padding: 600px 0 1000px; width: 3000px }';
      const innerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')!;
      onTestFinished(() => {
        window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
        style.remove();
        Object.defineProperty(window, 'innerWidth', innerWidth);
      });
      window.scrollTo({ left: 30, top: 400, behavior: 'instant' });
      // A scrollbar of 12 px. The frame of a test in Chromium shows no scrollbar.
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: document.documentElement.clientWidth + 12,
      });
      await mountPopover({ root: { defaultOpen: true }, nested: { root: { modal: true } } });
      await opened();
      await placed();
      const place = popup()!.getBoundingClientRect().toJSON();
      // The lock takes the scroll range away, and the scroll event places the popup again.
      const scrolled = new Promise((resolve) => {
        window.addEventListener('scroll', resolve, { once: true });
      });
      await userEvent.click(document.querySelector('[data-key="nested"]')!);
      await waitFor(() => expect(isScrollLocked()).toBe(true));
      await scrolled;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(popup()!.getBoundingClientRect().toJSON()).toEqual(place);
    },
  );

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

  test('`true` with no Close leaves the rest of the page in use; Tab from the last tab stop goes to the element after the trigger and closes the popover', async () => {
    const { trigger } = await mountPopover({ root: { modal: true } });
    await userEvent.click(trigger());
    await opened();
    await placed();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(byId('before')).not.toHaveAttribute('inert');
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.keyboard('{Tab}{Tab}');
    expect(document.activeElement).toBe(byId('after'));
    await closed();
  });

  test('a popover that is not modal renders no fixed element and locks no scroll', async () => {
    const { trigger } = await mountPopover({ root: { modal: false } });
    await userEvent.click(trigger());
    await opened();
    await placed();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.querySelector(BLOCK)).toBe(null);
    expect(positioner()!.previousElementSibling?.getAttribute('role')).not.toBe('presentation');
    expect(isScrollLocked()).toBe(false);
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

  test('a wide popover that a touch opened stays at its trigger when the lock of the page moves the containing block of the positioner', async () => {
    // A scrollbar that takes room makes `<body>` the containing block of the positioner during a
    // lock (useScrollLock.ts), and the margin of `<body>` moves that block. The window reports a
    // scrollbar of 12 px.
    const ownInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', {
      value: document.documentElement.clientWidth + 12,
      configurable: true,
    });
    document.body.style.margin = '8px';
    onTestFinished(() => {
      if (ownInnerWidth) Object.defineProperty(window, 'innerWidth', ownInnerWidth);
      else delete (window as { innerWidth?: number }).innerWidth;
      document.body.style.removeProperty('margin');
    });
    const { trigger } = await mountPopover({
      root: { modal: true },
      positioner: { style: 'width: 100vw' },
    });
    const { x, y } = centerOf(trigger());
    trigger().dispatchEvent(
      new PointerEvent('click', {
        bubbles: true,
        detail: 1,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
      }),
    );
    await opened();
    await waitFor(() => expect(isScrollLocked()).toBe(true));
    const bottom = Math.round(trigger().getBoundingClientRect().bottom);
    await waitFor(() => expect(Math.round(positioner()!.getBoundingClientRect().top)).toBe(bottom));
  });

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

describe('the focus', () => {
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

  test('`initialFocus` and `finalFocus` take an element; a function that gives `true` or `null` keeps the default target', async () => {
    for (const value of [true, null]) {
      const calls: string[] = [];
      const { trigger, unmount } = await mountPopover({
        popup: {
          initialFocus: () => {
            calls.push('initial');
            return value;
          },
          finalFocus: () => {
            calls.push('final');
            return value;
          },
        },
      });
      await userEvent.click(trigger());
      await opened();
      await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
      await userEvent.keyboard('{Escape}');
      await closed();
      expect(document.activeElement).toBe(trigger());
      expect(calls).toEqual(['initial', 'final']);
      unmount();
    }
    const popupProps = reactive<Props>({});
    const { trigger } = await mountPopover({ popup: popupProps, portal: { keepMounted: true } });
    const element = await opened();
    popupProps.initialFocus = byTestId('second');
    popupProps.finalFocus = byId('after');
    await userEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(byTestId('second')));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
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

  test('the trigger shows its focus ring after a close with a key, and not after a close with a press', async () => {
    const { trigger } = await mountPopover({ close: { 'data-testid': 'close' } });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(trigger().matches(':focus-visible')).toBe(true);
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(byTestId('close'));
    await closed();
    expect(document.activeElement).toBe(trigger());
    expect(trigger().matches(':focus-visible')).toBe(false);
  });

  test('a press on an outside element that takes no focus gives the focus back to the trigger', async () => {
    const other = appendOutside('div');
    other.textContent = 'Other';
    const { trigger } = await mountPopover();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.click(other);
    await closed();
    expect(document.activeElement).toBe(trigger());
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

  test('Shift+Tab on the trigger of an open popover goes to the element before it and closes the popover with `focus-out`; on the trigger of a closed kept popover, it asks for nothing', async () => {
    const log: string[] = [];
    const { trigger } = await mountPopover({
      root: rootEvents(log),
      portal: { keepMounted: true },
    });
    const element = await opened();
    trigger().focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('before'));
    expect(log).toEqual([]);
    await userEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    trigger().focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('before'));
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    expect(log.slice(2)).toEqual(['openChange false focus-out', 'update false']);
  });

  test('Tab from the element before the portal goes to the first tab stop of the popup', async () => {
    await mountPopover({ root: { defaultOpen: true }, popup: { initialFocus: false } });
    await opened();
    await placed();
    byId('outside').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('first'));
  });

  test('with `keepMounted`, a press on Close gives the focus to the trigger; after Tab closed the popover, the next open gives the focus to the popup again', async () => {
    const { trigger } = await mountPopover({
      portal: { keepMounted: true },
      close: { 'data-testid': 'close' },
    });
    const element = await opened();
    await userEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.click(byTestId('close'));
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    expect(document.activeElement).toBe(trigger());
    await userEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    byTestId('close').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('after'));
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    await userEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
  });

  test('a popover with `openOnHover` that a press opened in the delay gives the focus to the trigger at a press on Close', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 300 } }],
      close: { 'data-testid': 'close' },
    });
    await userEvent.click(trigger());
    await opened();
    await new Promise((resolve) => setTimeout(resolve, 400));
    await userEvent.click(byTestId('close'));
    await closed();
    expect(document.activeElement).toBe(trigger());
  });

  test('a child popover that code opened gives the focus back to the element that opened it, and the parent gives it to its trigger', async () => {
    const nested = reactive<Props>({
      open: false,
      'onUpdate:open': (open: boolean) => (nested.open = open),
    });
    const { trigger } = await mountPopover({ nested: { root: nested } });
    await userEvent.click(trigger());
    await opened();
    const opener = byTestId('second');
    opener.addEventListener('click', () => (nested.open = true));
    // WebKit gives a pressed button no focus, so a key presses it.
    opener.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(document.activeElement).toBe(byTestId('nested-button')));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[data-testid="nested-popup"]')).toBe(null));
    expect(document.activeElement).toBe(opener);
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(trigger());
  });

  test('an open by the parent after a press opened and closed the popover gives the focus back to the element that had it before the open', async () => {
    const root = reactive<Props>({
      open: false,
      'onUpdate:open': (open: boolean) => (root.open = open),
    });
    const { trigger } = await mountPopover({ root });
    await userEvent.click(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    byId('after').focus();
    root.open = true;
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(byId('after'));
  });

  test('with the popup before the trigger in the document, Tab from its last tab stop goes to the element after the trigger; Shift+Tab from its first goes to the trigger, and Tab goes back', async () => {
    const container = document.body.insertBefore(
      document.createElement('div'),
      document.body.firstChild,
    );
    onTestFinished(() => container.remove());
    const first = await mountPopover({ root: { defaultOpen: true }, portal: { to: container } });
    await opened();
    await placed();
    byTestId('second').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('after'));
    await closed();
    first.unmount();
    const second = await mountPopover({ root: { defaultOpen: true }, portal: { to: container } });
    await opened();
    await placed();
    byTestId('first').focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(second.trigger());
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('first'));
  });

  test('during the leave of the popup, Tab from the trigger goes to the element after the trigger', async () => {
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = '[data-testid="popup"].pop-leave-active { transition: opacity 10s }';
    onTestFinished(() => style.remove());
    const host = document.body.appendChild(document.createElement('div'));
    const after = document.body.appendChild(document.createElement('input'));
    after.setAttribute('aria-label', 'After');
    onTestFinished(() => {
      host.remove();
      after.remove();
    });
    const log: string[] = [];
    mount(PopoverInTransition, { log: { add: (entry: string) => log.push(entry) } }, host);
    const trigger = document.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    await userEvent.click(trigger);
    const element = await opened();
    await waitFor(() => expect(log).toEqual(['after-enter']));
    await waitFor(() => expect(document.activeElement).toBe(element.querySelector('button')));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(element.className).toContain('pop-leave-active'));
    expect(document.activeElement).toBe(trigger);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(after);
    expect(element.isConnected).toBe(true);
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

describe('the trigger', () => {
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

  test('a disabled trigger that is not a button has `aria-disabled` and no tab stop, and a press and a hover open nothing', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { as: 'span', disabled: true, openOnHover: true, delay: 0 } }],
    });
    expect(trigger()).toHaveAttribute('aria-disabled', 'true');
    expect(trigger()).not.toHaveAttribute('disabled');
    await userEvent.click(trigger(), { force: true });
    await userEvent.hover(trigger(), { force: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).toBe(null);
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('after'));
  });

  test('Enter and Space on a trigger that is not a button also close the popover', async () => {
    const { trigger } = await mountPopover({ triggers: [{ key: 't', attrs: { as: 'span' } }] });
    for (const key of ['{Enter}', ' ']) {
      trigger().focus();
      await userEvent.keyboard(key);
      await opened();
      await waitFor(() => expect(document.activeElement).toBe(byTestId('first')));
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      expect(document.activeElement).toBe(trigger());
      await userEvent.keyboard(key);
      await closed();
    }
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

describe('the hover', () => {
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

  test('a press on the trigger keeps a popover open that a parent closed and opened again after a hover open', async () => {
    const root = reactive<Props>({
      open: false,
      'onUpdate:open': (open: boolean) => (root.open = open),
    });
    const { trigger } = await mountPopover({
      root,
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
    });
    await userEvent.hover(trigger());
    await opened();
    await new Promise((resolve) => setTimeout(resolve, 550));
    root.open = false;
    await closed();
    root.open = true;
    await opened();
    await userEvent.click(trigger());
    await nextTick();
    expect(popup()).not.toBe(null);
    expect(trigger()).toHaveAttribute('data-pressed');
  });

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

  test('a hover on the trigger while the popup leaves after a hover close opens the popover at once; the same popup goes back', async () => {
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
    expect(popup()).toBe(first);
    expect(first).not.toHaveClass('pop-leave-active');
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

  test('a press on a trigger of another popup in a popup that a hover opened keeps it open after the pointer leaves; the next hover open closes at a leave again', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0, closeDelay: 0 } }],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await placed();
    byTestId('first').setAttribute('aria-haspopup', 'menu');
    await userEvent.click(byTestId('first'));
    await userEvent.hover(byId('outside'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(popup()).toBe(element);
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.hover(trigger());
    await opened();
    await placed();
    await userEvent.hover(byId('outside'));
    await closed();
  });

  test('of the presses in a popup that a hover opened, only a press on an element with `aria-haspopup` keeps the popup open, also on an item with no tab stop', async () => {
    const { trigger } = await mountPopover({
      triggers: [
        { key: 't', attrs: { openOnHover: true, delay: 0, closeDelay: 0, payload: 'More' } },
      ],
    });
    for (const [pressed, attributes, keeps] of [
      ['payload', { role: 'menuitem', tabindex: '-1', 'aria-haspopup': 'menu' }, true],
      ['first', { 'aria-haspopup': 'false' }, false],
      ['second', {}, false],
    ] as const) {
      await userEvent.hover(trigger());
      const element = await opened();
      await placed();
      for (const [name, value] of Object.entries(attributes)) {
        byTestId(pressed).setAttribute(name, value);
      }
      await userEvent.click(byTestId(pressed));
      await userEvent.hover(byId('outside'));
      if (!keeps) {
        await closed();
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(popup()).toBe(element);
      await userEvent.keyboard('{Escape}');
      await closed();
    }
  });

  test('a popover that the parent or `defaultOpen` opened stays open when the pointer goes into its popup and out', async () => {
    const hoverTrigger = [{ key: 't', attrs: { openOnHover: true, delay: 0, closeDelay: 0 } }];
    const root = reactive<Props>({ open: false });
    const first = await mountPopover({ root, triggers: hoverTrigger });
    root.open = true;
    for (const setup of [first, null]) {
      const current =
        setup ?? (await mountPopover({ root: { defaultOpen: true }, triggers: hoverTrigger }));
      const element = await opened();
      await placed();
      await moveMouse([centerOf(element), centerOf(byId('outside'))]);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(popup()).toBe(element);
      current.unmount();
    }
  });

  test('a hover close waits for `closeDelay` after the pointer leaves', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0, closeDelay: 400 } }],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await placed();
    await userEvent.hover(byId('outside'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(popup()).toBe(element);
    await closed();
  });

  test('a hover open and a hover close leave the focus on the element that has it', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0, closeDelay: 0 } }],
    });
    byId('after').focus();
    await userEvent.hover(trigger());
    await opened();
    await placed();
    await userEvent.hover(byId('outside'));
    await closed();
    expect(document.activeElement).toBe(byId('after'));
  });

  test('a press in the first 500 ms after a hover open makes a modal popover modal', async () => {
    const { trigger } = await mountPopover({
      root: { modal: true },
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
    });
    const pressed = readWhen(
      () => popup() !== null,
      () => {
        const fixedBefore = document.querySelector(BLOCK);
        trigger().click();
        return fixedBefore;
      },
    );
    await userEvent.hover(trigger());
    expect(await pressed).toBe(null);
    await waitFor(() => expect(document.querySelector(BLOCK)).not.toBe(null));
    await waitFor(() => expect(isScrollLocked()).toBe(true));
  });

  test('a hover opens the popover again after a press kept a hover open and a press on Close closed it', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 100 } }],
      close: { 'data-testid': 'close' },
    });
    const pressed = readWhen(
      () => popup() !== null,
      () => trigger().click(),
    );
    await userEvent.hover(trigger());
    await pressed;
    await opened();
    await placed();
    await userEvent.click(byTestId('close'));
    await closed();
    await userEvent.hover(byId('outside'));
    await userEvent.hover(trigger());
    await opened();
  });

  test('a hover open after a close by Escape has no `data-instant`', async () => {
    const { trigger } = await mountPopover({
      triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
      portal: { keepMounted: true },
    });
    await userEvent.click(trigger());
    const element = await opened();
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    expect(element).toHaveAttribute('data-instant', 'dismiss');
    await userEvent.hover(byId('outside'));
    await userEvent.hover(trigger());
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    expect(element).not.toHaveAttribute('data-instant');
  });

  test('Tab and Shift+Tab from the trigger of a popover that a hover opened follow the order of the page, and the popover stays open; a trigger with `tabindex="-1"` has no tab stop', async () => {
    const hoverTrigger = (attrs: Props = {}) => [
      { key: 't', attrs: { openOnHover: true, delay: 0, ...attrs } },
    ];
    const first = await mountPopover({ triggers: hoverTrigger() });
    await userEvent.hover(first.trigger());
    await opened();
    first.trigger().focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('after'));
    first.trigger().focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('before'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(first.trigger()).toHaveAttribute('aria-expanded', 'true');
    first.unmount();
    const second = await mountPopover({ triggers: hoverTrigger({ tabindex: -1 }) });
    await userEvent.hover(second.trigger());
    await opened();
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('after'));
    expect(second.trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  test.skipIf(server.browser !== 'chromium')(
    'a popover that a tap opened stays at its trigger when the mouse rests on another hover trigger; one that a mouse press opened moves',
    async () => {
      const { trigger } = await mountPopover({
        triggers: [
          { key: 'a', attrs: { id: 'a', openOnHover: true, delay: 0, closeDelay: 0 } },
          { key: 'b', attrs: { id: 'b', openOnHover: true, delay: 0, closeDelay: 0 } },
        ],
        popup: { initialFocus: false },
      });
      await touchDrag(centerOf(trigger('a')), centerOf(trigger('a')), 0);
      await opened();
      await userEvent.hover(trigger('b'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(trigger('a')).toHaveAttribute('aria-expanded', 'true');
      expect(trigger('b')).toHaveAttribute('aria-expanded', 'false');
      await userEvent.keyboard('{Escape}');
      await closed();
      await userEvent.click(trigger('a'));
      await opened();
      await userEvent.hover(trigger('b'));
      await waitFor(() => expect(trigger('b')).toHaveAttribute('aria-expanded', 'true'));
    },
  );
});

describe('the placement', () => {
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

  test.each([false, true])(
    'an open popup follows its trigger when the trigger moves (`keepMounted`: %s)',
    async (keepMounted) => {
      const triggers = reactive([{ key: 't', attrs: { style: 'transform: none' } }]);
      await mountPopover({ root: { defaultOpen: true }, triggers, portal: { keepMounted } });
      await opened();
      await placed();
      const top = positioner()!.getBoundingClientRect().top;
      triggers[0]!.attrs.style = 'transform: translateY(100px)';
      await nextTick();
      const bottom = document.querySelector('[data-key="t"]')!.getBoundingClientRect().bottom;
      expect(bottom).toBeGreaterThan(top + 50);
      await waitFor(() =>
        expect(Math.round(positioner()!.getBoundingClientRect().top)).toBe(Math.round(bottom)),
      );
    },
  );

  test('a press on a Close that is also a tooltip trigger names the popover trigger, and the popup that leaves stays at its place', async () => {
    const triggers: (string | undefined)[] = [];
    mount(PopoverCloseTooltip, {
      root: {
        onOpenChange: (_: boolean, details: PopoverRootChangeEventDetails) =>
          triggers.push(`${details.reason} ${details.trigger?.id}`),
      },
    });
    const element = await opened();
    await placed();
    const place = positioner()!.getBoundingClientRect().toJSON();
    await userEvent.click(element.querySelector('button')!);
    await waitFor(() => expect(element.className).toContain('slow-leave-leave-active'));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(positioner()!.getBoundingClientRect().toJSON()).toEqual(place);
    expect(triggers).toEqual(['close-press trigger-1']);
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

  describe('the offsets', () => {
    // The trigger is 72 × 36 px at the top left corner of the view, and the popup 52 × 24 px.
    const atCorner = {
      triggers: [
        {
          key: 't',
          attrs: {
            style:
              'position: fixed; left: 0; top: 0; width: 72px; height: 36px; box-sizing: border-box',
          },
        },
      ],
      popup: { style: 'width: 52px; height: 24px; overflow: hidden' },
    };
    async function placeAtCorner(positionerProps: Props, dir?: string) {
      await mountPopover({
        root: { defaultOpen: true },
        ...atCorner,
        positioner: { ...positionerProps, ...(dir && { dir }) },
      });
      await opened();
      await placed();
      return positioner()!;
    }

    test.each<[string, Props, { x: number; y: number }]>([
      ['a number in `sideOffset`', { sideOffset: 7 }, { x: 10, y: 43 }],
      [
        'a function in `sideOffset` that reads the sizes',
        {
          sideOffset: (data: { positioner: { width: number }; anchor: { width: number } }) =>
            data.positioner.width + data.anchor.width,
        },
        { x: 10, y: 36 + 52 + 72 },
      ],
      ['a number in `alignOffset`', { alignOffset: 7 }, { x: 17, y: 36 }],
      [
        'a function in `alignOffset` that reads the sizes',
        { alignOffset: (data: { positioner: { width: number } }) => data.positioner.width },
        { x: 10 + 52, y: 36 },
      ],
    ])('%s moves the positioner', async (_, positionerProps, place) => {
      const element = await placeAtCorner(positionerProps);
      expect(element.style.transform).toBe(`translate(${place.x}px, ${place.y}px)`);
      expect(element.getBoundingClientRect()).toMatchObject(place);
    });

    test.each<[string, Props, 'side' | 'align', string, string | undefined]>([
      ['the side after a flip', { side: 'left' }, 'side', 'right', undefined],
      ['the alignment after a flip', { side: 'right', align: 'start' }, 'align', 'end', undefined],
      ['the logical side after a flip', { side: 'inline-start' }, 'side', 'inline-end', undefined],
      [
        'the logical side from right to left',
        { side: 'inline-start' },
        'side',
        'inline-start',
        'rtl',
      ],
    ])('a function in an offset reads %s', async (_, positionerProps, key, expected, dir) => {
      for (const prop of ['sideOffset', 'alignOffset']) {
        let value = 'none';
        const { unmount } = await mountPopover({
          root: { defaultOpen: true },
          ...atCorner,
          positioner: {
            ...positionerProps,
            ...(dir && { dir }),
            [prop]: (data: Record<string, string>) => {
              value = data[key]!;
              return 0;
            },
          },
        });
        await opened();
        await placed();
        await waitFor(() => expect(positioner()).toHaveAttribute(`data-${key}`, expected));
        expect(value).toBe(expected);
        unmount();
      }
    });

    test('a popup that flips to the top side rests at `collisionPadding` from the top edge', async () => {
      await mountPopover({
        root: { defaultOpen: true },
        triggers: [{ key: 't', attrs: { style: 'position: fixed; bottom: 8px; left: 16px' } }],
        positioner: {
          side: 'bottom',
          sideOffset: 8,
          collisionPadding: 12,
          collisionAvoidance: { fallbackAxisSide: 'none' },
        },
        popup: { style: 'width: 200px; height: 1000px; max-height: var(--available-height)' },
      });
      await opened();
      await placed();
      await waitFor(() => expect(positioner()).toHaveAttribute('data-side', 'top'));
      await waitFor(() => expect(Math.round(positioner()!.getBoundingClientRect().top)).toBe(12));
    });
  });

  describe('at an anchor', () => {
    let anchor: HTMLElement;
    function placeAnchor(style: string) {
      anchor = document.body.appendChild(document.createElement('div'));
      anchor.style.cssText = `position: fixed; ${style}`;
      return anchor;
    }
    afterEach(() => anchor.remove());

    test('a kept popup follows an `anchor` that changes its size', async () => {
      placeAnchor('left: 300px; top: 200px; width: 50px; height: 20px');
      await mountPopover({
        root: { defaultOpen: true },
        portal: { keepMounted: true },
        positioner: { anchor },
        popup: { style: 'width: 20px; height: 20px; overflow: hidden' },
      });
      await opened();
      await placed();
      const left = positioner()!.getBoundingClientRect().left;
      anchor.style.width = '150px';
      await waitFor(() =>
        expect(Math.round(positioner()!.getBoundingClientRect().left)).toBe(Math.round(left + 50)),
      );
    });

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

    test('after the open, a resize of the popup, a resize of the anchor and a new `sideOffset` place the popup again', async () => {
      placeAnchor('left: 100px; top: 300px; width: 50px; height: 20px');
      const positionerProps = reactive<Props>({
        anchor,
        side: 'top',
        collisionAvoidance: { side: 'none' },
      });
      const popupProps = reactive<Props>({ style: 'height: 50px' });
      await mountPopover({
        root: { defaultOpen: true },
        positioner: positionerProps,
        popup: popupProps,
      });
      await opened();
      await placed();
      const bottom = () => Math.round(positioner()!.getBoundingClientRect().bottom);
      // Each change runs in a task of its own, as a change of an app does. A change in the step of
      // the resize observers of a frame gives a notice that the browser holds for the next frame.
      const nextTask = () => new Promise((resolve) => setTimeout(resolve));
      expect(bottom()).toBe(300);
      await nextTask();
      popupProps.style = 'height: 120px';
      await waitFor(() => expect(positioner()!.getBoundingClientRect().height).toBe(120));
      await waitFor(() => expect(bottom()).toBe(300));
      await nextTask();
      anchor.style.top = '';
      anchor.style.bottom = `${innerHeight - 320}px`;
      anchor.style.height = '40px';
      await waitFor(() => expect(bottom()).toBe(280));
      await nextTask();
      positionerProps.sideOffset = 8;
      await waitFor(() => expect(bottom()).toBe(272));
    });

    test('after the open, a new `alignOffset` and a new `arrowPadding` place the popup and its arrow again', async () => {
      placeAnchor('left: 100px; top: 300px; width: 50px; height: 20px');
      const positionerProps = reactive<Props>({ anchor, side: 'top' });
      await mountPopover({
        root: { defaultOpen: true },
        positioner: positionerProps,
        popup: { style: 'width: 100px; height: 50px' },
        arrow: { style: 'width: 10px; height: 10px' },
      });
      await opened();
      await placed();
      const left = () => Math.round(positioner()!.getBoundingClientRect().left);
      const arrowLeft = () => Math.round(byTestId('arrow').getBoundingClientRect().left) - left();
      expect(left()).toBe(75);
      positionerProps.alignOffset = 40;
      await waitFor(() => expect(left()).toBe(115));
      // The center of the anchor is 10 px from the start of the popup, so the padding holds the arrow.
      expect(arrowLeft()).toBe(5);
      positionerProps.arrowPadding = 30;
      await waitFor(() => expect(arrowLeft()).toBe(30));
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

    test.each([
      {
        name: 'a positioned popup with a border',
        side: 'bottom',
        popup: 'position: relative; border: 1px solid',
      },
      {
        name: 'a positioned popup with borders of other widths',
        side: 'right',
        popup: 'position: relative; border: solid; border-width: 4px 1px 2px 3px',
      },
      {
        name: 'a positioner with a border',
        side: 'bottom',
        popup: 'border: 1px solid',
        positioner: 'border: 3px solid',
      },
    ])(
      'VUE-193: in $name, the arrow and the transform origin point at the center of the anchor',
      async ({ side, popup: popupStyle, positioner: positionerStyle }) => {
        placeAnchor('left: 100px; top: 200px; width: 50px; height: 20px');
        await mountPopover({
          root: { defaultOpen: true },
          positioner: { anchor, side, style: positionerStyle },
          popup: { style: `width: 120px; height: 80px; ${popupStyle}` },
          arrow: { style: 'width: 10px; height: 10px' },
        });
        await opened();
        await placed();
        const arrow = byTestId('arrow');
        await waitFor(() => expect(arrow.style.left || arrow.style.top).toMatch(/px$/));
        const axis = side === 'bottom' ? 'x' : 'y';
        const center = centerOf(anchor)[axis];
        expect(Math.abs(centerOf(arrow)[axis] - center)).toBeLessThanOrEqual(0.5);
        const origin = positioner()!.style.getPropertyValue('--transform-origin').split(' ');
        const cross = parseFloat((axis === 'x' ? origin[0] : origin.at(-1))!);
        expect(
          Math.abs(popup()!.getBoundingClientRect()[axis] + cross - center),
        ).toBeLessThanOrEqual(0.5);
      },
    );

    test('VUE-193: the arrow in a positioned popup with a margin points at the center of the anchor', async () => {
      placeAnchor('left: 100px; top: 200px; width: 50px; height: 20px');
      await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor },
        popup: { style: 'width: 120px; position: relative; margin: 6px' },
        arrow: { style: 'width: 10px; height: 10px' },
      });
      await opened();
      await placed();
      const arrow = byTestId('arrow');
      await waitFor(() => expect(arrow.style.left).toMatch(/px$/));
      expect(Math.abs(centerOf(arrow).x - centerOf(anchor).x)).toBeLessThanOrEqual(0.5);
    });

    test('VUE-193: the arrow in a static popup with a border that scales while it enters points at the center of the anchor after the enter', async () => {
      placeAnchor('left: 100px; top: 200px; width: 50px; height: 20px');
      mount(PopoverInTransition, {
        root: { defaultOpen: true },
        positioner: { anchor },
        popup: { class: 'scales', style: 'width: 120px; border: 4px solid' },
        arrow: { style: 'width: 10px; height: 10px' },
      });
      await opened();
      // While the popup has a transform, the popup is the containing block of the arrow.
      await waitFor(() => expect(getComputedStyle(popup()!).transform).toBe('none'));
      const arrow = byTestId('arrow');
      expect(Math.abs(centerOf(arrow).x - centerOf(anchor).x)).toBeLessThanOrEqual(0.5);
    });

    test.each(['start', 'end'])(
      'VUE-193: at the %s edge of a positioned popup with a border, `arrowPadding` keeps the arrow from the inner edge, and the arrow is `data-uncentered`',
      async (align) => {
        placeAnchor('left: 150px; top: 200px; width: 20px; height: 20px');
        await mountPopover({
          root: { defaultOpen: true },
          positioner: { anchor, align },
          popup: { style: 'width: 120px; position: relative; border: 4px solid' },
          arrow: { style: 'width: 10px; height: 10px' },
        });
        await opened();
        await placed();
        const arrow = byTestId('arrow');
        await waitFor(() => expect(arrow).toHaveAttribute('data-uncentered'));
        const box = popup()!.getBoundingClientRect();
        const place = arrow.getBoundingClientRect();
        const space = align === 'start' ? place.left - box.left - 4 : box.right - 4 - place.right;
        expect(Math.abs(space - 5)).toBeLessThanOrEqual(0.5);
      },
    );

    test.each([
      {
        name: 'a popup with a margin',
        side: 'bottom',
        popup: 'margin: 16px',
        point: 'the center of the anchor',
      },
      {
        name: 'a positioner with a padding',
        side: 'top',
        positioner: 'padding: 6px',
        popup: 'position: relative; border: 1px solid',
        arrow: true,
        point: 'the arrow',
      },
      {
        name: 'a popup with no border, which a margin of its title moves',
        side: 'right',
        title: 'margin: 16px 0',
        point: 'the center of the anchor',
      },
    ])(
      'VUE-194: in $name, the transform origin is at $point, on the edge of the anchor',
      async ({ side, popup: popupStyle, positioner: positionerStyle, title, arrow }) => {
        placeAnchor('left: 100px; top: 200px; width: 50px; height: 20px');
        await mountPopover({
          root: { defaultOpen: true },
          positioner: { anchor, side, sideOffset: 8, style: positionerStyle },
          popup: { style: `width: 120px; ${popupStyle ?? ''}` },
          title: title ? { style: title } : undefined,
          arrow: arrow ? { style: 'width: 10px; height: 10px' } : undefined,
        });
        await opened();
        await placed();
        const vertical = side !== 'right';
        await waitFor(() =>
          expect(positioner()!.style.getPropertyValue('--transform-origin')).toMatch(/px/),
        );
        const box = anchor.getBoundingClientRect();
        const cross = arrow ? centerOf(byTestId('arrow')) : centerOf(anchor);
        const edge = { top: box.top, right: box.right, bottom: box.bottom }[side]!;
        const origin = scaleOrigin(popup()!);
        expect(
          Math.abs((vertical ? origin.x : origin.y) - (vertical ? cross.x : cross.y)),
        ).toBeLessThanOrEqual(0.5);
        expect(Math.abs((vertical ? origin.y : origin.x) - edge)).toBeLessThanOrEqual(0.5);
      },
    );

    test.each([true, false])(
      'VUE-195: in a popup with a CSS zoom and a margin, the arrow points at the center of the anchor, and the transform origin is at the arrow, or at the center of the anchor with no arrow (arrow: %s)',
      async (arrow) => {
        placeAnchor('left: 300px; top: 200px; width: 50px; height: 20px');
        await mountPopover({
          root: { defaultOpen: true },
          positioner: { anchor, sideOffset: 8 },
          popup: {
            style: 'width: 120px; position: relative; border: 1px solid; margin: 8px; zoom: 2',
          },
          arrow: arrow ? { style: 'width: 10px; height: 10px' } : undefined,
        });
        await opened();
        await placed();
        const center = centerOf(anchor).x;
        if (arrow) {
          const element = byTestId('arrow');
          await waitFor(() => expect(element.style.left).toMatch(/px$/));
          expect(element).not.toHaveAttribute('data-uncentered');
          expect(Math.abs(centerOf(element).x - center)).toBeLessThanOrEqual(0.5);
        }
        const origin = scaleOrigin(popup()!);
        expect(Math.abs(origin.x - center)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(origin.y - anchor.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0.5);
      },
    );

    test('VUE-195: in a popup with `zoom: 2`, `arrowPadding` is in the pixels of the popup', async () => {
      placeAnchor('left: 150px; top: 200px; width: 40px; height: 20px');
      await mountPopover({
        root: { defaultOpen: true },
        positioner: { anchor, align: 'start' },
        popup: { style: 'width: 120px; position: relative; border: 4px solid; zoom: 2' },
        arrow: { style: 'width: 10px; height: 10px' },
      });
      await opened();
      await placed();
      const arrow = byTestId('arrow');
      await waitFor(() => expect(arrow).toHaveAttribute('data-uncentered'));
      const space = arrow.getBoundingClientRect().left - popup()!.getBoundingClientRect().left - 8;
      expect(Math.abs(space - 2 * 5)).toBeLessThanOrEqual(0.5);
    });

    test('VUE-195: under a CSS zoom of a positioned ancestor, the shift stops at half the arrow and half the collision padding from the anchor', async () => {
      const container = document.body.appendChild(document.createElement('div'));
      container.style.cssText = 'position: fixed; inset: 0; zoom: 1.5';
      onTestFinished(() => container.remove());
      anchor = container.appendChild(document.createElement('div'));
      anchor.style.cssText =
        'position: absolute; left: -25px; top: 200px; width: 20px; height: 20px';
      await mountPopover({
        root: { defaultOpen: true },
        portal: { to: container },
        positioner: { anchor },
        popup: { style: 'width: 160px' },
        arrow: { style: 'width: 10px; height: 10px' },
      });
      await opened();
      await placed();
      const overlap = anchor.getBoundingClientRect().right - popup()!.getBoundingClientRect().left;
      expect(Math.abs(overlap - 1.5 * (10 / 2 + (5 + 5) / 2))).toBeLessThanOrEqual(0.5);
    });

    // Floating UI reads the zoom of the floating element from `Element.currentCSSZoom`, which the
    // WebKit of Playwright on Linux does not have (floating-ui/floating-ui#3492).
    test.skipIf(!('currentCSSZoom' in Element.prototype)).each([
      { zoomed: 'html', positionMethod: 'absolute' },
      { zoomed: 'body', positionMethod: 'absolute' },
      { zoomed: 'html', positionMethod: 'fixed' },
    ] as const)(
      'under `zoom: 1.5` on <$zoomed>, with the position method $positionMethod, the popup is at its side offset under the center of the anchor',
      async ({ zoomed, positionMethod }) => {
        const { style } = zoomed === 'html' ? document.documentElement : document.body;
        style.zoom = '1.5';
        onTestFinished(() => {
          style.zoom = '';
        });
        placeAnchor('left: 100px; top: 100px; width: 40px; height: 20px');
        await mountPopover({
          root: { defaultOpen: true },
          positioner: { anchor, sideOffset: 8, positionMethod },
          popup: { style: 'width: 120px' },
        });
        await opened();
        await placed();
        const box = anchor.getBoundingClientRect();
        const place = popup()!.getBoundingClientRect();
        expect(Math.abs(place.top - (box.bottom + 1.5 * 8))).toBeLessThanOrEqual(1);
        expect(Math.abs(centerOf(popup()!).x - centerOf(anchor).x)).toBeLessThanOrEqual(1);
      },
    );

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
        popup: { style: 'height: 200px; margin: 16px' },
      });
      await opened();
      await placed();
      const origin = scaleOrigin(popup()!);
      const center = centerOf(anchor);
      expect(Math.abs(origin.x - center.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(origin.y - center.y)).toBeLessThanOrEqual(0.5);
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

  test('the hole of the fixed element follows a move of the trigger', async () => {
    const { trigger } = await mountPopover({ root: { modal: true } });
    await userEvent.click(trigger());
    await opened();
    await placed();
    const block = document.querySelector<HTMLElement>(BLOCK)!;
    const corner = () => {
      const { left, top } = trigger().getBoundingClientRect();
      return `${left}px ${top}px`;
    };
    await waitFor(() => expect(block.style.clipPath).toContain(corner()));
    trigger().style.marginLeft = '40px';
    await waitFor(() => expect(block.style.clipPath).toContain(corner()));
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

  test.each([false, true])(
    'a press after 500 ms closes a popover that a hover opened (`v-model:open`: %s)',
    async (controlled) => {
      const root = reactive<Props>(
        controlled ? { open: false, 'onUpdate:open': (open: boolean) => (root.open = open) } : {},
      );
      const { trigger } = await mountPopover({
        root,
        triggers: [{ key: 't', attrs: { openOnHover: true, delay: 0 } }],
      });
      await userEvent.hover(trigger());
      await opened();
      await new Promise((resolve) => setTimeout(resolve, 550));
      await userEvent.click(trigger());
      await closed();
    },
  );

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

  // The trigger is 72 × 36 px, and the popup 52 × 24 px.
  const sized = { width: '72px', height: '36px' };
  test.each<[string, Props, Props, string | ((anchor: DOMRect, place: DOMRect) => string)]>([
    ['the center of the anchor for the center alignment', { margin: '50px' }, {}, '26px 0px'],
    ['the start edge for the start alignment', { margin: '50px' }, { align: 'start' }, '0% 0px'],
    [
      'the start edge of the direction of the positioner',
      { margin: '50px' },
      { align: 'start', dir: 'rtl' },
      '100% 0px',
    ],
    ['the end edge for the end alignment', { margin: '50px' }, { align: 'end' }, '100% 0px'],
    [
      'the end edge of the direction of the positioner',
      { margin: '50px' },
      { align: 'end', dir: 'rtl' },
      '0% 0px',
    ],
    [
      'the side first for a horizontal side',
      { margin: '50px' },
      { side: 'right', align: 'start' },
      '0px 0%',
    ],
    [
      'the end edge and `sideOffset` on the left side',
      { position: 'fixed', left: '200px', top: '50px' },
      { side: 'left', align: 'end', sideOffset: 7 },
      'calc(100% + 7px) 100%',
    ],
    [
      'the start edge and `sideOffset`',
      { margin: '50px' },
      { align: 'start', sideOffset: 7 },
      '0% -7px',
    ],
    [
      'the start edge and `sideOffset` on the top side',
      { position: 'fixed', left: '50px', top: '200px' },
      { side: 'top', align: 'start', sideOffset: 7 },
      '0% calc(100% + 7px)',
    ],
    [
      'the start edge with `alignOffset`',
      { margin: '50px' },
      { align: 'start', alignOffset: 7 },
      '0% 0px',
    ],
    [
      'the start edge at a narrow anchor with a large `arrowPadding` and no arrow',
      { position: 'fixed', left: '50px', top: '50px', width: '2px', height: '20px' },
      { align: 'start', arrowPadding: 20 },
      '0% 0px',
    ],
    [
      'the end edge when the alignment flips',
      { position: 'fixed', top: '50px', right: '4px', popupWidth: '240px' },
      { align: 'start', collisionAvoidance: { align: 'flip' } },
      '100% 0px',
    ],
    [
      'the start edge after a shift of 1 px on the cross axis',
      { position: 'fixed', left: 'calc(100vw - 51px)', top: '50px' },
      { align: 'start', collisionAvoidance: { align: 'shift' }, collisionPadding: 0 },
      '0% 0px',
    ],
    [
      'the center of the anchor when a shift on the cross axis moves a start-aligned popup',
      { position: 'fixed', top: '50px', right: '10px', popupWidth: '240px' },
      { align: 'start', collisionAvoidance: { align: 'shift' } },
      (anchor, place) => `${anchor.x + 36 - place.x}px 0px`,
    ],
    [
      'the center of the anchor when a shift on the cross axis moves an end-aligned popup',
      { position: 'fixed', left: '10px', top: '50px', popupWidth: '240px' },
      { align: 'end', collisionAvoidance: { align: 'shift' } },
      (anchor, place) => `${anchor.x + 36 - place.x}px 0px`,
    ],
    [
      'the center of the anchor when a shift on the cross axis moves a popup on the right side',
      { position: 'fixed', left: '50px', bottom: '10px', popupHeight: '120px' },
      { side: 'right', align: 'start', collisionAvoidance: { align: 'shift' } },
      (anchor, place) => `0px ${anchor.y + 18 - place.y}px`,
    ],
    [
      'the center of the anchor when a shift moves the popup over its anchor',
      { position: 'fixed', left: '50px', bottom: '10px' },
      { collisionAvoidance: { side: 'shift' } },
      (anchor, place) => `26px ${anchor.y + 18 - place.y}px`,
    ],
  ])('the transform origin is %s', async (_, place, positionerProps, origin) => {
    const { popupWidth = '52px', popupHeight = '24px', ...style } = place as Record<string, string>;
    const { trigger } = await mountPopover({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { style: { ...sized, ...style } } }],
      positioner: positionerProps,
      popup: { style: { width: popupWidth, height: popupHeight, overflow: 'hidden' } },
    });
    await opened();
    await placed();
    const anchor = trigger().getBoundingClientRect();
    const box = positioner()!.getBoundingClientRect();
    expect(positioner()!.style.getPropertyValue('--transform-origin')).toBe(
      typeof origin === 'string' ? origin : origin(anchor, box),
    );
    if (positionerProps.alignOffset) expect(Math.round(box.left - anchor.left)).toBe(7);
    if (positionerProps.arrowPadding) expect(Math.round(box.left)).toBe(Math.round(anchor.left));
    if (positionerProps.collisionPadding === 0) expect(Math.round(box.left - anchor.left)).toBe(-1);
  });

  test('the transform origin is the center of the anchor at an arrow, for each alignment', async () => {
    await mountPopover({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { style: { ...sized, margin: '50px' } } }],
      positioner: { align: 'start' },
      popup: { style: { width: '52px', height: '24px', overflow: 'hidden' } },
      arrow: { style: { width: '10px', height: '10px' } },
    });
    await opened();
    await placed();
    await waitFor(() =>
      expect(positioner()!.style.getPropertyValue('--transform-origin')).toBe('36px 0px'),
    );
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

describe('the viewport', () => {
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
    // The popup shows one update after its mount, and the positioner gets its size at the next
    // frame.
    await waitFor(() =>
      expect(positioner()!.style.getPropertyValue('--positioner-height')).toBe(old),
    );
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
    // The old content leaves two frames after the move, and the size animation ends 80 ms after
    // it. On a busy machine, the animation can end first, and the positioner then gets the size of
    // the two contents again before the size of the new one.
    await waitFor(() => {
      expect(element.querySelectorAll('.content')).toHaveLength(1);
      expect(positioner()!.style.getPropertyValue('--positioner-height')).toBe(
        `${element.offsetHeight}px`,
      );
    });
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

  test('a close or a new open during the size animation of a move gives the popup no `data-instant` of `trigger-change` when the animation ends', async () => {
    mount(PopoverViewportParts, {
      portal: { keepMounted: true },
      popup: { style: 'transition: height 5s' },
    });
    await nextTick();
    const element = popup()!;
    for (const reopen of [false, true]) {
      await userEvent.click(byId('one'));
      await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
      await placed();
      await userEvent.click(byId('two'));
      await waitFor(() => expect(element.getAnimations()).not.toEqual([]));
      await userEvent.click(byId('two'));
      await waitFor(() => expect(element).toHaveAttribute('hidden'));
      if (reopen) {
        await userEvent.click(byId('two'));
        await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
      }
      for (const animation of element.getAnimations()) animation.finish();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(element).not.toHaveAttribute('data-instant');
      if (reopen) await userEvent.click(byId('two'));
      await waitFor(() => expect(element).toHaveAttribute('hidden'));
    }
  });

  test('quick moves between triggers show the content and the size of the last trigger', async () => {
    mount(PopoverViewportParts, {});
    await nextTick();
    await userEvent.click(byId('one'));
    const element = await opened();
    await placed();
    byId('two').click();
    byId('one').click();
    byId('two').click();
    await waitFor(() => {
      expect(element.querySelectorAll('.content')).toHaveLength(1);
      expect(element.querySelector('.content')).toHaveTextContent('Two');
      expect(element.getAnimations()).toEqual([]);
    });
    expect(element.style.getPropertyValue('--popup-height')).toBe('');
    expect(positioner()!.style.getPropertyValue('--positioner-height')).toBe(
      `${element.offsetHeight}px`,
    );
  });

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

describe('with a menu or a combobox in the popup', () => {
  test('a menu in a popover in an open `<dialog>` that holds both portals opens by Enter and by a press, and the popover stays open; a press on an item that keeps the menu open keeps the popover open', async () => {
    const dialog = document.body.appendChild(document.createElement('dialog'));
    dialog.setAttribute('open', '');
    onTestFinished(() => dialog.remove());
    mount(PopoverWithNestedPopup, { nested: 'menu', to: dialog }, dialog);
    await waitFor(() => expect(document.activeElement).toBe(byTestId('before')));
    byTestId('menu-trigger').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(byTestId('menu-popup')).toBeTruthy());
    expect(dialog.contains(byTestId('menu-popup'))).toBe(true);
    expect(byTestId('popover-popup')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[data-testid="menu-popup"]')).toBe(null));
    expect(byTestId('popover-popup')).toBeTruthy();
    await userEvent.click(byTestId('menu-trigger'));
    await waitFor(() => expect(byTestId('menu-popup')).toBeTruthy());
    await userEvent.click(byTestId('item'));
    await nextTick();
    expect(byTestId('menu-popup')).toBeTruthy();
    expect(byTestId('popover-popup')).toBeTruthy();
  });

  test('Tab in a menu in a popover closes the menu and goes to the element after the menu trigger; the popover stays open', async () => {
    mount(PopoverWithNestedPopup, { nested: 'menu' });
    await waitFor(() => expect(document.activeElement).toBe(byTestId('before')));
    await userEvent.click(byTestId('menu-trigger'));
    await waitFor(() => expect(byTestId('menu-popup')).toBeTruthy());
    await waitFor(() => expect(byTestId('menu-popup').contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('after'));
    await waitFor(() => expect(document.querySelector('[data-testid="menu-popup"]')).toBe(null));
    expect(byTestId('popover-popup')).toBeTruthy();
  });

  test('Tab from a combobox in a popover closes its list and the popover, and goes to the element after the popover trigger; Shift+Tab closes the list and goes to the popover trigger', async () => {
    const listbox = () => document.querySelector('[role="listbox"]');
    const { unmount } = mount(PopoverWithNestedPopup, { nested: 'combobox' });
    await waitFor(() => expect(document.activeElement).toBe(byTestId('combobox-input')));
    await userEvent.click(byTestId('combobox-input'));
    await waitFor(() => expect(listbox()).not.toBe(null));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('after-trigger'));
    await waitFor(() => expect(document.querySelector('[data-testid="popover-popup"]')).toBe(null));
    expect(listbox()).toBe(null);
    unmount();
    mount(PopoverWithNestedPopup, { nested: 'combobox' });
    await waitFor(() => expect(document.activeElement).toBe(byTestId('combobox-input')));
    await userEvent.click(byTestId('combobox-input'));
    await waitFor(() => expect(listbox()).not.toBe(null));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byTestId('popover-trigger'));
    await waitFor(() => expect(listbox()).toBe(null));
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
  test('throws an error that names the part with no root, Positioner with no Portal, and Popup with no Positioner', () => {
    expect(String(mountError(PopoverPartAlone, { part: 'Popup' }))).toContain(
      '<Popover.Popup> must be inside <Popover.Root>',
    );
    expect(String(mountError(PopoverPartAlone, { part: 'Popup', inRoot: true }))).toContain(
      '<Popover.Popup> must be inside <Popover.Positioner>',
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
