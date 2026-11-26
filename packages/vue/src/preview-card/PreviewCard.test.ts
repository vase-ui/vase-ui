import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { computed, nextTick, reactive } from 'vue';
import { PreviewCard, type PreviewCardRootChangeEventDetails } from '@vase-ui/vue/preview-card';
import PreviewCardHandles from '../../test/fixtures/PreviewCardHandles.vue';
import PreviewCardInTransition from '../../test/fixtures/PreviewCardInTransition.vue';
import PreviewCardPartAlone from '../../test/fixtures/PreviewCardPartAlone.vue';
import PreviewCardParts from '../../test/fixtures/PreviewCardParts.vue';
import PreviewCardSlots from '../../test/fixtures/PreviewCardSlots.vue';
import {
  finishAnimations,
  mostMatches,
  opacityUntilRest,
  shownOpacity,
} from '../../test/animation';
import { touchDrag } from '../../test/pointer';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { readAfter, readWhen, waitSingleFrame } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const popup = () => document.querySelector<HTMLElement>('[data-testid="popup"]');
const positioner = () => document.querySelector<HTMLElement>('[data-testid="positioner"]');
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const byId = (id: string) => document.getElementById(id)!;
// WebKit moves Tab to a link only with Option, by the default setting of macOS.
const TAB = server.browser === 'webkit' ? '{Alt>}{Tab}{/Alt}' : '{Tab}';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mountCard(setup: Props = {}) {
  const { root, exposed, unmount } = mount(PreviewCardParts, setup);
  await nextTick();
  const trigger = (key = 't') => root.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
  return { root, exposed, unmount, trigger };
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: PreviewCardRootChangeEventDetails) =>
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
    await wait(10);
  }
}

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Tab from the input before the root to the first link. */
async function tabToLink() {
  byId('before').focus();
  await userEvent.keyboard(TAB);
}

/** The events of a window that loses the focus and gets it back, while the link keeps it. */
async function leaveWindowAndReturn(link: HTMLElement, back = true) {
  link.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  window.dispatchEvent(new FocusEvent('blur'));
  if (!back) return;
  await wait(10);
  window.dispatchEvent(new FocusEvent('focus'));
  link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}

describe('the parts', () => {
  test('render their native elements in <body>; the link has its id and no ARIA attribute, role or tabindex; a template ref has element; the attributes of the developer win', async () => {
    const { trigger, exposed } = await mountCard({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { id: 'link' } }],
      popup: { tabindex: 0 },
      backdrop: {},
      arrow: {},
    });
    const element = await opened();
    expect(trigger().localName).toBe('a');
    expect(trigger().getAttributeNames().sort()).toEqual([
      'data-key',
      'data-popup-open',
      'href',
      'id',
    ]);
    expect(element.localName).toBe('div');
    expect(element).toHaveAttribute('tabindex', '0');
    expect(element.getAttributeNames().filter((name) => /^(role|id|aria-)/.test(name))).toEqual([]);
    expect(exposed.popup.element).toBe(element);
    expect(positioner()!.parentElement).toBe(document.body);
    expect(byTestId('backdrop')).toHaveAttribute('role', 'presentation');
    expect(byTestId('backdrop').style.pointerEvents).toBe('none');
    expect(byTestId('arrow')).toHaveAttribute('aria-hidden', 'true');
  });

  test('the popup has `tabindex="-1"`; `as` renders its tag', async () => {
    const { trigger } = await mountCard({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { as: 'span' } }],
      popup: { as: 'section' },
    });
    const element = await opened();
    expect(trigger().localName).toBe('span');
    expect(element.localName).toBe('section');
    expect(element).toHaveAttribute('tabindex', '-1');
  });
});

describe('the element slot', () => {
  test('renders the element of the developer with the props of the part; a hover open and close of one link renders no other link again', async () => {
    const renders: string[] = [];
    mount(PreviewCardSlots, { renders: { add: (entry: string) => renders.push(entry) } });
    await nextTick();
    expect(byId('second').localName).toBe('a');
    expect(byId('second')).toHaveAttribute('href', '#second');
    renders.length = 0;
    await userEvent.hover(byId('first'));
    const element = await opened();
    expect(element.localName).toBe('section');
    expect(element).toHaveAttribute('tabindex', '-1');
    await userEvent.hover(byId('outside'));
    await closed();
    expect(renders).toEqual([]);
  });
});

