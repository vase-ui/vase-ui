import { expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import OTPFields from '../../test/fixtures/OTPFields.vue';
import { mount, settle } from '../../test/render';

vi.mock('../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../common/platform')>('../common/platform');
  return {
    ...actual,
    platform: { ...actual.platform, os: { ...actual.platform.os, android: true } },
  };
});

test('on Android, a slot takes each input event of a composition at once', async () => {
  const log: string[] = [];
  const { root } = mount(OTPFields, {
    root: { validationType: 'alphanumeric', onValueChange: (value: string) => log.push(value) },
    inputs: [{}, {}, {}],
  });
  await nextTick();
  const slots = [...root.querySelectorAll<HTMLInputElement>('input:not([aria-hidden])')];
  slots[0]!.focus();
  slots[0]!.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  slots[0]!.value = 'a';
  slots[0]!.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: 'a' }),
  );
  await settle();
  expect(log).toEqual(['a']);
  expect(document.activeElement).toBe(slots[1]);
  slots[0]!.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'a' }));
  await settle();
  expect(log).toEqual(['a']);
  expect(slots.map((slot) => slot.value)).toEqual(['a', '', '']);
});
