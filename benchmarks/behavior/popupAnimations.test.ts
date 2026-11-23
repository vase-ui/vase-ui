import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withoutWebKitEndReadings } from './popupAnimations.ts';
import type { Frame, Recording } from './recorder.ts';

const RECT = { x: 0, y: 0, width: 100, height: 100 };

/** A recording of the marker `popup`, with one element and one frame each 16 ms. */
function recording(...opacities: number[]): Recording {
  const frames: Frame[] = opacities.map((opacity, index) => ({
    time: index * 16,
    elements: { popup: [{ id: 0, visible: true, opacity, rect: RECT }] },
    focus: {},
    focusInLayer: {},
    active: 'body',
  }));
  return { frames, inputs: [] };
}

const opacitiesOf = ({ frames }: Recording) =>
  frames.map((frame) => frame.elements.popup?.[0]?.opacity);

test('a drop at the end of an enter, back to full opacity in the next frame, leaves WebKit frames', () => {
  const frames = recording(0.94, 0.97, 0.03, 1, 1);
  assert.deepEqual(opacitiesOf(withoutWebKitEndReadings(frames, 'webkit')), [0.94, 0.97, 1, 1]);
});

test('the same drop stays in the frames of Chromium and Firefox', () => {
  const frames = recording(0.94, 0.97, 0.03, 1, 1);
  for (const engine of ['chromium', 'firefox']) {
    assert.deepEqual(withoutWebKitEndReadings(frames, engine), frames);
  }
});

test('a WebKit drop that the next frame does not undo stays', () => {
  const frames = recording(0.5, 0.53, 0.03, 0.06, 1);
  assert.deepEqual(withoutWebKitEndReadings(frames, 'webkit'), frames);
});
