import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { leave } from '../../test/field';
import DateFieldInField from '../../test/fixtures/DateFieldInField.vue';
import DateFields from '../../test/fixtures/DateFields.vue';
import { mount, settle, submitsPrevented } from '../../test/render';

const day = (text: string) => Temporal.PlainDate.from(text);

/** The message and the flags of a native input that is not in the document. */
function nativeCheck(attributes: Record<string, string>) {
  const input = document.createElement('input');
  for (const [name, value] of Object.entries(attributes)) input.setAttribute(name, value);
  return input.validationMessage;
}
const MISSING = () => nativeCheck({ required: '' });
const PATTERN = () => nativeCheck({ pattern: 'a', value: 'b' });

async function mountFields(fields: Record<string, unknown>[], props: Record<string, unknown> = {}) {
  const { root, exposed } = mount(DateFields, { fields, ...props });
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

async function mountInField(props: {
  field?: Record<string, unknown>;
  date?: Record<string, unknown>;
  label?: 'for' | 'around';
  vaseForm?: boolean;
  formAttrs?: Record<string, unknown>;
  match?: string;
  fieldsetDisabled?: boolean;
}) {
  const { root } = mount(DateFieldInField, props);
  await nextTick();
  const group = root.querySelector<HTMLElement>('[role="group"]')!;
  return {
    root,
    group,
    segments: [...group.querySelectorAll<HTMLInputElement>('[role="spinbutton"]')],
    formInput: group.querySelector<HTMLInputElement>('input[aria-hidden]')!,
    form: root.querySelector('form')!,
    error: () => root.querySelector('#error'),
    match: () => root.querySelector('[data-testid="match"]'),
    submit: () => root.querySelector<HTMLButtonElement>('button[type=submit]')!.click(),
  };
}

describe('the form input', () => {
  test.each([
    { name: 'a date', value: '2026-11-14', type: 'date', text: '2026-11-14', step: null },
    {
      name: 'a date and time',
      value: '2026-11-14T15:04:30',
      type: 'datetime-local',
      text: '2026-11-14T15:04',
      step: null,
    },
    {
      name: 'a date and time with seconds',
      value: '2026-11-14T15:04:30',
      granularity: 'second',
      type: 'datetime-local',
      text: '2026-11-14T15:04:30',
      step: '1',
    },
    {
      name: 'a zoned date and time',
      value: '2026-11-14T15:04[Asia/Tokyo]',
      type: 'text',
      text: '2026-11-14T15:04+09:00[Asia/Tokyo]',
      step: null,
    },
    { name: 'a year and month', value: '2026-11', type: 'text', text: '2026-11', step: null },
  ])('has the type and the text of $name', async ({ value, type, text, step, granularity }) => {
    const parsed = value.includes('[')
      ? Temporal.ZonedDateTime.from(value)
      : value.includes('T')
        ? Temporal.PlainDateTime.from(value)
        : value.length === 7
          ? Temporal.PlainYearMonth.from(value)
          : day(value);
    const { formInput, form } = await mountFields([
      { defaultValue: parsed, granularity, name: 'when' },
    ]);
    expect(formInput.type).toBe(type);
    expect(formInput.value).toBe(text);
    expect(formInput.getAttribute('step')).toBe(step);
    expect([...new FormData(form)]).toEqual([['when', text]]);
  });

  test('a field with no value gives an empty text, and a segment has no name', async () => {
    const { form, segments } = await mountFields([{ name: 'when' }]);
    expect([...new FormData(form)]).toEqual([['when', '']]);
    expect(segments.every((segment) => !segment.name)).toBe(true);
  });

  test('a fill gives a value with the reason `input-change`; an empty text gives `null`; another text changes nothing', async () => {
    const log: string[] = [];
    const { formInput, segments } = await mountFields([
      {
        onValueChange: (value: unknown, details: { reason: string }) =>
          log.push(`${String(value)} ${details.reason}`),
      },
    ]);
    const fill = async (text: string) => {
      formInput.value = text;
      formInput.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    };
    await fill('2026-11-14');
    expect(segments.map((segment) => segment.value)).toEqual(['11', '14', '2026']);
    await fill('');
    // A date input refuses this text, so the input shows the value of the field again.
    formInput.type = 'text';
    await fill('soon');
    expect(formInput.value).toBe('');
    expect(log).toEqual(['2026-11-14 input-change', 'null input-change']);
  });

  test('the first segment takes the focus that a blocked submit gives to the form input', async () => {
    const { formInput, segments, form } = await mountFields([{ required: true }]);
    form.requestSubmit();
    expect(formInput.validity.valueMissing).toBe(true);
    expect(document.activeElement).toBe(segments[0]);
  });

  test('a native reset gives the first value and only `update:modelValue`, and removes a partial entry', async () => {
    const log: string[] = [];
    const first = day('2026-11-14');
    const field = reactive<Record<string, unknown>>({
      modelValue: first,
      onValueChange: (value: unknown) => log.push(`valueChange ${String(value)}`),
    });
    field['onUpdate:modelValue'] = (value: unknown) => {
      log.push(`update ${String(value)}`);
      field.modelValue = value;
    };
    const { segment, segments, form } = await mountFields([field]);
    segment('day').focus();
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{Backspace}');
    expect(segments.map((s) => s.value)).toEqual(['11', '', '2026']);
    log.length = 0;
    form.reset();
    await settle();
    expect(log).toEqual(['update 2026-11-14']);
    expect(segments.map((s) => s.value)).toEqual(['11', '14', '2026']);
  });
});

describe('validity', () => {
  test('the form input checks `required`, `min` and `max` of a date natively', async () => {
    const field = reactive<Record<string, unknown>>({
      defaultValue: day('2026-11-14'),
      min: day('2026-11-20'),
      required: true,
    });
    const { formInput } = await mountFields([field]);
    expect(formInput.min).toBe('2026-11-20');
    expect(formInput.validity.rangeUnderflow).toBe(true);
    expect(formInput.validity.customError).toBe(false);
  });

  test('a day field with a `min` that has a time allows its own day; a month is in the limits when one of its days is', async () => {
    const { formInput } = await mountFields([
      {
        defaultValue: day('2026-11-14'),
        min: Temporal.PlainDateTime.from('2026-11-14T18:00'),
      },
    ]);
    expect(formInput.validity.valid).toBe(true);
    const month = await mountFields([
      { defaultValue: Temporal.PlainYearMonth.from('2026-11'), min: day('2026-11-30') },
    ]);
    expect(month.formInput.validity.valid).toBe(true);
  });

  test.each([
    {
      name: 'a partial entry',
      field: {},
      message: MISSING,
      type: async (segments: HTMLInputElement[]) => {
        segments[0]!.focus();
        await userEvent.keyboard('11');
      },
    },
    {
      name: 'a zoned value below `min`',
      field: {
        defaultValue: Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]'),
        min: Temporal.ZonedDateTime.from('2026-11-14T16:00[Asia/Tokyo]'),
      },
      message: () =>
        nativeCheck({ type: 'datetime-local', value: '2026-11-14T15:04', min: '2026-11-14T16:00' }),
    },
    {
      name: 'a year and month after `max`',
      field: { defaultValue: Temporal.PlainYearMonth.from('2026-11'), max: day('2026-10-31') },
      message: () => nativeCheck({ type: 'date', value: '2026-11-01', max: '2026-10-31' }),
    },
    {
      name: 'a date that is not available',
      field: { defaultValue: day('2026-11-14'), unavailableDates: [day('2026-11-14')] },
      message: PATTERN,
    },
  ])(
    'outside a Field, $name is a custom error of the form input with the message of the browser',
    async ({ field, message, type }) => {
      const { formInput, segments } = await mountFields([field]);
      await type?.(segments);
      await settle();
      expect(formInput.validity.customError).toBe(true);
      expect(formInput.validationMessage).toBe(message());
    },
  );

  test('a read-only or disabled field is not validated', async () => {
    const field = reactive<Record<string, unknown>>({ required: true, readonly: true });
    const { formInput } = await mountFields([field]);
    expect(formInput.willValidate).toBe(false);
    field.readonly = false;
    field.disabled = true;
    await nextTick();
    expect(formInput.willValidate).toBe(false);
  });
});

