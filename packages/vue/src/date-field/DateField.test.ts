import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { DateFieldRootChangeEventDetails } from '@vase-ui/vue/date-field';
import { dataAttributes } from '../../test/field';
import DateFields from '../../test/fixtures/DateFields.vue';
import DateFieldSlots from '../../test/fixtures/DateFieldSlots.vue';
import { mockToday } from '../../test/mockBrowserToday';
import { mount, settle } from '../../test/render';

const day = (text: string) => Temporal.PlainDate.from(text);

/** Attributes of a field that write each event in `log`. */
function record(log: string[], attrs: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    onValueChange: (value: unknown, details: DateFieldRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: unknown) => log.push(`update ${String(value)}`),
    ...attrs,
  });
}

/** `v-model` on a field, with the log of `record`. The parent writes each value with `write`. */
function model(log: string[], modelValue: unknown, attrs: Record<string, unknown> = {}) {
  const field = record(log, { modelValue, ...attrs });
  field['onUpdate:modelValue'] = (value: unknown) => {
    log.push(`update ${String(value)}`);
    if (field.write !== false) field.modelValue = value;
  };
  return field;
}

async function mountFields(fields: Record<string, unknown>[], props: Record<string, unknown> = {}) {
  const { root, exposed } = mount(DateFields, { fields, ...props });
  await nextTick();
  const groups = [...root.querySelectorAll<HTMLElement>('[role="group"]')];
  const segmentsOf = (index = 0) => [
    ...groups[index]!.querySelectorAll<HTMLInputElement>('[role="spinbutton"]'),
  ];
  return {
    root,
    exposed,
    group: groups[0]!,
    segments: segmentsOf(0),
    segmentsOf,
    segment: (type: string) => groups[0]!.querySelector<HTMLInputElement>(`[data-type="${type}"]`)!,
    formInput: groups[0]!.querySelector<HTMLInputElement>('input[aria-hidden]')!,
    clear: root.querySelector<HTMLButtonElement>('button[aria-label="Clear"]'),
    form: root.querySelector('form')!,
  };
}

const values = (segments: HTMLInputElement[]) => segments.map((segment) => segment.value);

