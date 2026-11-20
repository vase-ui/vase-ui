import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  TimePickerRootChangeEventDetails,
  TimePickerRootOpenChangeEventDetails,
} from '@vase-ui/vue/time-picker';
import PickerPartAlone from '../../test/fixtures/PickerPartAlone.vue';
import TimePickerParts from '../../test/fixtures/TimePickerParts.vue';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const time = (text: string) => Temporal.PlainTime.from(text);

const popup = () => document.querySelector<HTMLElement>('[data-testid="popup"]');
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const options = (id: string) => [...byTestId(id).querySelectorAll<HTMLButtonElement>('[role="option"]')];
const option = (id: string, text: string) => options(id).find((each) => each.textContent === text)!;

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
    onValueChange: (value: unknown, details: TimePickerRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: unknown) => log.push(`update ${String(value)}`),
    onOpenChange: (open: boolean, details: TimePickerRootOpenChangeEventDetails) =>
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
  const { root, exposed } = mount(TimePickerParts, setup);
  await nextTick();
  const query = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector<T & HTMLElement>(selector);
  return {
    root,
    exposed,
    segments: () => [...root.querySelectorAll<HTMLInputElement>('[role="group"] [role="spinbutton"]')],
    formInput: query<HTMLInputElement>('input[aria-hidden]')!,
    trigger: query<HTMLButtonElement>('[data-testid="trigger"]')!,
    form: query<HTMLFormElement>('form')!,
    error: () => query('#error'),
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

async function fill(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}

describe('the parts', () => {
  test.each(['Field', 'Trigger', 'Positioner', 'Popup', 'List', 'Item', 'Column', 'ColumnItem', 'Clock'])(
    'TimePicker.%s outside TimePicker.Root throws an error that names both',
    (part) => {
      expect(String(mountError(PickerPartAlone, { family: 'TimePicker', part }))).toMatch(
        `<TimePicker.${part}> must be inside <TimePicker.Root>`,
      );
      takeReportedMessages();
    },
  );

  test('the slots of the trigger have the time in the locale, with the seconds and the zone', async () => {
    const props = reactive<Props>({ locale: 'en-US', modelValue: time('15:04') });
    const { trigger } = await mountPicker({ root: props });
    expect(trigger).toHaveTextContent('3:04 PM');
    props.granularity = 'second';
    props.modelValue = time('15:04:05');
    await nextTick();
    expect(trigger).toHaveTextContent('3:04:05 PM');
    props.modelValue = Temporal.ZonedDateTime.from('2026-11-18T15:04:05[UTC]');
    await nextTick();
    expect(trigger).toHaveTextContent('3:04:05 PM UTC');
    props.modelValue = null;
    await nextTick();
    expect(trigger).toHaveTextContent('Choose');
  });
});

describe('the list', () => {
  test('a listbox of buttons with the role option, in the locale and the hour cycle, by the step from min to max', async () => {
    const props = reactive<Props>({ locale: 'en-US', defaultOpen: true, min: time('09:00'), max: time('11:00') });
    await mountPicker({ root: props, list: { step: 45 } });
    await opened();
    const list = byTestId('list');
    expect(list).toHaveAttribute('role', 'listbox');
    expect(list).toHaveAttribute('aria-label', 'Times');
    expect(options('list').map((each) => each.textContent)).toEqual(['9:00 AM', '9:45 AM', '10:30 AM']);
    const [first] = options('list');
    expect(first).toHaveAttribute('type', 'button');
    expect(first).toHaveAttribute('aria-selected', 'false');
    expect(first).toHaveAttribute('data-allow-mismatch', 'text');
    props.hourCycle = 24;
    await nextTick();
    expect(options('list').map((each) => each.textContent)).toEqual(['09:00', '09:45', '10:30']);
  });

  test('a press on an item gives the time with the kind and the date of the template, and closes the popup', async () => {
    const log: string[] = [];
    const { trigger } = await mountPicker({
      root: logged(log, { referenceDate: Temporal.PlainDateTime.from('2026-11-18T08:00') }),
    });
    await userEvent.click(trigger);
    await opened();
    await userEvent.click(option('list', '9:30 AM'));
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'valueChange 2026-11-18T09:30:00 item-press',
      'update 2026-11-18T09:30:00',
      'openChange false imperative-action',
    ]);
  });

  test('a press on the selected item changes nothing and closes; a cancel keeps the popup open', async () => {
    const log: string[] = [];
    const props = logged(log, { defaultValue: time('09:30'), defaultOpen: true });
    await mountPicker({ root: props });
    await opened();
    expect(option('list', '9:30 AM')).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(option('list', '9:30 AM'));
    await closed();
    expect(log).toEqual(['openChange false imperative-action']);
  });

  test('a cancel of the change keeps the value and the popup; a read-only picker selects nothing', async () => {
    const log: string[] = [];
    const props = logged(log, {
      defaultOpen: true,
      onValueChange: (_: unknown, details: TimePickerRootChangeEventDetails) => details.cancel(),
    });
    await mountPicker({ root: props });
    await opened();
    await userEvent.click(option('list', '9:30 AM'));
    await settle();
    expect(popup()).not.toBe(null);
    expect(option('list', '9:30 AM')).toHaveAttribute('aria-selected', 'false');
    props.onValueChange = undefined;
    props.readonly = true;
    await nextTick();
    expect(byTestId('list')).toHaveAttribute('aria-readonly', 'true');
    await userEvent.click(option('list', '9:30 AM'));
    await settle();
    expect(log).toEqual([]);
  });

  test('the tab stop is the selected item, else the first enabled item; the keys move it and go over a disabled item', async () => {
    const { root } = await mountPicker({ root: { locale: 'en-US', defaultOpen: true, max: time('01:30') } });
    await opened();
    const items = options('list');
    expect(items.map((item) => item.tabIndex)).toEqual([0, -1, -1, -1]);
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(items[3]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(items[3]).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(items[0]).toHaveFocus();
    expect(root).toBeTruthy();
  });

  test('a list that scrolls shows its selected item after the open, and the page does not scroll', async () => {
    const { trigger } = await mountPicker({
      root: { locale: 'en-US', defaultValue: time('20:00') },
      list: { style: 'height: 80px; overflow: auto' },
    });
    const pageScroll = document.scrollingElement!.scrollTop;
    await userEvent.click(trigger);
    await opened();
    const selected = option('list', '8:00 PM');
    await waitFor(() => expect(selected).toHaveFocus());
    const list = byTestId('list').getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    expect(item.top).toBeGreaterThanOrEqual(list.top);
    expect(item.bottom).toBeLessThanOrEqual(list.bottom + 1);
    expect(document.scrollingElement!.scrollTop).toBe(pageScroll);
  });

  test('a list in a popup that scrolls shows its selected item after the open', async () => {
    const { trigger } = await mountPicker({
      root: { locale: 'en-US', defaultValue: time('20:00') },
      popup: { style: 'height: 80px; overflow: auto' },
    });
    await userEvent.click(trigger);
    const element = await opened();
    const selected = option('list', '8:00 PM');
    await waitFor(() => expect(selected).toHaveFocus());
    expect(element.scrollTop).toBeGreaterThan(0);
    expect(selected.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      element.getBoundingClientRect().bottom + 1,
    );
  });

  test('a list outside the popup and before it in the document does not take the first focus', async () => {
    await mountPicker({ root: { locale: 'en-US', defaultOpen: true }, listBefore: true });
    await opened();
    await waitFor(() => expect(options('list')[0]).toHaveFocus());
  });
});