describe('the root', () => {
  test('a mouse that rests on the link opens the card after `delay`, and the card closes `closeDelay` after the pointer leaves; openChange comes before update:open', async () => {
    const log: string[] = [];
    const { trigger } = await mountCard({
      root: rootEvents(log),
      triggers: [{ key: 't', attrs: { delay: 100, closeDelay: 100 } }],
    });
    const beforeOpen = readAfter(trigger(), 'pointerenter', 50, popup);
    await userEvent.hover(trigger());
    expect(await beforeOpen).toBe(null);
    await opened();
    expect(trigger()).toHaveAttribute('data-popup-open');
    expect(document.activeElement).not.toBe(trigger());
    const beforeClose = readAfter(trigger(), 'pointerleave', 50, popup);
    await userEvent.hover(byId('outside'));
    expect(await beforeClose).not.toBe(null);
    await closed();
    expect(log).toEqual([
      'openChange true trigger-hover',
      'update true',
      'openChange false trigger-hover',
      'update false',
    ]);
  });

  test('a controlled root shows only the value of its parent; cancel() keeps the state; a change by the parent and a mount open emit nothing', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { open: true });
    root.onOpenChange = (open: boolean, details: PreviewCardRootChangeEventDetails) => {
      log.push(`openChange ${open} ${details.reason}`);
      if (details.reason === 'escape-key') details.cancel();
    };
    await mountCard({ root });
    const element = await opened();
    element.focus();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(byId('outside'));
    await nextTick();
    expect(popup()).not.toBe(null);
    root.open = false;
    await closed();
    expect(log).toEqual([
      'openChange false escape-key',
      'openChange false outside-press',
      'update false',
    ]);
  });

  test('`defaultOpen` opens an uncontrolled root at the mount; the close() of a template ref asks for a close with `imperative-action`', async () => {
    const triggers: (Element | undefined)[] = [];
    const log: string[] = [];
    const { exposed, trigger } = await mountCard({
      root: {
        defaultOpen: true,
        onOpenChange: (open: boolean, details: PreviewCardRootChangeEventDetails) => {
          log.push(`openChange ${open} ${details.reason}`);
          triggers.push(details.trigger);
        },
        'onUpdate:open': (open: boolean) => log.push(`update ${open}`),
      },
    });
    await opened();
    exposed.root.close();
    await closed();
    expect(log).toEqual(['openChange false imperative-action', 'update false']);
    expect(triggers).toEqual([trigger()]);
  });

  test('with more links, a hover moves the card to its link with no delay; v-model:trigger-id follows; the slot gets the payload', async () => {
    const ids: (string | null)[] = [];
    const { trigger } = await mountCard({
      root: { 'onUpdate:triggerId': (id: string | null) => ids.push(id) },
      triggers: [
        { key: 'a', attrs: { id: 'a', payload: 'first', delay: 0 } },
        { key: 'b', attrs: { id: 'b', payload: 'second', delay: 5000, style: 'margin: 0 40px' } },
      ],
    });
    await userEvent.hover(trigger('a'));
    expect(await opened()).toHaveTextContent('first');
    await userEvent.hover(trigger('b'));
    expect(trigger('b')).toHaveAttribute('data-popup-open');
    await waitFor(() => expect(popup()).toHaveTextContent('second'));
    expect(trigger('a')).not.toHaveAttribute('data-popup-open');
    expect(ids).toEqual(['a', 'b']);
  });

  test('cancel() of an open keeps the card closed and the link with no `data-popup-open`', async () => {
    const log: string[] = [];
    const { trigger } = await mountCard({
      root: {
        onOpenChange: (open: boolean, details: PreviewCardRootChangeEventDetails) => {
          log.push(`${open} ${details.reason}`);
          details.cancel();
        },
      },
      triggers: [{ key: 't', attrs: { delay: 0 } }],
    });
    await userEvent.hover(trigger());
    await waitFor(() => expect(log).toEqual(['true trigger-hover']));
    await wait(40);
    expect(popup()).toBe(null);
    expect(trigger()).not.toHaveAttribute('data-popup-open');
  });

  test('a hover on the link of an open card emits nothing', async () => {
    const log: string[] = [];
    const { trigger } = await mountCard({
      root: rootEvents(log),
      triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 100 } }],
    });
    await userEvent.hover(trigger());
    await opened();
    await userEvent.hover(byTestId('text'));
    await userEvent.hover(trigger());
    await wait(150);
    expect(log).toEqual(['openChange true trigger-hover', 'update true']);
  });

  test('a controlled root keeps the payload when the parent moves the card to another link', async () => {
    const handle = PreviewCard.createHandle<string>();
    const root = reactive<Props>({ open: true, triggerId: 'first' });
    mount(PreviewCardHandles, { handle, root });
    expect(await opened()).toHaveTextContent('first');
    root.open = false;
    await closed();
    Object.assign(root, { open: true, triggerId: 'second' });
    expect(await opened()).toHaveTextContent('second');
  });
});

describe('the handle', () => {
  test('connects links outside the root; open(id) opens for that link; isOpen and close() follow; a computed that reads isOpen follows the root', async () => {
    const handle = PreviewCard.createHandle<string>();
    const isOpen = computed(() => handle.isOpen);
    const log: string[] = [];
    const { unmount } = mount(PreviewCardHandles, {
      handle,
      root: {
        onOpenChange: (open: boolean, details: PreviewCardRootChangeEventDetails) =>
          log.push(`${open} ${details.reason} ${details.trigger?.id}`),
      },
    });
    await nextTick();
    expect(isOpen.value).toBe(false);
    handle.open('first');
    expect(isOpen.value).toBe(true);
    expect(await opened()).toHaveTextContent('first');
    expect(byId('first')).toHaveAttribute('data-popup-open');
    handle.open('second');
    await waitFor(() => expect(popup()).toHaveTextContent('second'));
    expect(byId('first')).not.toHaveAttribute('data-popup-open');
    handle.close();
    await closed();
    expect(log).toEqual([
      'true imperative-action first',
      'true imperative-action second',
      'false imperative-action second',
    ]);
    handle.open('first');
    unmount();
    expect(isOpen.value).toBe(false);
  });

  test('`new PreviewCard.Handle()` makes the same object; open() of an unknown id throws; with no root the methods do nothing', async () => {
    const handle = new PreviewCard.Handle();
    const { unmount } = mount(PreviewCardHandles, { handle });
    await nextTick();
    expect(() => handle.open('missing')).toThrow('The handle has no trigger with the id "missing"');
    expect(handle.isOpen).toBe(false);
    unmount();
    const detached = new PreviewCard.Handle();
    mount(PreviewCardHandles, { handle: detached, noRoot: true, trigger: { delay: 0 } });
    await nextTick();
    detached.open('first');
    expect(takeReportedMessages()).toEqual([
      'console.warn: Vase UI: `open()` of a handle found no mounted root with this handle. The call does nothing.',
    ]);
    await userEvent.hover(byId('first'));
    await wait(20);
    expect(detached.isOpen).toBe(false);
    expect(byId('first')).not.toHaveAttribute('data-popup-open');
  });

  test('a root before its links is open at the mount for the link of `defaultTriggerId`, with no openChange', async () => {
    const log: string[] = [];
    mount(PreviewCardHandles, {
      handle: PreviewCard.createHandle(),
      root: rootEvents(log, { defaultOpen: true, defaultTriggerId: 'second' }),
    });
    expect(await opened()).toHaveTextContent('second');
    await nextTick();
    expect(byId('second')).toHaveAttribute('data-popup-open');
    expect(log).toEqual([]);
  });
});

