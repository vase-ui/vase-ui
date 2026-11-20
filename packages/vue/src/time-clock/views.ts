/** The unit that the face shows. */
export type TimeClockView = 'hour' | 'minute' | 'second';

export type TimeClockHourCycle = 12 | 24;

export type TimeClockDayPeriodValue = 'am' | 'pm';

export interface TimeClockFaceNumber {
  /**
   * The number that the face shows. On a 12-hour face, an hour is from 1 to 12. On a 24-hour face,
   * an hour is from 0 to 23. A minute or a second is a multiple of 5.
   */
  value: number;
  /**
   * Whether the number is on the inner ring of a 24-hour face. The inner ring has the hours 0 and 13
   * to 23.
   */
  inner: boolean;
}

export interface TimeLimits {
  minTime: Temporal.PlainTime | undefined;
  maxTime: Temporal.PlainTime | undefined;
  disabledTimes: ((time: Temporal.PlainTime, view: TimeClockView) => boolean) | undefined;
}

/** The values that a view can have: `first`, then each `step` more, up to but not including `first + count`. */
export interface Grid {
  first: number;
  count: number;
  step: number;
}

const VIEWS: readonly TimeClockView[] = ['hour', 'minute', 'second'];

/** The size of a Page Up or Page Down key, in the unit of the view. */
const PAGE_SIZES: Record<TimeClockView, number> = { hour: 2, minute: 15, second: 15 };

const ONE_UNIT: Record<TimeClockView, Temporal.DurationLike> = {
  hour: { hours: 1 },
  minute: { minutes: 1 },
  second: { seconds: 1 },
};

/** The views that a clock shows, from the hours to the unit of `granularity`. */
export function viewsOf(granularity: TimeClockView): readonly TimeClockView[] {
  return VIEWS.slice(0, VIEWS.indexOf(granularity) + 1);
}

/** A step must be a whole number above 0, or the face has no values to go to. */
export function isValidStep(step: number): boolean {
  return Number.isInteger(step) && step > 0;
}

/** The step of a view. An hour has a step of 1, and a step that is not valid is 1. */
export function stepOf(view: TimeClockView, minuteStep: number, secondStep: number): number {
  const step = view === 'hour' ? 1 : view === 'minute' ? minuteStep : secondStep;
  return isValidStep(step) ? step : 1;
}

/** The view that comes after `view` in the views of `granularity`, or `undefined` for the last view. */
export function nextView(
  view: TimeClockView,
  granularity: TimeClockView,
): TimeClockView | undefined {
  const views = viewsOf(granularity);
  const index = views.indexOf(view);
  return index === -1 ? undefined : views[index + 1];
}

export function gridOf(view: TimeClockView, hourCycle: TimeClockHourCycle, step: number): Grid {
  if (view === 'hour') {
    return hourCycle === 12 ? { first: 1, count: 12, step: 1 } : { first: 0, count: 24, step: 1 };
  }
  return { first: 0, count: 60, step };
}

export function faceNumber(
  view: TimeClockView,
  hourCycle: TimeClockHourCycle,
  value: number,
): TimeClockFaceNumber {
  return {
    value,
    inner: view === 'hour' && hourCycle === 24 && (value === 0 || value > 12),
  };
}

/** The numbers of a face, clockwise from the top. A 24-hour face lists its outer ring and then its inner ring. */
export function faceNumbers(
  view: TimeClockView,
  hourCycle: TimeClockHourCycle,
): TimeClockFaceNumber[] {
  const marks = Array.from({ length: 12 }, (_, mark) => mark);
  if (view !== 'hour') {
    return marks.map((mark) => faceNumber(view, hourCycle, mark * 5));
  }
  const outer = marks.map((mark) => faceNumber(view, hourCycle, mark === 0 ? 12 : mark));
  if (hourCycle === 12) {
    return outer;
  }
  return [
    ...outer,
    ...marks.map((mark) => faceNumber(view, hourCycle, mark === 0 ? 0 : mark + 12)),
  ];
}

