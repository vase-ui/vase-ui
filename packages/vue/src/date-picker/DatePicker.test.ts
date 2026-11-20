import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  DatePickerRootChangeEventDetails,
  DatePickerRootOpenChangeEventDetails,
} from '@vase-ui/vue/date-picker';
import type { CalendarRootChangeEventDetails } from '@vase-ui/vue/calendar';
import DatePickerParts from '../../test/fixtures/DatePickerParts.vue';
import PickerPartAlone from '../../test/fixtures/PickerPartAlone.vue';
import { mockToday } from '../../test/mockBrowserToday';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const day = (text: string) => Temporal.PlainDate.from(text);
const at = (text: string) => Temporal.PlainDateTime.from(text);

const popup = () => document.querySelector<HTMLElement>('[data-testid="popup"]');
const positioner = () => document.querySelector<HTMLElement>('[data-testid="positioner"]');
const cell = (date: string) => document.querySelector<HTMLElement>(`[data-date="${date}"]`)!;
const dayButton = (date: string) => cell(date).querySelector('button')!;

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
  return popup()!;
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

/** Root props that write each event of the value and of the popup in `log`. */
function logged(log: string[], props: Props = {}) {
  return reactive<Props>({
    locale: 'en-US',
    onValueChange: (value: unknown, details: DatePickerRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: unknown) => log.push(`update ${String(value)}`),
    onOpenChange: (open: boolean, details: DatePickerRootOpenChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    ...props,
  });
}

/** `v-model` on the root, with the log of `logged`. */
function model(log: string[], modelValue: unknown, props: Props = {}) {
  const root = logged(log, { modelValue, ...props });
  root['onUpdate:modelValue'] = (value: unknown) => {
    log.push(`update ${String(value)}`);
    root.modelValue = value;
  };
  return root;
}

async function mountPicker(setup: Props = {}) {
  const { root, exposed } = mount(DatePickerParts, setup);
  await nextTick();
  const query = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector<T & HTMLElement>(selector);
  return {
    root,
    exposed,
    group: query('[role="group"]')!,
    segments: () => [
      ...query('[role="group"]')!.querySelectorAll<HTMLInputElement>('[role="spinbutton"]'),
    ],
    formInput: query<HTMLInputElement>('input[aria-hidden]')!,
    trigger: query<HTMLButtonElement>('[data-testid="trigger"]')!,
    form: query<HTMLFormElement>('form')!,
    error: () => query('#error'),
    fieldRoot: () => query('[data-testid="field"]')!,
  };
}

/**
 * Resets the form. The field root and the field part each wait for the end of the event with a
 * timer. `reversed` runs the second timer first.
 */
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

/** A program that fills the form writes the whole date in one event. */
async function fill(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}

describe('the parts', () => {
  test('the root renders no element; the field is the group of DateField; the trigger is the button of Popover', async () => {
    const { root, group, trigger, formInput, exposed } = await mountPicker({
      root: { locale: 'en-US', name: 'day', defaultValue: day('2026-11-18') },
      trigger: { 'aria-label': 'Choose date' },
    });
    expect(root.querySelector('form > fieldset')!.firstElementChild).toBe(group);
    expect(group.lastElementChild).toBe(formInput);
    expect(formInput).toHaveAttribute('name', 'day');
    expect(formInput.value).toBe('2026-11-18');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAccessibleName('Choose date');
    expect(exposed.field.element).toBe(group);
    expect(exposed.field.inputElement).toBe(formInput);
  });

  test('an attribute of the root reaches Popover.Root, and Vue warns that no element takes it', async () => {
    await mountPicker({ root: { class: 'Picker' } });
    expect(document.querySelector('.Picker')).toBe(null);
    expect(takeReportedMessages().join()).toMatch(/Extraneous non-props attributes \(class\)/);
  });

  test.each([
    { name: 'multiple', attrs: { multiple: '' } },
    { name: 'in kebab case', attrs: { multiple: '', 'min-days': 2 } },
  ])(
    'an attribute $name of a prop that the picker keeps out does not reach the calendar',
    async ({ attrs }) => {
      mockToday('2026-11-18');
      await mountPicker({
        root: {
          locale: 'en-US',
          defaultOpen: true,
          closeOnSelect: false,
          defaultValue: day('2026-11-18'),
        },
        calendar: attrs,
      });
      const element = await opened();
      await userEvent.click(dayButton('2026-11-20'));
      expect(element.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    },
  );

  test('an attribute handle of the trigger does not reach Popover.Trigger, so the trigger opens the picker', async () => {
    const { trigger } = await mountPicker({
      root: { locale: 'en-US' },
      trigger: { handle: {}, 'open-on-hover': '' },
    });
    await userEvent.click(trigger);
    await opened();
  });

  test('an attribute name on the time field does not reach the form', async () => {
    const { form } = await mountPicker({
      root: { locale: 'en-US', open: true, name: 'when', defaultValue: at('2026-11-18T10:30') },
      timeField: { name: 'time' },
      // The popup is in the form.
      portal: { disabled: true },
    });
    await opened();
    expect(new FormData(form).has('time')).toBe(false);
    expect([...new FormData(form).keys()]).toEqual(['when']);
  });

  test.each(['Field', 'Trigger', 'Positioner', 'Popup', 'Calendar', 'TimeField'])(
    'DatePicker.%s outside DatePicker.Root throws an error that names both',
    (part) => {
      expect(String(mountError(PickerPartAlone, { family: 'DatePicker', part }))).toMatch(
        `<DatePicker.${part}> must be inside <DatePicker.Root>`,
      );
      takeReportedMessages();
    },
  );
});

describe('the trigger', () => {
  test('the slots have the value in the locale as text, and undefined with no value', async () => {
    const props = reactive<Props>({ locale: 'de-DE', modelValue: day('2026-11-18') });
    const { trigger } = await mountPicker({ root: props });
    const date = new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeZone: 'UTC' });
    expect(trigger).toHaveTextContent(date.format(Date.UTC(2026, 10, 18)));
    props.modelValue = Temporal.PlainYearMonth.from('2026-11');
    await nextTick();
    const month = new Intl.DateTimeFormat('de-DE', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    expect(trigger).toHaveTextContent(month.format(Date.UTC(2026, 10, 1)));
    props.modelValue = null;
    await nextTick();
    expect(trigger).toHaveTextContent('Choose');
  });

  test('a disabled or read-only picker disables the trigger', async () => {
    const props = reactive<Props>({ locale: 'en-US', disabled: true });
    const { trigger } = await mountPicker({ root: props });
    expect(trigger).toBeDisabled();
    props.disabled = false;
    props.readonly = true;
    await nextTick();
    expect(trigger).toBeDisabled();
    props.readonly = false;
    await nextTick();
    expect(trigger).toBeEnabled();
  });
});

describe('the value', () => {
  test('a press on a day gives one valueChange and one update, and closes the popup', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { trigger, formInput } = await mountPicker({ root: logged(log) });
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
    await userEvent.click(dayButton('2026-11-20'));
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'valueChange 2026-11-20 day-press',
      'update 2026-11-20',
      'openChange false imperative-action',
    ]);
    expect(formInput.value).toBe('2026-11-20');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  test('a cancel in the root keeps the value of the picker and of the calendar, and the popup', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { trigger } = await mountPicker({
      root: logged(log, {
        onValueChange: (_: unknown, details: DatePickerRootChangeEventDetails) => {
          log.push(`cancel ${details.reason}`);
          details.cancel();
        },
      }),
    });
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    await settle();
    expect(log).toEqual(['openChange true trigger-press', 'cancel day-press']);
    expect(popup()).not.toBe(null);
    expect(cell('2026-11-20')).toHaveAttribute('aria-selected', 'false');
  });

  test('a cancel of a listener on the field part stops the change there', async () => {
    const log: string[] = [];
    const { segments } = await mountPicker({
      root: logged(log, { defaultValue: day('2026-11-18') }),
      field: { onValueChange: (_: unknown, details: { cancel(): void }) => details.cancel() },
    });
    segments()[1]!.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(log).toEqual([]);
    expect(segments()[1]!.value).toBe('18');
  });

  test('a typed date gives the root the details of the field, with no second update', async () => {
    const log: string[] = [];
    const { segments } = await mountPicker({
      root: logged(log, { defaultValue: day('2026-11-18') }),
    });
    segments()[1]!.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(log).toEqual(['valueChange 2026-11-19 keyboard', 'update 2026-11-19']);
  });

  test('a controlled picker shows the value of the parent, also after a change that the parent did not write', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const props = logged(log, { modelValue: day('2026-11-18'), open: true });
    await mountPicker({ root: props });
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    expect(log).toContain('update 2026-11-20');
    expect(cell('2026-11-18')).toHaveAttribute('aria-selected', 'true');
    props.modelValue = day('2026-11-21');
    await nextTick();
    expect(cell('2026-11-21')).toHaveAttribute('aria-selected', 'true');
  });

  test.each([
    {
      name: 'the granularity month',
      root: { granularity: 'month' },
      months: true,
      value: '2026-12',
    },
    {
      name: 'the granularity minute',
      root: { granularity: 'minute' },
      value: '2026-11-20T00:00:00',
    },
    {
      name: 'a reference date',
      root: { referenceDate: Temporal.ZonedDateTime.from('2026-01-01T09:15[Europe/Paris]') },
      value: '2026-11-20T09:15:00+01:00[Europe/Paris]',
    },
    {
      name: 'the default value',
      root: { defaultValue: at('2026-11-01T08:00') },
      value: '2026-11-20T08:00:00',
    },
  ])('a new value has the kind of $name', async ({ root, months, value }) => {
    mockToday('2026-11-18');
    const log: string[] = [];
    await mountPicker({ root: logged(log, { open: true, closeOnSelect: false, ...root }), months });
    await opened();
    if (months)
      await userEvent.click(document.querySelector<HTMLElement>('[data-month="2026-12"]')!);
    else await userEvent.click(dayButton('2026-11-20'));
    expect(log[0]).toBe(`valueChange ${value} ${months ? 'month-press' : 'day-press'}`);
  });

  test('a picker that the user empties keeps the kind of its last value', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const props = model(log, at('2026-11-02T07:45'));
    const { exposed } = await mountPicker({ root: props });
    exposed.field.clear();
    await nextTick();
    props.open = true;
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    expect(log).toEqual([
      'update null',
      'valueChange 2026-11-20T07:45:00 day-press',
      'update 2026-11-20T07:45:00',
    ]);
  });
});

