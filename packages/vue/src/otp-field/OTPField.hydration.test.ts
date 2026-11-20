import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import OTPFields from '../../test/fixtures/OTPFields.vue';
import { hydrate, renderOnServer } from '../../test/render';

async function serverHtml(props: Record<string, unknown>) {
  const root = await renderOnServer('OTPFields', props);
  const group = root.querySelector<HTMLElement>('[role=group]')!;
  return {
    root,
    group,
    slots: [...group.querySelectorAll<HTMLInputElement>('input:not([aria-hidden])')],
    formInput: group.querySelector<HTMLInputElement>('input[aria-hidden]')!,
  };
}

describe('server render and hydration', () => {
  test('the server HTML has the group, each slot with its character and the tab stop, and the form input', async () => {
    const props = { root: { id: 'code', defaultValue: '12', name: 'otp' } };
    const { root, group, slots, formInput } = await serverHtml(props);
    expect(group).toHaveAttribute('data-filled');
    expect(slots.map((slot) => slot.getAttribute('value') ?? '')).toEqual([
      '1',
      '2',
      '',
      '',
      '',
      '',
    ]);
    expect(slots.map((slot) => slot.getAttribute('tabindex'))).toEqual([
      '-1',
      '-1',
      '0',
      '-1',
      '-1',
      '-1',
    ]);
    expect(slots.map((slot) => slot.id)).toEqual([
      'code',
      'code-2',
      'code-3',
      'code-4',
      'code-5',
      'code-6',
    ]);
    expect(slots[0]).toHaveAttribute('autocomplete', 'one-time-code');
    expect(slots[0]).toHaveAttribute('maxlength', '6');
    expect(group.lastElementChild).toBe(formInput);
    expect(formInput).toHaveAttribute('name', 'otp');
    expect(formInput).toHaveAttribute('value', '12');
    expect(formInput).toHaveAttribute('pattern', '\\d{6}');
    hydrate(OTPFields, props, root);
    await nextTick();
    expect(root.querySelector('[role=group]')).toBe(group);
    await userEvent.click(slots[2]!);
    await userEvent.keyboard('3');
    expect(formInput).toHaveValue('123');
    expect(document.activeElement).toBe(slots[3]);
  });

  test.each([
    { name: 'empty', props: {} },
    { name: 'controlled and complete', props: { root: { modelValue: '123456' } } },
    { name: 'masked', props: { inputs: Array.from({ length: 6 }, () => ({ type: 'password' })) } },
    {
      name: 'disabled, read-only and required',
      props: { root: { disabled: true, readonly: true, required: true, validationType: 'alpha' } },
    },
    { name: 'an id and no name', props: { root: { id: 'code' } } },
    { name: 'a native label', props: { root: { id: 'code' }, label: true } },
    { name: 'a field, the label before', props: { field: { name: 'otp' } } },
    { name: 'a field, the label after', props: { field: {}, labelAfter: true } },
  ])('hydrates with no mismatch: $name', async ({ props }) => {
    const { root, group } = await serverHtml(props);
    hydrate(OTPFields, props, root);
    await nextTick();
    expect(root.querySelector('[role=group]')).toBe(group);
  });

  test('the server HTML of a slot has one autocorrect attribute: the value of the developer, or off', async () => {
    const { slots } = await serverHtml({ inputs: [{ autocorrect: 'on' }, {}] });
    expect(slots.map((slot) => slot.getAttribute('autocorrect'))).toEqual(['on', 'off']);
  });

  test('the server HTML of a field names the group and each slot with the label, and describes the group', async () => {
    const { root, group, slots, formInput } = await serverHtml({
      field: { name: 'otp' },
      labelAfter: true,
    });
    const label = root.querySelector('label')!;
    expect(label).toHaveAttribute('for', slots[0]!.id);
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(group).toHaveAttribute('aria-describedby', 'description');
    expect(slots.every((slot) => slot.getAttribute('aria-labelledby') === label.id)).toBe(true);
    expect(formInput).toHaveAttribute('name', 'otp');
  });

  test('the server HTML of a disabled, read-only and required field has the attributes of each state', async () => {
    const { group, slots, formInput } = await serverHtml({
      root: { disabled: true, readonly: true, required: true },
    });
    expect(group).toHaveAttribute('data-disabled');
    expect(group).toHaveAttribute('data-readonly');
    expect(group).toHaveAttribute('data-required');
    for (const input of [...slots, formInput]) {
      expect(input).toHaveAttribute('disabled');
      expect(input).toHaveAttribute('readonly');
      expect(input).toHaveAttribute('required');
    }
  });
});
