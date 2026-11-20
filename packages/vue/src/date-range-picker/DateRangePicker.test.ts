import { afterEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  DateRangePickerRootChangeEventDetails,
  DateRangePickerRootOpenChangeEventDetails,
} from '@vase-ui/vue/date-range-picker';
import DateRangePickerParts from '../../test/fixtures/DateRangePickerParts.vue';
import PickerPartAlone from '../../test/fixtures/PickerPartAlone.vue';
import { leave } from '../../test/field';
import { mockToday } from '../../test/mockBrowserToday';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const day = (text: string) => Temporal.PlainDate.from(text);
const range = (start: string | null, end: string | null) =>
  [start && day(start), end && day(end)] as const;

const popup = () => document.querySelector<HTMLElement>('[data-testid="popup"]');
const positioner = () => document.querySelector<HTMLElement>('[data-testid="positioner"]');
const dayButton = (date: string) =>
  document.querySelector<HTMLButtonElement>(`[data-date="${date}"] button`)!;
const centerOf = (date: string) => {
  const rect = dayButton(date).getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

afterEach(async () => {
  await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
});

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
  return popup()!;
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

const text = (value: readonly unknown[]) => value.map(String).join(' ');

/** Root props that write each event of the range and of the popup in `log`. */
function logged(log: string[], props: Props = {}) {
  return reactive<Props>({
    locale: 'en-US',
    onValueChange: (value: readonly unknown[], details: DateRangePickerRootChangeEventDetails) =>
      log.push(`valueChange ${text(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: readonly unknown[]) => log.push(`update ${text(value)}`),
    onOpenChange: (open: boolean, details: DateRangePickerRootOpenChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    ...props,
  });
}

function model(log: string[], modelValue: unknown, props: Props = {}) {
  const root = logged(log, { modelValue, ...props });
  root['onUpdate:modelValue'] = (value: readonly unknown[]) => {
    log.push(`update ${text(value)}`);
    root.modelValue = value;
  };
  return root;
}

async function mountPicker(setup: Props = {}) {
  const { root, exposed } = mount(DateRangePickerParts, setup);
  await nextTick();
  const query = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector<T & HTMLElement>(selector);
  const segments = (id: string) => [
    ...query(`[data-testid="${id}"]`)!.querySelectorAll<HTMLInputElement>('[role="spinbutton"]'),
  ];
  return {
    root,
    exposed,
    start: query('[data-testid="start"]')!,
    end: query('[data-testid="end"]')!,
    segments,
    inputs: () => [...root.querySelectorAll<HTMLInputElement>('input[aria-hidden]')],
    trigger: query<HTMLButtonElement>('[data-testid="trigger"]')!,
    form: query<HTMLFormElement>('form')!,
    error: () => query('#error'),
    fieldRoot: () => query('[data-testid="field"]')!,
  };
}

async function resetForm(form: HTMLFormElement, reversed = false) {
  const timers: (() => void)[] = [];
  const spy = vi.spyOn(window, 'setTimeout').mockImplementation(((callback: () => void) => {
    timers.push(callback);
    return 0;
  }) as unknown as typeof setTimeout);
  form.reset();
  spy.mockRestore();
  for (const timer of reversed ? timers.reverse() : timers) timer();
  await settle();
}

async function fill(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}

describe('the parts', () => {
  test.each(['StartField', 'EndField', 'Trigger', 'Positioner', 'Popup', 'Calendar'])(
    'DateRangePicker.%s outside DateRangePicker.Root throws an error that names both',
    (part) => {
      expect(String(mountError(PickerPartAlone, { family: 'DateRangePicker', part }))).toMatch(
        `<DateRangePicker.${part}> must be inside <DateRangePicker.Root>`,
      );
      takeReportedMessages();
    },
  );

  test('each form input keeps its own name; the trigger text is the range, with fewer than two ends undefined', async () => {
    const props = reactive<Props>({
      locale: 'en-US',
      startName: 'from',
      endName: 'to',
      modelValue: range('2026-11-20', '2026-11-18'),
    });
    const { inputs, trigger, form } = await mountPicker({
      root: props,
      fieldRoot: { name: 'trip' },
    });
    expect(inputs().map((input) => input.name)).toEqual(['from', 'to']);
    expect([...new FormData(form).entries()]).toEqual([
      ['from', '2026-11-20'],
      ['to', '2026-11-18'],
    ]);
    const format = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });
    expect(trigger).toHaveTextContent(
      format.formatRange(Date.UTC(2026, 10, 20), Date.UTC(2026, 10, 18)),
    );
    props.modelValue = range('2026-11-18', null);
    await nextTick();
    expect(trigger).toHaveTextContent('Choose');
  });
});

describe('the selection', () => {
  test('the first press gives one end and keeps the popup open; the second press closes it', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { trigger, inputs } = await mountPicker({ root: logged(log) });
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
    await userEvent.click(dayButton('2026-11-20'));
    await settle();
    expect(popup()).not.toBe(null);
    await userEvent.click(dayButton('2026-11-24'));
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'valueChange 2026-11-20 null day-press',
      'update 2026-11-20 null',
      'valueChange 2026-11-20 2026-11-24 day-press',
      'update 2026-11-20 2026-11-24',
      'openChange false imperative-action',
    ]);
    expect(inputs().map((input) => input.value)).toEqual(['2026-11-20', '2026-11-24']);
  });

  test('a drag gives the range and closes the popup, also on the range that the picker has', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const props = model(log, range('2026-11-10', '2026-11-12'), { open: true });
    props['onUpdate:open'] = (open: boolean) => (props.open = open);
    await mountPicker({ root: props });
    await opened();
    await waitFor(() => expect(dayButton('2026-11-10')).toHaveFocus());
    await userEvent.pointer([
      { coords: centerOf('2026-11-10'), keys: '[MouseLeft>]' },
      { coords: centerOf('2026-11-11') },
      { coords: centerOf('2026-11-12') },
      { keys: '[/MouseLeft]' },
    ]);
    await closed();
    expect(log).toEqual(['openChange false imperative-action']);
  });

  test('a key that extends the range keeps the popup open; closeOnSelect false keeps it open', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    await mountPicker({ root: logged(log, { defaultOpen: true, closeOnSelect: false }) });
    await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await userEvent.click(dayButton('2026-11-25'));
    await userEvent.click(dayButton('2026-11-27'));
    await settle();
    expect(popup()).not.toBe(null);
    expect(log.filter((entry) => entry.startsWith('openChange'))).toEqual([]);
  });

  test('a new end has the kind of the granularity, and the end field gets the first end as its min', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { inputs } = await mountPicker({
      root: logged(log, { granularity: 'minute', defaultOpen: true }),
    });
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    expect(log[0]).toBe('valueChange 2026-11-20T00:00:00 null day-press');
    expect(inputs()[1]).toHaveAttribute('min', '2026-11-20T00:00');
  });
});

describe('the Escape key', () => {
  test('one Escape puts back the range in progress, closes the popup, and gives the focus to the trigger', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { trigger } = await mountPicker({ root: model(log, range('2026-11-02', '2026-11-04')) });
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    log.length = 0;
    // The focus is on a button of the page, not on a day.
    popup()!.querySelector<HTMLButtonElement>('button')!.focus();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(log).toEqual([
      'valueChange 2026-11-02 2026-11-04 keyboard',
      'update 2026-11-02 2026-11-04',
      'openChange false escape-key',
    ]);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  test('a cancel of openChange keeps the popup open with the range put back', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const props = model(log, range(null, null), {
      defaultOpen: true,
      onOpenChange: (open: boolean, details: DateRangePickerRootOpenChangeEventDetails) => {
        log.push(`openChange ${open} ${details.reason}`);
        details.cancel();
      },
    });
    await mountPicker({ root: props });
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(popup()).not.toBe(null);
    expect(log.slice(-3)).toEqual([
      'valueChange null null keyboard',
      'update null null',
      'openChange false escape-key',
    ]);
  });

  test('an Escape in a drag ends the drag and closes the popup', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    await mountPicker({ root: logged(log, { defaultOpen: true }) });
    await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
    await userEvent.pointer([
      { coords: centerOf('2026-11-10'), keys: '[MouseLeft>]' },
      { coords: centerOf('2026-11-12') },
    ]);
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(log).toEqual(['openChange false escape-key']);
  });
});

describe('the fields', () => {
  test('a typed end changes that end; Alt+ArrowDown in the end field opens the popup', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { segments } = await mountPicker({
      root: logged(log, { defaultValue: range('2026-11-18', '2026-11-20') }),
    });
    segments('end')[1]!.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(log).toEqual([
      'valueChange 2026-11-18 2026-11-21 keyboard',
      'update 2026-11-18 2026-11-21',
    ]);
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await opened();
  });

  test('clear() of a field empties that end with update only', async () => {
    const log: string[] = [];
    const { exposed } = await mountPicker({
      root: logged(log, { defaultValue: range('2026-11-18', '2026-11-20') }),
    });
    exposed.start.clear();
    await nextTick();
    expect(log).toEqual(['update null 2026-11-20']);
  });

  test('a reset of a form with the two fields gives one update, also for a controlled picker', async () => {
    const log: string[] = [];
    const { segments, form } = await mountPicker({
      root: model(log, range('2026-11-18', '2026-11-20')),
    });
    segments('start')[1]!.focus();
    await userEvent.keyboard('{ArrowUp}');
    segments('end')[1]!.focus();
    await userEvent.keyboard('{ArrowUp}');
    log.length = 0;
    await resetForm(form);
    expect(log).toEqual(['update 2026-11-18 2026-11-20']);
  });

  test('the positioner holds the box around the two fields, also when the trigger opens the popup', async () => {
    const { start, end, trigger } = await mountPicker({ root: { locale: 'en-US' } });
    await userEvent.click(trigger);
    await opened();
    // The fields stand one above the other, and the trigger below them.
    await waitFor(() =>
      expect(positioner()!.getBoundingClientRect().top).toBeCloseTo(
        end.getBoundingClientRect().bottom,
        0,
      ),
    );
    expect(positioner()!.getBoundingClientRect().left).toBeCloseTo(
      start.getBoundingClientRect().left,
      0,
    );
    expect(trigger.getBoundingClientRect().bottom).toBeGreaterThan(
      end.getBoundingClientRect().bottom,
    );
  });
});

describe('in a Field', () => {
  test('the name of a field joins its aria-label and the label; with no aria-label, the label alone', async () => {
    const { start, end, root } = await mountPicker({
      root: { locale: 'en-US' },
      start: { 'aria-label': 'Start date' },
      fieldRoot: { name: 'trip' },
    });
    const label = root.querySelector('label')!;
    expect(start).toHaveAttribute('aria-labelledby', `${start.id} ${label.id}`);
    expect(end).toHaveAttribute('aria-labelledby', label.id);
    expect(start).toHaveAccessibleName(`Start date ${label.textContent}`);
    expect(end).toHaveAccessibleName(label.textContent!);
  });

  test('required needs both ends; the error of the end field shows', async () => {
    const { root, error, segments } = await mountPicker({
      root: { locale: 'en-US', required: true, defaultValue: range('2026-11-18', null) },
      fieldRoot: { name: 'trip' },
      vaseForm: true,
    });
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
    expect(error()).not.toBe(null);
    expect(segments('end')[0]).toHaveAttribute('aria-invalid', 'true');
  });

  test('dirty is false after the user types the first range again; an edit of either end validates', async () => {
    const check = vi.fn((_: unknown) => null);
    const { inputs, fieldRoot } = await mountPicker({
      root: { locale: 'en-US', defaultValue: range('2026-11-18', '2026-11-20') },
      fieldRoot: {
        name: 'trip',
        validate: check,
        validationMode: 'change',
        'data-testid': 'field',
      },
    });
    await fill(inputs()[1]!, '2026-11-21');
    expect(fieldRoot()).toHaveAttribute('data-dirty');
    expect(String(check.mock.lastCall![0])).toBe('2026-11-18,2026-11-21');
    await fill(inputs()[1]!, '2026-11-20');
    expect(fieldRoot()).not.toHaveAttribute('data-dirty');
    await fill(inputs()[0]!, '2026-11-19');
    expect(check).toHaveBeenCalledTimes(3);
  });

  test('in the blur mode, a move from the start field to the end field shows no error, and a move out of both validates', async () => {
    const { segments, error } = await mountPicker({
      root: { locale: 'en-US', required: true },
      fieldRoot: { name: 'trip', validationMode: 'blur' },
    });
    segments('start')[0]!.focus();
    await userEvent.keyboard('11182026');
    segments('end')[0]!.focus();
    await settle();
    await settle();
    expect(error()).toBe(null);
    await leave(segments('end')[0]!);
    await waitFor(() => expect(error()).not.toBe(null));
  });

  test('a submit gives the focus to the first field that fails, and a partial end is badInput', async () => {
    const { root, segments } = await mountPicker({
      root: { locale: 'en-US', required: true, defaultValue: range('2026-11-18', null) },
      fieldRoot: { name: 'trip' },
      match: 'badInput',
      vaseForm: true,
    });
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
    expect(segments('end')[0]).toHaveFocus();
    expect(root.querySelector('[data-testid="match"]')).toBe(null);
    await userEvent.keyboard('11');
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
    expect(root.querySelector('[data-testid="match"]')).toHaveTextContent('Check the dates.');
  });

  describe.each([
    { order: 'the field root first', reversed: false },
    { order: 'the field part first', reversed: true },
  ])('VUE-21: a native reset of a picker with two fields, with $order', ({ reversed }) => {
    test.each([
      { name: 'for the range of the reset', first: range('2026-11-18', '2026-11-20') },
      { name: 'for the value of each end', first: undefined },
    ])('starts no validation $name, and validates the next entry', async ({ first }) => {
      const check = vi.fn(() => 'Wrong range');
      const { form, inputs, error, fieldRoot } = await mountPicker({
        root: { locale: 'en-US', defaultValue: first },
        fieldRoot: {
          name: 'trip',
          validate: check,
          validationMode: 'change',
          'data-testid': 'field',
        },
      });
      await fill(inputs()[1]!, '2026-11-25');
      expect(error()).toHaveTextContent('Wrong range');
      check.mockClear();
      await resetForm(form, reversed);
      expect(check).not.toHaveBeenCalled();
      expect(error()).toBe(null);
      expect(fieldRoot()).not.toHaveAttribute('data-dirty');
      await fill(inputs()[0]!, '2026-11-17');
      expect(check).toHaveBeenCalledTimes(1);
    });
  });
});

describe('VUE-112: a disabled fieldset', () => {
  test.each([
    { name: 'around the fields', noFields: false },
    { name: 'around the trigger of a picker with no field', noFields: true },
  ])('disables the picker $name, with the calendar in the popup', async ({ noFields }) => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { trigger } = await mountPicker({
      root: logged(log, { open: true }),
      fieldsetDisabled: true,
      noFields,
    });
    await opened();
    await waitFor(() => expect(trigger).toBeDisabled());
    expect(dayButton('2026-11-20')).toBeDisabled();
    expect(log).toEqual([]);
  });
});