describe('today and the first focus', () => {
  test('a picker that the user opens with no value has the focus on today, and today has its own state', async () => {
    mockToday('2026-11-18');
    const { trigger } = await mountPicker({ root: { locale: 'en-US' } });
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
    expect(cell('2026-11-18')).toHaveAttribute('data-today');
  });

  test('a picker that is open at the mount has the focus on today', async () => {
    mockToday('2026-11-18');
    await mountPicker({ root: { locale: 'en-US', defaultOpen: true } });
    await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
  });

  test('the root reads the clock again at each open', async () => {
    const spy = vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(day('2026-11-18'));
    const props = reactive<Props>({ locale: 'en-US', open: false });
    await mountPicker({ root: props });
    spy.mockReturnValue(day('2026-12-02'));
    props.open = true;
    await opened();
    await waitFor(() => expect(dayButton('2026-12-02')).toHaveFocus());
    spy.mockRestore();
  });

  test('the root reads the clock again when the user opens the popup', async () => {
    const spy = vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(day('2026-11-18'));
    const { trigger } = await mountPicker({ root: { locale: 'en-US' } });
    spy.mockReturnValue(day('2026-12-02'));
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(dayButton('2026-12-02')).toHaveFocus());
    spy.mockRestore();
  });

  test('the root reads today in the zone of timeZone, and gives it to the calendar', async () => {
    const spy = vi
      .spyOn(Temporal.Now, 'plainDateISO')
      .mockImplementation((zone) => day(zone === 'Asia/Tokyo' ? '2026-11-19' : '2026-11-18'));
    await mountPicker({ root: { locale: 'en-US', timeZone: 'Asia/Tokyo', defaultOpen: true } });
    await opened();
    await waitFor(() => expect(dayButton('2026-11-19')).toHaveFocus());
    expect(cell('2026-11-19')).toHaveAttribute('data-today');
    spy.mockRestore();
  });

  test('a time typed with no value takes the day of today, which the root reads at its mount', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { root } = await mountPicker({
      root: logged(log, { granularity: 'minute' }),
      inlineTimeField: { 'aria-label': 'Time' },
    });
    const [hour] = root.querySelectorAll<HTMLInputElement>(
      '[aria-label="Time"] [role="spinbutton"]',
    );
    hour!.focus();
    await userEvent.keyboard('0930a');
    expect(log.at(-1)).toBe('update 2026-11-18T09:30:00');
  });

  test('the selected day, and the today prop of the calendar', async () => {
    mockToday('2026-11-18');
    const props = reactive<Props>({ locale: 'en-US', defaultValue: day('2026-11-04'), open: true });
    const { exposed } = await mountPicker({ root: props, calendar: { today: day('2026-11-11') } });
    await opened();
    await waitFor(() => expect(dayButton('2026-11-04')).toHaveFocus());
    expect(cell('2026-11-11')).toHaveAttribute('data-today');
    exposed.field.clear();
    props.open = false;
    await closed();
    props.open = true;
    await opened();
    await waitFor(() => expect(dayButton('2026-11-11')).toHaveFocus());
  });

  test.each([
    {
      name: 'an element',
      target: () => popup()!.querySelector<HTMLElement>('button'),
      focus: 'previous',
    },
    { name: 'false', target: false, focus: 'before' },
  ])('an initialFocus of $name replaces the focus of the picker', async ({ target, focus }) => {
    mockToday('2026-11-18');
    const { trigger } = await mountPicker({
      root: { locale: 'en-US' },
      popup: { initialFocus: target },
    });
    await userEvent.click(trigger);
    // WebKit gives a button no focus at a click.
    const before = document.activeElement;
    const element = await opened();
    await settle();
    expect(document.activeElement).toBe(
      focus === 'before' ? before : element.querySelector('button'),
    );
  });

  test('an initialFocus that gives true asks for the focus of the picker', async () => {
    mockToday('2026-11-18');
    const { trigger } = await mountPicker({
      root: { locale: 'en-US' },
      popup: { initialFocus: () => true },
    });
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
  });

  test('a popup that stays mounted takes the focus at each open', async () => {
    mockToday('2026-11-18');
    const props = reactive<Props>({ locale: 'en-US', open: true });
    await mountPicker({ root: props, portal: { keepMounted: true } });
    await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
    document.getElementById('before')!.focus();
    props.open = false;
    await nextTick();
    props.open = true;
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
  });
});