/** The number of the face that `time` selects. */
export function faceNumberOf(
  view: TimeClockView,
  hourCycle: TimeClockHourCycle,
  time: Temporal.PlainTime,
): TimeClockFaceNumber {
  if (view === 'hour') {
    return faceNumber(view, hourCycle, hourCycle === 12 ? time.hour % 12 || 12 : time.hour);
  }
  return faceNumber(view, hourCycle, view === 'minute' ? time.minute : time.second);
}

/** The time of `time` with the unit of the view set to `number`. An hour of a 12-hour face keeps the day period. */
export function timeOfFaceNumber(
  view: TimeClockView,
  hourCycle: TimeClockHourCycle,
  time: Temporal.PlainTime,
  number: TimeClockFaceNumber,
): Temporal.PlainTime {
  if (view === 'hour') {
    const hour = hourCycle === 12 ? (number.value % 12) + (time.hour >= 12 ? 12 : 0) : number.value;
    return time.with({ hour });
  }
  return time.with(view === 'minute' ? { minute: number.value } : { second: number.value });
}

export function dayPeriodOf(time: Temporal.PlainTime): TimeClockDayPeriodValue {
  return time.hour >= 12 ? 'pm' : 'am';
}

export function timeOfDayPeriod(
  time: Temporal.PlainTime,
  dayPeriod: TimeClockDayPeriodValue,
): Temporal.PlainTime {
  return time.with({ hour: (time.hour % 12) + (dayPeriod === 'pm' ? 12 : 0) });
}

/** The angle of a number of the face, in degrees from 12 o'clock, clockwise. */
export function angleOfFaceNumber(view: TimeClockView, number: TimeClockFaceNumber): number {
  return angleOfPosition(number.value, view === 'hour' ? 12 : 60);
}

/** The radius of a number of the face, as a ratio of the radius of the outer ring. */
export function radiusOfFaceNumber(number: TimeClockFaceNumber): number {
  return number.inner ? INNER_RING_RADIUS : 1;
}

/**
 * The number that a point of the face selects, from its `angle` and from its distance to the center
 * as a `ratio` of the radius of the outer ring.
 */
export function faceNumberOfPoint(
  view: TimeClockView,
  hourCycle: TimeClockHourCycle,
  step: number,
  angle: number,
  ratio: number,
): TimeClockFaceNumber {
  if (view !== 'hour') {
    return faceNumber(view, hourCycle, positionOfAngle(angle, 60, step));
  }
  const position = positionOfAngle(angle, 12);
  if (hourCycle === 12 || ratio >= INNER_RING_THRESHOLD) {
    return faceNumber(view, hourCycle, position === 0 ? 12 : position);
  }
  return faceNumber(view, hourCycle, position === 0 ? 0 : position + 12);
}

function sizeOf(grid: Grid): number {
  return Math.ceil(grid.count / grid.step);
}

// Goes from the place `start` in the direction until a value is enabled, and wraps at each end.
function scan(
  grid: Grid,
  start: number,
  direction: 1 | -1,
  isEnabled: (value: number) => boolean,
): number | null {
  const size = sizeOf(grid);
  for (let attempt = 0; attempt < size; attempt += 1) {
    const place = (((start + attempt * direction) % size) + size) % size;
    const value = grid.first + place * grid.step;
    if (isEnabled(value)) {
      return value;
    }
  }
  return null;
}

/**
 * The enabled value that comes `places` places after `value`, or before it for a negative number.
 * A value that is not on the grid first goes to the next place in that direction. The result wraps
 * at the ends of the grid. It is `null` when no value is enabled.
 */
export function stepValue(
  grid: Grid,
  value: number,
  places: number,
  isEnabled: (value: number) => boolean,
): number | null {
  const place = (value - grid.first) / grid.step;
  return places > 0
    ? scan(grid, Math.floor(place) + places, 1, isEnabled)
    : scan(grid, Math.ceil(place) + places, -1, isEnabled);
}

/** The first or the last enabled value of the grid. */
export function edgeValue(
  grid: Grid,
  edge: 'first' | 'last',
  isEnabled: (value: number) => boolean,
): number | null {
  return edge === 'first'
    ? scan(grid, 0, 1, isEnabled)
    : scan(grid, sizeOf(grid) - 1, -1, isEnabled);
}