describe('in the DOM', () => {
  test('a popup in a <Transition> gets the leave classes after a close, and the portal keeps it until the leave ends', async () => {
    mount(PreviewCardInTransition, { root: { defaultOpen: true, defaultTriggerId: 'a' } });
    const element = await opened();
    await placed();
    // The leave of 300 ms can end before the command ends, so the case reads the page when the
    // leave starts.
    const atLeave = readWhen(
      () => element.classList.contains('card-leave-active') || !element.isConnected,
      () => ({
        leaving: element.classList.contains('card-leave-active'),
        positioner: positioner(),
      }),
    );
    await userEvent.click(byId('outside'));
    const { leaving, positioner: positionerAtLeave } = await atLeave;
    expect(leaving).toBe(true);
    expect(positionerAtLeave).not.toBe(null);
    await closed();
    await waitFor(() => expect(positioner()).toBe(null));
  });

  test('an open while the card leaves keeps the popup and the backdrop, which go back from where they are', async () => {
    const log = new Set<string>();
    const root = reactive<Props>({ open: true });
    mount(PreviewCardInTransition, {
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

  test('an open by another link while the card leaves shows the same popup at that link, with its payload, in the first frame', async () => {
    mount(PreviewCardInTransition, {
      trigger: { delay: 0, closeDelay: 0 },
      payloads: ['first', 'second'],
      popup: { class: 'slow' },
    });
    await nextTick();
    await userEvent.hover(byId('a'));
    const element = await opened();
    await placed();
    await finishAnimations(element);
    await waitFor(() => expect(element).not.toHaveClass('card-enter-active'));
    await userEvent.hover(byId('outside'));
    await waitFor(() => expect(element).toHaveClass('card-leave-active'));
    byId('b').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await nextTick();
    const firstFrame = await new Promise<{ payload: string; offset: number }>((resolve) =>
      requestAnimationFrame(() => {
        const box = positioner()!.getBoundingClientRect();
        const anchor = byId('b').getBoundingClientRect();
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
    mount(PreviewCardInTransition, {
      root,
      trigger: { delay: 0, closeDelay: 0 },
      payloads: ['first', 'second'],
      popup: { class: 'slow' },
    });
    await nextTick();
    await userEvent.hover(byId('a'));
    const element = await opened();
    await finishAnimations(element);
    await waitFor(() => expect(element).not.toHaveClass('card-enter-active'));
    await userEvent.hover(byId('outside'));
    await waitFor(() => expect(element).toHaveClass('card-leave-active'));
    expect(root.triggerId).toBe(null);
    await nextTick();
    expect(byTestId('payload')).toHaveTextContent('first');
  });

  test('the content of the popup stays mounted until the leave ends', async () => {
    const log: string[] = [];
    mount(PreviewCardInTransition, {
      root: { defaultOpen: true },
      popup: { class: 'slow' },
      log: { add: (entry: string) => log.push(entry) },
    });
    const element = await opened();
    await finishAnimations(element);
    await waitFor(() => expect(log).toContain('after-enter'));
    await userEvent.click(byId('outside'));
    await waitFor(() => expect(element).toHaveClass('card-leave-active'));
    await nextTick();
    expect(log).not.toContain('child unmounted');
    await finishAnimations(element);
    await waitFor(() => expect(element.isConnected).toBe(false));
    expect(log.slice(-2)).toEqual(['after-leave', 'child unmounted']);
  });

  test('with `:css="false"`, the enter runs once with no `appear`, and the popup leaves when `done` runs', async () => {
    const log: string[] = [];
    const root = reactive<Props>({ open: true });
    let endLeave = () => {};
    mount(PreviewCardInTransition, {
      root,
      jsHooks: {
        enter(done: () => void) {
          log.push('enter');
          done();
        },
        leave(done: () => void) {
          log.push('leave');
          endLeave = done;
        },
      },
      log: { add: (entry: string) => log.push(entry) },
    });
    const element = await opened();
    await waitFor(() => expect(log).toEqual(['before-enter', 'enter', 'after-enter']));
    root.open = false;
    await waitFor(() => expect(log).toContain('leave'));
    expect(element.isConnected).toBe(true);
    expect(log).not.toContain('child unmounted');
    endLeave();
    await waitFor(() => expect(element.isConnected).toBe(false));
    expect(log).toEqual([
      'before-enter',
      'enter',
      'after-enter',
      'leave',
      'after-leave',
      'child unmounted',
    ]);
  });

  test('with `keepMounted`, the closed popup and backdrop stay with `hidden` and `inert`', async () => {
    const { trigger } = await mountCard({
      portal: { keepMounted: true },
      backdrop: {},
      triggers: [{ key: 't', attrs: { delay: 0 } }],
    });
    const element = await opened();
    expect(element).toHaveAttribute('hidden');
    expect(element).toHaveAttribute('inert');
    expect(byTestId('backdrop')).toHaveAttribute('hidden');
    await userEvent.hover(trigger());
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    expect(element).not.toHaveAttribute('inert');
  });

  test('a kept card that opens again for another link moves to that link', async () => {
    const { trigger } = await mountCard({
      portal: { keepMounted: true },
      triggers: [
        { key: 'a', attrs: { delay: 0, closeDelay: 0 } },
        { key: 'b', attrs: { delay: 0, closeDelay: 0, style: 'display: block; margin-top: 80px' } },
      ],
    });
    const under = (link: Element) => () =>
      expect(
        Math.abs(positioner()!.getBoundingClientRect().top - link.getBoundingClientRect().bottom),
      ).toBeLessThan(1);
    await userEvent.hover(trigger('a'));
    const element = popup()!;
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    await waitFor(under(trigger('a')));
    await userEvent.hover(byId('outside'));
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    await userEvent.hover(trigger('b'));
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    await waitFor(under(trigger('b')));
  });

  test('the popup and the viewport have the `data-instant` of the last change: `focus` after an open by the focus, `dismiss` after Escape, none after a hover', async () => {
    const { trigger } = await mountCard({
      viewport: {},
      triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0 } }],
    });
    await tabToLink();
    const element = await opened();
    expect(element).toHaveAttribute('data-instant', 'focus');
    expect(byTestId('viewport')).toHaveAttribute('data-instant', 'focus');
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.hover(trigger());
    expect(await opened()).not.toHaveAttribute('data-instant');
  });

  test('the popup that leaves has `data-instant="dismiss"` after Escape, and keeps `focus` of an open by the focus after a press outside', async () => {
    const { unmount } = mount(PreviewCardInTransition, { root: { defaultOpen: true } });
    const element = await opened();
    element.focus();
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(element).toHaveAttribute('data-instant', 'dismiss');
    unmount();
    mount(PreviewCardInTransition, { trigger: { delay: 0 } });
    // After a mouse press, a `focus()` after Shift gets `:focus-visible` only in Chromium
    // (test/measurements/preview-card.test.ts). A repeat of this case starts after the press at
    // its end.
    await userEvent.keyboard(TAB);
    expect(document.activeElement).toBe(byId('a'));
    const second = await opened();
    expect(second).toHaveAttribute('data-instant', 'focus');
    await userEvent.click(byId('outside'));
    await nextTick();
    expect(second).toHaveAttribute('data-instant', 'focus');
  });
});

describe('the portal', () => {
  test('goes to a container in `to`; `to` of `null` renders nothing; `disabled` renders in place', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => container.remove());
    const first = await mountCard({ root: { defaultOpen: true }, portal: { to: container } });
    await waitFor(() => expect(container.querySelector('[data-testid="popup"]')).not.toBe(null));
    first.unmount();
    const unset = await mountCard({ root: { defaultOpen: true }, portal: { to: null } });
    await nextTick();
    expect(popup()).toBe(null);
    unset.unmount();
    const inPlace = await mountCard({ root: { defaultOpen: true }, portal: { disabled: true } });
    await opened();
    expect(inPlace.root.contains(popup())).toBe(true);
  });
});

describe('the dismissal', () => {
  test('a press outside closes the card; a click on the link navigates and keeps the card open', async () => {
    const log: string[] = [];
    const { trigger } = await mountCard({
      root: rootEvents(log, { defaultOpen: true }),
      triggers: [{ key: 't', attrs: { href: '#preview-card-link', delay: 0 } }],
    });
    await opened();
    await userEvent.click(byId('outside'));
    await closed();
    expect(log).toEqual(['openChange false outside-press', 'update false']);
    await userEvent.hover(trigger());
    await opened();
    onTestFinished(() => history.replaceState(null, '', location.pathname + location.search));
    await userEvent.click(trigger());
    expect(location.hash).toBe('#preview-card-link');
    await wait(20);
    expect(popup()).not.toBe(null);
  });

  test('Escape with the focus on the link closes the card; the key does not reach a listener of an ancestor of the link; details.trigger is the link', async () => {
    const triggers: (Element | undefined)[] = [];
    const { root, trigger } = await mountCard({
      root: {
        defaultOpen: true,
        onOpenChange: (_: boolean, details: PreviewCardRootChangeEventDetails) =>
          triggers.push(details.trigger),
      },
    });
    await opened();
    const keys: string[] = [];
    root.addEventListener('keydown', (event) => keys.push(event.key));
    trigger().focus();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(keys).toEqual([]);
    expect(triggers).toEqual([trigger()]);
  });

  test('a keydown listener of the developer on the link runs first, so its preventDefault() keeps the card open at Escape', async () => {
    const log: string[] = [];
    const { trigger } = await mountCard({
      root: rootEvents(log, { defaultOpen: true }),
      triggers: [
        { key: 't', attrs: { onKeydown: (event: KeyboardEvent) => event.preventDefault() } },
      ],
    });
    await opened();
    trigger().focus();
    await userEvent.keyboard('{Escape}');
    await wait(20);
    expect(popup()).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('a press that starts in a nested card and ends outside keeps both cards open', async () => {
    const log: string[] = [];
    await mountCard({
      root: rootEvents(log, { defaultOpen: true }),
      nested: { root: { defaultOpen: true } },
      positioner: { side: 'right' },
    });
    await opened();
    await placed();
    await waitFor(() => expect(byTestId('nested-positioner').style.visibility).toBe(''));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await userEvent.pointer([
      { coords: centerOf(byTestId('nested-text')) },
      '[MouseLeft>]',
      { coords: centerOf(byId('outside')) },
      '[/MouseLeft]',
    ]);
    await wait(20);
    expect(byTestId('nested-popup')).toBeTruthy();
    expect(popup()).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('Escape closes only the top card; a press in a nested card keeps the parent open', async () => {
    const log: string[] = [];
    await mountCard({
      root: rootEvents(log, { defaultOpen: true }),
      nested: { root: { defaultOpen: true } },
    });
    await opened();
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    await userEvent.click(byTestId('nested-text'));
    byTestId('nested-popup').focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[data-testid="nested-popup"]')).toBe(null));
    expect(popup()).not.toBe(null);
    expect(log).toEqual([]);
  });
});

describe('the hover', () => {
  test.skipIf(server.browser !== 'chromium')(
    'a touch that rests on the link opens nothing',
    async () => {
      const { trigger } = await mountCard({ triggers: [{ key: 't', attrs: { delay: 0 } }] });
      trigger().addEventListener('click', (event) => event.preventDefault());
      await touchDrag(centerOf(trigger()), centerOf(trigger()), 0, 100);
      await wait(50);
      expect(popup()).toBe(null);
    },
  );

  test('a move across the gap to the card keeps it open; a stop in the gap closes it after 40 ms', async () => {
    const { trigger } = await mountCard({
      triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0, style: 'margin: 100px' } }],
      positioner: { sideOffset: 30 },
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await placed();
    const link = trigger().getBoundingClientRect();
    const card = element.getBoundingClientRect();
    const x = link.left + link.width / 2;
    await moveMouse([
      { x, y: link.bottom + 2 },
      { x, y: (link.bottom + card.top) / 2 },
      centerOf(element),
    ]);
    await wait(60);
    expect(popup()).toBe(element);
    await moveMouse([centerOf(trigger()), { x, y: link.bottom + 5 }]);
    expect(popup()).toBe(element);
    await closed();
  });

  test('a card that a hover opened closes when the pointer leaves it; a card that the default opened does not, also when the pointer comes from its link or leaves the page', async () => {
    const { trigger, unmount } = await mountCard({
      triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0 } }],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await placed();
    await userEvent.hover(byTestId('text'));
    await userEvent.hover(byId('outside'));
    await closed();
    unmount();
    await mountCard({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0 } }],
    });
    expect(await opened()).not.toBe(element);
    await placed();
    await userEvent.hover(byId('outside'));
    document.documentElement.dispatchEvent(
      new PointerEvent('pointerleave', { pointerType: 'mouse' }),
    );
    await userEvent.hover(byTestId('text'));
    await userEvent.hover(byId('outside'));
    await userEvent.hover(document.querySelector<HTMLElement>('[data-key="t"]')!);
    await userEvent.hover(byTestId('text'));
    await userEvent.hover(byId('outside'));
    await wait(100);
    expect(popup()).not.toBe(null);
  });

  test('a card that the default opened closes when the pointer goes from its link to the page, not into the card', async () => {
    const log: string[] = [];
    const { trigger } = await mountCard({
      root: rootEvents(log, { defaultOpen: true }),
      triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0 } }],
    });
    await opened();
    await placed();
    await userEvent.hover(trigger());
    await userEvent.hover(byId('before'));
    await closed();
    expect(log).toEqual(['openChange false trigger-hover', 'update false']);
  });

  test('a nested card that closes while the pointer comes back to its parent leaves the parent open; a new hover on its link opens it again, and the pointer in it keeps both open', async () => {
    const { trigger } = await mountCard({
      root: { defaultOpen: true },
      nested: { trigger: { delay: 0, closeDelay: 150 }, root: {} },
      positioner: { side: 'right' },
    });
    await opened();
    await placed();
    const nested = () => document.querySelector<HTMLElement>('[data-key="nested"]')!;
    await userEvent.hover(nested());
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    await userEvent.hover(byId('outside'));
    await userEvent.hover(byTestId('text'));
    await waitFor(() => expect(document.querySelector('[data-testid="nested-popup"]')).toBe(null));
    expect(popup()).not.toBe(null);
    await userEvent.hover(nested());
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    await userEvent.hover(byTestId('nested-text'));
    await wait(250);
    expect(popup()).not.toBe(null);
    expect(byTestId('nested-popup')).toBeTruthy();
    expect(trigger()).toHaveAttribute('data-popup-open');
  });

  test('a card that the default opened stays open after the pointer goes from its link across the gap into the card and leaves the card', async () => {
    const { trigger } = await mountCard({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0, style: 'margin: 100px' } }],
      positioner: { sideOffset: 30 },
    });
    const element = await opened();
    await placed();
    const link = trigger().getBoundingClientRect();
    await moveMouse([
      centerOf(trigger()),
      { x: link.left + link.width / 2, y: link.bottom + 5 },
      centerOf(element),
      centerOf(byId('outside')),
    ]);
    await wait(100);
    expect(popup()).toBe(element);
  });

  test.each([
    { name: 'the default', root: { defaultOpen: true } },
    { name: 'the focus', root: {} },
  ])(
    'a card that $name opened closes `closeDelay` after the pointer leaves its link',
    async ({ root }) => {
      const log: string[] = [];
      const { trigger } = await mountCard({
        root: rootEvents(log, root),
        triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 50 } }],
      });
      if (!root.defaultOpen) await tabToLink();
      await opened();
      await placed();
      await userEvent.hover(trigger());
      const beforeClose = readAfter(trigger(), 'pointerleave', 20, popup);
      await userEvent.hover(byId('outside'));
      expect(await beforeClose).not.toBe(null);
      await closed();
      expect(log.at(-2)).toBe('openChange false trigger-hover');
    },
  );

  test('a hover on the link while the card leaves after a hover close opens it at once, and the same popup goes back from where it is', async () => {
    const log: string[] = [];
    const trigger = reactive<Props>({ delay: 0, closeDelay: 0 });
    mount(PreviewCardInTransition, {
      root: rootEvents(log),
      trigger,
      popup: { class: 'slow' },
    });
    await nextTick();
    await userEvent.hover(byId('a'));
    const first = await opened();
    await finishAnimations(first);
    await waitFor(() => expect(first).not.toHaveClass('card-enter-active'));
    trigger.delay = 10_000;
    const popups = mostMatches('[data-testid="popup"]');
    await userEvent.hover(byId('outside'));
    await waitFor(() => expect(shownOpacity(first)).toBeLessThan(0.8));
    const atOpen = shownOpacity(first);
    byId('a').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await nextTick();
    expect(log.at(-2)).toBe('openChange true trigger-hover');
    const [frames = []] = await opacityUntilRest([first]);
    expect(popup()).toBe(first);
    expect(popups()).toBe(1);
    expect(Math.min(...frames)).toBeGreaterThan(atOpen - 0.15);
    expect(frames.at(-1)).toBe(1);
  });

  test('a hover on a link while the card leaves after a hover close opens it with no delay, in a <Transition> and with `keepMounted`; after the leave, the delay holds', async () => {
    for (const portal of [{}, { keepMounted: true }]) {
      const log: string[] = [];
      const { unmount } = mount(PreviewCardInTransition, {
        root: rootEvents(log),
        trigger: { delay: 200, closeDelay: 0 },
        portal,
      });
      await userEvent.hover(byId('a'));
      await waitFor(() => expect(byId('a')).toHaveAttribute('data-popup-open'));
      // The hover on `b` comes in the task where the leave of 300 ms starts, which can end before a
      // command ends.
      const atHover = readWhen(
        () => !byId('a').hasAttribute('data-popup-open'),
        async () => {
          byId('b').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
          await nextTick();
          return byId('b').hasAttribute('data-popup-open');
        },
      );
      await userEvent.hover(byId('outside'));
      expect(await atHover).toBe(true);
      await userEvent.hover(byId('b'));
      await userEvent.hover(byId('outside'));
      await waitFor(() => expect(byId('b')).not.toHaveAttribute('data-popup-open'));
      // The card leaves until Vue removes it, also in the two frames before its transition starts. A
      // kept card leaves while its animation of `[hidden]` runs. The animation fills forwards, so it
      // stays `finished`.
      if (portal.keepMounted) {
        await waitFor(() =>
          expect(
            popup()!
              .getAnimations()
              .map(({ playState }) => playState),
          ).toEqual(['finished']),
        );
      } else {
        await closed();
      }
      const beforeOpen = readAfter(byId('a'), 'pointerenter', 100, () =>
        byId('a').hasAttribute('data-popup-open'),
      );
      await userEvent.hover(byId('a'));
      expect(await beforeOpen).toBe(false);
      await waitFor(() => expect(byId('a')).toHaveAttribute('data-popup-open'));
      unmount();
    }
  });

  test('a hover while the card leaves after Escape waits for the delay', async () => {
    mount(PreviewCardInTransition, { trigger: { delay: 150, closeDelay: 0 } });
    await userEvent.hover(byId('a'));
    await waitFor(() => expect(byId('a')).toHaveAttribute('data-popup-open'));
    // The hover on `b` comes in the task where the leave of 300 ms starts, and the check 50 ms after
    // it. A command can end after the leave or after the delay.
    const atHover = readWhen(
      () => !byId('a').hasAttribute('data-popup-open'),
      async () => {
        const leaving = popup();
        byId('b').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
        await wait(50);
        return { leaving, open: byId('b').hasAttribute('data-popup-open') };
      },
    );
    await userEvent.keyboard('{Escape}');
    const { leaving, open } = await atHover;
    expect(leaving).not.toBe(null);
    expect(open).toBe(false);
    await waitFor(() => expect(byId('b')).toHaveAttribute('data-popup-open'));
  });

  test('the delay of a hover holds when another link of the root unmounts, also the link of the trigger id of a closed root', async () => {
    const triggers = reactive([
      { key: 't', attrs: { delay: 100 } },
      { key: 'other', attrs: { id: 'other', delay: 0 } },
    ]);
    const { trigger } = await mountCard({ root: { defaultTriggerId: 'other' }, triggers });
    // The link starts its delay in its own listener of the same event, before this one.
    trigger().addEventListener('pointerenter', () => triggers.splice(1, 1), { once: true });
    const beforeOpen = readAfter(trigger(), 'pointerenter', 50, popup);
    await userEvent.hover(trigger());
    expect(await beforeOpen).toBe(null);
    expect(byId('other')).toBe(null);
    await opened();
    expect(trigger()).toHaveAttribute('data-popup-open');
  });

  test('a parent that closes a kept card while the pointer is in the triangle stops the close of that hover', async () => {
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    const { trigger } = await mountCard({
      root,
      portal: { keepMounted: true },
      triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0, style: 'margin: 100px' } }],
      positioner: { side: 'right', sideOffset: 100 },
    });
    await userEvent.hover(trigger());
    await waitFor(() => expect(trigger()).toHaveAttribute('data-popup-open'));
    await placed();
    const link = trigger().getBoundingClientRect();
    await userEvent.pointer({ coords: { x: link.right + 3, y: link.top + link.height / 2 } });
    root.open = false;
    await nextTick();
    await userEvent.hover(trigger());
    await waitFor(() => expect(trigger()).toHaveAttribute('data-popup-open'));
    await wait(80);
    expect(trigger()).toHaveAttribute('data-popup-open');
  });

  test('a nested card keeps its parent open while the pointer is in it; the two close when the pointer leaves for the page', async () => {
    const { trigger } = await mountCard({
      triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0 } }],
      nested: { trigger: { delay: 0, closeDelay: 0 }, root: {} },
      positioner: { side: 'right' },
    });
    await userEvent.hover(trigger());
    await opened();
    await placed();
    await userEvent.hover(byTestId('text'));
    await userEvent.hover(document.querySelector<HTMLElement>('[data-key="nested"]')!);
    await waitFor(() => expect(byTestId('nested-popup')).toBeTruthy());
    await userEvent.hover(byTestId('nested-text'));
    await wait(80);
    expect(popup()).not.toBe(null);
    await userEvent.hover(byId('outside'));
    await closed();
    expect(document.querySelector('[data-testid="nested-popup"]')).toBe(null);
  });
});