describe('the columns', () => {
  test('a column is a listbox named by Intl; a column of day periods renders nothing in a 24-hour cycle', async () => {
    const props = reactive<Props>({ locale: 'en-US', defaultOpen: true });
    await mountPicker({ root: props, parts: ['hour', 'minute', 'dayPeriod'], column: { step: 15 } });
    await opened();
    expect(byTestId('hour')).toHaveAttribute('role', 'listbox');
    expect(byTestId('hour')).toHaveAttribute('aria-label', 'hour');
    expect(byTestId('hour')).toHaveAttribute('data-allow-mismatch', 'attribute');
    expect(options('hour')[0]).toHaveTextContent('12');
    expect(options('minute').map((each) => each.textContent)).toEqual(['00', '15', '30', '45']);
    expect(options('dayPeriod').map((each) => each.textContent)).toEqual(['AM', 'PM']);
    props.hourCycle = 24;
    await nextTick();
    expect(document.querySelector('[data-testid="dayPeriod"]')).toBe(null);
  });

  test('a press sets the unit and keeps the other units; it closes only with closeOnSelect', async () => {
    const log: string[] = [];
    const props = model(log, time('09:30'), { defaultOpen: true });
    await mountPicker({ root: props, parts: ['hour', 'minute', 'dayPeriod'] });
    await opened();
    await userEvent.click(option('minute', '45'));
    await userEvent.click(option('dayPeriod', 'PM'));
    expect(popup()).not.toBe(null);
    props.closeOnSelect = true;
    await nextTick();
    await userEvent.click(option('hour', '3'));
    await closed();
    expect(log).toEqual([
      'valueChange 09:45:00 item-press',
      'update 09:45:00',
      'valueChange 21:45:00 item-press',
      'update 21:45:00',
      'valueChange 15:45:00 item-press',
      'update 15:45:00',
      'openChange false imperative-action',
    ]);
  });

  test('an item with no time in min and max is disabled, and a press puts the time into the limits', async () => {
    const log: string[] = [];
    await mountPicker({
      root: model(log, time('09:50'), { defaultOpen: true, min: time('09:10'), max: time('10:20') }),
      parts: ['hour', 'minute'],
    });
    await opened();
    expect(option('hour', '8')).toBeDisabled();
    expect(option('hour', '10')).toBeEnabled();
    await userEvent.click(option('hour', '10'));
    expect(log).toEqual(['valueChange 10:20:00 item-press', 'update 10:20:00']);
  });

  test('a cleared picker with a reference date: a press in the minute column keeps the hour of the reference date', async () => {
    const log: string[] = [];
    const props = model(log, time('15:30'), { referenceDate: time('08:00'), defaultOpen: true });
    const { exposed } = await mountPicker({ root: props, parts: ['minute', 'clock'] });
    await opened();
    exposed.field.clear();
    await nextTick();
    const face = byTestId('face').querySelector('input')!;
    expect(face.value).toBe('8');
    await userEvent.click(option('minute', '15'));
    expect(log).toEqual(['update null', 'valueChange 08:15:00 item-press', 'update 08:15:00']);
  });
});

