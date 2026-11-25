import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { computed, nextTick, reactive } from 'vue';
import { Tooltip, type TooltipRootChangeEventDetails } from '@vase-ui/vue/tooltip';
import TooltipComposed from '../../test/fixtures/TooltipComposed.vue';
import TooltipPartAlone from '../../test/fixtures/TooltipPartAlone.vue';
import TooltipParts from '../../test/fixtures/TooltipParts.vue';
import {
  finishAnimations,
  mostMatches,
  opacityUntilRest,
  shownOpacity,
} from '../../test/animation';
import { touchDrag } from '../../test/pointer';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { readAfter } from '../../test/wait';
import { waitFor } from '../../test/waitFor';
import { waitForPositioned } from '../../test/waitForPositioned';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const popup = (name = 't') => byTestId(`popup-${name}`);
const positioner = (name = 't') => byTestId(`positioner-${name}`);
const trigger = (key = 't') => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const byId = (id: string) => document.getElementById(id)!;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mountTooltips(setup: Props = {}) {
  const result = mount(TooltipParts, setup);
  await nextTick();
  return result;
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: TooltipRootChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    'onUpdate:open': (open: boolean) => log.push(`update ${open}`),
  });
}

/**
 * Props of a root that write in `delays` the time from the pointer event that started the delay of
 * each open by the hover to that open.
 */
function hoverDelays(delays: number[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: TooltipRootChangeEventDetails) => {
      if (open && details.reason === 'trigger-hover') {
        delays.push(performance.now() - details.event.timeStamp);
      }
    },
  });
}

// A timer of the browser runs at least its delay after its start. The browser rounds the times of
// its clock, so a measured time can be up to 2 ms below the delay.
const atLeast = (delay: number) => delay - 2;

async function opened(name = 't') {
  await waitFor(() => expect(popup(name)).not.toBe(null));
  return popup(name)!;
}

async function closed(name = 't') {
  await waitFor(() => expect(popup(name)).toBe(null));
}

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Moves a pointer of `pointerType` over `target` with synthetic events, at the point. */
function movePointer(target: Element, point: { x: number; y: number }, pointerType = 'mouse') {
  for (const type of ['pointerover', 'pointerenter', 'pointermove']) {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: type !== 'pointerenter',
        composed: true,
        pointerType,
        clientX: point.x,
        clientY: point.y,
      }),
    );
  }
}

/** Moves the real mouse to the bottom right corner of the view, away from each trigger. */
async function hoverAway() {
  let away = document.getElementById('outside') ?? document.getElementById('away');
  if (!away) {
    away = document.body.appendChild(document.createElement('button'));
    away.id = 'away';
    away.textContent = 'Away';
    away.style.cssText = 'position: fixed; left: 0; bottom: 0';
    const created = away;
    onTestFinished(() => created.remove());
  }
  await userEvent.hover(away);
}

/** An input at the start of `<body>`, before each part, that has the focus. */
function focusBefore() {
  const input = document.body.insertBefore(
    document.createElement('input'),
    document.body.firstChild,
  );
  input.setAttribute('aria-label', 'Start');
  onTestFinished(() => input.remove());
  input.focus();
}

/** The point of the last `pointermove` of the page. */
function lastPointer() {
  const point = { x: 0, y: 0 };
  const listener = (event: PointerEvent) =>
    Object.assign(point, { x: event.clientX, y: event.clientY });
  document.addEventListener('pointermove', listener, true);
  onTestFinished(() => document.removeEventListener('pointermove', listener, true));
  return point;
}

function addStyle(css: string) {
  const style = document.head.appendChild(document.createElement('style'));
  style.textContent = css;
  onTestFinished(() => style.remove());
}

describe('the parts', () => {
  test('render their native elements in <body>; the trigger has an id and no ARIA attribute; the popup has no role; the attributes of the developer win', async () => {
    const { exposed } = await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { defaultOpen: true },
          popup: { class: 'tip', tabindex: 0 },
          arrow: {},
          triggers: [{ key: 't', attrs: { 'data-extra': '' } }],
        },
      ],
    });
    const element = await opened();
    expect(trigger().localName).toBe('button');
    expect(trigger()).toHaveAttribute('type', 'button');
    expect(trigger().id).not.toBe('');
    expect([...trigger().attributes].some((attribute) => attribute.name.startsWith('aria-'))).toBe(
      false,
    );
    expect(trigger()).toHaveAttribute('data-popup-open');
    expect(trigger()).toHaveAttribute('data-extra');
    expect(element.localName).toBe('div');
    expect(element).not.toHaveAttribute('role');
    expect(element).toHaveAttribute('tabindex', '0');
    expect(element).toHaveClass('tip');
    expect(positioner()!.parentElement).toBe(document.body);
    expect(positioner()).toHaveAttribute('data-side', 'top');
    expect(byTestId('arrow-t')).toHaveAttribute('aria-hidden', 'true');
    expect(exposed.parts[0].root).toHaveProperty('close');
    expect(exposed.parts[0].popup.element).toBe(element);
  });

  test('`as` of the positioner, the popup and the arrow renders its tag', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { defaultOpen: true },
          positioner: { as: 'section' },
          popup: { as: 'aside' },
          arrow: { as: 'span' },
        },
      ],
    });
    const element = await opened();
    expect(positioner()!.localName).toBe('section');
    expect(element.localName).toBe('aside');
    expect(byTestId('arrow-t')!.localName).toBe('span');
  });

  test('`as` renders its tag: a `<button>` gets `type="button"`, another tag gets no type and no role', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          triggers: [
            { key: 'a', attrs: { as: 'span' } },
            { key: 'b', attrs: { as: 'button' } },
            { key: 'c', attrs: { type: 'submit' } },
          ],
        },
      ],
    });
    expect(trigger('a').localName).toBe('span');
    expect(trigger('a')).not.toHaveAttribute('type');
    expect(trigger('a')).not.toHaveAttribute('role');
    expect(trigger('b')).toHaveAttribute('type', 'button');
    expect(trigger('c')).toHaveAttribute('type', 'submit');
  });

  test('a trigger and a popup with no root, and a positioner with no portal, throw an error that names the part', () => {
    expect(String(mountError(TooltipPartAlone, { part: 'Trigger' }))).toContain(
      '<Tooltip.Trigger> must be inside <Tooltip.Root>',
    );
    expect(String(mountError(TooltipPartAlone, { part: 'Popup' }))).toContain(
      '<Tooltip.Popup> must be inside <Tooltip.Root>',
    );
    expect(String(mountError(TooltipPartAlone, { part: 'Positioner', inRoot: true }))).toContain(
      '<Tooltip.Positioner> must be inside <Tooltip.Portal>',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});

describe('the root', () => {
  test('a hover opens and closes the tooltip; openChange comes before update:open', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        { name: 't', root: rootEvents(log), triggers: [{ key: 't', attrs: { delay: 0 } }] },
      ],
    });
    await userEvent.hover(trigger());
    await opened();
    await hoverAway();
    await closed();
    expect(log).toEqual([
      'openChange true trigger-hover',
      'update true',
      'openChange false trigger-hover',
      'update false',
    ]);
  });

  test('a controlled root shows only the value of its parent; cancel() keeps the state; a change by the parent emits nothing', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { open: true });
    root.onOpenChange = (open: boolean, details: TooltipRootChangeEventDetails) => {
      log.push(`openChange ${open} ${details.reason}`);
      if (details.reason === 'escape-key') details.cancel();
    };
    await mountTooltips({ tooltips: [{ name: 't', root }] });
    await opened();
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(popup()).not.toBe(null);
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

  test('`defaultOpen` opens an uncontrolled root; the close() of a template ref asks for a close with `imperative-action`', async () => {
    const log: string[] = [];
    const { exposed } = await mountTooltips({
      tooltips: [{ name: 't', root: rootEvents(log, { defaultOpen: true }) }],
    });
    await opened();
    exposed.parts[0].root.close();
    await closed();
    expect(log).toEqual(['openChange false imperative-action', 'update false']);
  });

  test('a hover on a second trigger of an open root moves the tooltip at once; v-model:trigger-id follows; the slot gets the payload', async () => {
    const ids: (string | null)[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { 'onUpdate:triggerId': (id: string | null) => ids.push(id) },
          triggers: [
            { key: 'a', attrs: { id: 'a', delay: 0, payload: 'first' } },
            { key: 'b', attrs: { id: 'b', delay: 10_000, payload: 'second' } },
          ],
        },
      ],
    });
    await userEvent.hover(trigger('a'));
    await opened();
    expect(byTestId('payload')).toHaveTextContent('first');
    await userEvent.hover(trigger('b'));
    await waitFor(() => expect(trigger('b')).toHaveAttribute('data-popup-open'));
    expect(trigger('a')).not.toHaveAttribute('data-popup-open');
    expect(byTestId('payload')).toHaveTextContent('second');
    expect(ids).toEqual(['a', 'b']);
  });

  test('a handle opens and closes the root from code; `isOpen` in a `computed` follows the tooltip and the root (VUE-34)', async () => {
    const handle = Tooltip.createHandle<string>();
    const isOpen = computed(() => handle.isOpen);
    expect(isOpen.value).toBe(false);
    await mountTooltips({
      tooltips: [
        { name: 't', root: { handle }, triggers: [{ key: 't', attrs: { id: 'target' } }] },
      ],
    });
    handle.open('target');
    await opened();
    expect(isOpen.value).toBe(true);
    expect(() => handle.open('missing')).toThrow('no trigger with the id "missing"');
    handle.close();
    await closed();
    expect(isOpen.value).toBe(false);
  });

  test('a trigger with a handle outside its root opens the root and gives its payload', async () => {
    const handle = new Tooltip.Handle<string>();
    await mountTooltips({
      tooltips: [
        { name: 'r', root: { handle }, triggers: [] },
        { name: 'o', triggers: [{ key: 'out', attrs: { handle, delay: 0, payload: 'out' } }] },
      ],
    });
    await userEvent.hover(trigger('out'));
    await opened('r');
    expect(byTestId('payload')).toHaveTextContent('out');
  });

  test('a parent that opens the root again for another trigger with a handle shows the payload of that trigger at each render', async () => {
    const handle = Tooltip.createHandle<string>();
    const root = reactive<Props>({ handle, open: true, triggerId: 'first' });
    await mountTooltips({
      tooltips: [
        { name: 'r', root, triggers: [] },
        {
          name: 'o',
          triggers: [
            { key: 'first', attrs: { handle, id: 'first', payload: 'First' } },
            { key: 'second', attrs: { handle, id: 'second', payload: 'Second' } },
          ],
        },
      ],
    });
    await opened('r');
    await waitFor(() => expect(byTestId('payload')).toHaveTextContent('First'));
    root.open = false;
    root.triggerId = null;
    await closed('r');
    const shown: string[] = [];
    const observer = new MutationObserver(() => {
      const payload = popup('r')?.querySelector('[data-testid="payload"]');
      if (payload) shown.push(payload.textContent ?? '');
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    onTestFinished(() => observer.disconnect());
    root.open = true;
    root.triggerId = 'second';
    await opened('r');
    await nextTick();
    expect(byTestId('payload')).toHaveTextContent('Second');
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((text) => text === 'Second')).toBe(true);
  });

  test('a root with `defaultOpen` for a trigger with a handle outside it stays open, and that trigger has `data-popup-open`', async () => {
    const handle = Tooltip.createHandle();
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 'r',
          root: rootEvents(log, { handle, defaultOpen: true, defaultTriggerId: 'out' }),
          triggers: [],
        },
        { name: 'o', triggers: [{ key: 'out', attrs: { handle, id: 'out' } }] },
      ],
    });
    await opened('r');
    await waitFor(() => expect(trigger('out')).toHaveAttribute('data-popup-open'));
    await sleep(40);
    expect(popup('r')).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('cancel() of an open keeps the tooltip closed and the trigger with no `data-popup-open`', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: {
            onOpenChange: (open: boolean, details: TooltipRootChangeEventDetails) => {
              log.push(`${open} ${details.reason}`);
              details.cancel();
            },
          },
          triggers: [{ key: 't', attrs: { delay: 0 } }],
        },
      ],
    });
    await userEvent.hover(trigger());
    await waitFor(() => expect(log).toEqual(['true trigger-hover']));
    await sleep(40);
    expect(popup()).toBe(null);
    expect(trigger()).not.toHaveAttribute('data-popup-open');
  });

  test('a hover that waits while no root has the handle of its trigger opens nothing when the root mounts; the next hover opens', async () => {
    const handle = Tooltip.createHandle();
    const tooltips = reactive<({ name: string } & Props)[]>([
      { name: 'o', triggers: [{ key: 'out', attrs: { handle, delay: 50 } }] },
    ]);
    await mountTooltips({ tooltips });
    await userEvent.hover(trigger('out'));
    tooltips.push({ name: 'r', root: { handle }, triggers: [] });
    await sleep(120);
    expect(popup('r')).toBe(null);
    await hoverAway();
    await userEvent.hover(trigger('out'));
    await opened('r');
    expect(trigger('out')).toHaveAttribute('data-popup-open');
  });

  test('a trigger with a handle stays closed when the parent of the root refuses the open', async () => {
    const handle = Tooltip.createHandle();
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        { name: 'r', root: rootEvents(log, { handle, open: false }), triggers: [] },
        { name: 'o', triggers: [{ key: 'out', attrs: { handle, delay: 0 } }] },
      ],
    });
    await userEvent.hover(trigger('out'));
    await waitFor(() => expect(log).toEqual(['openChange true trigger-hover', 'update true']));
    await sleep(40);
    expect(popup('r')).toBe(null);
    expect(trigger('out')).not.toHaveAttribute('data-popup-open');
  });
});

