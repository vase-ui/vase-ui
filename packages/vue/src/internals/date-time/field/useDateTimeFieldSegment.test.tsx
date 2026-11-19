import { describe, expect, it, vi } from 'vitest';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { createRenderer, fireEvent, flushMicrotasks, pasteText, screen } from '#test-utils';
import DateTimeFieldProbe from '../../../../test/fixtures/DateTimeFieldProbe.vue';
import { formatter } from '../format';
import { getDayPeriodTexts } from './segmentLayout';

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const valuesOf = (container: Element) =>
  Array.from(container.querySelectorAll<HTMLInputElement>('input[data-type]'), (input) => [
    input.getAttribute('data-type'),
    input.value,
  ]);

type Props = Record<string, unknown>;

describe('useDateTimeFieldSegment', () => {
  const { render } = createRenderer();

  async function setup(props: Props) {
    const onValueChange = vi.fn();
    const result = await render(
      <DateTimeFieldProbe locale="en-US" onValueChange={onValueChange} {...props} />,
    );
    return { ...result, onValueChange };
  }

  const lastValue = (onValueChange: ReturnType<typeof vi.fn>) =>
    (onValueChange.mock.calls.at(-1)?.[0] as { toString(): string } | null)?.toString();
  const lastReason = (onValueChange: ReturnType<typeof vi.fn>) =>
    (onValueChange.mock.calls.at(-1)?.[1] as { reason: string }).reason;

  describe('keys', () => {
    it.each([
      {
        name: 'month up from 12',
        segment: 'month',
        value: '2026-12-14',
        key: '{ArrowUp}',
        expected: '2026-01-14',
      },
      {
        name: 'month down from 1',
        segment: 'month',
        value: '2026-01-14',
        key: '{ArrowDown}',
        expected: '2026-12-14',
      },
      {
        name: 'day up past the end of a month',
        segment: 'day',
        value: '2026-11-30',
        key: '{ArrowUp}',
        expected: '2026-11-01',
      },
      {
        name: 'day down from 1 in a leap February',
        segment: 'day',
        value: '2028-02-01',
        key: '{ArrowDown}',
        expected: '2028-02-29',
      },
      {
        name: 'year up',
        segment: 'year',
        value: '2026-11-14',
        key: '{ArrowUp}',
        expected: '2027-11-14',
      },
      {
        name: 'hour up from 23',
        segment: 'hour',
        value: '2026-11-14T23:30',
        key: '{ArrowUp}',
        expected: '2026-11-14T00:30:00',
      },
      {
        name: 'minute down from 0',
        segment: 'minute',
        value: '2026-11-14T10:00',
        key: '{ArrowDown}',
        expected: '2026-11-14T10:59:00',
      },
      {
        name: 'month Page Up',
        segment: 'month',
        value: '2026-11-14',
        key: '{PageUp}',
        expected: '2026-01-14',
      },
      {
        name: 'month Page Down',
        segment: 'month',
        value: '2026-02-14',
        key: '{PageDown}',
        expected: '2026-12-14',
      },
      {
        name: 'year Page Up',
        segment: 'year',
        value: '2026-11-14',
        key: '{PageUp}',
        expected: '2031-11-14',
      },
      {
        name: 'day Page Down',
        segment: 'day',
        value: '2026-11-04',
        key: '{PageDown}',
        expected: '2026-11-27',
      },
      {
        name: 'hour Page Up',
        segment: 'hour',
        value: '2026-11-14T10:30',
        key: '{PageUp}',
        expected: '2026-11-14T12:30:00',
      },
      {
        name: 'minute Page Up',
        segment: 'minute',
        value: '2026-11-14T10:50',
        key: '{PageUp}',
        expected: '2026-11-14T10:05:00',
      },
      {
        name: 'month Home',
        segment: 'month',
        value: '2026-11-14',
        key: '{Home}',
        expected: '2026-01-14',
      },
      {
        name: 'month End',
        segment: 'month',
        value: '2026-11-14',
        key: '{End}',
        expected: '2026-12-14',
      },
      {
        name: 'day End',
        segment: 'day',
        value: '2026-11-14',
        key: '{End}',
        expected: '2026-11-30',
      },
      {
        name: 'day End in a leap February',
        segment: 'day',
        value: '2028-02-14',
        key: '{End}',
        expected: '2028-02-29',
      },
      {
        name: 'year Home',
        segment: 'year',
        value: '2026-11-14',
        key: '{Home}',
        expected: '0001-11-14',
      },
      {
        name: 'year End',
        segment: 'year',
        value: '2026-11-14',
        key: '{End}',
        expected: '9999-11-14',
      },
      {
        name: 'hour End',
        segment: 'hour',
        value: '2026-11-14T10:30',
        key: '{End}',
        expected: '2026-11-14T23:30:00',
      },
      {
        name: 'minute Home',
        segment: 'minute',
        value: '2026-11-14T10:30',
        key: '{Home}',
        expected: '2026-11-14T10:00:00',
      },
    ])('moves the $name', async ({ segment, value, key, expected }) => {
      const { container, user, onValueChange } = await setup({
        defaultValue: value,
        hourCycle: 24,
      });

      await user.click(segmentOf(container, segment));
      await user.keyboard(key);

      expect(lastValue(onValueChange)).toBe(expected);
      expect(lastReason(onValueChange)).toBe('keyboard');
    });

    it('moves a month that has fewer days than the day', async () => {
      const { container, user, onValueChange } = await setup({ defaultValue: '2026-03-31' });

      await user.click(segmentOf(container, 'month'));
      await user.keyboard('{ArrowDown}');

      expect(lastValue(onValueChange)).toBe('2026-02-28');
    });

    it('moves a year of a leap day to the last day of February', async () => {
      const { container, user, onValueChange } = await setup({ defaultValue: '2028-02-29' });

      await user.click(segmentOf(container, 'year'));
      await user.keyboard('{ArrowUp}');

      expect(lastValue(onValueChange)).toBe('2029-02-28');
    });

    it('moves the hour of a 12-hour cycle inside its day period', async () => {
      const { container, user, onValueChange } = await setup({
        family: 'time',
        defaultValue: '11:30:10',
        granularity: 'second',
      });

      await user.click(segmentOf(container, 'hour'));
      await user.keyboard('{ArrowUp}');

      expect(lastValue(onValueChange)).toBe('00:30:10');
      expect(segmentOf(container, 'hour').value).toBe('12');
      expect(segmentOf(container, 'dayPeriod').value).toBe(getDayPeriodTexts('en-US').am);

      await user.click(segmentOf(container, 'second'));
      await user.keyboard('{End}');
      expect(lastValue(onValueChange)).toBe('00:30:59');
    });

    it.each([
      { name: 'month', segment: 'month', key: '{ArrowUp}', expected: 3 },
      { name: 'day', segment: 'day', key: '{ArrowUp}', expected: 9 },
      { name: 'year', segment: 'year', key: '{ArrowUp}', expected: 2025 },
      { name: 'hour', segment: 'hour', key: '{ArrowUp}', expected: 10 },
      { name: 'minute', segment: 'minute', key: '{ArrowUp}', expected: 30 },
    ])('gives an empty $name its number from referenceDate', async ({ segment, key, expected }) => {
      const { container, user } = await setup({
        referenceDate: '2025-03-09T10:30',
        hourCycle: 24,
      });

      await user.click(segmentOf(container, segment));
      await user.keyboard(key);

      expect(Number(segmentOf(container, segment).value)).toBe(expected);
    });

    it('gives an empty segment the least number with no key that adds', async () => {
      const { container, user } = await setup({ referenceDate: '2025-03-09' });

      await user.click(segmentOf(container, 'month'));
      await user.keyboard('{Home}');
      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{End}');

      expect(segmentOf(container, 'month').value).toBe('1');
      expect(segmentOf(container, 'day').value).toBe('31');
    });

    it('moves the day period with Up and Down, and sets it with Home and End', async () => {
      const { container, user } = await setup({ family: 'time', defaultValue: '10:30' });
      const texts = getDayPeriodTexts('en-US');
      const period = segmentOf(container, 'dayPeriod');

      await user.click(period);
      await user.keyboard('{ArrowUp}');
      expect(period.value).toBe(texts.pm);
      await user.keyboard('{ArrowDown}');
      expect(period.value).toBe(texts.am);
      await user.keyboard('{End}');
      expect(period.value).toBe(texts.pm);
      await user.keyboard('{Home}');
      expect(period.value).toBe(texts.am);
    });

    it('moves the focus with Left and Right, and stops at the first and the last segment', async () => {
      const { container, user } = await setup({ defaultValue: '2026-11-14' });

      await user.click(segmentOf(container, 'month'));
      await user.keyboard('{ArrowLeft}');
      expect(segmentOf(container, 'month')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(segmentOf(container, 'day')).toHaveFocus();
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(segmentOf(container, 'year')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(segmentOf(container, 'day')).toHaveFocus();
    });

    it.each([
      { direction: 'ltr', next: 'ArrowRight', previous: 'ArrowLeft' },
      { direction: 'rtl', next: 'ArrowLeft', previous: 'ArrowRight' },
    ] as const)('moves the focus with $next in the direction $direction', async (row) => {
      const { container, user } = await render(
        <DirectionProvider direction={row.direction}>
          <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" />
        </DirectionProvider>,
      );

      await user.click(segmentOf(container, 'month'));
      await user.keyboard(`{${row.next}}`);
      expect(segmentOf(container, 'day')).toHaveFocus();
      await user.keyboard(`{${row.previous}}`);
      expect(segmentOf(container, 'month')).toHaveFocus();
    });

    it('is in the Tab sequence with each segment', async () => {
      const { container, user } = await setup({ defaultValue: '2026-11-14' });

      await user.tab();
      expect(segmentOf(container, 'month')).toHaveFocus();
      expect(segmentOf(container, 'month')).not.toHaveAttribute('tabindex');
      await user.tab();
      expect(segmentOf(container, 'day')).toHaveFocus();
      await user.tab();
      expect(segmentOf(container, 'year')).toHaveFocus();
    });

    it.each([
      { name: 'a read-only field', props: { readOnly: true } },
      { name: 'a disabled field', props: { disabled: true } },
    ])('changes nothing in $name', async ({ props }) => {
      const { container, onValueChange } = await setup({ defaultValue: '2026-11-14', ...props });
      const day = segmentOf(container, 'day');

      day.focus();
      for (const key of ['ArrowUp', 'PageDown', 'Home', 'Backspace', 'Delete']) {
        await fireEvent.keyDown(day, { key });
      }
      await fireEvent.input(day, { target: { value: '15' } });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(day.value).toBe('14');
    });

    it('lets a read-only field move the focus', async () => {
      const { container, user } = await setup({ defaultValue: '2026-11-14', readOnly: true });

      await user.click(segmentOf(container, 'month'));
      await user.keyboard('{ArrowRight}');

      expect(segmentOf(container, 'day')).toHaveFocus();
    });

    it('leaves a key with a modifier to the browser', async () => {
      const { container, user, onValueChange } = await setup({ defaultValue: '2026-11-14' });

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{Control>}{ArrowUp}{/Control}{Alt>}{ArrowDown}{/Alt}');

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('typing', () => {
    it.each([
      {
        name: 'a month that a second digit can grow',
        segment: 'month',
        keys: '1',
        focus: 'month',
        value: '1',
      },
      {
        name: 'a month that a second digit fills',
        segment: 'month',
        keys: '12',
        focus: 'day',
        value: '12',
      },
      {
        name: 'a month that no second digit can grow',
        segment: 'month',
        keys: '3',
        focus: 'day',
        value: '3',
      },
      {
        name: 'a month that a zero starts',
        segment: 'month',
        keys: '05',
        focus: 'day',
        value: '5',
      },
      {
        name: 'a month of 13 that starts again',
        segment: 'month',
        keys: '13',
        focus: 'day',
        value: '3',
      },
      {
        name: 'a day that a second digit can grow',
        segment: 'day',
        keys: '3',
        focus: 'day',
        value: '3',
      },
      {
        name: 'a day that no second digit can grow',
        segment: 'day',
        keys: '4',
        focus: 'year',
        value: '4',
      },
      {
        name: 'a day of 31 in a month of 30 days',
        segment: 'day',
        keys: '31',
        focus: 'day',
        value: '1',
      },
      {
        name: 'a year of four digits',
        segment: 'year',
        keys: '2027',
        focus: 'year',
        value: '2027',
      },
      {
        name: 'a year with fewer digits',
        segment: 'year',
        keys: '202',
        focus: 'year',
        value: '202',
      },
    ])('takes $name', async ({ segment, keys, focus, value }) => {
      const { container, user } = await setup({
        defaultValue: '2026-11-14',
        referenceDate: '2026-11-14',
      });
      const target = segmentOf(container, segment);

      await user.click(target);
      await user.keyboard(keys);

      expect(target.value).toBe(value);
      expect(segmentOf(container, focus)).toHaveFocus();
    });

    it('starts the digits again at each focus and after a full segment', async () => {
      const { container, user } = await setup({ defaultValue: '2026-11-14' });
      const month = segmentOf(container, 'month');

      await user.click(month);
      await user.keyboard('1');
      await user.click(segmentOf(container, 'day'));
      await user.click(month);
      await user.keyboard('2');

      expect(month.value).toBe('2');
    });

    it('ignores a letter in a numeric segment', async () => {
      const { container, user, onValueChange } = await setup({ defaultValue: '2026-11-14' });

      await user.click(segmentOf(container, 'month'));
      await user.keyboard('ab');

      expect(onValueChange).not.toHaveBeenCalled();
      expect(segmentOf(container, 'month')).toHaveFocus();
    });

    it('gives the reason input-change to a typed digit', async () => {
      const { container, user, onValueChange } = await setup({ defaultValue: '2026-11-14' });

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('2');

      expect(lastReason(onValueChange)).toBe('input-change');
    });

    it('types the hour of a 12-hour cycle with the day period', async () => {
      const { container, user, onValueChange } = await setup({
        family: 'time',
        defaultValue: '15:30',
      });

      await user.click(segmentOf(container, 'hour'));
      await user.keyboard('12');
      expect(lastValue(onValueChange)).toBe('12:30:00');

      await user.click(segmentOf(container, 'dayPeriod'));
      await user.keyboard('a');
      expect(lastValue(onValueChange)).toBe('00:30:00');
    });

    it.each([
      { name: 'p for PM', start: '03:30', keys: 'p', expected: '15:30:00' },
      { name: 'A for AM', start: '15:30', keys: 'A', expected: '03:30:00' },
      { name: 'x for neither', start: '03:30', keys: 'x', expected: undefined },
    ])('takes the letter $name', async ({ start, keys, expected }) => {
      const { container, user, onValueChange } = await setup({
        family: 'time',
        defaultValue: start,
      });

      await user.click(segmentOf(container, 'dayPeriod'));
      await user.keyboard(keys);

      expect(lastValue(onValueChange)).toBe(expected);
    });

    it('types the digits of the numbering system of the locale, and ASCII digits', async () => {
      const { container, user } = await setup({
        locale: 'ar-EG',
        defaultValue: '2026-11-14',
        referenceDate: '2026-11-14',
      });
      const [first, second] = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[data-type]'),
      );
      const digits = new Intl.NumberFormat('ar-EG', { useGrouping: false });

      await user.click(first!);
      await user.keyboard(digits.format(1) + digits.format(2));
      expect(first!.getAttribute('aria-valuenow')).toBe('12');
      expect(first!.value).toBe(digits.format(12));

      await user.click(second!);
      await user.keyboard('2');
      expect(second!.getAttribute('aria-valuenow')).toBe('2');
    });

    it('takes a digit from a keyboard that sends only beforeinput, and ignores text that is not a digit', async () => {
      const { container, onValueChange } = await setup({
        defaultValue: '2026-11-14',
        referenceDate: '2026-11-14',
      });
      const month = segmentOf(container, 'month');
      const insert = (data: string) =>
        fireEvent(
          month,
          new InputEvent('beforeinput', { inputType: 'insertText', data, cancelable: true }),
        );

      month.focus();
      expect(await insert('x')).toBe(false);
      expect(onValueChange).not.toHaveBeenCalled();
      await insert('4');

      expect(month.getAttribute('aria-valuenow')).toBe('4');
    });

    it('removes a digit for a deleteContent input, with the reason input-clear', async () => {
      const { container, onValueChange } = await setup({ defaultValue: '2026-11-14' });
      const month = segmentOf(container, 'month');

      month.focus();
      await fireEvent(
        month,
        new InputEvent('beforeinput', { inputType: 'deleteContentBackward', cancelable: true }),
      );

      expect(month.getAttribute('aria-valuenow')).toBe('1');
      expect(lastReason(onValueChange)).toBe('input-clear');
    });

    it('takes text that the browser changed with no beforeinput', async () => {
      const { container, onValueChange } = await setup({
        defaultValue: '2026-11-14',
        referenceDate: '2026-11-14',
      });
      const month = segmentOf(container, 'month');

      await fireEvent.input(month, { target: { value: '12' } });
      expect(lastValue(onValueChange)).toBe('2026-12-14');
      expect(month.value).toBe('12');

      await fireEvent.input(month, { target: { value: '' } });
      expect(month.value).toBe('12');
    });

    it.each([
      { name: 'Backspace', key: '{Backspace}', expected: ['1', ''] },
      { name: 'Delete', key: '{Delete}', expected: ['1', ''] },
    ])('removes the last digit with $name, one digit at a time', async ({ key, expected }) => {
      const { container, user } = await setup({ defaultValue: '2026-11-14' });
      const month = segmentOf(container, 'month');

      await user.click(month);
      await user.keyboard(key);
      expect(month.value).toBe(expected[0]);
      await user.keyboard(key);
      expect(month.value).toBe(expected[1]);
    });

    it('moves to the segment before with Backspace in an empty segment, and not with Delete', async () => {
      const { container, user } = await setup({
        defaultValue: '2026-11-14',
        referenceDate: '2026-11-14',
      });
      await user.click(screen.getByTestId('clear'));
      const day = segmentOf(container, 'day');

      await user.click(day);
      await user.keyboard('{Delete}');
      expect(day).toHaveFocus();
      await user.keyboard('{Backspace}');
      expect(segmentOf(container, 'month')).toHaveFocus();
    });

    it('removes the day period with Backspace', async () => {
      const { container, user } = await setup({ family: 'time', defaultValue: '10:30' });
      const period = segmentOf(container, 'dayPeriod');

      await user.click(period);
      await user.keyboard('{Backspace}');

      expect(period.value).toBe('');
      expect(period).toHaveAttribute('aria-valuetext', 'Empty');
    });
  });

  describe('paste', () => {
    it.each([
      { name: 'an ISO date', text: '2027-05-17', expected: '2027-05-17' },
      { name: 'a date in the layout of the locale', text: '5/17/2027', expected: '2027-05-17' },
      { name: 'a date with white space around', text: '  2027-05-17\n', expected: '2027-05-17' },
    ])('takes $name', async ({ text, expected }) => {
      const { container, onValueChange } = await setup({ defaultValue: '2026-11-14' });

      segmentOf(container, 'day').focus();
      await pasteText(segmentOf(container, 'day'), text);

      expect(lastValue(onValueChange)).toBe(expected);
      expect(lastReason(onValueChange)).toBe('input-paste');
      expect(segmentOf(container, 'year').value).toBe('2027');
    });

    it('takes a date and time in the layout of the locale, and the digits of its numbering system', async () => {
      const { container, onValueChange } = await setup({
        locale: 'ar-EG',
        defaultValue: '2026-11-14T10:30',
        hourCycle: 24,
      });
      const digits = new Intl.NumberFormat('ar-EG', { useGrouping: false });
      const arabic = (value: number) => digits.format(value);
      const first = container.querySelector<HTMLInputElement>('input[data-type]')!;

      first.focus();
      await pasteText(
        first,
        `${arabic(17)}/${arabic(5)}/${arabic(2027)} ${arabic(9)}:${arabic(45)}`,
      );

      expect(lastValue(onValueChange)).toBe('2027-05-17T09:45:00');
    });

    it('takes a time with a day period in the layout of the locale', async () => {
      const { container, onValueChange } = await setup({ family: 'time', defaultValue: '10:30' });

      segmentOf(container, 'hour').focus();
      await pasteText(segmentOf(container, 'hour'), '3:45 PM');

      expect(lastValue(onValueChange)).toBe('15:45:00');
    });

    it('takes an ISO zoned text for a zoned value, and an ISO date and time for a date and time', async () => {
      const zoned = await setup({ defaultValue: '2026-11-14T10:30[Asia/Tokyo]' });
      segmentOf(zoned.container, 'month').focus();
      await pasteText(segmentOf(zoned.container, 'month'), '2027-05-17T09:45[Asia/Tokyo]');
      expect(lastValue(zoned.onValueChange)).toBe('2027-05-17T09:45:00+09:00[Asia/Tokyo]');

      const plain = await setup({ defaultValue: '2026-11-14T10:30', hourCycle: 24 });
      const day = plain.container.querySelectorAll<HTMLInputElement>('input[data-type="day"]')[0]!;
      day.focus();
      await pasteText(day, '2027-05-17T09:45');
      expect(lastValue(plain.onValueChange)).toBe('2027-05-17T09:45:00');
    });

    it.each([
      { name: 'text that is not a date', text: 'next friday' },
      { name: 'a layout with too few numbers', text: '5/2027' },
      { name: 'an empty text', text: '' },
      { name: 'a layout with the year first', text: '2027/05/17' },
      { name: 'a day past the end of its month', text: '2/30/2027' },
      { name: 'a year above 9999', text: '5/17/999999' },
    ])('ignores $name', async ({ text }) => {
      const { container, onValueChange } = await setup({ defaultValue: '2026-11-14' });

      segmentOf(container, 'day').focus();
      const notPrevented = await pasteText(segmentOf(container, 'day'), text);

      expect(notPrevented).toBe(false);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'a read-only field', props: { readOnly: true } },
      { name: 'a disabled field', props: { disabled: true } },
    ])('changes nothing in $name', async ({ props }) => {
      const { container, onValueChange } = await setup({ defaultValue: '2026-11-14', ...props });

      await pasteText(segmentOf(container, 'day'), '2027-05-17');

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('composition', () => {
    // Safari gives the text of an IME composition through `input` events as a string that grows.
    it('buffers the text of a composition and commits it at compositionend', async () => {
      const { container, onValueChange } = await setup({
        defaultValue: '2026-11-14',
        referenceDate: '2026-11-14',
      });
      const month = segmentOf(container, 'month');

      month.focus();
      await fireEvent.compositionStart(month);
      await fireEvent.input(month, { target: { value: '1' } });
      await fireEvent.input(month, { target: { value: '12' } });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(month.value).toBe('12');

      await fireEvent.compositionEnd(month, { target: { value: '12' } });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(lastValue(onValueChange)).toBe('2026-12-14');
      expect(month.value).toBe('12');
    });

    it('does not run a key command while a composition is buffered', async () => {
      const { container, onValueChange } = await setup({ defaultValue: '2026-11-14' });
      const month = segmentOf(container, 'month');

      month.focus();
      await fireEvent.compositionStart(month);
      await fireEvent.keyDown(month, { key: 'Backspace' });
      await fireEvent.keyDown(month, { key: 'ArrowUp' });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(month).toHaveFocus();
    });

    it('does not run a key command for a keydown with the key code 229', async () => {
      const { container, onValueChange } = await setup({ defaultValue: '2026-11-14' });
      const month = segmentOf(container, 'month');

      month.focus();
      await fireEvent.keyDown(month, { key: 'Backspace', keyCode: 229, which: 229 });
      await fireEvent.keyDown(month, { key: 'ArrowUp', keyCode: 229, which: 229 });

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not commit a composition that ends after the field becomes read-only', async () => {
      const { container, setProps, onValueChange } = await setup({
        defaultValue: '2026-11-14',
        referenceDate: '2026-11-14',
      });
      const month = segmentOf(container, 'month');

      month.focus();
      await fireEvent.compositionStart(month);
      await fireEvent.input(month, { target: { value: '5' } });
      await setProps({ readOnly: true });
      await fireEvent.compositionEnd(month, { target: { value: '5' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(month.value).toBe('11');
    });
  });

  describe('focus', () => {
    it('selects the whole text of a segment at each focus', async () => {
      const { container, user } = await setup({ defaultValue: '2026-11-14' });
      const year = segmentOf(container, 'year');

      year.focus();
      expect([year.selectionStart, year.selectionEnd]).toEqual([0, 4]);

      const month = segmentOf(container, 'month');
      await user.click(month);
      expect([month.selectionStart, month.selectionEnd]).toEqual([0, 2]);

      await user.keyboard('{ArrowRight}');
      const day = segmentOf(container, 'day');
      expect([day.selectionStart, day.selectionEnd]).toEqual([0, 2]);
    });

    it('selects the whole text again when the user presses the segment that has the focus', async () => {
      const { container, user } = await setup({ defaultValue: '2026-11-14' });
      const month = segmentOf(container, 'month');

      await user.click(month);
      await user.keyboard('1');
      expect([month.selectionStart, month.selectionEnd]).toEqual([1, 1]);

      await user.click(month);

      expect([month.selectionStart, month.selectionEnd]).toEqual([0, 1]);
    });

    it('gives the focus to the first segment for a press on the input outside a segment', async () => {
      const { container } = await setup({ referenceDate: '2026-11-14' });

      await fireEvent.mouseDown(screen.getByTestId('input'));

      expect(segmentOf(container, 'month')).toHaveFocus();
    });

    it('gives the focus to the first empty segment, and to the first segment when none is empty', async () => {
      const { container, user } = await setup({
        defaultValue: '2026-11-14',
        referenceDate: '2026-11-14',
      });
      const input = screen.getByTestId('input');

      await user.click(segmentOf(container, 'day'));
      await user.keyboard('{Backspace}{Backspace}');
      segmentOf(container, 'day').blur();
      await fireEvent.mouseDown(input);
      expect(segmentOf(container, 'day')).toHaveFocus();

      await user.keyboard('4');
      segmentOf(container, 'year').focus();
      segmentOf(container, 'year').blur();
      await fireEvent.mouseDown(input);
      expect(segmentOf(container, 'month')).toHaveFocus();
    });
  });

  describe('attributes', () => {
    it('names each segment from Intl.DisplayNames, and gives the number and its range', async () => {
      const { container } = await setup({ defaultValue: '2028-02-14T09:30', locale: 'de-DE' });
      const names = new Intl.DisplayNames('de-DE', { type: 'dateTimeField' });
      const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' }).format(
        Date.UTC(2028, 1, 14),
      );

      for (const type of ['day', 'month', 'year', 'hour', 'minute']) {
        expect(segmentOf(container, type)).toHaveAttribute('aria-label', names.of(type));
      }
      expect(segmentOf(container, 'month')).toHaveAttribute('aria-valuetext', monthName);
      expect(segmentOf(container, 'month')).toHaveAttribute('aria-valuemax', '12');
      expect(segmentOf(container, 'day')).toHaveAttribute('aria-valuemax', '29');
      expect(segmentOf(container, 'day')).toHaveAttribute('aria-valuenow', '14');
      expect(segmentOf(container, 'hour')).toHaveAttribute('aria-valuemax', '23');
      expect(segmentOf(container, 'minute')).not.toHaveAttribute('aria-valuetext');
    });

    it('names the month in the calendar that the field shows', async () => {
      const { container } = await setup({ defaultValue: '2026-11-14', calendar: 'persian' });
      const [format, epoch] = formatter(
        Temporal.PlainDate.from('2026-11-14').withCalendar('persian'),
        { month: 'long' },
        'en-US',
      );

      expect(segmentOf(container, 'month')).toHaveAttribute('aria-valuetext', format.format(epoch));
    });

    it.each([
      { name: 'a numeric segment', type: 'hour', inputmode: 'numeric' },
      { name: 'the day period', type: 'dayPeriod', inputmode: 'text' },
    ])('sets the input mode and the role of $name', async ({ type, inputmode }) => {
      const { container } = await setup({ family: 'time', defaultValue: '10:30' });
      const segment = segmentOf(container, type);

      expect(segment).toHaveAttribute('inputmode', inputmode);
      expect(segment).toHaveAttribute('role', 'spinbutton');
      expect(segment).toHaveAttribute('autocomplete', 'off');
      expect(segment).not.toHaveAttribute('name');
    });

    it('sizes a segment to its greatest length, and gives a placeholder to an empty segment', async () => {
      const { container } = await setup({ referenceDate: '2026-11-14' });

      expect(segmentOf(container, 'year')).toHaveAttribute('size', '4');
      expect(segmentOf(container, 'month')).toHaveAttribute('size', '2');
      expect(valuesOf(container)).toEqual([
        ['month', ''],
        ['day', ''],
        ['year', ''],
      ]);
      expect(segmentOf(container, 'year')).toHaveAttribute('placeholder', 'yyyy');
      expect(segmentOf(container, 'year')).toHaveAttribute('aria-valuetext', 'Empty');
      expect(segmentOf(container, 'year')).not.toHaveAttribute('aria-valuenow');
      expect(segmentOf(container, 'year')).toHaveAttribute('data-placeholder');
    });

    it('marks each segment required when the field is required', async () => {
      const { container } = await setup({ defaultValue: '2026-11-14', required: true });

      expect(segmentOf(container, 'day')).toHaveAttribute('aria-required', 'true');
      expect(segmentOf(container, 'day')).not.toHaveAttribute('aria-invalid');
    });
  });
});