describe('the focus', () => {
  test('Tab to the link opens the card after `delay` with `trigger-focus`; Tab away closes it', async () => {
    const log: string[] = [];
    const { trigger } = await mountCard({
      root: rootEvents(log),
      triggers: [{ key: 't', attrs: { delay: 100 } }],
    });
    const beforeOpen = readAfter(trigger(), 'focusin', 50, popup);
    await tabToLink();
    expect(await beforeOpen).toBe(null);
    await opened();
    await userEvent.keyboard(TAB);
    expect(document.activeElement).toBe(byId('outside'));
    await closed();
    expect(log).toEqual([
      'openChange true trigger-focus',
      'update true',
      'openChange false trigger-focus',
      'update false',
    ]);
  });

  // WebKit on macOS moves no focus to a link at a click (test/measurements/preview-card.test.ts).
  test.skipIf(server.browser === 'webkit' && server.platform === 'darwin')(
    'a mouse click on the link gives the focus with no open by the focus',
    async () => {
      const { trigger } = await mountCard({ triggers: [{ key: 't', attrs: { delay: 5000 } }] });
      onTestFinished(() => history.replaceState(null, '', location.pathname + location.search));
      await userEvent.click(trigger());
      expect(document.activeElement).toBe(trigger());
      await userEvent.hover(byId('outside'));
      await wait(50);
      expect(popup()).toBe(null);
    },
  );

  test('the focus on another link opens the card for it with no delay; after Escape the next link opens it again', async () => {
    await mountCard({
      triggers: [
        { key: 'a', attrs: { delay: 0 } },
        { key: 'b', attrs: { delay: 5000 } },
      ],
    });
    await tabToLink();
    await opened();
    await userEvent.keyboard(TAB);
    expect(document.querySelector('[data-key="b"]')).toHaveAttribute('data-popup-open');
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.keyboard('{Shift>}' + TAB + '{/Shift}');
    await opened();
    expect(document.querySelector('[data-key="a"]')).toHaveAttribute('data-popup-open');
  });

  test('the focus that leaves a link keeps the card that is open for another link', async () => {
    const { trigger } = await mountCard({
      triggers: [
        { key: 'a', attrs: { delay: 0 } },
        { key: 'b', attrs: { delay: 0 } },
      ],
    });
    // A mouse press before `focus()` gives no `:focus-visible`, so the link gets the focus with no
    // open (test/measurements/preview-card.test.ts).
    await userEvent.click(byId('before'));
    trigger('a').focus();
    await userEvent.hover(trigger('b'));
    await opened();
    byId('before').focus();
    await wait(50);
    expect(trigger('b')).toHaveAttribute('data-popup-open');
  });

  test.each([false, true])(
    'a press on text in a card that the focus opened keeps it open (portal in a shadow root: %s)',
    async (shadow) => {
      let to: Element | undefined;
      if (shadow) {
        const host = document.body.appendChild(document.createElement('div'));
        onTestFinished(() => host.remove());
        to = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('div'));
      }
      const log: string[] = [];
      await mountCard({
        root: rootEvents(log),
        portal: { to },
        triggers: [{ key: 't', attrs: { delay: 0 } }],
      });
      await tabToLink();
      await waitFor(() => expect(log).toEqual(['openChange true trigger-focus', 'update true']));
      const text = (to ?? document).querySelector<HTMLElement>('[data-testid="text"]')!;
      await userEvent.click(text);
      await wait(50);
      expect(log).toEqual(['openChange true trigger-focus', 'update true']);
    },
  );

  test('after Escape, a window that loses the focus and gets it back opens nothing; a card that the focus opened stays open while the window has no focus', async () => {
    const { trigger } = await mountCard({ triggers: [{ key: 't', attrs: { delay: 0 } }] });
    await tabToLink();
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    await leaveWindowAndReturn(trigger());
    await wait(50);
    expect(popup()).toBe(null);
    await userEvent.keyboard(TAB);
    await userEvent.keyboard('{Shift>}' + TAB + '{/Shift}');
    await opened();
    await leaveWindowAndReturn(trigger(), false);
    await wait(50);
    expect(popup()).not.toBe(null);
  });
});