describe('the popup', () => {
  test.each([
    {
      name: 'Alt+ArrowDown opens the popup for the first trigger',
      keys: '{Alt>}{ArrowDown}{/Alt}',
      opens: true,
    },
    {
      name: 'Shift does not open it',
      keys: '{Shift>}{Alt>}{ArrowDown}{/Alt}{/Shift}',
      opens: false,
    },
    {
      name: 'Control does not open it',
      keys: '{Control>}{Alt>}{ArrowDown}{/Alt}{/Control}',
      opens: false,
    },
    { name: 'ArrowDown alone changes the segment', keys: '{ArrowDown}', opens: false },
  ])('$name', async ({ keys, opens }) => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { segments, trigger } = await mountPicker({ root: logged(log) });
    segments()[0]!.focus();
    await userEvent.keyboard(keys);
    await settle();
    expect(popup() !== null).toBe(opens);
    if (!opens) return;
    expect(log).toEqual(['openChange true trigger-press']);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  test('Alt+ArrowDown does nothing after a listener prevents it, and in a read-only picker', async () => {
    const root = reactive<Props>({ locale: 'en-US' });
    const { segments } = await mountPicker({
      root,
      field: { onKeydown: (event: KeyboardEvent) => event.preventDefault() },
    });
    segments()[0]!.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await settle();
    expect(popup()).toBe(null);
  });

  test('Alt+ArrowDown does nothing while the popup is open', async () => {
    const log: string[] = [];
    const props = logged(log, { open: true });
    const { segments } = await mountPicker({ root: props });
    await opened();
    segments()[0]!.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await settle();
    expect(log).toEqual([]);
  });

  test('Alt+ArrowDown with no trigger opens the popup, and the focus returns to the segment', async () => {
    mockToday('2026-11-18');
    const { segments } = await mountPicker({
      root: { locale: 'en-US', readonly: false },
      noTrigger: true,
    });
    segments()[1]!.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(segments()[1]).toHaveFocus());
  });

  test('a read-only picker does not open by a key, and its calendar selects nothing', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { segments } = await mountPicker({ root: logged(log, { readonly: true }) });
    segments()[0]!.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await settle();
    expect(popup()).toBe(null);
    log.length = 0;
    const props = logged(log, { readonly: true, open: true });
    await mountPicker({ root: props });
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    expect(log).toEqual([]);
  });

  test.each([
    {
      name: 'a press on the selected day closes the popup',
      value: day('2026-11-18'),
      closes: true,
    },
    {
      name: 'a value with a time keeps the popup open',
      value: at('2026-11-18T10:00'),
      closes: false,
    },
  ])('$name', async ({ value, closes }) => {
    mockToday('2026-11-18');
    const log: string[] = [];
    await mountPicker({ root: logged(log, { defaultValue: value, defaultOpen: true }) });
    await opened();
    await userEvent.click(dayButton('2026-11-18'));
    await settle();
    expect(popup() === null).toBe(closes);
    expect(log.filter((entry) => entry.startsWith('value'))).toEqual([]);
  });

  test('a press on a month of a year and month picker closes the popup', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    await mountPicker({
      root: logged(log, { granularity: 'month', defaultOpen: true }),
      months: true,
    });
    await opened();
    await userEvent.click(document.querySelector<HTMLElement>('[data-month="2026-02"]')!);
    await closed();
    expect(log).toEqual([
      'valueChange 2026-02 month-press',
      'update 2026-02',
      'openChange false imperative-action',
    ]);
  });

  test('a cancel of openChange keeps the popup open, and the value stays changed', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    await mountPicker({
      root: logged(log, {
        defaultOpen: true,
        onOpenChange: (open: boolean, details: DatePickerRootOpenChangeEventDetails) => {
          if (!open) details.cancel();
        },
      }),
    });
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    await settle();
    expect(popup()).not.toBe(null);
    expect(log).toEqual(['valueChange 2026-11-20 day-press', 'update 2026-11-20']);
  });

  test('closeOnSelect false keeps the popup open; Escape and a press outside close it and keep the value', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { trigger } = await mountPicker({ root: logged(log, { closeOnSelect: false }) });
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    await settle();
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(document.getElementById('outside')!);
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'valueChange 2026-11-20 day-press',
      'update 2026-11-20',
      'openChange false escape-key',
      'openChange true trigger-press',
      'openChange false outside-press',
    ]);
  });

  test('v-model:open and close() of the root', async () => {
    const props = reactive<Props>({ locale: 'en-US', open: false });
    props['onUpdate:open'] = (open: boolean) => (props.open = open);
    const { exposed, trigger } = await mountPicker({ root: props });
    await userEvent.click(trigger);
    await opened();
    expect(props.open).toBe(true);
    exposed.root.close();
    await closed();
    expect(props.open).toBe(false);
  });

  test('the positioner is at the start of the field, and at the trigger with no field', async () => {
    const { group } = await mountPicker({ root: { locale: 'en-US', defaultOpen: true } });
    await opened();
    await waitFor(() =>
      expect(positioner()!.getBoundingClientRect().left).toBeCloseTo(
        group.getBoundingClientRect().left,
        0,
      ),
    );
    expect(positioner()).toHaveAttribute('data-align', 'start');
  });
});

