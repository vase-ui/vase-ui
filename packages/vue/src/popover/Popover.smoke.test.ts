import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

test('smoke', async () => {
  const log: string[] = [];
  const { root } = mount(PopoverParts, { root: { onOpenChange: (open: boolean, d: any) => log.push(`${open} ${d.reason}`) }, close: {} });
  await nextTick();
  const trigger = root.querySelector('button')!;
  await userEvent.click(trigger);
  await waitFor(() => expect(document.querySelector('[role=dialog]')).not.toBe(null));
  const popup = document.querySelector('[role=dialog]') as HTMLElement;
  await waitFor(() => expect(document.activeElement?.textContent).toBe('First'));
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(trigger).toHaveAttribute('aria-controls', popup.id);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.querySelector('[role=dialog]')).toBe(null));
  expect(document.activeElement).toBe(trigger);
  await userEvent.click(trigger);
  await waitFor(() => expect(document.querySelector('[role=dialog]')).not.toBe(null));
  await userEvent.click(document.querySelector('#before')!);
  await waitFor(() => expect(document.querySelector('[role=dialog]')).toBe(null));
  expect(log).toEqual(['true trigger-press', 'false escape-key', 'true trigger-press', 'false outside-press']);
});
