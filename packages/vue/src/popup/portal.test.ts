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

// A positioner hides its popup with `visibility: hidden` until the first place of the popup, and a
// hidden element takes no focus. So the content of a positioned popup takes no focus at its mount.
const FAMILIES = [
  { family: 'dialog', parts: ['backdrop', 'popup'], popupTag: 'div', positioned: false },
  { family: 'drawer', parts: ['backdrop', 'popup'], popupTag: 'div', positioned: false },
  { family: 'popover', parts: ['backdrop', 'popup'], popupTag: 'div', positioned: true },
  { family: 'menu', parts: ['backdrop', 'popup'], popupTag: 'div', positioned: true },
  { family: 'tooltip', parts: ['popup'], popupTag: 'div', positioned: true },
  { family: 'preview-card', parts: ['backdrop', 'popup'], popupTag: 'div', positioned: true },
  { family: 'combobox', parts: ['backdrop', 'popup'], popupTag: 'div', positioned: true },
  { family: 'navigation-menu', parts: ['backdrop', 'popup'], popupTag: 'nav', positioned: true },
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

  test.each(MODES)(
    'a hook of the mount of the content (%s) finds the popup shown and the content with a size, at an open from the trigger',
    async (mode) => {
      const log: PopupContentReading[] = [];
      mount(PopupContentFamilies, {
        family,
        mode,
        log: { add: (entry: PopupContentReading) => log.push(entry) },
      });
      await openFromTrigger(family);
      await waitFor(() => expect(log).toHaveLength(1));
      expect(log[0]).toMatchObject({ shown: true, sized: true });
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

describe.each(FAMILIES.filter(({ positioned }) => !positioned))(
  'the focus of the content of $family',
  ({ family }) => {
    test.each(MODES)(
      'a focus in a hook of the mount (%s) moves the focus into the popup at an open from the trigger, and it stays with `initialFocus` false',
      async (mode) => {
        const log: PopupContentReading[] = [];
        mount(PopupContentFamilies, {
          family,
          mode,
          keepFocus: true,
          log: { add: (entry: PopupContentReading) => log.push(entry) },
        });
        await openFromTrigger(family);
        await waitFor(() => expect(log).toHaveLength(1));
        expect(log[0]?.focused).toBe(true);
        await waitSingleFrame();
        expect(byTestId('field')).toHaveFocus();
      },
    );
  },
);
