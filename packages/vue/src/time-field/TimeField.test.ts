import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { TimeFieldRootChangeEventDetails } from '@vase-ui/vue/time-field';
import TimeFields from '../../test/fixtures/TimeFields.vue';
import { mount, settle } from '../../test/render';

const time = (text: string) => Temporal.PlainTime.from(text);

function record(log: string[], attrs: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    onValueChange: (value: unknown, details: TimeFieldRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
    ...attrs,
  });
}

async function mountFields(fields: Record<string, unknown>[], props: Record<string, unknown> = {}) {
  const { root, exposed } = mount(TimeFields, { fields, ...props });
  await nextTick();
  const group = root.querySelector<HTMLElement>('[role="group"]')!;
  return {
    root,
    exposed,
    group,
    segments: [...group.querySelectorAll<HTMLInputElement>('[role="spinbutton"]')],
    segment: (type: string) => group.querySelector<HTMLInputElement>(`[data-type="${type}"]`)!,
    formInput: group.querySelector<HTMLInputElement>('input[aria-hidden]')!,
    form: root.querySelector('form')!,
  };
}

const types = (segments: HTMLInputElement[]) => segments.map((s) => s.getAttribute('data-type'));

describe('the segments', () => {
  test('a 12-hour locale has a day period; each time unit and the day period show `--` while empty', async () => {
    const { segments, segment } = await mountFields([{}]);
    expect(types(segments)).toEqual(['hour', 'minute', 'dayPeriod']);
    expect(segments.map((s) => s.placeholder)).toEqual(['--', '--', '--']);
    expect(segment('dayPeriod')).toHaveAttribute('inputmode', 'text');
    expect(segment('dayPeriod')).toHaveAttribute('size', '2');
    expect(segment('hour')).toHaveAttribute('aria-valuemin', '1');
    expect(segment('hour')).toHaveAttribute('aria-valuemax', '12');
  });

  test('`hourCycle` and `granularity` give the layout, and `forceLeadingZeros` pads the hour', async () => {
    const field = reactive<Record<string, unknown>>({
      defaultValue: time('09:05:07'),
      hourCycle: 24,
      granularity: 'second',
    });
    const { root } = await mountFields([field]);
    const segments = () => [...root.querySelectorAll<HTMLInputElement>('[role="spinbutton"]')];
    expect(types(segments())).toEqual(['hour', 'minute', 'second']);
    expect(segments().map((s) => s.value)).toEqual(['09', '05', '07']);
    Object.assign(field, { hourCycle: 12, granularity: 'hour', forceLeadingZeros: true });
    await nextTick();
    expect(types(segments())).toEqual(['hour', 'dayPeriod']);
    expect(segments().map((s) => s.value)).toEqual(['09', 'AM']);
  });

  test('a letter selects the day period whose text starts with it, and the focus goes on', async () => {
    const log: string[] = [];
    const { segment, root } = await mountFields([record(log, { defaultValue: time('09:30') })]);
    root.querySelector('button[type=submit]')!.setAttribute('id', 'after');
    segment('dayPeriod').focus();
    await userEvent.keyboard('p');
    expect(segment('dayPeriod').value).toBe('PM');
    expect(segment('dayPeriod')).toHaveAttribute('aria-valuetext', 'PM');
    expect(log).toEqual(['valueChange 21:30:00 input-change']);
    await userEvent.keyboard('{ArrowUp}{End}{Home}');
    expect(log.at(-1)).toBe('valueChange 09:30:00 keyboard');
  });

  test('a zoned value shows the name of its zone unless `hideTimeZone`', async () => {
    const field = reactive<Record<string, unknown>>({
      defaultValue: Temporal.ZonedDateTime.from('2026-11-14T15:04[America/New_York]'),
    });
    const { group } = await mountFields([field]);
    expect(group.querySelector('[data-type="timeZoneName"]')).toHaveTextContent('EST');
    expect(group.querySelector('[data-type="timeZoneName"]')).not.toHaveAttribute('aria-hidden');
    field.hideTimeZone = true;
    await nextTick();
    expect(group.querySelector('[data-type="timeZoneName"]')).toBe(null);
  });
});

