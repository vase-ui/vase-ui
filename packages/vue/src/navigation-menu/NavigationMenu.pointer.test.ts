import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import type { NavigationMenuRootChangeEventDetails } from '@vase-ui/vue/navigation-menu';
import NavigationMenuParts from '../../test/fixtures/NavigationMenuParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const get = (id: string) => byTestId(id)!;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mountMenu(setup: Props = {}) {
  const result = mount(NavigationMenuParts, setup);
  await nextTick();
  return result;
}

async function shows(item: string) {
  await waitFor(() => expect(byTestId(`content-${item}`)).not.toBe(null));
  await waitFor(() => expect(get(`content-${item}`)).not.toHaveAttribute('hidden'));
}

async function closed() {
  await waitFor(() => expect(byTestId('popup')).toBe(null));
}

/** A tap: the pointer events of a touch, then the `click`. */
function tap(element: Element) {
  const init = { bubbles: true, cancelable: true, pointerType: 'touch' };
  element.dispatchEvent(new PointerEvent('pointerover', init));
  element.dispatchEvent(new PointerEvent('pointerenter', { ...init, bubbles: false }));
  element.dispatchEvent(new PointerEvent('pointerdown', init));
  element.dispatchEvent(new PointerEvent('pointerup', init));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
}

afterEach(async () => {
  await frame();
});

describe('the pointer', () => {
  test('a hover opens the menu again after a tap on a nested trigger and a press outside', async () => {
    await mountMenu({ nested: { root: {} } });
    tap(get('trigger-one'));
    await shows('one');
    tap(get('trigger-sub-b'));
    await shows('sub-b');
    await userEvent.click(document.getElementById('outside')!);
    await closed();
    await userEvent.hover(get('trigger-one'));
    await shows('one');
  });

  test('a hover opens the menu again after a quick press and a move to another trigger', async () => {
    await mountMenu();
    await userEvent.hover(get('trigger-one'));
    await shows('one');
    await userEvent.click(get('trigger-one'));
    await userEvent.hover(get('trigger-two'));
    await shows('two');
    await userEvent.hover(document.getElementById('outside')!);
    await closed();
    await userEvent.hover(get('trigger-one'));
    await shows('one');
  });

  test('a press on a link of a hover-opened popup does not keep it open when the pointer leaves', async () => {
    await mountMenu();
    await userEvent.hover(get('trigger-one'));
    await shows('one');
    await userEvent.hover(get('link-one-a'));
    get('link-one-a').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }),
    );
    await userEvent.hover(document.getElementById('outside')!);
    await closed();
  });

  test('a tap on another trigger moves the menu there', async () => {
    await mountMenu();
    await userEvent.click(get('trigger-one'));
    await shows('one');
    expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'true');
    tap(get('trigger-two'));
    await shows('two');
    expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'false');
    expect(get('trigger-two')).toHaveAttribute('aria-expanded', 'true');
  });

  test('a tap on a disabled trigger opens nothing', async () => {
    const log: string[] = [];
    await mountMenu({
      root: { onValueChange: (value: unknown) => log.push(String(value)) },
      triggers: { one: { disabled: true } },
    });
    tap(get('trigger-one'));
    await wait(50);
    expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'false');
    expect(byTestId('popup')).toBe(null);
    expect(log).toEqual([]);
  });

  test('a pointer that leaves a nested popup and the menu closes both', async () => {
    const log: string[] = [];
    await mountMenu({
      root: {
        onValueChange: (value: unknown, details: NavigationMenuRootChangeEventDetails) =>
          log.push(`${String(value)} ${details.reason}`),
      },
      nested: { inline: false },
    });
    await userEvent.hover(get('trigger-one'));
    await shows('one');
    await userEvent.hover(get('trigger-sub-a'));
    await shows('sub-a');
    await userEvent.hover(document.getElementById('outside')!);
    await waitFor(() => expect(byTestId('content-sub-a')).toBe(null));
    await closed();
    expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'false');
  });
});
