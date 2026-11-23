import { describe, expect, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import PopupPartsOfFamilies from '../../test/fixtures/PopupPartsOfFamilies.vue';
import { finishAnimations } from '../../test/animation';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

const FAMILIES = [
  { family: 'dialog', parts: ['backdrop', 'popup'] },
  { family: 'popover', parts: ['backdrop', 'popup'] },
  { family: 'menu', parts: ['backdrop', 'popup'] },
  { family: 'tooltip', parts: ['popup'] },
] as const;

function mountFamily(family: string, inSlot = false) {
  const scene = reactive({ open: true });
  const log: string[] = [];
  mount(PopupPartsOfFamilies, {
    family,
    scene,
    inSlot,
    log: { add: (entry: string) => log.push(entry) },
  });
  return { scene, log };
}

describe.each(FAMILIES)('the parts of $family', ({ family, parts }) => {
  test('in a <Transition>: the parts that leave are inert with no `hidden`, `after-leave` comes once for each, and the portal then removes them', async () => {
    const { scene, log } = mountFamily(family);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    const elements = parts.map((part) => byTestId(part)!);
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
  });

  test('in the `element` slot: the parts leave the DOM at the close', async () => {
    const { scene } = mountFamily(family, true);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    const elements = parts.map((part) => byTestId(part)!);
    expect(elements.map((element) => element.localName)).toEqual(parts.map(() => 'section'));
    scene.open = false;
    await waitFor(() => expect(elements.some((element) => element.isConnected)).toBe(false));
  });
});