describe('the dismissal', () => {
  test('Escape closes the tooltip; details.trigger is the active trigger', async () => {
    const triggers: (Element | undefined)[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: {
            onOpenChange: (_: boolean, details: TooltipRootChangeEventDetails) =>
              triggers.push(details.trigger),
          },
          triggers: [{ key: 't', attrs: { delay: 0 } }],
        },
      ],
    });
    await userEvent.hover(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(triggers).toEqual([trigger(), trigger()]);
  });

  test('Escape gives a kept popup `data-instant="dismiss"`', async () => {
    await mountTooltips({ tooltips: [{ name: 't', portal: { keepMounted: true } }] });
    const element = popup()!;
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    expect(element).toHaveAttribute('data-instant', 'dismiss');
  });

  test('allowPropagation() lets the Escape go on while the tooltip closes', async () => {
    const escapes: boolean[] = [];
    const listener = (event: KeyboardEvent) => escapes.push(event.defaultPrevented);
    document.addEventListener('keydown', listener);
    onTestFinished(() => document.removeEventListener('keydown', listener));
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: {
            defaultOpen: true,
            onOpenChange: (_: boolean, details: TooltipRootChangeEventDetails) =>
              details.allowPropagation(),
          },
        },
      ],
    });
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(escapes).toEqual([false]);
  });

  test('in a popover, one Escape closes the tooltip and not the popover; a press in the tooltip keeps the popover open', async () => {
    mount(TooltipComposed, {
      kind: 'in-popover',
      popover: { defaultOpen: true },
      trigger: { delay: 0 },
    });
    await waitFor(() => expect(byTestId('popover')).not.toBe(null));
    await userEvent.hover(byId('trigger'));
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.click(byTestId('popup')!);
    expect(byTestId('popover')).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(byTestId('popup')).toBe(null));
    expect(byTestId('popover')).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(byTestId('popover')).toBe(null));
  });

  test.each([false, true])(
    'a press on a tooltip trigger outside a popover closes the popover, with the tooltip open: %s',
    async (tooltipOpen) => {
      mount(TooltipComposed, {
        kind: 'outside-popover',
        popover: { defaultOpen: true },
        trigger: { delay: tooltipOpen ? 0 : 10_000, closeOnClick: false },
      });
      await waitFor(() => expect(byTestId('popover')).not.toBe(null));
      await userEvent.hover(byId('trigger'));
      if (tooltipOpen) await waitFor(() => expect(byTestId('popup')).not.toBe(null));
      await userEvent.click(byId('trigger'));
      await waitFor(() => expect(byTestId('popover')).toBe(null));
    },
  );
});