describe('the calendar', () => {
  test('a listener of monthChange and v-model:month reach the calendar, and details.cancel() keeps the page', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const calendar = reactive<Props>({
      month: Temporal.PlainYearMonth.from('2026-11'),
      onMonthChange: (month: Temporal.PlainYearMonth, details: CalendarRootChangeEventDetails) => {
        log.push(`monthChange ${month.toString()}`);
        if (month.month === 10) details.cancel();
      },
      'onUpdate:month': (month: Temporal.PlainYearMonth) => (calendar.month = month),
    });
    await mountPicker({ root: { locale: 'en-US', defaultOpen: true }, calendar });
    const element = await opened();
    const [previous, next] = element.querySelectorAll<HTMLButtonElement>('[role="group"] > button');
    await userEvent.click(next!);
    expect(String(calendar.month)).toBe('2026-12');
    await userEvent.click(previous!);
    await userEvent.click(previous!);
    expect(log).toEqual(['monthChange 2026-12', 'monthChange 2026-11', 'monthChange 2026-10']);
    expect(String(calendar.month)).toBe('2026-11');
  });

  test('focus() of the template ref gives the focus to a day', async () => {
    mockToday('2026-11-18');
    const { exposed } = await mountPicker({ root: { locale: 'en-US', defaultOpen: true } });
    await opened();
    exposed.calendar.focus(day('2026-11-25'));
    await waitFor(() => expect(dayButton('2026-11-25')).toHaveFocus());
  });

  test('the limits and the unavailable days of the root', async () => {
    mockToday('2026-11-18');
    await mountPicker({
      root: {
        locale: 'en-US',
        defaultOpen: true,
        min: day('2026-11-10'),
        max: day('2026-11-25'),
        unavailableDates: day('2026-11-19'),
      },
    });
    await opened();
    expect(dayButton('2026-11-09')).toBeDisabled();
    expect(dayButton('2026-11-26')).toBeDisabled();
    expect(cell('2026-11-19')).toHaveAttribute('data-unavailable');
  });
});