describe('the parts', () => {
  test('the root is one group element; the form input is its last child; each attribute but `id` goes to the group', async () => {
    const { group, formInput, exposed, segments } = await mountFields([
      { id: 'when', class: 'Day', 'data-x': 'y', name: 'day', defaultValue: day('2026-11-14') },
    ]);
    expect(group.tagName).toBe('DIV');
    expect(group).toHaveClass('Day');
    expect(group).toHaveAttribute('data-x', 'y');
    expect(group).not.toHaveAttribute('id');
    expect(group.lastElementChild).toBe(formInput);
    expect(exposed.roots[0].element).toBe(group);
    expect(exposed.roots[0].inputElement).toBe(formInput);
    expect(segments.map((segment) => segment.id)).toEqual(['when', '', '']);
    expect(formInput).toHaveAttribute('aria-hidden', 'true');
    expect(formInput.tabIndex).toBe(-1);
  });

  test('each segment is a text input with the role spinbutton, the names of Intl and its range; each literal is hidden', async () => {
    const { segments, group } = await mountFields([{ defaultValue: day('2026-11-14') }]);
    const [month, dayOfMonth, year] = segments;
    expect(month!.type).toBe('text');
    expect(
      Object.fromEntries(
        month!.getAttributeNames().map((name) => [name, month!.getAttribute(name)]),
      ),
    ).toEqual({
      id: expect.any(String),
      type: 'text',
      role: 'spinbutton',
      inputmode: 'numeric',
      autocomplete: 'off',
      spellcheck: 'false',
      size: '2',
      placeholder: 'mo',
      'aria-label': 'month',
      'aria-valuemin': '1',
      'aria-valuemax': '12',
      'aria-valuenow': '11',
      'aria-valuetext': 'November',
      'data-type': 'month',
      'data-complete': '',
      'data-allow-mismatch': 'attribute',
      value: '11',
    });
    expect(dayOfMonth).toHaveAttribute('size', '3');
    expect(dayOfMonth).toHaveAttribute('aria-valuemax', '30');
    expect(dayOfMonth).not.toHaveAttribute('aria-valuetext');
    expect(year).toHaveAttribute('placeholder', 'yr');
    expect(year).toHaveAttribute('aria-valuemax', '9999');
    const literals = [...group.querySelectorAll('span')];
    expect(literals.map((literal) => literal.textContent)).toEqual(['/', '/']);
    expect(literals.every((literal) => literal.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(literals[0]).toHaveAttribute('data-type', 'literal');
  });

  test('an empty field: no number, the placeholder of each unit, and data-empty on the parts', async () => {
    const { group, segments } = await mountFields([{}], { clear: '×' });
    expect(values(segments)).toEqual(['', '', '']);
    expect(segments.map((segment) => segment.placeholder)).toEqual(['mo', 'day', 'yr']);
    expect(segments.every((segment) => segment.matches(':placeholder-shown'))).toBe(true);
    expect(segments[0]).not.toHaveAttribute('aria-valuenow');
    expect(segments[0]).not.toHaveAttribute('aria-valuetext');
    expect(dataAttributes(group)).toEqual(['data-empty']);
    expect(dataAttributes(group.firstElementChild!)).toEqual(['data-allow-mismatch', 'data-empty']);
  });

  test('the state of the root gives its attributes; a segment leaves out each one that CSS has', async () => {
    const attrs = reactive<Record<string, unknown>>({ defaultValue: day('2026-11-14') });
    const { group, segments } = await mountFields([attrs]);
    Object.assign(attrs, { disabled: true, readonly: true, required: true });
    await nextTick();
    expect(dataAttributes(group)).toEqual([
      'data-complete',
      'data-disabled',
      'data-readonly',
      'data-required',
    ]);
    expect(dataAttributes(segments[0]!)).toEqual([
      'data-allow-mismatch',
      'data-complete',
      'data-type',
    ]);
    expect(segments[0]!.disabled).toBe(true);
    expect(segments[0]!.readOnly).toBe(true);
    expect(segments[0]).toHaveAttribute('aria-required', 'true');
  });

  test('Clear is a button that does not submit; the attributes of the developer win', async () => {
    const { clear } = await mountFields([{ defaultValue: day('2026-11-14') }], { clear: '×' });
    expect(clear!.type).toBe('button');
    expect(clear).toHaveTextContent('×');
    expect(clear!.disabled).toBe(false);
  });

  test('the element slots render the elements of the developer, with the state; each part exposes its element', async () => {
    const date = reactive<Record<string, unknown>>({ defaultValue: day('2026-11-14') });
    const { root, exposed } = mount(DateFieldSlots, { date });
    await nextTick();
    const section = root.querySelector('section')!;
    expect(exposed.input.element).toBe(section);
    expect(section).toHaveAttribute('data-items', '5');
    expect(section).toHaveAttribute('data-allow-mismatch', 'children');
    const segments = [...root.querySelectorAll<HTMLInputElement>('.Segment')];
    expect(segments.map((segment) => segment.getAttribute('role'))).toEqual([
      'spinbutton',
      'spinbutton',
      'spinbutton',
    ]);
    expect(root.querySelectorAll('b')).toHaveLength(2);
    const clear = root.querySelector<HTMLButtonElement>('.StyledButton')!;
    expect(exposed.clear.element).toBe(clear);
    expect(clear).toHaveAttribute('data-cleared', 'false');
    clear.click();
    await nextTick();
    expect(clear).toHaveAttribute('data-cleared', 'true');
    expect(section).toHaveAttribute('data-empty-field', 'true');
    expect(segments[0]).toHaveAttribute('data-placeholder-shown', 'true');
  });
});

describe('the value', () => {
  test('a typed date gives a value of the kind of `defaultValue`; a partial entry has no value', async () => {
    const log: string[] = [];
    const { segments, formInput } = await mountFields([record(log)]);
    segments[0]!.focus();
    await userEvent.keyboard('11');
    expect(document.activeElement).toBe(segments[1]);
    await userEvent.keyboard('14');
    expect(log).toEqual([]);
    expect(formInput.value).toBe('');
    // Each digit of the year gives a whole date, as a native date input does.
    await userEvent.keyboard('2026');
    await nextTick();
    expect(log.slice(-2)).toEqual(['valueChange 2026-11-14 input-change', 'update 2026-11-14']);
    expect(formInput.value).toBe('2026-11-14');
  });

  test('a new value keeps the calendar, the time zone and the units that the field does not show', async () => {
    const log: string[] = [];
    const zoned = Temporal.ZonedDateTime.from('2026-11-14T15:04:30[Asia/Tokyo]');
    const { segment } = await mountFields([
      record(log, { defaultValue: zoned, granularity: 'day' }),
    ]);
    segment('day').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(log[0]).toBe('valueChange 2026-11-15T15:04:30+09:00[Asia/Tokyo] keyboard');
  });

  test('with no value, the granularity gives the kind of the first value', async () => {
    const log: string[] = [];
    const { segmentsOf } = await mountFields([
      record(log, { granularity: 'month' }),
      record(log, { granularity: 'hour', hourCycle: 24 }),
    ]);
    segmentsOf(0)[0]!.focus();
    await userEvent.keyboard('112026');
    segmentsOf(1)[0]!.focus();
    await userEvent.keyboard('11142026');
    await userEvent.keyboard('15');
    const changes = log.filter((line) => line.startsWith('valueChange'));
    expect(changes).toContain('valueChange 2026-11 input-change');
    expect(changes.at(-1)).toBe('valueChange 2026-11-14T15:00:00 input-change');
  });

  test('a controlled field shows its prop again after a change that the parent does not write', async () => {
    const log: string[] = [];
    const field = model(log, day('2026-11-14'), { write: false });
    const { segment, formInput } = await mountFields([field]);
    segment('day').focus();
    await userEvent.keyboard('{ArrowUp}');
    await settle();
    expect(log).toEqual(['valueChange 2026-11-15 keyboard', 'update 2026-11-15']);
    expect(segment('day').value).toBe('14');
    expect(formInput.value).toBe('2026-11-14');
  });

  test('`details.cancel()` keeps each segment and the focus', async () => {
    const log: string[] = [];
    const field = record(log, {
      defaultValue: day('2026-11-14'),
      onValueChange: (value: unknown, details: DateFieldRootChangeEventDetails) => {
        log.push(`valueChange ${String(value)}`);
        details.cancel();
      },
    });
    const { segment } = await mountFields([field]);
    segment('month').focus();
    await userEvent.keyboard('3');
    await nextTick();
    expect(log).toEqual(['valueChange 2026-03-14']);
    expect(segment('month').value).toBe('11');
    expect(document.activeElement).toBe(segment('month'));
  });

  test('a partial entry that a controlled parent refuses goes, so a later `null` of the parent shows each segment empty', async () => {
    const log: string[] = [];
    const field = model(log, day('2026-11-14'), { write: false });
    const { segments } = await mountFields([field]);
    segments[1]!.focus();
    await userEvent.keyboard('{Backspace}');
    await settle();
    expect(values(segments)).toEqual(['11', '14', '2026']);
    field.modelValue = null;
    await nextTick();
    expect(values(segments)).toEqual(['', '', '']);
  });

  test('a typed year takes the era of today', async () => {
    mockToday('2026-11-14');
    const log: string[] = [];
    const { segment } = await mountFields([record(log, { calendar: 'japanese' })]);
    segment('year').focus();
    await userEvent.keyboard('5');
    segment('month').focus();
    await userEvent.keyboard('11');
    segment('day').focus();
    await userEvent.keyboard('14');
    expect(log.at(-2)).toBe('valueChange 2023-11-14 input-change');
  });

  test('`clear()` empties each segment and gives only `update:modelValue`', async () => {
    const log: string[] = [];
    const { exposed, segments } = await mountFields([
      record(log, { defaultValue: day('2026-11-14') }),
    ]);
    exposed.roots[0].clear();
    await nextTick();
    expect(values(segments)).toEqual(['', '', '']);
    expect(log).toEqual(['update null']);
    exposed.roots[0].clear();
    expect(log).toEqual(['update null']);
  });
});

describe('keys', () => {
  test('a digit joins the digits before it while the number is in the range, and a full segment gives the focus to the next one', async () => {
    const log: string[] = [];
    const { segments } = await mountFields([record(log, { defaultValue: day('2026-11-14') })]);
    segments[0]!.focus();
    // 1 can start 10, 11 or 12, so the month waits; 3 cannot join 1, so it starts a new number.
    await userEvent.keyboard('1');
    expect(document.activeElement).toBe(segments[0]);
    await userEvent.keyboard('3');
    expect(segments[0]!.value).toBe('3');
    expect(document.activeElement).toBe(segments[1]);
    // The typed digits start again at each focus.
    segments[0]!.focus();
    await userEvent.keyboard('2');
    expect(segments[0]!.value).toBe('2');
  });

  test('the digits of the locale and full-width digits count', async () => {
    const { segment } = await mountFields([{ locale: 'ar-EG', defaultValue: day('2026-11-14') }]);
    segment('day').focus();
    await userEvent.keyboard('٢');
    expect(segment('day').value).toBe('٢');
    await userEvent.keyboard('５');
    expect(segment('day').value).toBe('٢٥');
  });

  test('arrows and Page keys step with a wrap, Home and End go to the ends, and the year does not wrap', async () => {
    const { segment } = await mountFields([{ defaultValue: day('2026-12-31') }]);
    segment('month').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(segment('month').value).toBe('1');
    await userEvent.keyboard('{PageDown}');
    expect(segment('month').value).toBe('11');
    await userEvent.keyboard('{Home}');
    expect(segment('month').value).toBe('1');
    await userEvent.keyboard('{End}');
    expect(segment('month').value).toBe('12');
    // December 31 gave the day 30 in November. 30 and 7 wrap to 6 in a month of 31 days.
    segment('day').focus();
    await userEvent.keyboard('{PageUp}');
    expect(segment('day').value).toBe('6');
    segment('year').focus();
    await userEvent.keyboard('{PageUp}');
    expect(segment('year').value).toBe('2031');
  });

  test('an arrow in an empty segment gives the number of `referenceDate`', async () => {
    const { segment } = await mountFields([{ referenceDate: day('2030-02-10') }]);
    segment('month').focus();
    await userEvent.keyboard('{ArrowUp}');
    segment('year').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(segment('month').value).toBe('2');
    expect(segment('year').value).toBe('2030');
  });

  test('ArrowLeft and ArrowRight move the focus, and change places in a right-to-left direction', async () => {
    const { segments, root } = await mountFields([{}]);
    segments[1]!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(segments[2]);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(segments[0]);
    root.dir = 'rtl';
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(segments[1]);
  });

  test('Backspace and Delete empty the segment; Backspace in an empty segment goes back', async () => {
    const log: string[] = [];
    const { segments } = await mountFields([record(log, { defaultValue: day('2026-11-14') })]);
    segments[1]!.focus();
    await userEvent.keyboard('{Backspace}');
    expect(segments[1]!.value).toBe('');
    expect(log).toEqual(['valueChange null keyboard', 'update null']);
    await userEvent.keyboard('{Delete}');
    expect(document.activeElement).toBe(segments[1]);
    await userEvent.keyboard('{Backspace}');
    expect(document.activeElement).toBe(segments[0]);
  });

  test('a delete with no key empties the segment with the reason `input-clear`', async () => {
    const log: string[] = [];
    const { segments } = await mountFields([record(log, { defaultValue: day('2026-11-14') })]);
    segments[0]!.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'deleteContentBackward', cancelable: true }),
    );
    await nextTick();
    expect(log).toEqual(['valueChange null input-clear', 'update null']);
  });

  test('a read-only field moves the focus and changes nothing; a key with Ctrl, Alt or Meta stays native', async () => {
    const log: string[] = [];
    const { segments } = await mountFields([
      record(log, { defaultValue: day('2026-11-14'), readonly: true }),
    ]);
    segments[0]!.focus();
    await userEvent.keyboard('{ArrowUp}5{Backspace}{ArrowRight}');
    expect(document.activeElement).toBe(segments[1]);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '2027-01-01' } });
    segments[1]!.dispatchEvent(paste);
    await nextTick();
    expect(values(segments)).toEqual(['11', '14', '2026']);
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, cancelable: true });
    segments[1]!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(log).toEqual([]);
  });
});