describe('in a Field', () => {
  test('the label names the group and gives the focus to the first segment; the description describes the group', async () => {
    const { root, group, segments } = await mountInField({ field: { name: 'when' } });
    const label = root.querySelector('label')!;
    expect(label.htmlFor).toBe(segments[0]!.id);
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(group).toHaveAttribute('aria-describedby', 'description');
    await userEvent.click(label);
    expect(document.activeElement).toBe(segments[0]);
  });

  test('the field gets the Temporal value: `dirty` holds for an equal object, and `validate` gets the value', async () => {
    const values: unknown[] = [];
    const first = day('2026-11-14');
    const date = reactive<Record<string, unknown>>({ modelValue: first });
    date['onUpdate:modelValue'] = (value: unknown) => (date.modelValue = value);
    const { root, segments } = await mountInField({
      field: { validate: (value: unknown) => void values.push(value), validationMode: 'change' },
      date,
    });
    const fieldRoot = root.querySelector('[role="group"]')!.parentElement!;
    date.modelValue = day('2026-11-14');
    await settle();
    expect(fieldRoot).not.toHaveAttribute('data-dirty');
    segments[1]!.focus();
    await userEvent.keyboard('{ArrowUp}');
    await settle();
    expect(fieldRoot).toHaveAttribute('data-dirty');
    expect(values.at(-1)).toBeInstanceOf(Temporal.PlainDate);
  });

  test('a move between two segments or to Clear is no leave; a leave of the group touches the field', async () => {
    const { root, segments } = await mountInField({ field: {} });
    const fieldRoot = root.querySelector('[role="group"]')!.parentElement!;
    segments[0]!.focus();
    segments[1]!.focus();
    root.querySelector<HTMLButtonElement>('button[aria-label="Clear"]')!.focus();
    await settle();
    expect(fieldRoot).not.toHaveAttribute('data-touched');
    await leave(segments[1]!);
    root.querySelector<HTMLButtonElement>('button[type=submit]')!.focus();
    await settle();
    expect(fieldRoot).toHaveAttribute('data-touched');
  });

  test.each([
    { name: 'a partial entry', match: 'badInput', date: {}, partial: true },
    {
      name: 'a zoned value below `min`',
      match: 'rangeUnderflow',
      date: {
        defaultValue: Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]'),
        min: Temporal.ZonedDateTime.from('2026-11-15T00:00[Asia/Tokyo]'),
      },
    },
    {
      name: 'a year and month below `min`',
      match: 'rangeUnderflow',
      date: { defaultValue: Temporal.PlainYearMonth.from('2026-10'), min: day('2026-11-01') },
    },
    {
      name: 'a date that is not available',
      match: 'customError',
      date: {
        defaultValue: day('2026-11-14'),
        unavailableDates: (date: Temporal.PlainDate) => date.day === 14,
      },
    },
  ])('$name shows the error of `match="$match"` at a submit', async ({ match, date, partial }) => {
    const {
      segments,
      match: matched,
      error,
      submit,
    } = await mountInField({
      vaseForm: true,
      field: { name: 'when' },
      date,
      match,
    });
    if (partial) {
      segments[0]!.focus();
      await userEvent.keyboard('11');
    }
    submit();
    await settle();
    expect(matched()).toHaveTextContent('Choose another day.');
    expect(error()).not.toBe(null);
    expect(submitsPrevented).toEqual([true]);
    expect(segments.every((segment) => segment.getAttribute('aria-invalid') === 'true')).toBe(true);
  });

  test('a partial entry validates at the leave in `blur` mode, and not at each digit', async () => {
    const values: unknown[] = [];
    const { segments, error } = await mountInField({
      field: { validationMode: 'blur', validate: (value: unknown) => void values.push(value) },
      match: 'badInput',
    });
    segments[0]!.focus();
    await userEvent.keyboard('11');
    await settle();
    expect(error()).toBe(null);
    await leave(segments[1]!);
    expect(error()).toHaveTextContent(MISSING());
    expect(values).toEqual([]);
  });

  test('a message of `validate` stays a custom error, and the failure of the field wins over it', async () => {
    const { segments, error, submit } = await mountInField({
      vaseForm: true,
      field: { name: 'when', validate: () => 'Pick a weekday.', validationMode: 'change' },
      date: { defaultValue: day('2026-11-14') },
    });
    submit();
    await settle();
    expect(error()).toHaveTextContent('Pick a weekday.');
    segments[1]!.focus();
    await userEvent.keyboard('{Backspace}');
    await settle();
    expect(error()).toHaveTextContent(MISSING());
  });

  test('a Form gives the Temporal value of the field at a submit', async () => {
    const submitted: unknown[] = [];
    const { submit } = await mountInField({
      vaseForm: true,
      formAttrs: {
        onSubmit: (_event: Event, values: Record<string, unknown>) => submitted.push(values),
      },
      field: { name: 'when' },
      date: { defaultValue: day('2026-11-14') },
    });
    submit();
    await settle();
    expect(submitted).toEqual([{ when: day('2026-11-14') }]);
  });

  test('VUE-112: a disabled fieldset disables each segment, Clear and the form input', async () => {
    const { root, group, segments, formInput } = await mountInField({
      date: { defaultValue: day('2026-11-14') },
      fieldsetDisabled: true,
    });
    await settle();
    expect(segments.every((segment) => segment.matches(':disabled'))).toBe(true);
    expect(formInput.matches(':disabled')).toBe(true);
    expect(root.querySelector('button[aria-label="Clear"]')!.matches(':disabled')).toBe(true);
    expect(group).toHaveAttribute('data-disabled');
  });
});

