import { describe, expect, inject, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import PopupContentFamilies from '../../test/fixtures/PopupContentFamilies.vue';
import PopupPartsOfFamilies from '../../test/fixtures/PopupPartsOfFamilies.vue';
import type { PopupContentReading } from '../../test/fixtures/popupContent';
import { finishAnimations } from '../../test/animation';
import { mount } from '../../test/render';
import { waitSingleFrame } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

const FAMILIES = [
  { family: 'dialog', parts: ['backdrop', 'popup'], popupTag: 'div' },
  { family: 'drawer', parts: ['backdrop', 'popup'], popupTag: 'div' },
  { family: 'popover', parts: ['backdrop', 'popup'], popupTag: 'div' },
  { family: 'menu', parts: ['backdrop', 'popup'], popupTag: 'div' },
  { family: 'tooltip', parts: ['popup'], popupTag: 'div' },
  { family: 'preview-card', parts: ['backdrop', 'popup'], popupTag: 'div' },
  { family: 'combobox', parts: ['backdrop', 'popup'], popupTag: 'div' },
  { family: 'navigation-menu', parts: ['backdrop', 'popup'], popupTag: 'nav' },
] as const;

const CONTENT_FAMILIES = [
  'dialog',
  'drawer',
  'popover',
  'menu',
  'tooltip',
  'preview-card',
  'combobox',
  'combobox-popup-input',
  'navigation-menu',
  'navigation-menu-content',
] as const;

// A Vapor template takes only a function directive, which runs when the template creates its
// element. So only a virtual DOM fixture has a directive with a `mounted` hook.
const MODES = inject('app').startsWith('vapor')
  ? (['onMounted'] as const)
  : (['onMounted', 'directive'] as const);

function mountFamily(
  family: string,
  inSlot = false,
  options: { open?: boolean; keepMounted?: boolean; as?: keyof HTMLElementTagNameMap } = {},
) {
  const scene = reactive({ open: options.open ?? true });
  const log: string[] = [];
  mount(PopupPartsOfFamilies, {
    family,
    scene,
    inSlot,
    keepMounted: options.keepMounted,
    as: options.as,
    log: { add: (entry: string) => log.push(entry) },
  });
  return { scene, log };
}

describe.each(FAMILIES)('the parts of $family', ({ family, parts, popupTag }) => {
  test.each([{ as: undefined }, { as: 'section' }] as const)(
    'in a <Transition> with `as` $as: the parts that leave are inert with no `hidden`, `after-leave` comes once for each, and the portal then removes them',
    async ({ as }) => {
      const { scene, log } = mountFamily(family, false, { as });
      await waitFor(() => expect(byTestId('popup')).not.toBe(null));
      const elements = parts.map((part) => byTestId(part)!);
      expect(elements.map((element) => element.localName)).toEqual(
        parts.map((part) => as ?? (part === 'popup' ? popupTag : 'div')),
      );
      await Promise.all(elements.map(finishAnimations));
      await waitFor(() => expect(log).toHaveLength(parts.length));
      scene.open = false;
      await nextTick();
      for (const element of elements) {
        expect(element).toHaveAttribute('inert');
        expect(element).not.toHaveAttribute('hidden');
        expect(element.checkVisibility()).toBe(true);
      }
      await Promise.all(elements.map(finishAnimations));
      await waitFor(() => expect(elements.some((element) => element.isConnected)).toBe(false));
      expect(log.toSorted()).toEqual(
        parts.flatMap((part) => [`${part} after-enter`, `${part} after-leave`]).toSorted(),
      );
    },
  );

  // The counts are renders of the virtual DOM: a Vapor component updates each binding alone.
  test.runIf(inject('app') === 'vdom').each([{ as: undefined }, { as: 'section' }])(
    'renders the content of each part once at an open, with `as` $as',
    async ({ as }) => {
      const renders: Record<string, number> = {};
      const count = (part: string) => {
        renders[part] = (renders[part] ?? 0) + 1;
        return '';
      };
      mount(PopupPartsOfFamilies, {
        family,
        scene: { open: true },
        log: { add() {} },
        as,
        count,
      });
      await waitFor(() => expect(byTestId('popup')?.checkVisibility()).toBe(true));
      for (let frame = 0; frame < 3; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      expect(renders).toEqual(Object.fromEntries(parts.map((part) => [part, 1])));
    },
  );

  test('in the `element` slot: the parts leave the DOM at the close', async () => {
    const { scene } = mountFamily(family, true);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    const elements = parts.map((part) => byTestId(part)!);
    expect(elements.map((element) => element.localName)).toEqual(parts.map(() => 'section'));
    scene.open = false;
    await waitFor(() => expect(elements.some((element) => element.isConnected)).toBe(false));
  });

  test('in the `element` slot with `keepMounted`: the closed parts stay in the DOM with `hidden` and `inert`', async () => {
    mountFamily(family, true, { open: false, keepMounted: true });
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    for (const part of parts) {
      const element = byTestId(part)!;
      expect(element.localName).toBe('section');
      expect(element).toHaveAttribute('hidden');
      expect(element).toHaveAttribute('inert');
    }
  });
});

async function openFromTrigger(family: string) {
  const trigger = byTestId('trigger')!;
  await (family === 'tooltip' || family === 'preview-card'
    ? userEvent.hover(trigger)
    : userEvent.click(trigger));
}

describe.each(CONTENT_FAMILIES)('the mount of the content of %s', (family) => {
  test.each(MODES)(
    'a hook of the mount (%s) finds the popup shown and sized, moves the focus there, and default `initialFocus` keeps it',
    async (mode) => {
      const log: PopupContentReading[] = [];
      mount(PopupContentFamilies, {
        family,
        mode,
        log: { add: (entry: PopupContentReading) => log.push(entry) },
      });
      await openFromTrigger(family);
      await waitFor(() => expect(log).toHaveLength(1));
      expect(log[0]).toEqual({ shown: true, sized: true, focused: true });
      await waitSingleFrame();
      expect(byTestId('field')).toHaveFocus();
    },
  );
});

describe('the mount of the content of a `disabled` portal', () => {
  test.each(['dialog', 'popover'] as const)(
    '%s mounts open with its content shown, sized, and focused',
    async (family) => {
      const log: PopupContentReading[] = [];
      mount(PopupContentFamilies, {
        family,
        mode: 'onMounted',
        defaultOpen: true,
        disabledPortal: true,
        log: { add: (entry: PopupContentReading) => log.push(entry) },
      });
      await waitFor(() => expect(log).toHaveLength(1));
      expect(log[0]).toEqual({ shown: true, sized: true, focused: true });
      await waitSingleFrame();
      expect(byTestId('field')).toHaveFocus();
    },
  );
});

describe.each(['select', 'select-anchored'] as const)(
  'the mount of the content of %s',
  (family) => {
    test.each(MODES)(
      'an open by click or code finds the popup shown, sized, and focusable in %s, and then focuses the selected item',
      async (mode) => {
        for (const button of ['trigger', 'opener'] as const) {
          const log: PopupContentReading[] = [];
          const { unmount } = mount(PopupContentFamilies, {
            family,
            mode,
            selectValue: 'one',
            log: { add: (entry: PopupContentReading) => log.push(entry) },
          });
          try {
            await userEvent.click(byTestId(button)!);
            await waitFor(() => expect(log).toHaveLength(1));
            expect(log[0]).toEqual({ shown: true, sized: true, focused: true });
            await waitFor(() => expect(byTestId('item-one')).toHaveFocus());
          } finally {
            unmount();
          }
        }
      },
    );

    test('a defaultOpen mount finds the popup shown, sized, and focusable, and then focuses the selected item', async () => {
      const log: PopupContentReading[] = [];
      mount(PopupContentFamilies, {
        family,
        mode: 'onMounted',
        defaultOpen: true,
        selectValue: 'one',
        log: { add: (entry: PopupContentReading) => log.push(entry) },
      });
      await waitFor(() => expect(log).toHaveLength(1));
      expect(log[0]).toEqual({ shown: true, sized: true, focused: true });
      await waitFor(() => expect(byTestId('item-one')).toHaveFocus());
    });
  },
);

test('a select-anchored with no selected item keeps a child focus from `onMounted` at a click open', async () => {
  const log: PopupContentReading[] = [];
  mount(PopupContentFamilies, {
    family: 'select-anchored',
    mode: 'onMounted',
    log: { add: (entry: PopupContentReading) => log.push(entry) },
  });
  await userEvent.click(byTestId('opener')!);
  await waitFor(() => expect(log).toHaveLength(1));
  expect(log[0]).toEqual({ shown: true, sized: true, focused: true });
  await waitSingleFrame();
  expect(byTestId('field')).toHaveFocus();
});
