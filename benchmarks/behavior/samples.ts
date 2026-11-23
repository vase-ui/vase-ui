// The rules that turn the frames of a recording into measures, and the limits of the checks.
import type { Frame, Recording } from './recorder.ts';

/** The duration of each enter and each exit of the shared look, in milliseconds. */
export const DURATION = 500;
/** A change of the opacity between two frames, beyond the rate of the run, above this is a jump. */
export const JUMP_LIMIT = 0.2;
/** The highest opacity of the first visible frame of an enter, and of the last frame of an exit. */
export const HIDDEN_LIMIT = 0.2;
/** The lowest opacity of a popup that is open. */
export const FULL_OPACITY = 0.99;
/** How far from one duration an enter or an exit can end, in milliseconds. */
export const DURATION_TOLERANCE = 150;
/** How far the opacity can go on in the old direction after an interruption. */
export const GOING_BACK_LIMIT = 0.15;
/** A gap between two frames above this, in milliseconds, makes the run not valid. */
export const FRAME_GAP_LIMIT = 100;
/** The time from the close of the layer on top to the input on the layer below, in milliseconds. */
export const INPUT_DURING_EXIT_DELAY = 100;
/** The longest wait for a layer to open or to go, in milliseconds. */
export const LAYER_WAIT = 1000;
/** How far a drawer can be from the pointer in a drag, in pixels. */
export const DRAWER_TOLERANCE = 10;
/** How far a handle can be from the pointer in a drag, in pixels. */
export const HANDLE_TOLERANCE = 4;
/** The largest move of a drawer between two frames after the release, in pixels. */
export const SETTLE_JUMP_LIMIT = 100;

/** The opacity of a marker in a frame: the largest opacity of its visible elements, else 0. */
export function shownOpacity(frame: Frame, marker: string): number {
  return Math.max(
    0,
    ...(frame.elements[marker] ?? [])
      .filter((element) => element.visible)
      .map((element) => element.opacity),
  );
}

/**
 * The largest change of the shown opacity of a marker between two frames, beyond the change that an
 * animation of `duration` gives in the time between the frames. A removal while the marker shows,
 * and a first frame that shows the marker at full opacity, are changes by the same rule.
 */
export function largestJump(frames: readonly Frame[], marker: string, duration: number): number {
  let largest = 0;
  for (let index = 1; index < frames.length; index++) {
    const before = frames[index - 1] as Frame;
    const after = frames[index] as Frame;
    const change = Math.abs(shownOpacity(after, marker) - shownOpacity(before, marker));
    largest = Math.max(largest, change - (after.time - before.time) / duration);
  }
  return largest;
}

/** The largest time between two frames, in milliseconds. */
export function largestFrameGap(frames: readonly Frame[]): number {
  let largest = 0;
  for (let index = 1; index < frames.length; index++) {
    largest = Math.max(largest, (frames[index] as Frame).time - (frames[index - 1] as Frame).time);
  }
  return largest;
}

/** A run is valid when no gap between two of its frames is above `FRAME_GAP_LIMIT`. */
export function isValid(recording: Recording): boolean {
  return largestFrameGap(recording.frames) <= FRAME_GAP_LIMIT;
}

/** The last frame at or before a time, such as the time of an input. */
export function frameAt(recording: Recording, time: number): Frame | undefined {
  return recording.frames.findLast((frame) => frame.time <= time);
}

/**
 * The point of a computed `transform-origin` in the viewport. The value is in pixels from the box
 * of the element, so the point adds the left and top of the rectangle of the element at rest.
 */
export function originPoint(
  transformOrigin: string,
  rect: { x: number; y: number },
): { x: number; y: number } {
  const [x = 0, y = 0] = transformOrigin.split(' ').map((length) => Number.parseFloat(length));
  return { x: rect.x + x, y: rect.y + y };
}