describe('the value', () => {
  test('a partial entry goes when the hour cycle changes', async () => {
    const field = reactive<Record<string, unknown>>({ hourCycle: 12 });
    const { segment, root } = await mountFields([field]);
    segment('hour').focus();
    await userEvent.keyboard('3');
    expect(segment('hour').value).toBe('3');
    field.hourCycle = 24;
    await nextTick();
    const segments = [...root.querySelectorAll<HTMLInputElement>('[role="spinbutton"]')];
    expect(segments.map((s) => s.value)).toEqual(['', '']);
  });

  test('a new time keeps the date and the zone of the value', async () => {
    const log: string[] = [];
    const { segment } = await mountFields([
      record(log, { defaultValue: Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]') }),
    ]);
    segment('minute').focus();
    await userEvent.keyboard('30');
    expect(log.at(-1)).toBe('valueChange 2026-11-14T15:30:00+09:00[Asia/Tokyo] input-change');
  });

  test('with no value, an arrow in an empty segment starts at midnight, and the value is a `Temporal.PlainTime`', async () => {
    const log: string[] = [];
    const { segment } = await mountFields([record(log, { hourCycle: 24 })]);
    segment('hour').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(segment('hour').value).toBe('00');
    segment('minute').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(log).toEqual(['valueChange 00:00:00 keyboard']);
  });
});

describe('the form input', () => {
  test('is a time input with `step`, and with `step="1"` when the field shows seconds', async () => {
    const field = reactive<Record<string, unknown>>({ defaultValue: time('15:04'), step: 300 });
    const { formInput } = await mountFields([field]);
    expect(formInput.type).toBe('time');
    expect(formInput.value).toBe('15:04');
    expect(formInput.step).toBe('300');
    // The step goes from midnight.
    expect(formInput.validity.stepMismatch).toBe(true);
    Object.assign(field, { step: undefined, granularity: 'second' });
    await nextTick();
    expect(formInput.step).toBe('1');
    expect(formInput.value).toBe('15:04:00');
  });

  test('checks a range through midnight natively', async () => {
    const field = reactive<Record<string, unknown>>({
      defaultValue: time('23:00'),
      min: time('22:00'),
      max: time('02:00'),
    });
    const { formInput } = await mountFields([field]);
    expect(formInput.validity.valid).toBe(true);
    field.defaultValue = undefined;
    field.modelValue = time('12:00');
    await nextTick();
    expect(formInput.validity.rangeUnderflow || formInput.validity.rangeOverflow).toBe(true);
  });

  test('a value with a date: the form input has the date and the time, and the root checks `min`, `max` and `step` with a time input', async () => {
    const { formInput, form } = await mountFields([
      {
        name: 'start',
        defaultValue: Temporal.PlainDateTime.from('2026-11-14T08:00'),
        min: time('09:00'),
      },
    ]);
    expect(formInput.type).toBe('datetime-local');
    expect(formInput.value).toBe('2026-11-14T08:00');
    expect(formInput.hasAttribute('min')).toBe(false);
    await settle();
    expect(formInput.validity.customError).toBe(true);
    const check = document.createElement('input');
    check.type = 'time';
    check.min = '09:00';
    check.value = '08:00';
    expect(formInput.validationMessage).toBe(check.validationMessage);
    expect([...new FormData(form)]).toEqual([['start', '2026-11-14T08:00']]);
  });

  test('a value with a date: the step goes from midnight', async () => {
    const { formInput } = await mountFields([
      { defaultValue: Temporal.PlainDateTime.from('2026-11-14T09:05'), step: 600 },
    ]);
    await settle();
    expect(formInput.validity.customError).toBe(true);
    const check = document.createElement('input');
    check.type = 'time';
    check.step = '600';
    check.value = '09:05';
    expect(formInput.validationMessage).toBe(check.validationMessage);
  });
});
