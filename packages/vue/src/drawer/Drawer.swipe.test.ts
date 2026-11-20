import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import DrawerParts from '../../test/fixtures/DrawerParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

async function mountDrawer(setup: Props = {}) {
  const log: string[] = [];
  const root = reactive<Props>({
    defaultOpen: true,
    onOpenChange: (open: boolean, details: { reason: string }) =>
      log.push(`openChange ${open} ${details.reason}`),
    ...(setup.root as Props),
  });
  const result = mount(DrawerParts, { ...setup, root });
  await waitFor(() => expect(byTestId('popup')).not.toBe(null));
  return { ...result, log, root };
}

async function mouseDrag(from: { x: number; y: number }, dy: number, steps = 6) {
  await userEvent.pointer({ coords: from });
  await userEvent.pointer({ keys: '[MouseLeft>]' });
  for (let step = 1; step <= steps; step += 1) {
    await userEvent.pointer({ coords: { x: from.x, y: from.y + (dy * step) / steps } });
  }
  await userEvent.pointer({ keys: '[/MouseLeft]' });
}

function textPoint() {
  const rect = byTestId('popup')!.getBoundingClientRect();
  return { x: rect.left + 200, y: rect.top + 10 };
}

describe('smoke', () => {
  test('a mouse swipe down of 200 px closes a drawer of 300 px', async () => {
    const { log } = await mountDrawer();
    await mouseDrag(textPoint(), 200);
    await waitFor(() => expect(byTestId('popup')).toBe(null));
    expect(log).toEqual(['openChange false swipe']);
  });

  test('a mouse swipe down of 50 px moves the popup back', async () => {
    const { log } = await mountDrawer();
    await mouseDrag(textPoint(), 50, 10);
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(byTestId('popup')!.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    expect(log).toEqual([]);
  });
});