describe('paste and input methods', () => {
  test('a paste reads a whole value: a text of the kind, or a text in the layout of the locale', async () => {
    const log: string[] = [];
    const { segments } = await mountFields([record(log)]);
    // Firefox gives a made `ClipboardEvent` no data, so the event carries its own.
    const paste = (text: string) => {
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', {
        value: { getData: (type: string) => (type === 'text/plain' ? text : '') },
      });
      segments[1]!.dispatchEvent(event);
    };
    paste('2026-11-14');
    paste('12/24/2027');
    paste('24/12/2027');
    paste('soon');
    await nextTick();
    expect(log.filter((line) => line.startsWith('valueChange'))).toEqual([
      'valueChange 2026-11-14 input-paste',
      'valueChange 2027-12-24 input-paste',
    ]);
  });

  test.each([
    { order: 'the last input before compositionend' },
    { order: 'compositionend before the last input' },
  ])('a composition gives its text one time at its end: $order', async ({ order }) => {
    const log: string[] = [];
    const { segments } = await mountFields([record(log, { defaultValue: day('2026-11-14') })]);
    const month = segments[0]!;
    month.focus();
    month.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
    // An input method owns its keys: key code 229.
    const key = new KeyboardEvent('keydown', { key: 'Process', keyCode: 229, cancelable: true });
    month.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    month.value = '1';
    month.dispatchEvent(
      new InputEvent('input', { inputType: 'insertCompositionText', data: '1', isComposing: true }),
    );
    month.value = '12';
    const last = new InputEvent('input', { inputType: 'insertCompositionText', data: '12' });
    const end = new CompositionEvent('compositionend', { data: '12' });
    if (order === 'the last input before compositionend') {
      month.dispatchEvent(last);
      month.dispatchEvent(end);
    } else {
      month.dispatchEvent(end);
      month.dispatchEvent(last);
    }
    await settle();
    expect(log.filter((line) => line.startsWith('valueChange'))).toEqual([
      'valueChange 2026-12-14 input-change',
    ]);
    expect(month.value).toBe('12');
  });

  // WebKit sends key code 229 with no `isComposing`, and before `compositionstart`.
  test('a key with the key code 229 belongs to the input method', async () => {
    const { segments } = await mountFields([{ defaultValue: day('2026-11-14') }]);
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', keyCode: 229, cancelable: true });
    segments[0]!.dispatchEvent(event);
    await nextTick();
    expect(event.defaultPrevented).toBe(false);
    expect(segments[0]!.value).toBe('11');
  });

  test('text of an `input` with no `beforeinput` that could be cancelled counts as typed text', async () => {
    const log: string[] = [];
    const { segments } = await mountFields([record(log, { defaultValue: day('2026-11-14') })]);
    segments[1]!.value = '149';
    segments[1]!.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: '9' }));
    await settle();
    expect(log[0]).toBe('valueChange 2026-11-09 input-change');
    expect(segments[1]!.value).toBe('9');
  });
});