describe('the active trigger leaves', () => {
  test('an open card closes with the reason `none` and no trigger', async () => {
    const events: unknown[] = [];
    const triggers = reactive([{ key: 'a', attrs: { id: 'a' } }, { key: 'b' }]);
    await mountCard({
      root: {
        defaultOpen: true,
        defaultTriggerId: 'a',
        onOpenChange: (open: boolean, details: PreviewCardRootChangeEventDetails) =>
          events.push([open, details.reason, details.trigger]),
      },
      triggers,
    });
    await opened();
    triggers.splice(0, 1);
    await closed();
    expect(events).toEqual([[false, 'none', undefined]]);
    expect(document.querySelector('[data-key="b"]')).not.toHaveAttribute('data-popup-open');
  });

  test('a focused link that Vue removes gives one openChange, also when a listener cancels the close', async () => {
    const log: string[] = [];
    const triggers = reactive([{ key: 't', attrs: { delay: 0 } }]);
    await mountCard({
      root: {
        onOpenChange: (open: boolean, details: PreviewCardRootChangeEventDetails) => {
          log.push(`${open} ${details.reason}`);
          if (details.reason === 'none') details.cancel();
        },
      },
      triggers,
    });
    await tabToLink();
    await opened();
    triggers.splice(0, 1);
    await nextTick();
    await wait(50);
    expect(log).toEqual(['true trigger-focus', 'false none']);
    expect(popup()).not.toBe(null);
  });

  test('a cancelled close keeps the card open at its place with its payload', async () => {
    const handle = PreviewCard.createHandle<string>();
    const removed = reactive({ first: false });
    mount(PreviewCardHandles, {
      handle,
      root: {
        onOpenChange: (_: boolean, details: PreviewCardRootChangeEventDetails) => {
          if (details.reason === 'none') details.cancel();
        },
      },
      removed,
    });
    await nextTick();
    handle.open('first');
    const element = await opened();
    expect(element).toHaveTextContent('first');
    removed.first = true;
    await nextTick();
    await nextTick();
    expect(popup()).toBe(element);
    expect(element).toHaveTextContent('first');
  });

  test('a link that a `v-if` with a new `key` replaces with the same id keeps the card open', async () => {
    const triggers = reactive([{ key: 'a', attrs: { id: 'link' } }]);
    await mountCard({ root: { defaultOpen: true }, triggers });
    const element = await opened();
    triggers.splice(0, 1, { key: 'b', attrs: { id: 'link' } });
    await nextTick();
    await nextTick();
    expect(popup()).toBe(element);
  });
});

