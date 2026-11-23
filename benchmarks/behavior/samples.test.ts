import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ElementSample, Frame } from './recorder.ts';
import {
  DURATION,
  FRAME_GAP_LIMIT,
  frameAt,
  isValid,
  JUMP_LIMIT,
  largestJump,
  originPoint,
  shownOpacity,
} from './samples.ts';

const FRAME_TIME = 16;
const RECT = { x: 0, y: 0, width: 100, height: 100 };

function element(opacity: number, visible = true, id = 0): ElementSample {
  return { id, visible, opacity, rect: RECT };
}

/** Frames of the marker `popup`, one each 16 ms from 0, with the elements of each frame. */
function frames(...elements: ElementSample[][]): Frame[] {
  return elements.map((popup, index) => ({
    time: index * FRAME_TIME,
    elements: { popup },
    focus: {},
    focusInLayer: {},
    active: 'body',
  }));
}

/** The opacity of a linear enter of one duration at each frame time. */
function linearEnter(count: number): ElementSample[][] {
  return Array.from({ length: count }, (_, index) => [
    element(Math.min(1, (index * FRAME_TIME) / DURATION)),
  ]);
}

test('the shown opacity is the largest opacity of the visible elements, else 0', () => {
  const [frame, hidden, none] = frames(
    [element(0.3), element(0.8), element(1, false)],
    [element(1, false)],
    [],
  );
  assert.equal(shownOpacity(frame as Frame, 'popup'), 0.8);
  assert.equal(shownOpacity(hidden as Frame, 'popup'), 0);
  assert.equal(shownOpacity(none as Frame, 'popup'), 0);
});

test('a linear run has no jump, and a restart is a jump', () => {
  const enter = linearEnter(40);
  assert.ok(largestJump(frames(...enter), 'popup', DURATION) < 0.01);
  // The exit starts again from full opacity at the half of the enter.
  const restart = [
    ...enter.slice(0, 16),
    ...linearEnter(10).map(([sample]) => [element(1 - (sample?.opacity ?? 0))]),
  ];
  assert.ok(largestJump(frames(...restart), 'popup', DURATION) > JUMP_LIMIT);
});

test('a removal while the popup shows and a first frame at full opacity are jumps', () => {
  assert.ok(largestJump(frames([element(1)], []), 'popup', DURATION) > JUMP_LIMIT);
  assert.ok(largestJump(frames([], [element(1)]), 'popup', DURATION) > JUMP_LIMIT);
});

test('a late frame of a linear run is not a jump', () => {
  // One frame takes 150 ms, so the opacity moves 0.3 between two frames.
  const late = frames([element(0.2)], [element(0.5)]);
  (late[1] as Frame).time = 150;
  assert.ok(largestJump(late, 'popup', DURATION) < 1e-9);
});

test('a run is valid only with no gap between two frames above the limit', () => {
  const recording = { frames: frames([], [], []), inputs: [] };
  assert.equal(isValid(recording), true);
  (recording.frames[2] as Frame).time = FRAME_TIME + FRAME_GAP_LIMIT + 1;
  assert.equal(isValid(recording), false);
});

test('the frame at a time is the last frame at or before it', () => {
  const recording = { frames: frames([element(0)], [element(0.5)], [element(1)]), inputs: [] };
  assert.equal(frameAt(recording, FRAME_TIME + 5)?.time, FRAME_TIME);
  assert.equal(frameAt(recording, -1), undefined);
});

test('the point of a transform origin adds the corner of the rectangle at rest', () => {
  assert.deepEqual(originPoint('60px 0px', { x: 100, y: 40 }), { x: 160, y: 40 });
});