describe('the hover', () => {
  test('a mouse that rests on the trigger opens after `delay`; a pointer that leaves before that opens nothing; the close comes `closeDelay` after the leave', async () => {
    const times: { open?: number; close?: number } = {};
    let left = 0;
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: {
            onOpenChange: (open: boolean, details: TooltipRootChangeEventDetails) => {
              if (open) times.open = performance.now() - details.event.timeStamp;
              else times.close = performance.now() - left;
            },
          },
          triggers: [{ key: 't', attrs: { delay: 150, closeDelay: 150 } }],
        },
      ],
    });
    for (const type of ['pointerenter', 'pointerleave']) {
      trigger().dispatchEvent(new PointerEvent(type, { pointerType: 'mouse' }));
    }
    await sleep(300);
    expect(times).toEqual({});
    trigger().addEventListener('pointerleave', (event) => (left = event.timeStamp));
    await userEvent.hover(trigger());
    await opened();
    expect(times.open).toBeGreaterThanOrEqual(atLeast(150));
    await hoverAway();
    await closed();
    expect(times.close).toBeGreaterThanOrEqual(atLeast(150));
  });

  test('a pointer that enters the trigger of an open tooltip again asks for nothing', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        { name: 't', root: rootEvents(log), triggers: [{ key: 't', attrs: { delay: 0 } }] },
      ],
    });
    await userEvent.hover(trigger());
    await opened();
    movePointer(trigger(), centerOf(trigger()));
    await sleep(60);
    expect(popup()).not.toBe(null);
    expect(log).toEqual(['openChange true trigger-hover', 'update true']);
  });

  test('a tooltip that `defaultOpen` opened closes when the pointer leaves its trigger', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: rootEvents(log, { defaultOpen: true }),
          triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0 } }],
        },
      ],
    });
    await opened();
    await userEvent.hover(trigger());
    await hoverAway();
    await closed();
    expect(log).toEqual(['openChange false trigger-hover', 'update false']);
  });

  test('the trigger loses `data-popup-open` at the close, while the popup leaves', async () => {
    await mountTooltips({
      tooltips: [{ name: 't', transition: 'tip', triggers: [{ key: 't', attrs: { delay: 0 } }] }],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await hoverAway();
    await waitFor(() => expect(element.className).toContain('tip-leave-active'));
    expect(trigger()).not.toHaveAttribute('data-popup-open');
  });

  test('a hover opens on a disabled toolbar button with `aria-disabled` in the `element` slot', async () => {
    mount(TooltipComposed, { kind: 'toolbar-button', trigger: { delay: 20 } });
    await nextTick();
    expect(byId('trigger')).toHaveAttribute('aria-disabled', 'true');
    expect(byId('trigger')).not.toHaveAttribute('disabled');
    await userEvent.hover(byId('trigger'), { force: true });
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
  });

  test('a trigger with a handle that unmounts in its delay opens nothing; the unmount of an active trigger with a handle closes the tooltip', async () => {
    const handle = Tooltip.createHandle();
    const log: string[] = [];
    const tooltips = reactive([
      { name: 'r', root: rootEvents(log, { handle }), triggers: [] as Props[] },
      { name: 'o', triggers: [{ key: 'out', attrs: { handle, delay: 100 } }] },
    ]);
    await mountTooltips({ tooltips });
    trigger('out').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    tooltips[1]!.triggers = [];
    await sleep(200);
    expect(log).toEqual([]);
    tooltips[1]!.triggers = [
      { key: 'a', attrs: { handle, delay: 0 } },
      { key: 'b', attrs: { handle, delay: 0 } },
    ];
    await nextTick();
    await userEvent.hover(trigger('a'));
    await opened('r');
    tooltips[1]!.triggers = [{ key: 'b', attrs: { handle, delay: 0 } }];
    await closed('r');
    expect(log.at(-2)).toBe('openChange false none');
    expect(trigger('b')).not.toHaveAttribute('data-popup-open');
  });

  test('a trigger with no `delay` waits 600 ms', async () => {
    const delays: number[] = [];
    await mountTooltips({ tooltips: [{ name: 't', root: hoverDelays(delays) }] });
    await userEvent.hover(trigger());
    await opened();
    expect(delays[0]).toBeGreaterThanOrEqual(atLeast(600));
  });

  test('a hover opens on a trigger in a disabled fieldset and on a `<button disabled>` in the `element` slot', async () => {
    for (const kind of ['fieldset', 'disabled-button']) {
      const { unmount } = mount(TooltipComposed, { kind, trigger: { delay: 0 } });
      await nextTick();
      expect(byId('trigger')).toBeDisabled();
      expect(byId('trigger')).not.toHaveAttribute('data-trigger-disabled');
      await userEvent.hover(byId('trigger'));
      await waitFor(() => expect(byTestId('popup')).not.toBe(null));
      await hoverAway();
      unmount();
    }
  });

  test('the pointer can rest on the popup; with `disableHoverablePopup`, the popup takes no pointer and the tooltip closes when the pointer leaves the trigger', async () => {
    for (const disableHoverablePopup of [false, true]) {
      const { unmount } = await mountTooltips({
        tooltips: [
          {
            name: 't',
            root: { disableHoverablePopup },
            positioner: { sideOffset: 0 },
            triggers: [{ key: 't', attrs: { delay: 0, style: 'margin: 100px' } }],
          },
        ],
      });
      await userEvent.hover(trigger());
      const element = await opened();
      expect(positioner()!.style.pointerEvents).toBe(disableHoverablePopup ? 'none' : '');
      await userEvent.hover(element, { force: true });
      if (disableHoverablePopup) {
        await closed();
      } else {
        await sleep(100);
        expect(popup()).toBe(element);
      }
      await hoverAway();
      await closed();
      unmount();
    }
  });

  test('with `disableHoverablePopup`, a pointer that moves from the trigger toward the popup closes the tooltip at once', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { disableHoverablePopup: true },
          positioner: { sideOffset: 40 },
          triggers: [{ key: 't', attrs: { delay: 0, style: 'margin: 100px' } }],
        },
      ],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await waitFor(() => expect(positioner()!.style.visibility).toBe(''));
    const from = centerOf(trigger());
    const to = centerOf(element);
    // Moves in the triangle to the popup, 10 ms apart, keep a hoverable popup open.
    for (let step = 1; step <= 8; step += 1) {
      const y = trigger().getBoundingClientRect().top - step * 4;
      document.elementFromPoint(from.x, y)?.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          composed: true,
          pointerType: 'mouse',
          clientX: from.x + ((to.x - from.x) * step) / 10,
          clientY: y,
        }),
      );
      await sleep(10);
    }
    expect(popup()).toBe(null);
  });

  test('a move from the trigger toward the popup keeps the tooltip open; a move away from the popup closes it with no rest delay', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          positioner: { side: 'top', sideOffset: 40 },
          triggers: [{ key: 't', attrs: { delay: 0, closeDelay: 0, style: 'margin: 100px' } }],
        },
      ],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await waitFor(() => expect(positioner()!.style.visibility).toBe(''));
    const center = centerOf(trigger());
    const box = trigger().getBoundingClientRect();
    const moveTo = (point: { x: number; y: number }) =>
      document.elementFromPoint(point.x, point.y)!.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          composed: true,
          pointerType: 'mouse',
          clientX: point.x,
          clientY: point.y,
        }),
      );
    // A timer of 20 ms that starts after the move ends before the rest of 40 ms in the triangle.
    moveTo({ x: center.x, y: box.top - 10 });
    await sleep(20);
    expect(trigger()).toHaveAttribute('data-popup-open');
    moveTo(centerOf(element));
    moveTo(center);
    moveTo({ x: center.x, y: box.bottom + 10 });
    await sleep(20);
    expect(trigger()).not.toHaveAttribute('data-popup-open');
  });

  test('a hover on the trigger while the popup leaves after a hover close opens the root at once, and the same popup goes back from where it is', async () => {
    const log: string[] = [];
    const attrs = reactive<Props>({ delay: 0 });
    await mountTooltips({
      tooltips: [
        { name: 't', root: rootEvents(log), transition: 'slow', triggers: [{ key: 't', attrs }] },
      ],
    });
    await userEvent.hover(trigger());
    const first = await opened();
    await finishAnimations(first);
    await waitFor(() => expect(first).not.toHaveClass('slow-enter-active'));
    attrs.delay = 10_000;
    const popups = mostMatches('[data-testid="popup-t"]');
    await hoverAway();
    await waitFor(() => expect(shownOpacity(first)).toBeLessThan(0.8));
    const atOpen = shownOpacity(first);
    movePointer(trigger(), centerOf(trigger()));
    await nextTick();
    expect(log.at(-2)).toBe('openChange true trigger-hover');
    const [frames = []] = await opacityUntilRest([first]);
    expect(popup()).toBe(first);
    expect(popups()).toBe(1);
    expect(Math.min(...frames)).toBeGreaterThan(atOpen - 0.15);
    expect(frames.at(-1)).toBe(1);
  });

  test('after a close by Escape, a move on the trigger opens nothing; a pointer that leaves and comes back opens', async () => {
    await mountTooltips({
      tooltips: [{ name: 't', triggers: [{ key: 't', attrs: { delay: 0 } }] }],
    });
    await userEvent.hover(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.hover(trigger(), { position: { x: 5, y: 5 } });
    await sleep(60);
    expect(popup()).toBe(null);
    await hoverAway();
    await userEvent.hover(trigger());
    await opened();
  });

  test('a touch opens nothing', async () => {
    await mountTooltips({
      tooltips: [{ name: 't', triggers: [{ key: 't', attrs: { delay: 0 } }] }],
    });
    movePointer(trigger(), centerOf(trigger()), 'touch');
    await sleep(60);
    expect(popup()).toBe(null);
  });

  test('a hover asks for nothing while the tooltip is open with no active trigger', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: rootEvents(log, { defaultOpen: true }),
          triggers: [
            { key: 'a', attrs: { delay: 0 } },
            { key: 'b', attrs: { delay: 0 } },
          ],
        },
      ],
    });
    await opened();
    await hoverAway();
    for (const key of ['a', 'b']) {
      await userEvent.hover(trigger(key));
      await sleep(60);
    }
    expect(log).toEqual([]);
    expect(document.querySelectorAll('[data-popup-open]')).toHaveLength(0);
  });

  test('with `closeOnClick` false, a press in the first 500 ms after a hover open does not keep the tooltip open after the pointer left', async () => {
    await mountTooltips({
      tooltips: [{ name: 't', triggers: [{ key: 't', attrs: { delay: 0, closeOnClick: false } }] }],
    });
    await userEvent.hover(trigger());
    await opened();
    await userEvent.click(trigger());
    expect(popup()).not.toBe(null);
    await hoverAway();
    await closed();
  });

  test('a trigger that unmounts in its delay opens nothing', async () => {
    const log: string[] = [];
    const tooltips = reactive([
      { name: 't', root: rootEvents(log), triggers: [{ key: 't', attrs: { delay: 100 } }] },
    ]);
    await mountTooltips({ tooltips });
    trigger().dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    tooltips[0]!.triggers = [];
    await sleep(200);
    expect(log).toEqual([]);
  });

  // At the document, a move in a shadow tree has the host of the tree as its target.
  test('a popup that a hover opened stays open while the pointer moves on its trigger in a shadow root', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => host.remove());
    const shadow = host.attachShadow({ mode: 'open' });
    mount(
      TooltipParts,
      {
        tooltips: [
          {
            name: 's',
            triggers: [{ key: 's', attrs: { delay: 0, style: 'width: 200px; height: 40px' } }],
          },
        ],
      },
      shadow,
    );
    await nextTick();
    const box = shadow.querySelector('[data-key="s"]')!.getBoundingClientRect();
    await userEvent.pointer({ coords: { x: box.left + 20, y: box.top + 20 } });
    const element = await opened('s');
    await userEvent.pointer({ coords: { x: box.left + 60, y: box.top + 20 } });
    await sleep(50);
    expect(element.isConnected).toBe(true);
  });

  test('a popup in a shadow root that a hover opened stays open while the pointer is on it', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => host.remove());
    const shadow = host.attachShadow({ mode: 'open' });
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          portal: { to: shadow },
          positioner: { side: 'bottom', sideOffset: 10 },
          triggers: [{ key: 't', attrs: { delay: 0 } }],
        },
      ],
    });
    await userEvent.hover(trigger());
    const element = await waitFor(() => {
      const found = shadow.querySelector<HTMLElement>('[data-testid="popup-t"]');
      expect(found).not.toBe(null);
      return found!;
    });
    await waitForPositioned(shadow.querySelector<HTMLElement>('[data-testid="positioner-t"]')!);
    await userEvent.pointer({ coords: centerOf(element) });
    await sleep(100);
    expect(element.isConnected).toBe(true);
  });
});