/** The number of places of a Page Up or Page Down key in a view. */
export function pagePlaces(view: TimeClockView, step: number): number {
  return Math.ceil(PAGE_SIZES[view] / step);
}

/** The first and the last moment of the unit of the view that holds `time`. */
function boundsOf(
  time: Temporal.PlainTime,
  view: TimeClockView,
): [start: Temporal.PlainTime, end: Temporal.PlainTime] {
  const start = time.round({ smallestUnit: view, roundingMode: 'floor' });
  return [start, start.add(ONE_UNIT[view]).subtract({ nanoseconds: 1 })];
}

/**
 * Whether a person can select `time` in a view. An hour or a minute is selectable when a moment in
 * it is between `minTime` and `maxTime`.
 */
export function isTimeAllowed(
  time: Temporal.PlainTime,
  view: TimeClockView,
  { minTime, maxTime, disabledTimes }: TimeLimits,
): boolean {
  const [start, end] = boundsOf(time, view);
  if (minTime && Temporal.PlainTime.compare(end, minTime) < 0) {
    return false;
  }
  if (maxTime && Temporal.PlainTime.compare(start, maxTime) > 0) {
    return false;
  }
  return !disabledTimes?.(time, view);
}

/** The time in the range from `minTime` to `maxTime`. A selectable hour can hold a time that is out of the range. */
export function clampTime(
  time: Temporal.PlainTime,
  { minTime, maxTime }: Pick<TimeLimits, 'minTime' | 'maxTime'>,
): Temporal.PlainTime {
  if (minTime && Temporal.PlainTime.compare(time, minTime) < 0) {
    return minTime;
  }
  if (maxTime && Temporal.PlainTime.compare(time, maxTime) > 0) {
    return maxTime;
  }
  return time;
}

interface ClockPoint {
  x: number;
  y: number;
}

interface ClockRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The ratio of the radius of the outer ring below which a point of a 24-hour face is on the inner
 * ring. It is the middle between the outer ring, at 1, and the inner ring, at `INNER_RING_RADIUS`.
 */
const INNER_RING_THRESHOLD = 0.82;

/** The radius of the inner ring of a 24-hour face, as a ratio of the radius of the outer ring. */
const INNER_RING_RADIUS = 0.64;

function distanceFromCenter(point: ClockPoint, rect: ClockRect): number {
  return Math.hypot(point.x - (rect.left + rect.width / 2), point.y - (rect.top + rect.height / 2));
}

/** The angle of `point` seen from the center of `rect`, in degrees from 12 o'clock, clockwise. */
export function angleOfPoint(point: ClockPoint, rect: ClockRect): number {
  const dx = point.x - (rect.left + rect.width / 2);
  const dy = point.y - (rect.top + rect.height / 2);
  return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
}

/** The distance of `point` from the center of `rect`, as a ratio of `radius`. */
export function ratioOfPoint(point: ClockPoint, rect: ClockRect, radius: number): number {
  return distanceFromCenter(point, rect) / radius;
}

/**
 * The radius of the outer ring of the face `rect`: the mean distance of the centers of `numbers`
 * from the center of the face. The style sheet of the consumer places the numbers, so only their
 * boxes give the radius. With no numbers, the radius is half of the shorter side of the face.
 */
export function outerRingRadius(rect: ClockRect, numbers: readonly ClockRect[]): number {
  if (numbers.length === 0) {
    return Math.min(rect.width, rect.height) / 2;
  }
  let total = 0;
  for (const number of numbers) {
    total += distanceFromCenter(
      { x: number.left + number.width / 2, y: number.top + number.height / 2 },
      rect,
    );
  }
  return total / numbers.length;
}

/** The nearest mark on the face. The gap from the last mark back to zero can be shorter than a step. */
export function positionOfAngle(angle: number, count: number, step = 1): number {
  const position = angle / (360 / count);
  const before = Math.floor(position / step) * step;
  const after = Math.min(before + step, count);
  return position - before < after - position ? before : after % count;
}

/** The angle of a position on a face of `count` equal parts, in degrees from 12 o'clock, clockwise. */
export function angleOfPosition(position: number, count: number): number {
  return (position % count) * (360 / count);
}
