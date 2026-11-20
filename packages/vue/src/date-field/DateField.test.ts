import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import DateFields from '../../test/fixtures/DateFields.vue';
import { mount } from '../../test/render';

async function mountFields(fields: Record<string, unknown>[], props: Record<string, unknown> = {}) {
  const { root } = mount(DateFields, { fields, ...props });
  await nextTick();
  return {
    root,
    groups: [...root.querySelectorAll<HTMLElement>('[role="group"]')],
    segments: [...root.querySelectorAll<HTMLInputElement>('[role="spinbutton"]')],
    input: root.querySelector<HTMLInputElement>('input[aria-hidden]')!,
  };
}

describe('smoke', () => {
  test('renders', async () => {
    const log: unknown[] = [];
    const field = reactive<Record<string, unknown>>({
      defaultValue: Temporal.PlainDate.from('2026-11-14'),
      name: 'day',
      onValueChange: (value: unknown) => log.push(String(value)),
    });
    const { root, segments } = await mountFields([field], { clear: 'x' });
    console.log(root.innerHTML);
    segments[0]!.focus();
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('0');
    await userEvent.keyboard('5');
    await nextTick();
    console.log(root.innerHTML, log, document.activeElement?.outerHTML);
    expect(true).toBe(true);
  });
});