describe('a native label', () => {
  test.each([{ label: 'for' as const }, { label: 'around' as const }])(
    'a <label> $label the first segment names the group after the mount',
    async ({ label }) => {
      const { root, group, segments } = await mountInField({ label, date: { id: 'day' } });
      await settle();
      const element = root.querySelector('label')!;
      expect(element.id).toBe('day-label');
      expect(group).toHaveAttribute('aria-labelledby', 'day-label');
      expect(element.control).toBe(segments[0]);
    },
  );

  test('each change of `id` names the group with the label of the new id', async () => {
    const date = reactive<Record<string, unknown>>({ id: 'day' });
    const { root, group } = await mountInField({ date });
    root.insertAdjacentHTML(
      'beforeend',
      '<label for="day" id="day-name">Day</label><label for="arrival" id="arrival-name">Arrival</label>',
    );
    date.id = 'arrival';
    await settle();
    expect(group).toHaveAttribute('aria-labelledby', 'arrival-name');
    date.id = 'day';
    await settle();
    expect(group).toHaveAttribute('aria-labelledby', 'day-name');
  });

  test('`aria-label` of the developer and the label of a Field win', async () => {
    const named = await mountInField({ label: 'for', date: { id: 'day', 'aria-label': 'Day' } });
    await settle();
    expect(named.group).not.toHaveAttribute('aria-labelledby');
    const inField = await mountInField({ field: {}, label: 'for', date: { id: 'day' } });
    await settle();
    const fieldLabel = inField.root.querySelector<HTMLElement>('label:not([for="day"])');
    expect(inField.group.getAttribute('aria-labelledby')).toBe(
      fieldLabel?.id ?? inField.root.querySelectorAll('label')[0]!.id,
    );
  });
});

describe('the locale', () => {
  test('is `en-US` with no prop, and the layout follows the prop', async () => {
    const field = reactive<Record<string, unknown>>({ defaultValue: day('2026-11-14') });
    const { root } = await mountFields([field]);
    const types = () =>
      [...root.querySelectorAll('[role="spinbutton"]')].map((s) => s.getAttribute('data-type'));
    expect(types()).toEqual(['month', 'day', 'year']);
    field.locale = 'de-DE';
    await nextTick();
    expect(types()).toEqual(['day', 'month', 'year']);
    expect(root.querySelector('span')).toHaveTextContent('.');
  });
});
