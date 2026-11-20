import { describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import DateFields from '../../test/fixtures/DateFields.vue';
import { mount, settle } from '../../test/render';

vi.mock('../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../common/platform')>('../common/platform');
  return {
    ...actual,
    platform: { ...actual.platform, os: { ...actual.platform.os, android: true } },
  };
});

// An Android keyboard can give each text as a composition that does not end before the blur. The
// three desktop browsers cannot show this, so the case mocks the platform.
describe('a segment on Android', () => {
  test('takes the text of each `input` event of a composition at once', async () => {
    const log: string[] = [];
    const { root } = mount(DateFields, {
      fields: [
        {
          defaultValue: Temporal.PlainDate.from('2026-11-14'),
          onValueChange: (value: unknown) => log.push(String(value)),
        },
      ],
    });
    await nextTick();
    const month = root.querySelector<HTMLInputElement>('[data-type="month"]')!;
    month.focus();
    month.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
    month.value = '5';
    month.dispatchEvent(
      new InputEvent('input', { inputType: 'insertCompositionText', data: '5', isComposing: true }),
    );
    await settle();
    expect(log).toEqual(['2026-05-14']);
    expect(month.value).toBe('5');
  });
});
