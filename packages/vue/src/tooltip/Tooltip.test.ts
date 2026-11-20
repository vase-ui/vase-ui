import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { computed, nextTick, reactive } from 'vue';
import { Tooltip, type TooltipRootChangeEventDetails } from '@vase-ui/vue/tooltip';
import TooltipComposed from '../../test/fixtures/TooltipComposed.vue';
import TooltipPartAlone from '../../test/fixtures/TooltipPartAlone.vue';
import TooltipParts from '../../test/fixtures/TooltipParts.vue';
import { touchDrag } from '../../test/pointer';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

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
    await mountTooltips({
      tooltips: [{ name: 't', triggers: [{ key: 't', attrs: { delay: 120, closeDelay: 120 } }] }],
    });
    await userEvent.hover(trigger());
    await hoverAway();
    await sleep(200);
    expect(popup()).toBe(null);
    await userEvent.hover(trigger());
    await sleep(40);
    expect(popup()).toBe(null);
    await opened();
    await hoverAway();
    await sleep(40);
    expect(popup()).not.toBe(null);
    await closed();
  });

  test('a trigger with no `delay` waits 600 ms', async () => {
    await mountTooltips();
    await userEvent.hover(trigger());
    await sleep(450);
    expect(popup()).toBe(null);
    await opened();
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

  test('a hover on the trigger while the popup leaves after a hover close opens the root at once; the element enters after the leave', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        {
          name: 't',
          root: rootEvents(log),
          transition: 'short',
          triggers: [{ key: 't', attrs: { delay: 50 } }],
        },
      ],
    });
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    await userEvent.hover(trigger());
    const first = await opened();
    await hoverAway();
    await waitFor(() => expect(first.className).toContain('short-leave-active'));
    let most = 0;
    const observer = new MutationObserver(() => {
      most = Math.max(most, document.querySelectorAll('[data-testid="popup-t"]').length);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    onTestFinished(() => observer.disconnect());
    await userEvent.hover(trigger());
    await nextTick();
    expect(log.at(-2)).toBe('openChange true trigger-hover');
    // The old popup ends its leave before the new one enters.
    await nextTick();
    expect(first.isConnected).toBe(true);
    expect(first.className).toContain('short-leave-active');
    await waitFor(() => expect(popup()).not.toBe(first));
    expect(popup()).not.toBe(null);
    await sleep(20);
    expect(most).toBe(1);
  });

  test('after a close by Escape, a move on the trigger opens nothing; a pointer that leaves and comes back opens', async () => {
    await mountTooltips({
      tooltips: [{ name: 't', triggers: [{ key: 't', attrs: { delay: 0 } }] }],
    });
    await userEvent.hover(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    const center = centerOf(trigger());
    await userEvent.hover(trigger(), { position: { x: 5, y: 5 } });
    await sleep(60);
    expect(popup()).toBe(null);
    expect(center.x).toBeGreaterThan(0);
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
    const tooltips = reactive([{ name: 't', triggers: [{ key: 't', attrs: { delay: 50 } }] }]);
    await mountTooltips({ tooltips });
    await userEvent.hover(trigger());
    tooltips[0]!.triggers = [];
    await sleep(100);
    expect(popup()).toBe(null);
  });
});