describe('the arrow', () => {
  test('VUE-193: the arrow in a positioned popup with a border points at the center of the link', async () => {
    const { trigger } = await mountCard({
      root: { defaultOpen: true },
      triggers: [
        {
          key: 't',
          attrs: { style: 'position: fixed; left: 300px; top: 200px; width: 40px; display: block' },
        },
      ],
      popup: { style: 'position: relative; width: 160px; border: 1px solid' },
      arrow: { style: 'width: 10px; height: 10px' },
    });
    await opened();
    await placed();
    const arrow = byTestId('arrow');
    await waitFor(() => expect(arrow.style.left).toMatch(/px$/));
    expect(Math.abs(centerOf(arrow).x - centerOf(trigger()).x)).toBeLessThanOrEqual(0.5);
  });

  test('VUE-160: an arrow that replaces another arrow keeps its place after the old arrow leaves', async () => {
    const arrows = reactive({ first: true, second: false });
    const positioner = reactive<Props>({ sideOffset: 0 });
    const { trigger } = await mountCard({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { style: 'margin: 0 150px' } }],
      popup: { style: 'width: 100px; height: 50px' },
      positioner,
      arrows,
    });
    await opened();
    await placed();
    const link = trigger().getBoundingClientRect();
    const expectCentered = () => {
      const arrow = byTestId('second-arrow').getBoundingClientRect();
      expect(Math.abs(arrow.left + arrow.width / 2 - (link.left + link.width / 2))).toBeLessThan(1);
    };
    arrows.second = true;
    await waitFor(expectCentered);
    arrows.first = false;
    positioner.sideOffset = 12;
    await waitFor(() => {
      const top = byTestId('positioner').getBoundingClientRect().top;
      expect(Math.abs(top - (link.bottom + 12))).toBeLessThan(1);
      expectCentered();
    });
  });
});