describe('the focus', () => {
  test('a Tab to the trigger opens the tooltip at once with the instant state `focus`; a Tab away closes it with `trigger-focus`', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: rootEvents(log),
          arrow: {},
          viewport: true,
          triggers: [{ key: 't', attrs: { delay: 10_000 } }],
        },
      ],
    });
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(trigger());
    const element = await opened();
    expect(element).toHaveAttribute('data-instant', 'focus');
    expect(byTestId('arrow-t')).toHaveAttribute('data-instant', 'focus');
    expect(byTestId('viewport-t')).toHaveAttribute('data-instant', 'focus');
    expect(byTestId('positioner-instant-t')).toHaveTextContent('focus');
    await userEvent.keyboard('{Tab}');
    await closed();
    expect(log).toEqual([
      'openChange true trigger-focus',
      'update true',
      'openChange false trigger-focus',
      'update false',
    ]);
  });

  test('a hover open after a focus open has no `data-instant`', async () => {
    await mountTooltips({
      tooltips: [{ name: 't', triggers: [{ key: 't', attrs: { delay: 0 } }] }],
    });
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    expect(await opened()).toHaveAttribute('data-instant', 'focus');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await closed();
    await userEvent.hover(trigger());
    expect(await opened()).not.toHaveAttribute('data-instant');
  });

  test('a press on a button trigger gives no open by the focus', async () => {
    await mountTooltips({
      tooltips: [
        { name: 't', triggers: [{ key: 't', attrs: { delay: 10_000, closeOnClick: false } }] },
      ],
    });
    await userEvent.click(trigger());
    await sleep(60);
    expect(popup()).toBe(null);
  });

  test('a press on an `<input>` trigger opens nothing; a Tab to it opens', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: rootEvents(log),
          triggers: [{ key: 't', attrs: { as: 'input', 'aria-label': 'Name', delay: 10_000 } }],
        },
      ],
    });
    await userEvent.click(trigger());
    expect(document.activeElement).toBe(trigger());
    await sleep(60);
    expect(popup()).toBe(null);
    expect(log).toEqual([]);
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await opened();
  });

  // Only Chromium has the protocol of a real touch in the test browsers.
  test.skipIf(server.browser !== 'chromium')(
    'a tap on an `<input>` trigger opens nothing',
    async () => {
      await mountTooltips({
        tooltips: [
          {
            name: 't',
            triggers: [{ key: 't', attrs: { as: 'input', 'aria-label': 'Name', delay: 0 } }],
          },
        ],
      });
      const center = centerOf(trigger());
      await touchDrag(center, center, 0);
      await sleep(60);
      expect(document.activeElement).toBe(trigger());
      expect(popup()).toBe(null);
    },
  );

  test('a press on the text of a tooltip that the focus opened keeps it open', async () => {
    await mountTooltips();
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    const element = await opened();
    await userEvent.click(element);
    await sleep(60);
    expect(popup()).toBe(element);
    expect(document.activeElement).toBe(element);
  });

  test('the focus that goes to another trigger of the root moves the tooltip; to a disabled trigger, it closes the tooltip', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: rootEvents(log),
          triggers: [{ key: 'a' }, { key: 'b' }, { key: 'c', attrs: { disabled: true } }],
        },
      ],
    });
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await opened();
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(trigger('b')).toHaveAttribute('data-popup-open'));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(trigger('c'));
    await closed();
    expect(log).toEqual([
      'openChange true trigger-focus',
      'update true',
      'openChange true trigger-focus',
      'openChange false trigger-focus',
      'update false',
    ]);
  });

  test('a window that loses the focus keeps the tooltip; a closed tooltip stays closed when the window gets the focus again', async () => {
    const { exposed } = await mountTooltips();
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await opened();
    // When its window loses the focus, Chromium and Firefox send `focusout` with no related target,
    // and the trigger stays the active element. At the return, they send `focusin`. WebKit sends
    // neither (test/measurements/tooltip.test.ts).
    trigger().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await sleep(20);
    expect(popup()).not.toBe(null);
    exposed.parts[0].root.close();
    await closed();
    trigger().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await sleep(20);
    trigger().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await sleep(20);
    expect(popup()).toBe(null);
  });

  test('after a close by Escape, the focus of the trigger opens nothing until the focus leaves it', async () => {
    await mountTooltips();
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    trigger().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await sleep(20);
    expect(popup()).toBe(null);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}');
    await opened();
  });

  test('after a close by a press outside, a Tab to the trigger opens the tooltip', async () => {
    await mountTooltips({ tooltips: [{ name: 't', root: { defaultOpen: true } }] });
    await opened();
    await userEvent.click(byId('outside'));
    await closed();
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await opened();
  });

  test('a press that gives the trigger no focus blocks the focus open until the mouse leaves the trigger', async () => {
    await mountTooltips({
      tooltips: [{ name: 't', triggers: [{ key: 't', attrs: { delay: 10_000 } }] }],
    });
    await userEvent.hover(trigger());
    // WebKit gives a button no focus at a press (test/measurements/tooltip.test.ts).
    trigger().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await hoverAway();
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await opened();
  });

  test('a focus that leaves to no element closes the tooltip with `trigger-focus`', async () => {
    const log: string[] = [];
    await mountTooltips({ tooltips: [{ name: 't', root: rootEvents(log) }] });
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await opened();
    trigger().blur();
    await closed();
    expect(log.at(-2)).toBe('openChange false trigger-focus');
  });
});

describe('the press', () => {
  test('a press closes the tooltip with `trigger-press` and `data-instant="dismiss"`; Enter on the trigger closes it too', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: rootEvents(log),
          transition: 'tip',
          triggers: [{ key: 't', attrs: { delay: 0 } }],
        },
      ],
    });
    await userEvent.hover(trigger());
    const element = await opened();
    await userEvent.click(trigger());
    await waitFor(() => expect(element).toHaveAttribute('data-instant', 'dismiss'));
    expect(log.slice(2)).toEqual(['openChange false trigger-press', 'update false']);
    // A press blocks the focus open while the mouse is on the trigger.
    await hoverAway();
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(trigger()).toHaveAttribute('data-popup-open'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(trigger()).not.toHaveAttribute('data-popup-open'));
    expect(log.at(-2)).toBe('openChange false trigger-press');
  });

  test('a press stops the open that waits; with `closeOnClick` false, a press closes nothing', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          triggers: [
            { key: 'a', attrs: { delay: 300 } },
            { key: 'b', attrs: { delay: 0, closeOnClick: false } },
          ],
        },
      ],
    });
    // The press comes in the task of the `pointerenter`, after the listener of the trigger: the open
    // waits 300 ms, and a command can take more time.
    trigger('a').addEventListener(
      'pointerenter',
      () => trigger('a').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' })),
      { once: true },
    );
    await userEvent.hover(trigger('a'));
    await sleep(500);
    expect(popup()).toBe(null);
    await userEvent.hover(trigger('b'));
    await opened();
    await userEvent.click(trigger('b'));
    await sleep(40);
    expect(popup()).not.toBe(null);
  });

  test('with `closeOnClick` false, a press in the delay keeps the open at the end of the delay', async () => {
    await mountTooltips({
      tooltips: [
        { name: 't', triggers: [{ key: 't', attrs: { delay: 300, closeOnClick: false } }] },
      ],
    });
    await userEvent.hover(trigger());
    trigger().dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }),
    );
    trigger().click();
    await opened();
  });

  test('after a press closed the tooltip, a pointer that leaves the trigger and comes back opens it again', async () => {
    await mountTooltips({
      tooltips: [{ name: 't', triggers: [{ key: 't', attrs: { delay: 100 } }] }],
    });
    await userEvent.hover(trigger());
    await opened();
    await userEvent.click(trigger());
    await closed();
    await hoverAway();
    await userEvent.hover(trigger());
    await opened();
  });

  test('a touch press on another trigger closes a tooltip that follows the pointer', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { trackCursorAxis: 'both', defaultOpen: true, defaultTriggerId: 'a' },
          triggers: [
            { key: 'a', attrs: { id: 'a' } },
            { key: 'b', attrs: { id: 'b' } },
          ],
        },
      ],
    });
    await opened();
    trigger('b').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
    );
    trigger('b').dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }),
    );
    trigger('b').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await closed();
  });

  test('the `closeOnClick` of the pressed trigger decides, also when the trigger is not active', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { defaultTriggerId: 'a', defaultOpen: true },
          triggers: [
            { key: 'a', attrs: { id: 'a' } },
            { key: 'b', attrs: { id: 'b', closeOnClick: false } },
            { key: 'c', attrs: { id: 'c' } },
          ],
        },
      ],
    });
    const element = await opened();
    await userEvent.click(trigger('b'));
    await sleep(40);
    expect(popup()).toBe(element);
    await userEvent.click(trigger('c'));
    await closed();
  });
});

