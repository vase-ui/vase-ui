import { describe, expect, it, vi } from 'vitest';
import { shallowReactive } from 'vue';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getRangeDayState, useRangeSelection } from './RangeCalendarRootContext';
import type { DateValue } from '../../internals/date-time/temporal';
import type { RangeCalendarRootProps } from './RangeCalendarRoot.vue';
import type { RangeCalendarHost } from './RangeCalendarRootContext';

const day = (text: string) => Temporal.PlainDate.from(text);

function texts(value: readonly (DateValue | null)[]) {
  return value.map((end) => end?.toString() ?? null);
}

function createSelection(props: RangeCalendarRootProps<DateValue> = {}, host?: RangeCalendarHost) {
  const reactiveProps = shallowReactive(props);
  const emit = vi.fn();
  const selection = useRangeSelection(reactiveProps, emit, host);
  const press = (text: string) => {
    selection.press(day(text), createChangeEventDetails(REASONS.dayPress));
  };
  const extend = (text: string, from: string) => {
    selection.extend(day(text), createChangeEventDetails(REASONS.keyboard), day(from));
  };
  const values = () => texts(selection.values.value);
  const changes = () =>
    emit.mock.calls.filter(([name]) => name === 'valueChange').map(([, value]) => texts(value));
  return { selection, props: reactiveProps, emit, press, extend, values, changes };
}

const escape = () => new KeyboardEvent('keydown', { key: 'Escape' });