describe('the viewport', () => {
  function nextResize(element: Element) {
    return new Promise<void>((resolve) => {
      const observer = new ResizeObserver(() => {
        observer.disconnect();
        resolve();
      });
      observer.observe(element);
    });
  }

  async function openSizedCard() {
    const root = reactive({ open: true, defaultTriggerId: 'link' });
    await mountCard({
      root,
      triggers: [{ key: 't', attrs: { id: 'link' } }],
      portal: { keepMounted: true },
      positioner: { style: { height: 'var(--positioner-height)' } },
      // A kept popup can still have a box during its CSS exit.
      popup: { style: { display: 'block' } },
      viewport: {},
    });
    await placed();
    const card = byTestId('popup');
    const box = byTestId('positioner');
    await nextResize(card);
    await waitSingleFrame();
    const height = card.offsetHeight;
    expect(box.style.getPropertyValue('--positioner-height')).toBe(`${height}px`);
    return { root, card, box, height, content: byTestId('text') };
  }

  test('a popup that grows after it opens gives no resize loop error and its positioner fits it in the next frame', async () => {
    const { card, box, height, content } = await openSizedCard();
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.message);
    window.addEventListener('error', onError);
    onTestFinished(() => window.removeEventListener('error', onError));

    content.style.paddingBottom = '1px';
    await nextResize(card);
    await waitSingleFrame();
    expect(errors).toEqual([]);
    expect(card.offsetHeight).toBe(height + 1);
    expect(box.offsetHeight).toBe(card.offsetHeight);
  });

  test('a close before the next frame keeps the last open size of the positioner during the exit', async () => {
    const { root, card, box, height, content } = await openSizedCard();
    content.style.paddingBottom = '1px';
    await new Promise<void>((resolve) => {
      const observer = new ResizeObserver(([entry]) => {
        if (entry.target === box) {
          // The delivery of the parent lets the browser deliver the deeper popup again this frame.
          observer.unobserve(box);
          content.style.paddingBottom = '2px';
        } else {
          observer.disconnect();
          root.open = false;
          resolve();
        }
      });
      observer.observe(box);
      observer.observe(card);
    });
    await waitSingleFrame();
    expect(card).toHaveAttribute('hidden');
    expect(card.offsetHeight).toBe(height + 2);
    expect(box.style.getPropertyValue('--positioner-height')).toBe(`${height}px`);
  });

  test('gives the id of the active link to its slot, and the card writes no `trigger-change`', async () => {
    const { trigger } = await mountCard({
      viewport: {},
      triggers: [
        { key: 'a', attrs: { id: 'a', payload: 'first', delay: 0 } },
        { key: 'b', attrs: { id: 'b', payload: 'second', delay: 0, style: 'margin: 0 40px' } },
      ],
    });
    await userEvent.hover(trigger('a'));
    await opened();
    await userEvent.hover(trigger('b'));
    await waitFor(() => expect(byTestId('payload')).toHaveTextContent('second'));
    await wait(50);
    expect(byTestId('viewport')).not.toHaveAttribute('data-instant');
  });

  test('in a positioner with the size of its variables, the popup has the size of its content at the first open', async () => {
    const { trigger } = await mountCard({
      viewport: {},
      positioner: {
        style: { width: 'var(--positioner-width)', height: 'var(--positioner-height)' },
      },
      triggers: [{ key: 't', attrs: { payload: 'first', delay: 0 } }],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await placed();
    await waitFor(() =>
      expect(positioner()!.style.getPropertyValue('--positioner-width')).not.toBe(''),
    );
    for (let frame = 0; frame < 3; frame += 1) await waitSingleFrame();
    expect(element.offsetWidth).toBeGreaterThan(0);
    expect(element.offsetWidth).toBe(element.scrollWidth);
    expect(positioner()!.style.getPropertyValue('--positioner-width')).toBe(
      `${element.offsetWidth}px`,
    );
  });

  test.each([
    { label: 'side="top"', side: 'top' as const, dir: 'ltr' as const, axis: 'height' as const },
    { label: 'side="left"', side: 'left' as const, dir: 'ltr' as const, axis: 'width' as const },
    {
      label: 'side="inline-end" in RTL',
      side: 'inline-end' as const,
      dir: 'rtl' as const,
      axis: 'width' as const,
    },
  ])(
    'on $label, late content growth expands away from the trigger on frame 0 with no overlap and no resize loop error',
    async ({ side, dir, axis }) => {
      const { trigger } = await mountCard({
        root: { defaultOpen: true, defaultTriggerId: 'link' },
        triggers: [
          {
            key: 't',
            attrs: {
              id: 'link',
              style: 'position: fixed; top: 260px; left: 320px; width: 60px; height: 24px',
            },
          },
        ],
        positioner: {
          side,
          dir,
          sideOffset: 8,
          collisionAvoidance: { side: 'none' },
          style: { width: 'var(--positioner-width)', height: 'var(--positioner-height)' },
        },
        popup: {
          style: { width: 'var(--popup-width, auto)', height: 'var(--popup-height, auto)' },
        },
        viewport: {},
      });
      await opened();
      await placed();
      const card = byTestId('popup');
      const box = byTestId('positioner');
      const text = byTestId('text');
      text.style.width = '100px';
      text.style.height = '40px';
      await waitFor(() =>
        expect(box.style.getPropertyValue(`--positioner-${axis}`)).toBe(
          `${axis === 'height' ? card.offsetHeight : card.offsetWidth}px`,
        ),
      );
      await waitSingleFrame();
      await waitSingleFrame();
      const trigRect = trigger().getBoundingClientRect();
      const before = card.getBoundingClientRect();

      const errors: string[] = [];
      const onError = (event: ErrorEvent) => errors.push(event.message);
      window.addEventListener('error', onError);
      onTestFinished(() => window.removeEventListener('error', onError));

      let f0Pop!: DOMRect;
      let f0Pos!: DOMRect;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          text.style[axis] = axis === 'height' ? '80px' : '140px';
          requestAnimationFrame(() => {
            f0Pop = card.getBoundingClientRect();
            f0Pos = box.getBoundingClientRect();
            requestAnimationFrame(() => resolve());
          });
        });
      });

      expect(Math.round(f0Pos[axis])).toBe(Math.round(before[axis]));
      expect(Math.round(f0Pop[axis])).toBe(Math.round(before[axis] + 40));
      if (axis === 'height') {
        expect(Math.round(f0Pop.bottom)).toBe(Math.round(trigRect.top - 8));
        expect(Math.round(f0Pop.top)).toBe(Math.round(before.top - 40));
      } else {
        expect(Math.round(f0Pop.right)).toBe(Math.round(trigRect.left - 8));
        expect(Math.round(f0Pop.left)).toBe(Math.round(before.left - 40));
      }
      expect(card.style.position).toBe('absolute');
      expect(card.style[axis === 'height' ? 'bottom' : 'right']).toBe('0px');
      await waitFor(() =>
        expect(box.style.getPropertyValue(`--positioner-${axis}`)).toBe(
          `${Math.round(before[axis] + 40)}px`,
        ),
      );
      await waitSingleFrame();
      expect(errors).toEqual([]);
    },
  );

  test('with no viewport on side="top", the popup gets no anchoring style', async () => {
    await mountCard({
      root: { defaultOpen: true, defaultTriggerId: 'link' },
      triggers: [
        { key: 't', attrs: { id: 'link', style: 'position: fixed; top: 260px; left: 320px' } },
      ],
      positioner: { side: 'top', collisionAvoidance: { side: 'none' } },
    });
    const card = await opened();
    await placed();
    await waitSingleFrame();
    expect(card.style.position).toBe('');
    expect(card.style.bottom).toBe('');
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('a part outside its parent', () => {
  test('throws an error that names the part with no root, Positioner with no Portal, and Popup and Viewport with no Positioner', () => {
    expect(String(mountError(PreviewCardPartAlone, { part: 'Popup' }))).toContain(
      '<PreviewCard.Popup> must be inside <PreviewCard.Root>',
    );
    expect(String(mountError(PreviewCardPartAlone, { part: 'Trigger' }))).toContain(
      '<PreviewCard.Trigger> must be inside <PreviewCard.Root>, or it must have a `handle`',
    );
    expect(
      String(mountError(PreviewCardPartAlone, { part: 'Positioner', inRoot: true })),
    ).toContain('<PreviewCard.Positioner> must be inside <PreviewCard.Portal>');
    for (const part of ['Popup', 'Viewport']) {
      expect(String(mountError(PreviewCardPartAlone, { part, inPortal: true }))).toContain(
        `<PreviewCard.${part}> must be inside <PreviewCard.Positioner>`,
      );
    }
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