describe('the group', () => {
  test('a trigger `delay` wins over the `delay` of the provider; while the group is active, a hover opens at once', async () => {
    const delays: number[] = [];
    await mountTooltips({
      provider: { delay: 10_000, timeout: 10_000 },
      tooltips: [
        { name: 'c', root: hoverDelays(delays), triggers: [{ key: 'c', attrs: { delay: 250 } }] },
        { name: 'a' },
        { name: 'b', triggers: [{ key: 'b', attrs: { delay: 10_000 } }] },
      ],
    });
    await userEvent.hover(trigger('c'));
    await opened('c');
    expect(delays[0]).toBeGreaterThanOrEqual(atLeast(250));
    await userEvent.hover(trigger('a'));
    await opened('a');
    await closed('c');
    await userEvent.hover(trigger('b'));
    await opened('b');
    await closed('a');
  });

  test('the provider gives its `delay` and its `closeDelay`, and a tooltip reads them at their use', async () => {
    const times: { open?: number; close?: number } = {};
    let left = 0;
    const provider = reactive({ delay: 10_000, closeDelay: 10_000 });
    await mountTooltips({
      provider,
      tooltips: [
        {
          name: 'a',
          root: {
            onOpenChange: (open: boolean, details: TooltipRootChangeEventDetails) => {
              if (open) times.open = performance.now() - details.event.timeStamp;
              else times.close = performance.now() - left;
            },
          },
        },
      ],
    });
    trigger('a').addEventListener('pointerleave', (event) => (left = event.timeStamp));
    provider.delay = 150;
    provider.closeDelay = 150;
    await nextTick();
    await userEvent.hover(trigger('a'));
    await opened('a');
    await hoverAway();
    await closed('a');
    expect(times.open).toBeGreaterThanOrEqual(atLeast(150));
    // The open delay of a trigger with no provider is 600 ms.
    expect(times.open).toBeLessThan(600);
    expect(times.close).toBeGreaterThanOrEqual(atLeast(150));
  });

  test('one tooltip of a group is open at a time; the other closes with `none`; the new one has `data-instant="delay"` at its insert, and the old one before its leave', async () => {
    const log: string[] = [];
    await mountTooltips({
      provider: { delay: 0 },
      tooltips: [
        { name: 'a', root: rootEvents(log, { defaultOpen: true }), transition: 'tip' },
        { name: 'b', transition: 'tip' },
      ],
    });
    const first = await opened('a');
    expect(first).not.toHaveAttribute('data-instant');
    const inserted: (string | null)[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.dataset.testid === 'positioner-b') {
            inserted.push(
              node.querySelector('[data-testid="popup-b"]')!.getAttribute('data-instant'),
            );
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });
    onTestFinished(() => observer.disconnect());
    await userEvent.hover(trigger('b'));
    await opened('b');
    expect(inserted).toEqual(['delay']);
    expect(first).toHaveAttribute('data-instant', 'delay');
    expect(log).toEqual(['openChange false none', 'update false']);
  });

  test.each(['tip', 'spin'])(
    'a tooltip in a leave of 10 s (%s) is out of the document when a sibling opens, with no `[data-instant]` rule',
    async (transition) => {
      const log: string[] = [];
      await mountTooltips({
        provider: { delay: 0, timeout: 10_000 },
        tooltips: [
          {
            name: 'a',
            root: rootEvents(log),
            transition,
            triggers: [{ key: 'a', attrs: { delay: 0 } }],
          },
          { name: 'b', transition: 'tip' },
        ],
      });
      await userEvent.hover(trigger('a'));
      const first = await opened('a');
      // A close in the enter of 10 s reverses it, and the leave then lasts only as long as the
      // enter ran. So the case ends the enter first.
      if (transition === 'tip') await finishAnimations(first);
      await userEvent.keyboard('{Escape}');
      await nextTick();
      expect(first.isConnected).toBe(true);
      await userEvent.hover(trigger('b'));
      await opened('b');
      await waitFor(() => expect(first.isConnected).toBe(false));
      expect(positioner('a')).toBe(null);
      expect(log).toEqual([
        'openChange true trigger-hover',
        'update true',
        'openChange false escape-key',
        'update false',
      ]);
    },
  );

  test('a tooltip that opened at once in an active group leaves with no `data-instant` after a hover close', async () => {
    await mountTooltips({
      provider: { delay: 0, timeout: 10_000 },
      tooltips: [
        { name: 'a', transition: 'tip', triggers: [{ key: 'a', attrs: { delay: 0 } }] },
        { name: 'b', transition: 'tip', triggers: [{ key: 'b', attrs: { delay: 0 } }] },
      ],
    });
    await userEvent.hover(trigger('a'));
    await opened('a');
    await userEvent.hover(trigger('b'));
    const second = await opened('b');
    expect(second).toHaveAttribute('data-instant', 'delay');
    await hoverAway();
    await waitFor(() => expect(second.className).toContain('tip-leave-active'));
    expect(second).not.toHaveAttribute('data-instant');
  });

  test('the group stays active for `timeout` after the last close; then a hover waits its delay; a tooltip reads `timeout` at its close', async () => {
    const provider = reactive({ delay: 10_000, timeout: 10_000 });
    await mountTooltips({
      provider,
      tooltips: [{ name: 'a', triggers: [{ key: 'a', attrs: { delay: 0 } }] }, { name: 'b' }],
    });
    await userEvent.hover(trigger('a'));
    await opened('a');
    await hoverAway();
    await closed('a');
    await userEvent.hover(trigger('b'));
    await opened('b');
    provider.timeout = 100;
    await hoverAway();
    await closed('b');
    await sleep(300);
    await userEvent.hover(trigger('b'));
    await sleep(200);
    expect(popup('b')).toBe(null);
  });

  test('a tooltip that opens again while the timer of its close runs keeps the group active after that timer', async () => {
    const a: Props = reactive({ open: true, 'onUpdate:open': (open: boolean) => (a.open = open) });
    await mountTooltips({
      provider: { delay: 10_000, timeout: 200 },
      tooltips: [{ name: 'a', root: a }, { name: 'b' }],
    });
    await opened('a');
    a.open = false;
    await closed('a');
    a.open = true;
    await opened('a');
    await sleep(400);
    await userEvent.hover(trigger('b'));
    await opened('b');
    await closed('a');
  });

  test('the tooltips with no provider are one group with no timeout: one open at a time, and the next hover waits its delay', async () => {
    const log: string[] = [];
    const delays: number[] = [];
    await mountTooltips({
      tooltips: [
        { name: 'a', root: rootEvents(log, { defaultOpen: true }) },
        { name: 'b', root: hoverDelays(delays), triggers: [{ key: 'b', attrs: { delay: 300 } }] },
      ],
    });
    await opened('a');
    await userEvent.hover(trigger('b'));
    await opened('b');
    expect(delays[0]).toBeGreaterThanOrEqual(atLeast(300));
    await closed('a');
    expect(popup('b')).toHaveAttribute('data-instant', 'delay');
    expect(log).toEqual(['openChange false none', 'update false']);
  });

  test('after the active trigger of an open tooltip unmounts, the next hover waits its delay, and its tooltip has no `data-instant`', async () => {
    const delays: number[] = [];
    const tooltips = reactive<({ name: string } & Props)[]>([
      { name: 'a', root: { defaultOpen: true } },
      { name: 'b', root: hoverDelays(delays) },
    ]);
    await mountTooltips({ provider: { delay: 300, timeout: 10_000 }, tooltips });
    await opened('a');
    tooltips[0]!.triggers = [];
    await closed('a');
    await userEvent.hover(trigger('b'));
    const element = await opened('b');
    expect(delays[0]).toBeGreaterThanOrEqual(atLeast(300));
    expect(element).not.toHaveAttribute('data-instant');
  });

  test('after an open tooltip unmounts, the next hover waits its delay', async () => {
    const delays: number[] = [];
    const tooltips = reactive<({ name: string } & Props)[]>([
      { name: 'a', root: { defaultOpen: true } },
      { name: 'b', root: hoverDelays(delays) },
    ]);
    await mountTooltips({ provider: { delay: 300, timeout: 10_000 }, tooltips });
    await opened('a');
    tooltips.splice(0, 1);
    await closed('a');
    await userEvent.hover(trigger('b'));
    await opened('b');
    expect(delays[0]).toBeGreaterThanOrEqual(atLeast(300));
  });

  test('the group of a tooltip is the group of its active trigger', async () => {
    const handle = Tooltip.createHandle();
    await mountTooltips({
      tooltips: [
        { name: 'a', root: { defaultOpen: true } },
        { name: 'b', root: { handle }, triggers: [] },
      ],
    });
    await opened('a');
    // A trigger with the handle of `b` in a provider of its own.
    mount(TooltipParts, {
      provider: { delay: 0 },
      tooltips: [
        {
          name: 'c',
          triggers: [{ key: 'c', attrs: { handle, delay: 0, style: 'margin: 150px' } }],
        },
      ],
    });
    await nextTick();
    await userEvent.hover(trigger('c'));
    await opened('b');
    await sleep(40);
    expect(popup('a')).not.toBe(null);
  });

  test('a closed tooltip that unmounts leaves the timer of its group (VUE-48)', async () => {
    const tooltips = reactive<({ name: string } & Props)[]>([
      { name: 'a', triggers: [{ key: 'a', attrs: { delay: 0 } }] },
      { name: 'b' },
    ]);
    await mountTooltips({ provider: { delay: 10_000, timeout: 10_000 }, tooltips });
    await userEvent.hover(trigger('a'));
    await opened('a');
    await hoverAway();
    await closed('a');
    tooltips.splice(0, 1);
    await nextTick();
    await userEvent.hover(trigger('b'));
    await opened('b');
  });
});

