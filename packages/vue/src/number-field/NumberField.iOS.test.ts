import { describe, expect, test, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import NumberFields from '../../test/fixtures/NumberFields.vue';
import { mount } from '../../test/render';

vi.mock('../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../common/platform')>('../common/platform');
  return {
    ...actual,
    platform: { ...actual.platform, os: { ...actual.platform.os, ios: true, apple: true } },
  };
});

// The numeric keyboard of iOS has no decimal key and no minus key.
describe('the input mode on iOS', () => {
  test.each([
    { name: 'decimal when no minus can be typed', root: { min: 0 }, mode: 'decimal' },
    { name: 'text when the range holds a negative number', root: { min: -5 }, mode: 'text' },
    { name: 'text with no min', root: {}, mode: 'text' },
    { name: 'text with allowOutOfRange', root: { min: 0, allowOutOfRange: true }, mode: 'text' },
  ])('$name', async ({ root, mode }) => {
    const { root: container } = mount(NumberFields, { root });
    await nextTick();
    expect(container.querySelector('[role=spinbutton]')).toHaveAttribute('inputmode', mode);
  });

  test('an inputmode of the developer wins', async () => {
    const input = reactive({ inputmode: 'tel' });
    const { root } = mount(NumberFields, { root: { min: 0 }, input });
    await nextTick();
    expect(root.querySelector('[role=spinbutton]')).toHaveAttribute('inputmode', 'tel');
  });
});