describe('the time field', () => {
  test('shows and sets the time of the value; a typed time with no value takes the day of the template', async () => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const props = model(log, at('2026-11-18T10:30'), { open: true });
    const { exposed } = await mountPicker({ root: props, timeField: {} });
    const element = await opened();
    await waitFor(() => expect(dayButton('2026-11-18')).toHaveFocus());
    const [hour] = element.querySelectorAll<HTMLInputElement>(
      '[aria-label="Time"] [role="spinbutton"]',
    );
    expect(hour!.value).toBe('10');
    hour!.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(log).toEqual(['valueChange 2026-11-18T11:30:00 keyboard', 'update 2026-11-18T11:30:00']);
    log.length = 0;
    exposed.timeField.clear();
    await nextTick();
    expect(log).toEqual(['update null']);
    hour!.focus();
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{Tab}{ArrowUp}{Tab}{ArrowUp}');
    expect(log.at(-1)).toMatch(/^update 2026-11-18T/);
  });

  test('a picker whose value has no time throws for a time field in a development build', () => {
    expect(
      String(mountError(DatePickerParts, { root: { locale: 'en-US' }, inlineTimeField: {} })),
    ).toMatch('<DatePicker.TimeField> needs a picker whose value has a time');
    takeReportedMessages();
  });
});