describe('the pointer anchor (`trackCursorAxis`)', () => {
  test.each(['x', 'y', 'both'] as const)(
    'the anchor on the axis %s is at the pointer, and follows it on the trigger',
    async (axis) => {
      await mountTooltips({
        tooltips: [
          {
            name: 't',
            root: { trackCursorAxis: axis },
            positioner: { side: 'bottom' },
            triggers: [{ key: 't', attrs: { delay: 0, style: 'width: 300px; height: 100px' } }],
          },
        ],
      });
      const box = trigger().getBoundingClientRect();
      const pointer = lastPointer();
      await userEvent.hover(trigger(), { position: { x: 50, y: 30 } });
      const element = await opened();
      const atPointer = () =>
        waitFor(() => {
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          expect(
            Math.abs(centerX - (axis === 'y' ? box.left + box.width / 2 : pointer.x)),
          ).toBeLessThan(1);
          expect(Math.abs(rect.top - (axis === 'x' ? box.bottom : pointer.y))).toBeLessThan(1);
        });
      await atPointer();
      await userEvent.hover(trigger(), { position: { x: 200, y: 70 } });
      await atPointer();
      expect(byTestId('positioner-instant-t')).toHaveTextContent('tracking-cursor');
      expect(positioner()!.style.pointerEvents).toBe(axis === 'both' ? 'none' : '');
    },
  );

  test('the anchor is at the pointer after the delay of the first hover, at the new pointer after a close and a new hover, and at the trigger after `trackCursorAxis` turns to `none`', async () => {
    const root = reactive<Props>({ trackCursorAxis: 'x' });
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root,
          positioner: { side: 'bottom' },
          popup: { style: 'width: 40px; height: 20px' },
          triggers: [{ key: 't', attrs: { delay: 100, style: 'width: 300px; height: 40px' } }],
        },
      ],
    });
    const box = trigger().getBoundingClientRect();
    const centerX = () => centerOf(popup()!).x;
    await userEvent.hover(trigger(), { position: { x: 240, y: 20 } });
    await opened();
    await waitFor(() => expect(Math.abs(centerX() - (box.left + 240))).toBeLessThanOrEqual(2));
    await hoverAway();
    await closed();
    await userEvent.hover(trigger(), { position: { x: 60, y: 20 } });
    await opened();
    await waitFor(() => expect(Math.abs(centerX() - (box.left + 60))).toBeLessThanOrEqual(2));
    await hoverAway();
    await closed();
    root.trackCursorAxis = 'none';
    await userEvent.hover(trigger(), { position: { x: 240, y: 20 } });
    await opened();
    await waitFor(() => expect(Math.abs(centerX() - (box.left + 150))).toBeLessThanOrEqual(2));
  });

  test('a kept tooltip follows the pointer on the page while it is closed, and an open by code is at the last point', async () => {
    const root = reactive<Props>({ trackCursorAxis: 'x', open: false });
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root,
          portal: { keepMounted: true },
          positioner: { side: 'bottom' },
          popup: { style: 'width: 40px; height: 20px' },
          triggers: [{ key: 't', attrs: { delay: 0, style: 'width: 300px; height: 40px' } }],
        },
      ],
    });
    const element = popup()!;
    const box = trigger().getBoundingClientRect();
    movePointer(trigger(), { x: box.left + 240, y: box.top + 20 });
    root.open = true;
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    await waitFor(() =>
      expect(Math.abs(centerOf(element).x - (box.left + 240))).toBeLessThanOrEqual(2),
    );
    root.open = false;
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    document.body.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerType: 'mouse',
        clientX: box.left + 60,
        clientY: box.top + 20,
      }),
    );
    root.open = true;
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    await waitFor(() =>
      expect(Math.abs(centerOf(element).x - (box.left + 60))).toBeLessThanOrEqual(2),
    );
  });

  test('a tooltip that the focus opened stays at its trigger; a pen moves the anchor, and a touch does not', async () => {
    const root = reactive<Props>({ trackCursorAxis: 'x', open: false });
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root,
          positioner: { side: 'bottom' },
          triggers: [{ key: 't', attrs: { delay: 10_000, style: 'width: 300px; height: 40px' } }],
        },
      ],
    });
    const box = trigger().getBoundingClientRect();
    const centerX = () => centerOf(popup()!).x;
    movePointer(trigger(), { x: box.left + 20, y: box.top + 10 }, 'pen');
    root.open = true;
    await opened();
    await waitFor(() => expect(Math.abs(centerX() - (box.left + 20))).toBeLessThan(1));
    root.open = false;
    await closed();
    movePointer(trigger(), { x: box.left + 250, y: box.top + 10 }, 'touch');
    root.open = true;
    await opened();
    await waitFor(() => expect(Math.abs(centerX() - (box.left + 20))).toBeLessThan(1));
    root.open = false;
    await closed();
    delete root.open;
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await opened();
    await waitFor(() => expect(Math.abs(centerX() - (box.left + 150))).toBeLessThan(1));
  });

  test('a tooltip that code opened after the pointer was on its trigger stays with the trigger at a scroll', async () => {
    const root = reactive<Props>({ trackCursorAxis: 'both', open: false });
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root,
          positioner: { side: 'bottom' },
          triggers: [
            {
              key: 't',
              attrs: { delay: 10_000, style: 'margin-top: 50px; width: 300px; height: 40px' },
            },
          ],
        },
      ],
    });
    const spacer = document.body.appendChild(document.createElement('div'));
    spacer.style.height = '3000px';
    onTestFinished(() => {
      spacer.remove();
      window.scrollTo(0, 0);
    });
    const box = trigger().getBoundingClientRect();
    movePointer(trigger(), { x: box.left + 100, y: box.top + 20 });
    root.open = true;
    const element = await opened();
    await waitFor(() =>
      expect(Math.abs(element.getBoundingClientRect().top - (box.top + 20))).toBeLessThan(2),
    );
    window.scrollBy(0, 30);
    expect(window.scrollY).toBe(30);
    // The placement runs again after the scroll event.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      Math.abs(element.getBoundingClientRect().top - (trigger().getBoundingClientRect().top + 20)),
    ).toBeLessThan(2);
  });

  test('the anchor stops while the pointer is on the popup, and follows again on the trigger', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { trackCursorAxis: 'x' },
          positioner: { side: 'bottom' },
          triggers: [
            {
              key: 't',
              attrs: { delay: 0, closeDelay: 10_000, style: 'width: 300px; height: 40px' },
            },
          ],
        },
      ],
    });
    const box = trigger().getBoundingClientRect();
    const pointer = lastPointer();
    await userEvent.hover(trigger(), { position: { x: 40, y: 20 } });
    const element = await opened();
    await waitFor(() => expect(Math.abs(centerOf(element).x - pointer.x)).toBeLessThan(1));
    movePointer(document.body, { x: box.left + 150, y: box.bottom + 200 });
    await waitFor(() => expect(Math.abs(centerOf(element).x - (box.left + 150))).toBeLessThan(1));
    const left = element.getBoundingClientRect().left;
    movePointer(element, { x: left + 5, y: element.getBoundingClientRect().top + 5 });
    movePointer(document.body, { x: box.left + 250, y: box.bottom + 200 });
    await sleep(40);
    expect(element.getBoundingClientRect().left).toBe(left);
    movePointer(trigger(), { x: box.left + 250, y: box.top + 20 });
    await waitFor(() => expect(Math.abs(centerOf(element).x - (box.left + 250))).toBeLessThan(1));
  });

  test('a popup in a shadow root follows the pointer on the page outside that shadow root', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => host.remove());
    const shadow = host.attachShadow({ mode: 'open' });
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { trackCursorAxis: 'x' },
          portal: { to: shadow },
          positioner: { side: 'bottom' },
          triggers: [
            {
              key: 't',
              attrs: { delay: 0, closeDelay: 10_000, style: 'width: 300px; height: 40px' },
            },
          ],
        },
      ],
    });
    const box = trigger().getBoundingClientRect();
    await userEvent.hover(trigger(), { position: { x: 40, y: 20 } });
    const element = await waitFor(() => {
      const found = shadow.querySelector<HTMLElement>('[data-testid="popup-t"]');
      expect(found).not.toBe(null);
      return found!;
    });
    movePointer(document.body, { x: box.left + 150, y: box.bottom + 200 });
    await waitFor(() => expect(Math.abs(centerOf(element).x - (box.left + 150))).toBeLessThan(1));
  });
});