describe('focus and pointer', () => {
  test('a segment selects its text at each focus and at a press', async () => {
    const { segments } = await mountFields([{ defaultValue: day('2026-11-14') }]);
    segments[2]!.focus();
    expect([segments[2]!.selectionStart, segments[2]!.selectionEnd]).toEqual([0, 4]);
    await userEvent.click(segments[0]!);
    expect(document.activeElement).toBe(segments[0]);
    expect([segments[0]!.selectionStart, segments[0]!.selectionEnd]).toEqual([0, 2]);
    // A digit that does not fill the segment writes its text, and the caret goes to its end.
    await userEvent.keyboard('1');
    await userEvent.click(segments[0]!);
    expect([segments[0]!.selectionStart, segments[0]!.selectionEnd]).toEqual([0, 1]);
  });

  test('a press on Input outside a segment gives the focus to the first empty segment, else to the first', async () => {
    const { segments, group } = await mountFields([{}]);
    const input = group.firstElementChild as HTMLElement;
    const literal = input.querySelector('span')!;
    segments[0]!.focus();
    await userEvent.keyboard('11');
    await userEvent.click(literal);
    expect(document.activeElement).toBe(segments[1]);
    await userEvent.keyboard('142026');
    await userEvent.click(literal);
    expect(document.activeElement).toBe(segments[0]);
  });

  test('Clear empties each segment, gives the focus to the first segment, and is disabled while empty, disabled or read-only', async () => {
    const log: string[] = [];
    const attrs = record(log, { defaultValue: day('2026-11-14') });
    const { segments, clear } = await mountFields([attrs], { clear: '×' });
    await userEvent.click(clear!);
    expect(values(segments)).toEqual(['', '', '']);
    expect(document.activeElement).toBe(segments[0]);
    expect(log).toEqual(['valueChange null clear-press', 'update null']);
    expect(clear!.disabled).toBe(true);
    await userEvent.keyboard('11');
    expect(clear!.disabled).toBe(false);
    attrs.readonly = true;
    await nextTick();
    expect(clear!.disabled).toBe(true);
  });
});
