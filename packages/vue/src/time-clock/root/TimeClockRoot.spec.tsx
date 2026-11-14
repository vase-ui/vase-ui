import { TimeClock } from '@vase-ui/vue/time-clock';
import type {
  TimeClockDayPeriodProps,
  TimeClockFaceNumber,
  TimeClockHandState,
  TimeClockNumberState,
  TimeClockRootProps,
  TimeClockRootState,
  TimeClockView,
  TimeClockViewTriggerState,
} from '@vase-ui/vue/time-clock';
import { expectType } from '#test-utils';

const plainTime = Temporal.PlainTime.from('10:30');
const dateTime = Temporal.PlainDateTime.from('2026-11-14T10:30');
const zoned = Temporal.ZonedDateTime.from('2026-11-14T10:30[Europe/Paris]');

export const props: TimeClock.Root.Props = {
  value: null,
  defaultValue: plainTime,
  view: 'minute',
  defaultView: 'hour',
  granularity: 'second',
  hourCycle: 24,
  minuteStep: 5,
  secondStep: 15,
  minTime: plainTime,
  maxTime: plainTime,
  disabledTimes: (time, view) => {
    expectType<Temporal.PlainTime, typeof time>(time);
    expectType<TimeClockView, typeof view>(view);
    return false;
  },
  referenceDate: dateTime,
  locale: 'de-DE',
  disabled: true,
  readOnly: true,
} satisfies TimeClockRootProps;
export const state: TimeClock.Root.State = {
  view: 'hour',
  disabled: false,
  readOnly: false,
  dragging: false,
  empty: true,
} satisfies TimeClockRootState;

// The value has the type that the clock got.
export const plainTimeClock = (
  <TimeClock.Root
    defaultValue={plainTime}
    onValueChange={(value, details) => {
      expectType<Temporal.PlainTime, typeof value>(value);
      expectType<
        'drag' | 'keyboard' | 'input-change' | 'item-press' | 'trigger-press',
        typeof details.reason
      >(details.reason);
    }}
    onValueCommitted={(value, details) => {
      expectType<Temporal.PlainTime, typeof value>(value);
      expectType<'drag' | 'keyboard', typeof details.reason>(details.reason);
    }}
  />
);
export const zonedClock = (
  <TimeClock.Root
    value={zoned}
    onValueChange={(value) => {
      expectType<Temporal.ZonedDateTime, typeof value>(value);
    }}
  />
);
export const referenceClock = (
  <TimeClock.Root
    value={null}
    referenceDate={dateTime}
    onValueChange={(value) => {
      expectType<Temporal.PlainDateTime, typeof value>(value);
    }}
  />
);
export const noValueClock = (
  <TimeClock.Root
    onValueChange={(value) => {
      expectType<
        Temporal.PlainTime | Temporal.PlainDateTime | Temporal.ZonedDateTime,
        typeof value
      >(value);
    }}
    onViewChange={(view) => {
      expectType<TimeClockView, typeof view>(view);
    }}
  />
);

// A date is not a time.
// @ts-expect-error `value` takes a time, a date and time, or a date and time in a zone
export const dateValue = <TimeClock.Root value={Temporal.PlainDate.from('2026-11-14')} />;
// @ts-expect-error `minTime` takes a plain time
export const dateTimeLimit = <TimeClock.Root minTime={dateTime} />;
// @ts-expect-error the granularity is an hour, a minute or a second
export const dayGranularity = <TimeClock.Root granularity="day" />;
// @ts-expect-error the hour cycle is 12 or 24
export const wrongHourCycle = <TimeClock.Root hourCycle={36} />;
// @ts-expect-error the view is an hour, a minute or a second
export const wrongView = <TimeClock.Root view="day" />;

// The parts have the props of their element, and `as`, `stateClass` and `stateStyle`.
export const face = (
  <TimeClock.Face
    as="section"
    lang="fr"
    stateClass={(state) => (state.dragging ? 'dragging' : '')}
    onKeydown={(event) => event.preventVaseUIHandler()}
  />
);
export const hand = (
  <TimeClock.Hand
    stateClass={(state: TimeClockHandState) => {
      expectType<boolean, typeof state.inner>(state.inner);
      expectType<boolean, typeof state.betweenNumbers>(state.betweenNumbers);
      return '';
    }}
  />
);
export const number = (
  <TimeClock.Number
    number={{ value: 3, inner: false } satisfies TimeClockFaceNumber}
    stateClass={(state: TimeClockNumberState) => (state.selected ? 'selected' : '')}
  />
);
export const dayPeriod = (
  <TimeClock.DayPeriod value="pm" onClick={(event) => event.preventVaseUIHandler()} />
);
export const viewTrigger = (
  <TimeClock.ViewTrigger
    view="minute"
    stateClass={(state: TimeClockViewTriggerState) => (state.active ? 'active' : '')}
  />
);
export const dayPeriodProps: TimeClockDayPeriodProps = { value: 'am' };

// @ts-expect-error `number` is required
export const numberWithoutNumber = <TimeClock.Number />;
// @ts-expect-error `number` has a value and a ring
export const numberWithoutRing = <TimeClock.Number number={{ value: 3 }} />;
// @ts-expect-error `value` is `am` or `pm`
export const noonPeriod = <TimeClock.DayPeriod value="noon" />;
// @ts-expect-error `view` is required
export const triggerWithoutView = <TimeClock.ViewTrigger />;