describe('the clock', () => {
  test('the commit of the last view closes the popup; the views change with v-model:view and come back at each open', async () => {
    const log: string[] = [];
    const props = logged(log, { defaultValue: time('09:30') });
    const views: string[] = [];
    const { trigger } = await mountPicker({
      root: props,
      parts: ['clock'],
      clock: { 'onUpdate:view': (view: string) => views.push(view) },
    });
    await userEvent.click(trigger);
    await opened();
    const face = () => byTestId('face').querySelector('input')!;
    await waitFor(() => expect(face()).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    expect(popup()).not.toBe(null);
    expect(face()).toHaveAccessibleName('minute');
    await userEvent.keyboard('{Enter}');
    await closed();
    expect(views).toEqual(['minute']);
    await userEvent.click(trigger);
    await opened();
    await waitFor(() => expect(face()).toHaveFocus());
    expect(face()).toHaveAccessibleName('hour');
    expect(log).toEqual([
      'openChange true trigger-press',
      'openChange false imperative-action',
      'openChange true trigger-press',
    ]);
  });

  test('valueCommitted and viewChange reach the clock, and details.cancel() keeps the view', async () => {
    const log: string[] = [];
    await mountPicker({
      root: { locale: 'en-US', defaultOpen: true, defaultValue: time('09:30') },
      parts: ['clock'],
      clock: {
        onValueCommitted: (value: unknown) => log.push(`committed ${String(value)}`),
        onViewChange: (view: string, details: { cancel(): void }) => {
          log.push(`viewChange ${view}`);
          details.cancel();
        },
      },
    });
    await opened();
    const face = byTestId('face').querySelector('input')!;
    await waitFor(() => expect(face).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    expect(log).toEqual(['committed 09:30:00', 'viewChange minute']);
    expect(face).toHaveAccessibleName('hour');
  });
});

describe('the first focus', () => {
  test.each([
    { parts: ['list', 'hour', 'clock'], first: 'list' },
    { parts: ['hour', 'list', 'clock'], first: 'hour' },
    { parts: ['clock', 'hour', 'list'], first: 'clock' },
  ] as const)('goes to the first of $parts', async ({ parts, first }) => {
    await mountPicker({ root: { locale: 'en-US', defaultOpen: true, defaultValue: time('01:00') }, parts: [...parts] });
    await opened();
    const target =
      first === 'clock' ? byTestId('face').querySelector('input')! : byTestId(first).querySelector('[tabindex="0"]')!;
    await waitFor(() => expect(target).toHaveFocus());
  });

  test('the tab stop of a column with a disabled first item is the first enabled item', async () => {
    await mountPicker({
      root: { locale: 'en-US', defaultOpen: true, hourCycle: 24, min: time('02:00') },
      parts: ['hour'],
    });
    await opened();
    await waitFor(() => expect(option('hour', '02')).toHaveFocus());
    expect(option('hour', '00')).toBeDisabled();
  });
});

describe('the form', () => {
  test('a reset gives one update of an uncontrolled picker and no valueChange; clear() gives update only', async () => {
    const log: string[] = [];
    const { segments, form, exposed } = await mountPicker({ root: logged(log, { defaultValue: time('09:30') }) });
    segments()[0]!.focus();
    await userEvent.keyboard('{ArrowUp}');
    log.length = 0;
    await resetForm(form);
    expect(log).toEqual(['update 09:30:00']);
    log.length = 0;
    exposed.field.clear();
    await nextTick();
    expect(log).toEqual(['update null']);
  });

  describe.each([
    { order: 'the field root first', reversed: false },
    { order: 'the field part first', reversed: true },
  ])('VUE-21: a native reset clears the error of the field, with $order', ({ reversed }) => {
    test.each([
      { name: 'with a first value', first: time('09:30') },
      { name: 'with no first value', first: undefined },
    ])('starts no validation for the value of the reset, and validates the next entry, $name', async ({ first }) => {
      const check = vi.fn((value: unknown) => (value === null ? 'Choose a time' : 'Wrong time'));
      const { form, formInput, error } = await mountPicker({
        root: { locale: 'en-US', defaultValue: first },
        fieldRoot: { name: 'when', validate: check, validationMode: 'change' },
      });
      await fill(formInput, '10:15');
      expect(error()).toHaveTextContent('Wrong time');
      check.mockClear();
      await resetForm(form, reversed);
      expect(check).not.toHaveBeenCalled();
      expect(error()).toBe(null);
      await fill(formInput, '10:45');
      expect(check).toHaveBeenCalledTimes(1);
    });
  });
});

describe('VUE-112: a disabled fieldset', () => {
  test('disables the picker with the parts in the popup', async () => {
    const log: string[] = [];
    const { trigger } = await mountPicker({
      root: logged(log, { open: true }),
      fieldsetDisabled: true,
      parts: ['list', 'hour'],
    });
    await opened();
    await waitFor(() => expect(trigger).toBeDisabled());
    expect(byTestId('list')).toHaveAttribute('aria-disabled', 'true');
    expect(options('list')[0]).toBeDisabled();
    expect(options('hour')[0]).toBeDisabled();
    expect(log).toEqual([]);
  });
});