describe('the form', () => {
  test.each([
    {
      name: 'an uncontrolled picker',
      root: { defaultValue: day('2026-11-18') },
      log: ['update 2026-11-18'],
    },
    {
      name: 'a controlled picker',
      root: { modelValue: day('2026-11-18'), write: true },
      log: ['update 2026-11-18'],
    },
  ])(
    'a reset of the form gives one update of $name, and no valueChange',
    async ({ root, log: expected }) => {
      const log: string[] = [];
      const props = 'modelValue' in root ? model(log, root.modelValue) : logged(log, root);
      const { segments, form, formInput } = await mountPicker({ root: props });
      segments()[1]!.focus();
      await userEvent.keyboard('{ArrowUp}');
      log.length = 0;
      await resetForm(form);
      expect(log).toEqual(expected);
      expect(formInput.value).toBe('2026-11-18');
      expect(segments()[1]!.value).toBe('18');
    },
  );

  test('clear() of the field gives update only', async () => {
    const log: string[] = [];
    const { exposed, segments } = await mountPicker({
      root: logged(log, { defaultValue: day('2026-11-18') }),
    });
    exposed.field.clear();
    await nextTick();
    expect(log).toEqual(['update null']);
    expect(segments().map((segment) => segment.value)).toEqual(['', '', '']);
  });

  describe.each([
    { order: 'the field root first', reversed: false },
    { order: 'the field part first', reversed: true },
  ])('VUE-21: a native reset clears the error of the field, with $order', ({ reversed }) => {
    const validate = () =>
      vi.fn((value: unknown) => (value === null ? 'Choose a date' : 'Wrong date'));

    test.each([
      { name: 'with a first value', first: day('2026-11-14') },
      { name: 'with no first value', first: undefined },
    ])(
      'starts no validation for the value of the reset, and validates the next entry, $name',
      async ({ first }) => {
        const check = validate();
        const { form, formInput, error, fieldRoot } = await mountPicker({
          root: { locale: 'en-US', defaultValue: first },
          fieldRoot: {
            name: 'when',
            validate: check,
            validationMode: 'change',
            'data-testid': 'field',
          },
        });
        await fill(formInput, '2026-11-15');
        expect(error()).toHaveTextContent('Wrong date');
        check.mockClear();
        await resetForm(form, reversed);
        expect(formInput.value).toBe(first?.toString() ?? '');
        expect(check).not.toHaveBeenCalled();
        expect(error()).toBe(null);
        expect(fieldRoot()).not.toHaveAttribute('data-dirty');
        expect(fieldRoot()).not.toHaveAttribute('data-invalid');
        await fill(formInput, '2026-11-16');
        expect(check).toHaveBeenCalledTimes(1);
        expect(error()).toHaveTextContent('Wrong date');
      },
    );
  });

  test('in a Field, a press on a day removes the error that a submit showed', async () => {
    mockToday('2026-11-18');
    const { root, error, trigger } = await mountPicker({
      root: { locale: 'en-US', required: true },
      fieldRoot: { name: 'when' },
      vaseForm: true,
    });
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
    expect(error()).not.toBe(null);
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    await settle();
    expect(error()).toBe(null);
  });

  test('in a Form with an error for the field, a press on a day removes the error', async () => {
    mockToday('2026-11-18');
    const { error, trigger } = await mountPicker({
      root: { locale: 'en-US' },
      fieldRoot: { name: 'when' },
      formErrors: { when: 'Server error' },
    });
    expect(error()).toHaveTextContent('Server error');
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(dayButton('2026-11-20'));
    await settle();
    expect(error()).toBe(null);
  });

  test('in a Field, a required picker with a time field in the popup shows its error at a submit', async () => {
    const { root, error } = await mountPicker({
      root: { locale: 'en-US', open: true, required: true, granularity: 'minute' },
      fieldRoot: { name: 'when' },
      timeField: {},
      vaseForm: true,
    });
    await opened();
    await settle();
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
    expect(error()).not.toBe(null);
  });

  test('in a Field, the field is the control: the label names it, and the time field of the popup is none', async () => {
    const { root, segments, formInput, form } = await mountPicker({
      root: { locale: 'en-US', open: true, defaultValue: at('2026-11-18T10:30') },
      fieldRoot: { name: 'when' },
      timeField: {},
    });
    await opened();
    await userEvent.click(root.querySelector('label')!);
    expect(segments()[0]).toHaveFocus();
    expect(formInput).toHaveAttribute('name', 'when');
    expect([...new FormData(form).keys()]).toEqual(['when']);
  });
});

describe('VUE-112: a disabled fieldset', () => {
  test.each([
    { name: 'around the field', noField: false },
    { name: 'around the trigger of a picker with no field', noField: true },
  ])('disables the picker $name, with the parts in the popup', async ({ noField }) => {
    mockToday('2026-11-18');
    const log: string[] = [];
    const { trigger } = await mountPicker({
      root: logged(log, { open: true }),
      fieldsetDisabled: true,
      noField,
    });
    await opened();
    await waitFor(() => expect(trigger).toBeDisabled());
    expect(dayButton('2026-11-20')).toBeDisabled();
    expect(log).toEqual([]);
  });

  test('a disabled Field disables the picker', async () => {
    const { trigger, segments } = await mountPicker({
      root: { locale: 'en-US' },
      fieldRoot: { disabled: true },
    });
    expect(trigger).toBeDisabled();
    expect(segments()[0]).toBeDisabled();
  });
});