describe('useRangeSelection', () => {
  it('keeps the last end when a consumer clears the range in the same task', () => {
    const { props, selection } = createSelection({ modelValue: [day('2026-11-14'), null] });
    const zoned = Temporal.ZonedDateTime.from('2026-11-16T09:30[Asia/Tokyo]');

    props.modelValue = [null, zoned];
    props.modelValue = [null, null];

    expect(selection.template.value).toBe(zoned);
  });

  describe('press', () => {
    it('starts a range at the first press and ends it at the second', () => {
      const { press, changes, emit } = createSelection();

      press('2026-11-10');
      press('2026-11-14');

      expect(changes()).toEqual([
        ['2026-11-10', null],
        ['2026-11-10', '2026-11-14'],
      ]);
      expect(emit).toHaveBeenCalledWith('update:modelValue', expect.anything());
      expect(emit.mock.calls[0]![2].reason).toBe('day-press');
    });

    it('puts the ends in the order of the calendar', () => {
      const { press, changes } = createSelection();

      press('2026-11-14');
      press('2026-11-10');

      expect(changes().at(-1)).toEqual(['2026-11-10', '2026-11-14']);
    });

    it('makes a range of one day when the first day is pressed twice', () => {
      const { press, changes, selection } = createSelection();

      press('2026-11-10');
      press('2026-11-10');

      expect(changes().at(-1)).toEqual(['2026-11-10', '2026-11-10']);
      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-10'),
      });
    });

    it('starts a new range with the press after a complete range', () => {
      const { press, changes, selection } = createSelection({
        defaultValue: [day('2026-11-03'), day('2026-11-05')],
      });

      press('2026-11-20');

      expect(changes()).toEqual([['2026-11-20', null]]);
      expect(selection.selecting.value).toBe(true);
    });

    it('gives each end the kind, the time and the zone of the end that it replaces', () => {
      const first = Temporal.ZonedDateTime.from('2026-11-02T09:00[Asia/Tokyo]');
      const last = Temporal.ZonedDateTime.from('2026-11-04T17:30[Asia/Tokyo]');
      const { press, changes } = createSelection({ defaultValue: [first, last] });

      press('2026-11-10');
      press('2026-11-12');

      expect(changes()).toEqual([
        ['2026-11-10T09:00:00+09:00[Asia/Tokyo]', null],
        ['2026-11-10T09:00:00+09:00[Asia/Tokyo]', '2026-11-12T17:30:00+09:00[Asia/Tokyo]'],
      ]);
    });

    it('gives a new end of an empty controlled range the kind of an end of defaultValue', () => {
      const { press, changes } = createSelection({
        modelValue: [null, null],
        defaultValue: [null, Temporal.ZonedDateTime.from('2026-11-04T17:30[Asia/Tokyo]')],
      });

      press('2026-11-10');

      expect(changes()).toEqual([['2026-11-10T17:30:00+09:00[Asia/Tokyo]', null]]);
    });

    it('gives a new end of an empty range a date in the ISO calendar', () => {
      const { press, selection } = createSelection({ defaultValue: [null, null] });

      press('2026-11-10');

      expect(selection.values.value[0]).toBeInstanceOf(Temporal.PlainDate);
      expect((selection.values.value[0] as Temporal.PlainDate).calendarId).toBe('iso8601');
    });

    it.each([
      { name: 'a range with fewer days than minDays', props: { minDays: 3 }, last: '2026-11-11' },
      { name: 'a range with more days than maxDays', props: { maxDays: 3 }, last: '2026-11-14' },
    ])('starts a new range at the pressed day for $name', ({ props, last }) => {
      const { press, changes } = createSelection(props);

      press('2026-11-10');
      press(last);

      expect(changes()).toEqual([
        ['2026-11-10', null],
        [last, null],
      ]);
    });

    it.each([
      { name: 'minDays', props: { minDays: 3 }, last: '2026-11-12' },
      { name: 'maxDays', props: { maxDays: 3 }, last: '2026-11-12' },
    ])('counts both ends of the range for $name', ({ props, last }) => {
      const { press, changes } = createSelection(props);

      press('2026-11-10');
      press(last);

      expect(changes().at(-1)).toEqual(['2026-11-10', last]);
    });

    it('changes nothing when a press starts the range that is in progress again', () => {
      const { press, changes } = createSelection({ minDays: 3 });

      press('2026-11-10');
      press('2026-11-10');

      expect(changes()).toEqual([['2026-11-10', null]]);
    });

    it.each([
      { name: 'a disabled day', props: { disabledDates: day('2026-11-12') } },
      { name: 'an unavailable day', props: { unavailableDates: day('2026-11-12') } },
    ])('starts a new range at the pressed day when the range crosses $name', ({ props }) => {
      const { press, changes } = createSelection(props);

      press('2026-11-10');
      press('2026-11-14');

      expect(changes()).toEqual([
        ['2026-11-10', null],
        ['2026-11-14', null],
      ]);
    });

    it.each([
      { name: 'a disabled day', props: { disabledDates: day('2026-11-12') } },
      { name: 'an unavailable day', props: { unavailableDates: day('2026-11-12') } },
    ])('makes the range over $name with allowNonContiguousRanges', ({ props }) => {
      const { press, changes, selection } = createSelection({
        ...props,
        allowNonContiguousRanges: true,
      });

      press('2026-11-10');
      press('2026-11-14');

      expect(changes().at(-1)).toEqual(['2026-11-10', '2026-11-14']);
      const state = (text: string) =>
        getRangeDayState(day(text), selection.displayRange.value, true);
      expect(state('2026-11-12')).toMatchObject({ selected: false, rangeMiddle: true });
    });

    it('makes the range of a value that has another calendar than the grid', () => {
      const { press, changes } = createSelection({
        defaultValue: [day('2026-11-02').withCalendar('persian'), null],
      });

      press('2026-11-04');

      expect(changes()).toEqual([['2026-11-02[u-ca=persian]', '2026-11-04[u-ca=persian]']]);
    });
  });

  describe('a controlled range', () => {
    it('emits the change and keeps its value until the consumer gives a new one', () => {
      const { press, props, selection, emit } = createSelection({
        modelValue: [day('2026-11-03'), day('2026-11-05')],
      });

      press('2026-11-10');

      expect(emit).toHaveBeenCalledWith('update:modelValue', expect.anything());
      expect(texts(selection.values.value)).toEqual(['2026-11-03', '2026-11-05']);

      props.modelValue = [day('2026-11-10'), null];
      expect(selection.selecting.value).toBe(true);
    });

    it('keeps the value when a listener cancels the change', () => {
      const emit = vi.fn((name: string, _value: unknown, details?: { cancel: () => void }) => {
        if (name === 'valueChange') {
          details?.cancel();
        }
      });
      const selection = useRangeSelection({ defaultValue: [day('2026-11-03'), null] }, emit);

      selection.press(day('2026-11-10'), createChangeEventDetails(REASONS.dayPress));

      expect(emit).toHaveBeenCalledTimes(1);
      expect(texts(selection.values.value)).toEqual(['2026-11-03']);
    });
  });

  describe('cancel', () => {
    it('puts back the range from before the first press', () => {
      const { press, cancel, changes, values } = withCancel({
        defaultValue: [day('2026-11-03'), day('2026-11-05')],
      });

      press('2026-11-10');
      expect(values()).toEqual(['2026-11-10']);
      expect(cancel()).toBe(true);

      expect(values()).toEqual(['2026-11-03', '2026-11-05']);
      expect(changes().at(-1)).toEqual(['2026-11-03', '2026-11-05']);
    });

    it('puts back the range from before the first press after a press that restarts the range', () => {
      const { press, cancel, values } = withCancel({
        minDays: 3,
        defaultValue: [day('2026-11-03'), day('2026-11-05')],
      });

      press('2026-11-10');
      press('2026-11-11');
      cancel();

      expect(values()).toEqual(['2026-11-03', '2026-11-05']);
    });

    it('empties a range that no earlier range preceded', () => {
      const { cancel, values } = withCancel({ defaultValue: [day('2026-11-10'), null] });

      expect(cancel()).toBe(true);

      expect(values()).toEqual([]);
    });

    it('tells that it did nothing when no range is in progress', () => {
      const { cancel, changes } = withCancel({
        defaultValue: [day('2026-11-03'), day('2026-11-05')],
      });

      expect(cancel()).toBe(false);
      expect(changes()).toEqual([]);
    });

    it('does not change the value of a read-only range', () => {
      const { cancel, changes } = withCancel({
        readOnly: true,
        defaultValue: [day('2026-11-03'), null],
      });

      expect(cancel()).toBe(false);
      expect(changes()).toEqual([]);
    });

    it('keeps the range from before the first press when a listener cancels the change', () => {
      let cancelNext = false;
      const emit = vi.fn((name: string, _value: unknown, details?: { cancel: () => void }) => {
        if (name === 'valueChange' && cancelNext) {
          cancelNext = false;
          details?.cancel();
        }
      });
      const selection = useRangeSelection(
        { defaultValue: [day('2026-11-03'), day('2026-11-05')] },
        emit,
      );
      selection.press(day('2026-11-10'), createChangeEventDetails(REASONS.dayPress));
      selection.preview(day('2026-11-12'));

      cancelNext = true;
      expect(selection.cancel(escape())).toBe(true);
      expect(texts(selection.values.value)).toEqual(['2026-11-10']);
      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-12'),
      });

      selection.cancel(escape());
      expect(texts(selection.values.value)).toEqual(['2026-11-03', '2026-11-05']);
    });

    it('gives the key as the reason of the change', () => {
      const { press, cancel, emit } = withCancel({});

      press('2026-11-10');
      cancel();

      const [, , details] = emit.mock.calls.filter(([name]) => name === 'valueChange').at(-1)!;
      expect(details.reason).toBe('keyboard');
    });

    function withCancel(props: RangeCalendarRootProps<DateValue>) {
      const created = createSelection(props);
      return { ...created, cancel: () => created.selection.cancel(escape()) };
    }
  });

  describe('extend', () => {
    it('makes the range from the day before the key to the day after it', () => {
      const { extend, changes } = createSelection();

      extend('2026-11-11', '2026-11-10');

      expect(changes()).toEqual([['2026-11-10', '2026-11-11']]);
    });

    it('keeps the first day while the keys go on from the day that the last one reached', () => {
      const { extend, changes } = createSelection();

      extend('2026-11-11', '2026-11-10');
      extend('2026-11-12', '2026-11-11');
      extend('2026-11-11', '2026-11-12');

      expect(changes().at(-1)).toEqual(['2026-11-10', '2026-11-11']);
      expect(changes()).toHaveLength(3);
    });

    it('starts again from another day when the focus moved between two keys', () => {
      const { extend, changes } = createSelection();

      extend('2026-11-11', '2026-11-10');
      extend('2026-11-21', '2026-11-20');

      expect(changes().at(-1)).toEqual(['2026-11-20', '2026-11-21']);
    });

    it('ends a range in progress at the day after the key', () => {
      const { extend, changes } = createSelection({ defaultValue: [day('2026-11-05'), null] });

      extend('2026-11-11', '2026-11-10');

      expect(changes()).toEqual([['2026-11-05', '2026-11-11']]);
    });

    it('changes nothing when the range would not be valid, and keeps the first day', () => {
      const { extend, changes } = createSelection({ maxDays: 2 });

      extend('2026-11-11', '2026-11-10');
      extend('2026-11-12', '2026-11-11');
      expect(changes()).toEqual([['2026-11-10', '2026-11-11']]);
      extend('2026-11-11', '2026-11-12');
      extend('2026-11-10', '2026-11-11');

      expect(changes().at(-1)).toEqual(['2026-11-10', '2026-11-10']);
    });
  });

  describe('preview', () => {
    it('shows the range that a press on the day makes', () => {
      const { press, selection } = createSelection();

      press('2026-11-10');
      selection.preview(day('2026-11-14'));

      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-14'),
      });
    });

    it('shows the day as the start of a new range when a press on it would start one', () => {
      const { press, selection } = createSelection({ maxDays: 3 });

      press('2026-11-10');
      selection.preview(day('2026-11-20'));

      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-20'),
        end: day('2026-11-20'),
      });
    });

    it('shows the first day alone before the pointer or the focus reaches another day', () => {
      const { press, selection } = createSelection();

      press('2026-11-10');

      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-10'),
      });
    });

    it('shows nothing of a preview when no range is in progress', () => {
      const { selection } = createSelection({
        defaultValue: [day('2026-11-03'), day('2026-11-05')],
      });

      selection.preview(day('2026-11-14'));

      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-03'),
        end: day('2026-11-05'),
      });
    });

    it('shows nothing of a preview in a read-only range', () => {
      const { selection } = createSelection({
        readOnly: true,
        defaultValue: [day('2026-11-10'), null],
      });

      selection.preview(day('2026-11-14'));

      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-10'),
      });
    });

    it('ignores a day that the user cannot select', () => {
      const { press, selection } = createSelection({ unavailableDates: day('2026-11-14') });

      press('2026-11-10');
      selection.preview(day('2026-11-12'));
      selection.preview(day('2026-11-14'));

      expect(selection.displayRange.value?.end.toString()).toBe('2026-11-12');
    });
  });

  describe('drag', () => {
    const up = () => new PointerEvent('pointerup', { pointerId: 1 });

    it('makes the range in one change when the pointer goes to another day', () => {
      const { selection, changes, emit } = createSelection();

      expect(selection.beginDrag(day('2026-11-10'), 1)).toBe(true);
      selection.dragTo(day('2026-11-12'));
      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-12'),
      });
      expect(selection.selecting.value).toBe(true);
      selection.endDrag(day('2026-11-14'), up());

      expect(changes()).toEqual([['2026-11-10', '2026-11-14']]);
      expect(emit.mock.calls[0]![2].reason).toBe('drag');
      expect(selection.selecting.value).toBe(false);
    });

    it('keeps the range of the grid until the pointer leaves its first day', () => {
      const { selection } = createSelection({
        defaultValue: [day('2026-11-03'), day('2026-11-05')],
      });

      selection.beginDrag(day('2026-11-10'), 1);

      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-03'),
        end: day('2026-11-05'),
      });
      expect(selection.selecting.value).toBe(false);

      selection.dragTo(day('2026-11-11'));

      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-11'),
      });
    });

    it('ends at the last day of the drag when the pointer is not over a day', () => {
      const { selection, changes } = createSelection();

      selection.beginDrag(day('2026-11-10'), 1);
      selection.dragTo(day('2026-11-12'));
      selection.endDrag(null, up());

      expect(changes()).toEqual([['2026-11-10', '2026-11-12']]);
    });

    it('leaves a press on one day to the click that follows', () => {
      const { selection, changes } = createSelection();

      selection.beginDrag(day('2026-11-10'), 1);
      selection.endDrag(day('2026-11-10'), up());

      expect(changes()).toEqual([]);
      expect(selection.takeClickSuppression(new MouseEvent('click', { detail: 1 }))).toBe(false);
    });

    it('makes a range of one day when the pointer returns to its first day', () => {
      const { selection, changes } = createSelection();

      selection.beginDrag(day('2026-11-10'), 1);
      selection.dragTo(day('2026-11-11'));
      selection.dragTo(day('2026-11-10'));
      selection.endDrag(day('2026-11-10'), up());

      expect(changes()).toEqual([['2026-11-10', '2026-11-10']]);
    });

    it('replaces a range in progress with the range of the drag', () => {
      const { selection, changes } = createSelection({ defaultValue: [day('2026-11-03'), null] });

      selection.beginDrag(day('2026-11-10'), 1);
      selection.endDrag(day('2026-11-12'), up());

      expect(changes()).toEqual([['2026-11-10', '2026-11-12']]);
    });

    describe('the host', () => {
      const value: RangeCalendarRootProps<DateValue> = {
        defaultValue: [day('2026-11-10'), day('2026-11-12')],
      };

      it('learns of a drag that makes the range that the value already has', () => {
        const host = { onSameRange: vi.fn() };
        const { selection, changes } = createSelection(value, host);
        const event = up();

        selection.beginDrag(day('2026-11-10'), 1);
        selection.dragTo(day('2026-11-12'));
        selection.endDrag(day('2026-11-12'), event);

        expect(changes()).toEqual([]);
        expect(host.onSameRange).toHaveBeenCalledTimes(1);
        expect(host.onSameRange).toHaveBeenCalledWith(event);
      });

      it.each([
        { name: 'a drag that makes another range', cancel: false, end: '2026-11-14' },
        { name: 'a drag that a listener cancels', cancel: true, end: '2026-11-14' },
        { name: 'a press on one day', cancel: false, end: '2026-11-10' },
      ])('does not tell the host of $name', ({ cancel, end }) => {
        const host = { onSameRange: vi.fn() };
        const { selection, emit } = createSelection(value, host);
        if (cancel) {
          emit.mockImplementation((_name, _value, details) => {
            details?.cancel();
          });
        }

        selection.beginDrag(day('2026-11-10'), 1);
        selection.dragTo(day(end));
        selection.endDrag(day(end), up());

        expect(host.onSameRange).not.toHaveBeenCalled();
      });
    });

    it('swallows the click after a drag one time, and not a click of the keyboard', () => {
      const { selection } = createSelection();

      selection.beginDrag(day('2026-11-10'), 1);
      selection.endDrag(day('2026-11-12'), up());

      expect(selection.takeClickSuppression(new MouseEvent('click', { detail: 0 }))).toBe(false);
      expect(selection.takeClickSuppression(new MouseEvent('click', { detail: 1 }))).toBe(true);
      expect(selection.takeClickSuppression(new MouseEvent('click', { detail: 1 }))).toBe(false);
    });

    it('does not keep a swallowed click for the next press', () => {
      const { selection } = createSelection();

      selection.beginDrag(day('2026-11-10'), 1);
      selection.endDrag(day('2026-11-12'), up());
      selection.beginDrag(day('2026-11-20'), 2);

      expect(selection.takeClickSuppression(new MouseEvent('click', { detail: 1 }))).toBe(false);
    });

    it('ends the range at the last day toward the pointer that keeps maxDays', () => {
      const { selection, changes } = createSelection({ maxDays: 2 });

      selection.beginDrag(day('2026-11-10'), 1);
      selection.dragTo(day('2026-11-14'));
      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-11'),
      });
      selection.endDrag(day('2026-11-14'), up());

      expect(changes()).toEqual([['2026-11-10', '2026-11-11']]);
    });

    it('makes no range when no day reaches minDays, and still swallows the click', () => {
      const { selection, changes } = createSelection({ minDays: 3 });

      selection.beginDrag(day('2026-11-10'), 1);
      selection.dragTo(day('2026-11-11'));
      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-10'),
      });
      selection.endDrag(day('2026-11-11'), up());

      expect(changes()).toEqual([]);
      expect(selection.takeClickSuppression(new MouseEvent('click', { detail: 1 }))).toBe(true);
    });

    it.each([
      { name: 'a day that the user cannot select', props: { disabledDates: day('2026-11-10') } },
      { name: 'a read-only range', props: { readOnly: true } },
      { name: 'a disabled range', props: { disabled: true } },
    ])('does not start a drag on $name', ({ props }) => {
      const { selection } = createSelection(props);

      expect(selection.beginDrag(day('2026-11-10'), 1)).toBe(false);
      expect(selection.isDragging(1)).toBe(false);
    });

    it('stops before a day that the user cannot select, and ignores another pointer', () => {
      const { selection, changes } = createSelection({ unavailableDates: day('2026-11-12') });

      selection.beginDrag(day('2026-11-10'), 1);
      selection.dragTo(day('2026-11-14'));
      expect(selection.displayRange.value).toEqual({
        start: day('2026-11-10'),
        end: day('2026-11-11'),
      });
      expect(selection.isDragging(1)).toBe(true);
      expect(selection.isDragging(2)).toBe(false);
      selection.endDrag(day('2026-11-14'), up());

      expect(changes()).toEqual([['2026-11-10', '2026-11-11']]);
    });

    it('stops when the drag is cancelled', () => {
      const { selection, changes } = createSelection();

      selection.beginDrag(day('2026-11-10'), 1);
      selection.dragTo(day('2026-11-12'));
      selection.cancelDrag();
      selection.endDrag(day('2026-11-12'), up());

      expect(changes()).toEqual([]);
      expect(selection.selecting.value).toBe(false);
    });

    it('ends the drag with Escape, tells that the key was handled, and swallows the click', () => {
      const { selection, changes } = createSelection();

      selection.beginDrag(day('2026-11-10'), 1);

      expect(selection.cancel(escape())).toBe(true);
      expect(selection.isDragging(1)).toBe(false);
      expect(selection.takeClickSuppression(new MouseEvent('click', { detail: 1 }))).toBe(true);
      expect(changes()).toEqual([]);
    });
  });

  describe('isSelected', () => {
    it('is true for each day of a range, and for the first day of a range in progress', () => {
      const complete = createSelection({ defaultValue: [day('2026-11-05'), day('2026-11-03')] });
      const progress = createSelection({ defaultValue: [null, day('2026-11-05')] });

      expect(
        ['02', '03', '04', '05', '06'].map((d) =>
          complete.selection.isSelected(day(`2026-11-${d}`)),
        ),
      ).toEqual([false, true, true, true, false]);
      expect(progress.selection.isSelected(day('2026-11-05'))).toBe(true);
      expect(progress.selection.isSelected(day('2026-11-06'))).toBe(false);
    });
  });
});