describe('a trigger in a trigger', () => {
  test('the pointer on the inner trigger opens only the inner tooltip, and closes an outer tooltip that the hover opened; the rest of the outer trigger starts its delay again', async () => {
    mount(TooltipComposed, { kind: 'nested', trigger: { delay: 0 }, inner: { delay: 0 } });
    await nextTick();
    const outer = byId('trigger');
    const inner = byId('inner');
    const box = outer.getBoundingClientRect();
    await userEvent.hover(outer, { position: { x: 250, y: 30 } });
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.hover(inner);
    await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
    await waitFor(() => expect(byTestId('popup')).toBe(null));
    await userEvent.hover(outer, { position: { x: 250, y: 30 } });
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    expect(box.width).toBe(300);
  });

  test('a pointer that enters the outer trigger on the inner one starts no open of the outer tooltip', async () => {
    mount(TooltipComposed, { kind: 'nested', trigger: { delay: 50 }, inner: { delay: 0 } });
    await nextTick();
    await hoverAway();
    await userEvent.hover(byId('inner'));
    await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
    await sleep(120);
    expect(byTestId('popup')).toBe(null);
    expect(byTestId('inner-popup')).not.toBe(null);
  });

  test('the pointer on an inner trigger closes an outer tooltip that the hover opened, before the inner tooltip opens', async () => {
    mount(TooltipComposed, { kind: 'nested', trigger: { delay: 0 }, inner: { delay: 10_000 } });
    await nextTick();
    await userEvent.hover(byId('trigger'), { position: { x: 250, y: 30 } });
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.hover(byId('inner'));
    await waitFor(() => expect(byTestId('popup')).toBe(null));
    expect(byTestId('inner-popup')).toBe(null);
  });

  test('the focus on the inner trigger opens only the inner tooltip; a disabled inner trigger lets the outer tooltip open', async () => {
    const { unmount } = mount(TooltipComposed, {
      kind: 'nested',
      trigger: { tabindex: -1 },
      inner: { tabindex: 0 },
    });
    await nextTick();
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('inner'));
    await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
    expect(byTestId('popup')).toBe(null);
    unmount();
    mount(TooltipComposed, { kind: 'nested', trigger: { delay: 0 }, inner: { disabled: true } });
    await nextTick();
    await userEvent.hover(byId('inner'));
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    expect(byTestId('inner-popup')).toBe(null);
  });

  /** The point of the outer trigger right of its inner triggers. */
  const outerArea = () => {
    const box = byId('trigger').getBoundingClientRect();
    return { x: box.right - 20, y: box.top + 30 };
  };

  test('a move between two inner triggers opens their tooltips in turn, and a third level opens only its own; the outer tooltip stays closed', async () => {
    const { unmount } = mount(TooltipComposed, {
      kind: 'nested',
      trigger: { delay: 50 },
      inner: { delay: 0 },
      second: { delay: 0 },
    });
    await nextTick();
    await userEvent.hover(byId('inner'));
    await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
    await userEvent.hover(byId('second'));
    await waitFor(() => expect(byTestId('second-popup')).not.toBe(null));
    await waitFor(() => expect(byTestId('inner-popup')).toBe(null));
    await sleep(120);
    expect(byTestId('popup')).toBe(null);
    unmount();
    mount(TooltipComposed, {
      kind: 'nested',
      trigger: { delay: 0 },
      inner: { delay: 0 },
      third: { delay: 0 },
    });
    await nextTick();
    await userEvent.hover(byId('third'));
    await waitFor(() => expect(byTestId('third-popup')).not.toBe(null));
    await sleep(60);
    expect(byTestId('inner-popup')).toBe(null);
    expect(byTestId('popup')).toBe(null);
  });

  test('a disabled outer trigger opens nothing when the pointer moves from an inner trigger to its own area', async () => {
    mount(TooltipComposed, {
      kind: 'nested',
      trigger: { delay: 0, disabled: true },
      inner: { delay: 0 },
    });
    await nextTick();
    await userEvent.hover(byId('inner'));
    await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
    const area = outerArea();
    const box = byId('trigger').getBoundingClientRect();
    await userEvent.hover(byId('trigger'), { position: { x: area.x - box.left, y: 30 } });
    await sleep(60);
    expect(byTestId('popup')).toBe(null);
  });

  test('a pointer that goes back to an inner trigger, or leaves the outer trigger, in the delay of the outer tooltip opens nothing; so does a pointer that moves on to an inner trigger in that delay', async () => {
    for (const after of [
      'back to the inner trigger',
      'out of the outer trigger',
      'on to an inner trigger',
    ]) {
      const { unmount } = mount(TooltipComposed, {
        kind: 'nested',
        trigger: { delay: 100 },
        inner: { delay: 10_000 },
      });
      await nextTick();
      const inner = byId('inner');
      const outer = byId('trigger');
      if (after !== 'on to an inner trigger') movePointer(inner, centerOf(inner));
      movePointer(outer, outerArea());
      await sleep(50);
      if (after === 'out of the outer trigger') {
        outer.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      } else {
        movePointer(inner, centerOf(inner));
        inner.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            pointerType: 'mouse',
            ...centerOf(inner),
          }),
        );
      }
      await sleep(120);
      expect(byTestId('popup')).toBe(null);
      unmount();
    }
  });

  test('the delayed open of the outer tooltip asks for nothing when code opened it in the delay', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { open: false });
    mount(TooltipComposed, {
      kind: 'nested',
      root,
      trigger: { delay: 100 },
      inner: { delay: 10_000 },
    });
    await nextTick();
    movePointer(byId('inner'), centerOf(byId('inner')));
    movePointer(byId('trigger'), outerArea());
    root.open = true;
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await sleep(160);
    expect(byTestId('popup')).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('the pointer on the popup of an inner tooltip opens no outer tooltip', async () => {
    mount(TooltipComposed, { kind: 'nested', trigger: { delay: 100 }, inner: { delay: 0 } });
    await nextTick();
    await userEvent.hover(byId('inner'));
    await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
    await userEvent.hover(byTestId('inner-popup')!);
    await sleep(200);
    expect(byTestId('popup')).toBe(null);
  });

  test('an outer tooltip that the focus or the parent opened stays open while the pointer is on an inner trigger', async () => {
    const { unmount } = mount(TooltipComposed, {
      kind: 'nested',
      trigger: { delay: 0 },
      inner: { delay: 10_000 },
    });
    await nextTick();
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('trigger'));
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.hover(byId('inner'));
    await sleep(60);
    expect(byTestId('popup')).not.toBe(null);
    unmount();
    const log: string[] = [];
    mount(TooltipComposed, {
      kind: 'nested',
      root: rootEvents(log, { open: true }),
      trigger: { delay: 0 },
      inner: { delay: 10_000 },
    });
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.hover(byId('inner'));
    await sleep(60);
    expect(byTestId('popup')).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('a mouse opens the outer tooltip after a touch on it; the pointer that goes from the outer popup to an inner trigger closes the outer tooltip', async () => {
    mount(TooltipComposed, { kind: 'nested', trigger: { delay: 0 }, inner: { delay: 10_000 } });
    await nextTick();
    const outer = byId('trigger');
    movePointer(outer, outerArea(), 'touch');
    await sleep(40);
    expect(byTestId('popup')).toBe(null);
    const box = outer.getBoundingClientRect();
    await userEvent.hover(outer, { position: { x: outerArea().x - box.left, y: 30 } });
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.hover(byTestId('popup')!);
    await sleep(40);
    expect(byTestId('popup')).not.toBe(null);
    await userEvent.hover(byId('inner'));
    await waitFor(() => expect(byTestId('popup')).toBe(null));
    await sleep(60);
    expect(byTestId('popup')).toBe(null);
  });

  test('an inner trigger in an open shadow root marks its events for the outer trigger', async () => {
    const log: string[] = [];
    mount(TooltipComposed, {
      kind: 'nested',
      root: rootEvents(log),
      trigger: { delay: 0 },
      inner: { style: 'display: none' },
    });
    await nextTick();
    const host = byId('trigger').appendChild(document.createElement('span'));
    host.style.cssText = 'display: inline-block; width: 80px; height: 60px';
    const shadow = host.attachShadow({ mode: 'open' });
    mount(
      TooltipParts,
      { tooltips: [{ name: 's', triggers: [{ key: 's', attrs: { delay: 0 } }] }] },
      shadow,
    );
    await nextTick();
    await userEvent.hover(host);
    await waitFor(() => expect(byTestId('popup-s')).not.toBe(null));
    expect(log).toEqual([]);
  });
});

describe('`disabled`', () => {
  test('a disabled root opens at no hover and no focus; each trigger has `data-trigger-disabled`', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { disabled: true },
          triggers: [
            { key: 'a', attrs: { delay: 0 } },
            { key: 'b', attrs: { disabled: false } },
          ],
        },
      ],
    });
    expect(trigger('a')).toHaveAttribute('data-trigger-disabled');
    expect(trigger('b')).toHaveAttribute('data-trigger-disabled');
    await userEvent.hover(trigger('a'));
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await sleep(60);
    expect(popup()).toBe(null);
  });

  test('an open root that becomes disabled asks for a close with `disabled`; after a cancel, it shows again when it is enabled again', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { open: true, disabled: true });
    await mountTooltips({ tooltips: [{ name: 't', root }] });
    await nextTick();
    expect(popup()).toBe(null);
    expect(log).toEqual(['openChange false disabled', 'update false']);
    root.disabled = false;
    await opened();
    root.disabled = true;
    await closed();
    expect(log.slice(2)).toEqual(['openChange false disabled', 'update false']);
  });

  test('a trigger with `disabled` opens nothing, also when it becomes disabled in its delay; the hover from the active trigger to it closes the tooltip', async () => {
    const tooltips = reactive([
      {
        name: 't',
        triggers: [
          { key: 'a', attrs: { delay: 0 } },
          { key: 'b', attrs: { delay: 80, disabled: false } },
        ],
      },
    ]);
    await mountTooltips({ tooltips });
    // The trigger becomes disabled in its delay, and the check comes after the delay. Both start at
    // the `pointerenter` of the hover, because the command can end after the delay.
    const disabled = readAfter(trigger('b'), 'pointerenter', 0, () => {
      tooltips[0]!.triggers[1]!.attrs.disabled = true;
    });
    const afterDelay = readAfter(trigger('b'), 'pointerenter', 150, popup);
    await userEvent.hover(trigger('b'));
    await disabled;
    expect(await afterDelay).toBe(null);
    await userEvent.hover(trigger('a'));
    await opened();
    expect(trigger('b')).toHaveAttribute('data-trigger-disabled');
    await userEvent.hover(trigger('b'));
    await closed();
  });
});

describe('the renders', () => {
  test('an open renders no other trigger of the root and no trigger of another tooltip of the group', async () => {
    const renders: string[] = [];
    mount(TooltipComposed, {
      kind: 'renders',
      renders: {
        count(id: string, open: boolean) {
          renders.push(id);
          return open ? ' open' : '';
        },
      },
    });
    await nextTick();
    renders.length = 0;
    await userEvent.hover(byId('trigger'));
    await waitFor(() => expect(byId('trigger')).toHaveTextContent('A open'));
    await nextTick();
    expect(renders).toContain('trigger');
    expect(renders).not.toContain('second');
    expect(renders).not.toContain('other');
  });
});

describe('the trigger leaves', () => {
  test('the unmount of the active trigger closes the tooltip with `none`; a cancelled close leaves it open', async () => {
    for (const cancel of [false, true]) {
      const log: string[] = [];
      const root = rootEvents(log, { defaultOpen: true });
      if (cancel) {
        root.onOpenChange = (open: boolean, details: TooltipRootChangeEventDetails) => {
          log.push(`openChange ${open} ${details.reason}`);
          details.cancel();
        };
      }
      const tooltips = reactive([{ name: 't', root }] as ({ name: string } & Props)[]);
      const { unmount } = await mountTooltips({ tooltips });
      await opened();
      tooltips[0]!.triggers = [];
      await nextTick();
      await nextTick();
      expect(log[0]).toBe('openChange false none');
      if (cancel) expect(popup()).not.toBe(null);
      else await closed();
      unmount();
    }
  });

  test('a trigger that a new trigger with the same id replaces keeps the tooltip open', async () => {
    const log: string[] = [];
    const tooltips = reactive([
      {
        name: 't',
        root: rootEvents(log, { defaultOpen: true }),
        triggers: [{ key: 'a', attrs: { id: 'same' } }],
      },
    ]);
    await mountTooltips({ tooltips });
    await opened();
    tooltips[0]!.triggers = [{ key: 'b', attrs: { id: 'same' } }];
    await nextTick();
    await nextTick();
    expect(log).toEqual([]);
    expect(trigger('b')).toHaveAttribute('data-popup-open');
  });
});