describe('the focus', () => {
  test('a Tab to the trigger opens the tooltip at once with `data-instant="focus"`; a Tab away closes it with `trigger-focus`', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        { name: 't', root: rootEvents(log), triggers: [{ key: 't', attrs: { delay: 10_000 } }] },
      ],
    });
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(trigger());
    const element = await opened();
    expect(element).toHaveAttribute('data-instant', 'focus');
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
    // A browser that loses the focus of its window sends `focusout` with no related target, and
    // the trigger stays the active element.
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
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
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
            { key: 'a', attrs: { delay: 100 } },
            { key: 'b', attrs: { delay: 0, closeOnClick: false } },
          ],
        },
      ],
    });
    await userEvent.click(trigger('a'));
    await sleep(200);
    expect(popup()).toBe(null);
    await userEvent.hover(trigger('b'));
    await opened();
    await userEvent.click(trigger('b'));
    await sleep(40);
    expect(popup()).not.toBe(null);
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
  test('a provider gives its `delay`; a trigger `delay` wins; while the group is active, a hover opens at once', async () => {
    await mountTooltips({
      provider: { delay: 40, timeout: 400 },
      tooltips: [{ name: 'a' }, { name: 'b', triggers: [{ key: 'b', attrs: { delay: 10_000 } }] }],
    });
    await userEvent.hover(trigger('a'));
    await sleep(10);
    expect(popup('a')).toBe(null);
    await opened('a');
    await userEvent.hover(trigger('b'));
    await opened('b');
    await closed('a');
  });

  test('one tooltip of a group is open at a time; the other closes with `none`; the new one has `data-instant="delay"` at its insert, and the old one before its leave', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
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
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const log: string[] = [];
      await mountTooltips({
        provider: { delay: 0 },
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

  test('the group stays active for `timeout` after the last close; then a hover waits its delay', async () => {
    await mountTooltips({
      provider: { delay: 150, timeout: 300 },
      tooltips: [{ name: 'a', triggers: [{ key: 'a', attrs: { delay: 0 } }] }, { name: 'b' }],
    });
    await userEvent.hover(trigger('a'));
    await opened('a');
    await hoverAway();
    await closed('a');
    await userEvent.hover(trigger('b'));
    await sleep(60);
    expect(popup('b')).not.toBe(null);
    await hoverAway();
    await closed('b');
    await sleep(400);
    await userEvent.hover(trigger('b'));
    await sleep(60);
    expect(popup('b')).toBe(null);
    await opened('b');
  });

  test('the tooltips with no provider are one group with no timeout: one open at a time, and the next hover waits its delay', async () => {
    const log: string[] = [];
    await mountTooltips({
      tooltips: [
        { name: 'a', root: rootEvents(log, { defaultOpen: true }) },
        { name: 'b', triggers: [{ key: 'b', attrs: { delay: 80 } }] },
      ],
    });
    await opened('a');
    await userEvent.hover(trigger('b'));
    await sleep(30);
    expect(popup('b')).toBe(null);
    await opened('b');
    await closed('a');
    expect(popup('b')).toHaveAttribute('data-instant', 'delay');
    expect(log).toEqual(['openChange false none', 'update false']);
  });

  test('the props of the provider are read at their use', async () => {
    const provider = reactive({ delay: 10_000, closeDelay: 10_000 });
    await mountTooltips({ provider, tooltips: [{ name: 'a' }] });
    provider.delay = 0;
    provider.closeDelay = 0;
    await nextTick();
    await userEvent.hover(trigger('a'));
    await opened('a');
    await hoverAway();
    await closed('a');
  });

  test('after the active trigger of an open tooltip unmounts, the next hover waits its delay, and its tooltip has no `data-instant`', async () => {
    const tooltips = reactive([
      { name: 'a', root: { defaultOpen: true } as Props },
      { name: 'b', triggers: [{ key: 'b', attrs: { delay: 80 } }] },
    ]);
    await mountTooltips({ provider: { delay: 80, timeout: 10_000 }, tooltips });
    await opened('a');
    tooltips[0]!.triggers = [];
    await closed('a');
    await userEvent.hover(trigger('b'));
    await sleep(30);
    expect(popup('b')).toBe(null);
    const element = await opened('b');
    expect(element).not.toHaveAttribute('data-instant');
  });

  test('after an open tooltip unmounts, the next hover waits its delay', async () => {
    const tooltips = reactive<({ name: string } & Props)[]>([
      { name: 'a', root: { defaultOpen: true } },
      { name: 'b', triggers: [{ key: 'b', attrs: { delay: 80 } }] },
    ]);
    await mountTooltips({ provider: { delay: 80, timeout: 10_000 }, tooltips });
    await opened('a');
    tooltips.splice(0, 1);
    await closed('a');
    await userEvent.hover(trigger('b'));
    await sleep(30);
    expect(popup('b')).toBe(null);
    await opened('b');
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
      if (axis === 'both') expect(positioner()!.style.pointerEvents).toBe('none');
    },
  );

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
    await userEvent.hover(trigger('b'));
    tooltips[0]!.triggers[1]!.attrs.disabled = true;
    await sleep(150);
    expect(popup()).toBe(null);
    await userEvent.hover(trigger('a'));
    await opened();
    expect(trigger('b')).toHaveAttribute('data-trigger-disabled');
    await userEvent.hover(trigger('b'));
    await closed();
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
    const element = await waitFor(() => popup()!);
    expect(element).toHaveAttribute('hidden');
    expect(element).toHaveAttribute('inert');
    expect(positioner()).not.toHaveAttribute('hidden');
    expect(positioner()!.style.pointerEvents).toBe('none');
    await userEvent.hover(trigger());
    await waitFor(() => expect(element).not.toHaveAttribute('hidden'));
    expect(positioner()!.style.pointerEvents).toBe('');
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
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
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

  test.skipIf(inject('app') === 'vapor')(
    'a `Toolbar.Button` in the `element` slot: a disabled item keeps the focus and opens the tooltip at a hover',
    async () => {
      mount(TooltipComposed, {
        kind: 'toolbar-button',
        trigger: { delay: 0 },
        inner: { disabled: true },
      });
      await nextTick();
      expect(byId('trigger')).toHaveAttribute('aria-disabled', 'true');
      await userEvent.hover(byId('trigger'));
      await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    },
  );
});

test.skipIf(server.browser !== 'chromium')('the browser is Chromium', () => {
  expect(server.browser).toBe('chromium');
});