describe('getRangeDayState', () => {
  const range = { start: day('2026-11-10'), end: day('2026-11-12') };

  it.each([
    { date: '2026-11-09', expected: [false, false, false, false] },
    { date: '2026-11-10', expected: [true, true, false, false] },
    { date: '2026-11-11', expected: [true, false, false, true] },
    { date: '2026-11-12', expected: [true, false, true, false] },
    { date: '2026-11-13', expected: [false, false, false, false] },
  ])('gives $date the states $expected', ({ date, expected }) => {
    const state = getRangeDayState(day(date), range, false);

    expect([state.selected, state.rangeStart, state.rangeEnd, state.rangeMiddle]).toEqual(expected);
  });

  it('gives a range of one day both ends and no middle', () => {
    const one = { start: day('2026-11-10'), end: day('2026-11-10') };

    expect(getRangeDayState(day('2026-11-10'), one, false)).toEqual({
      selected: true,
      rangeStart: true,
      rangeEnd: true,
      rangeMiddle: false,
    });
  });

  it('does not select a day that the user cannot select', () => {
    expect(getRangeDayState(day('2026-11-11'), range, true).selected).toBe(false);
  });

  it('gives no state when there is no range', () => {
    expect(getRangeDayState(day('2026-11-11'), null, false)).toEqual({
      selected: false,
      rangeStart: false,
      rangeEnd: false,
      rangeMiddle: false,
    });
  });
});