describe('the portal, the positioner and the popup', () => {
  test('with `keepMounted`, the closed popup has `hidden` and `inert`; its positioner takes no pointer', async () => {
    await mountTooltips({
      tooltips: [
        { name: 't', portal: { keepMounted: true }, triggers: [{ key: 't', attrs: { delay: 0 } }] },
      ],
    });
    const element = await opened();
    expect(element).toHaveAttribute('hidden');
    expect(element).toHaveAttribute('inert');
    expect(positioner()).not.toHaveAttribute('hidden');
    expect(positioner()!.style.pointerEvents).toBe('none');
    await userEvent.hover(trigger());
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    expect(positioner()!.style.pointerEvents).toBe('');
  });

  test('a kept popup that closed follows no anchor, and the first frame of the next open has the place of its new trigger', async () => {
    const frames: DOMRect[] = [];
    const first = reactive<Props>({ delay: 0, style: 'margin-left: 0' });
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: {
            onOpenChange: (open: boolean) => {
              if (open) {
                requestAnimationFrame(() => frames.push(positioner()!.getBoundingClientRect()));
              }
            },
          },
          portal: { keepMounted: true },
          positioner: { side: 'bottom' },
          triggers: [
            { key: 'a', attrs: first },
            { key: 'b', attrs: { delay: 0, style: 'display: block; margin-top: 100px' } },
          ],
        },
      ],
    });
    const element = await opened();
    await userEvent.hover(trigger('a'));
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    await waitFor(() => expect(frames).toHaveLength(1));
    const place = positioner()!.getBoundingClientRect();
    await hoverAway();
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    first.style = 'margin-left: 100px';
    await sleep(100);
    expect(positioner()!.getBoundingClientRect().left).toBe(place.left);
    await userEvent.hover(trigger('b'));
    await waitFor(() => expect(frames).toHaveLength(2));
    await sleep(100);
    const settled = positioner()!.getBoundingClientRect();
    expect(Math.abs(frames[1]!.left - settled.left)).toBeLessThan(1);
    expect(Math.abs(frames[1]!.top - settled.top)).toBeLessThan(1);
    expect(frames[1]!.top - place.top).toBeGreaterThan(100);
  });

  test('a kept popup has `data-instant="delay"` after a close because its active trigger unmounted', async () => {
    const tooltips = reactive<({ name: string } & Props)[]>([
      { name: 't', root: { defaultOpen: true }, portal: { keepMounted: true } },
    ]);
    await mountTooltips({ tooltips });
    const element = await opened();
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    tooltips[0]!.triggers = [];
    await waitFor(() => expect(element).toHaveAttribute('hidden'));
    expect(element).toHaveAttribute('data-instant', 'delay');
  });

  test('`to` moves the content to a container', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => container.remove());
    await mountTooltips({
      tooltips: [{ name: 't', root: { defaultOpen: true }, portal: { to: container } }],
    });
    await opened();
    expect(container.contains(positioner())).toBe(true);
  });

  test('a popup that a `v-if` replaces closes at a hover leave', async () => {
    const tooltip = reactive<{ name: string } & Props>({
      name: 't',
      triggers: [{ key: 't', attrs: { delay: 0 } }],
    });
    await mountTooltips({ tooltips: [tooltip] });
    await userEvent.hover(trigger());
    const first = await opened();
    tooltip.transition = 'none';
    await waitFor(() => expect(popup()).not.toBe(first));
    expect(popup()).not.toBe(null);
    await hoverAway();
    await closed();
  });

  test('a popup with `transition: opacity` and no `<Transition>` starts no transition at its open', async () => {
    addStyle('[data-testid="popup-t"] { transition: opacity 1s; }');
    const started: string[] = [];
    const listener = (event: Event) => started.push(event.type);
    document.addEventListener('transitionrun', listener, true);
    onTestFinished(() => document.removeEventListener('transitionrun', listener, true));
    await mountTooltips({ tooltips: [{ name: 't', root: { defaultOpen: true } }] });
    await opened();
    await sleep(50);
    expect(started).toEqual([]);
  });

  test('the positioner has a transform with no viewport, and insets while a viewport is mounted', async () => {
    const tooltip = reactive<{ name: string } & Props>({
      name: 't',
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { style: 'position: fixed; top: 260px; left: 320px' } }],
      positioner: {
        style: { width: 'var(--positioner-width)', height: 'var(--positioner-height)' },
      },
      viewport: false,
    });
    await mountTooltips({ tooltips: [tooltip] });
    const element = await opened();
    await waitFor(() => expect(positioner()!.style.transform).toMatch(/^translate\(/));
    expect(element.style.position).toBe('');
    expect(element.style.bottom).toBe('');
    tooltip.viewport = true;
    await waitFor(() => expect(positioner()!.style.transform).toBe(''));
    expect(positioner()!.style.left).toMatch(/px$/);
    await waitFor(() => expect(element.style.position).toBe('absolute'));
    expect(element.style.bottom).toBe('0px');
    tooltip.viewport = false;
    await waitFor(() => expect(positioner()!.style.transform).toMatch(/^translate\(/));
    expect(element.style.position).toBe('');
    expect(element.style.bottom).toBe('');
  });

  test('on side="top", late content growth expands upward on frame 0 with no trigger overlap and no resize loop error', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { defaultOpen: true },
          viewport: true,
          triggers: [
            {
              key: 't',
              attrs: {
                style: 'position: fixed; top: 260px; left: 320px; width: 60px; height: 24px',
              },
            },
          ],
          positioner: {
            sideOffset: 8,
            collisionAvoidance: { side: 'none' },
            style: { width: 'var(--positioner-width)', height: 'var(--positioner-height)' },
          },
          popup: {
            style: { width: 'var(--popup-width, auto)', height: 'var(--popup-height, auto)' },
          },
        },
      ],
    });
    const element = await opened();
    const box = positioner()!;
    await waitFor(() => expect(box.style.visibility).toBe(''));
    await waitFor(() =>
      expect(box.style.getPropertyValue('--positioner-height')).toBe(`${element.offsetHeight}px`),
    );
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const trigRect = trigger().getBoundingClientRect();
    const before = element.getBoundingClientRect();
    const view = byTestId('viewport-t')!;

    const errors: string[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.message);
    window.addEventListener('error', onError);
    onTestFinished(() => window.removeEventListener('error', onError));

    let f0Pop!: DOMRect;
    let f0Pos!: DOMRect;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        view.style.paddingBottom = '40px';
        requestAnimationFrame(() => {
          f0Pop = element.getBoundingClientRect();
          f0Pos = box.getBoundingClientRect();
          requestAnimationFrame(() => resolve());
        });
      });
    });

    expect(Math.round(f0Pos.height)).toBe(Math.round(before.height));
    expect(Math.round(f0Pop.height)).toBe(Math.round(before.height + 40));
    expect(Math.round(f0Pop.bottom)).toBe(Math.round(trigRect.top - 8));
    expect(Math.round(f0Pop.top)).toBe(Math.round(before.top - 40));
    expect(element.style.position).toBe('absolute');
    expect(element.style.bottom).toBe('0px');
    await waitFor(() =>
      expect(box.style.getPropertyValue('--positioner-height')).toBe(
        `${Math.round(before.height + 40)}px`,
      ),
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(errors).toEqual([]);
  });

  test('a popup with a viewport on the left side has its place from the right edge', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          viewport: true,
          positioner: { side: 'left' },
          triggers: [
            { key: 't', attrs: { delay: 0, style: 'position: fixed; top: 200px; left: 300px' } },
          ],
        },
      ],
    });
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    await opened();
    await waitFor(() => expect(positioner()).toHaveAttribute('data-side', 'left'));
    await waitFor(() => expect(positioner()!.style.right).not.toBe(''));
    expect(positioner()!.style.left).toBe('');
  });

  test('the arrow and the viewport: the side of the popup, the trigger id in the slot of the viewport, and the direction of a move', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          arrow: {},
          viewport: true,
          triggers: [
            { key: 'a', attrs: { id: 'a', delay: 0 } },
            { key: 'b', attrs: { id: 'b', delay: 0 } },
          ],
        },
      ],
    });
    await userEvent.hover(trigger('a'));
    await opened();
    await waitFor(() => expect(positioner()!.style.visibility).toBe(''));
    const side = positioner()!.getAttribute('data-side');
    expect(byTestId('arrow-t')).toHaveAttribute('data-side', side);
    expect(byTestId('viewport-t')).toHaveTextContent('a');
    await userEvent.hover(trigger('b'));
    await waitFor(() => expect(byTestId('viewport-t')).toHaveTextContent('b'));
    expect(byTestId('viewport-t')).toHaveAttribute('data-activation-direction', 'right ');
    // The viewport of a popover writes `trigger-change` after the animations of the move.
    await sleep(50);
    expect(byTestId('viewport-t')).not.toHaveAttribute('data-instant');
  });

  test('VUE-193: the arrow in a positioned popup with a border points at the center of the trigger', async () => {
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: { defaultOpen: true },
          triggers: [
            { key: 't', attrs: { style: 'position: fixed; left: 300px; top: 200px; width: 40px' } },
          ],
          popup: { style: 'position: relative; width: 80px; border: 1px solid' },
          arrow: { style: 'width: 10px; height: 10px' },
        },
      ],
    });
    await opened();
    const arrow = byTestId('arrow-t')!;
    await waitFor(() => expect(arrow.style.left).toMatch(/px$/));
    expect(Math.abs(centerOf(arrow).x - centerOf(trigger()).x)).toBeLessThanOrEqual(0.5);
  });
});

describe('with other parts', () => {
  test('Enter on a `Popover.Trigger` in the `element` slot closes the tooltip with `trigger-press` and opens the popover', async () => {
    const log: string[] = [];
    mount(TooltipComposed, { kind: 'popover-trigger', root: rootEvents(log) });
    await nextTick();
    const element = byId('trigger');
    expect(element).toHaveAttribute('aria-haspopup', 'dialog');
    expect(element).toHaveAttribute('type', 'button');
    focusBefore();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(element);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(byTestId('popover')).not.toBe(null));
    expect(log).toContain('openChange false trigger-press');
  });
});
