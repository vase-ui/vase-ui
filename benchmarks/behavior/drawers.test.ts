import assert from 'node:assert/strict';
import { test } from 'node:test';
import { largestMove, SETTLE_LONG_DRAG } from './drawers.ts';
import type { Frame } from './recorder.ts';
import { SETTLE_JUMP_LIMIT } from './samples.ts';

const VIEWPORT_HEIGHT = 720;
/** The top edge of drawer 1 at its place: the drawer is 400 px high. */
const PLACE = VIEWPORT_HEIGHT - 400;

/** Frames of the marker `drawer`, with the top edge of the drawer in each frame, or none. */
function frames(...tops: (number | null)[]): Frame[] {
  return tops.map((top, index) => ({
    time: index * 16,
    elements: {
      drawer:
        top === null
          ? []
          : [
              {
                id: 0,
                visible: true,
                opacity: 1,
                rect: { x: 0, y: top, width: 1280, height: 400 },
              },
            ],
    },
    focus: {},
    focusInLayer: {},
    active: 'body',
  }));
}

test('the largest move is the largest change of the top edge between two frames', () => {
  assert.equal(largestMove(frames(420, 400, 360, 330, 320), 'drawer', VIEWPORT_HEIGHT), 40);
});

test('a recording whose first frame shows no drawer has no move', () => {
  // The first frame comes before the release, so it must show the drawer.
  assert.equal(largestMove(frames(null, null), 'drawer', VIEWPORT_HEIGHT), undefined);
  assert.equal(largestMove(frames(730, null), 'drawer', VIEWPORT_HEIGHT), undefined);
});

test('a drawer that leaves the screen moves its edge to the bottom of the viewport', () => {
  // A removal at 620 px moves the edge 100 px, and a removal below the viewport moves it 0 px.
  assert.equal(largestMove(frames(620, null), 'drawer', VIEWPORT_HEIGHT), 100);
  assert.equal(largestMove(frames(700, 730, null), 'drawer', VIEWPORT_HEIGHT), 20);
});

test('a removal at the release of the long drag is more than the limit', () => {
  const move = largestMove(frames(PLACE + SETTLE_LONG_DRAG, null), 'drawer', VIEWPORT_HEIGHT);
  assert.ok(move !== undefined && move > SETTLE_JUMP_LIMIT);
});
