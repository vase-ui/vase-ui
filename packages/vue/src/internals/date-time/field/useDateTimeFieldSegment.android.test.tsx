import { describe, expect, it, vi } from 'vitest';
import { createRenderer, fireEvent } from '#test-utils';
import DateTimeFieldProbe from '../../../../test/fixtures/DateTimeFieldProbe.vue';

vi.mock('../../../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../../../common/platform')>(
    '../../../common/platform',
  );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, android: true },
    },
  };
});

describe('useDateTimeFieldSegment on Android', () => {
  const { render } = createRenderer();

  // Some Android keyboards report all text as a composition.
  it('commits each change during a composition', async () => {
    const onValueChange = vi.fn();
    const { container } = await render(
      <DateTimeFieldProbe
        defaultValue="2026-11-14"
        locale="en-US"
        referenceDate="2026-11-14"
        onValueChange={onValueChange}
      />,
    );
    const month = container.querySelector<HTMLInputElement>('input[data-type="month"]')!;

    month.focus();
    await fireEvent.compositionStart(month);
    await fireEvent.input(month, { target: { value: '5' } });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-05-14');
    expect(month.value).toBe('5');
  });
});
