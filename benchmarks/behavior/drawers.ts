import type { Page } from 'playwright';
import { centerOf, enterOn, flick, slowDrag, type PointerKind } from './input.ts';
import {
  belowIsInert,
  escapeClosesTop,
  focusReturns,
  inputDuringExit,
  read,
  waitForFrame,
  waitForRest,
  waitUntilGone,
} from './layers.ts';
import type { Frame } from './recorder.ts';
import { DRAWER_TOLERANCE, isValid, largestFrameGap, SETTLE_JUMP_LIMIT } from './samples.ts';
import type { CaseResult, Group } from './types.ts';

const PREFIX = 'drawer';
const NESTED = 'NestedDrawers';
const SNAP = 'DrawerSnapPoints';
const FIRST = `${PREFIX}-1`;
const SECOND = `${PREFIX}-2`;
/** The drawer of `DrawerSnapPoints`. */
const SNAP_DRAWER = PREFIX;

// Drawer 1 is 400 pixels high: a short drag is a quarter of it, and a long drag is three quarters.
const SHORT_DRAG = 100;
const LONG_DRAG = 300;
/**
 * The long drag of `settles-with-no-jump`. It leaves drawer 1 150 px above the bottom of the
 * viewport, more than `SETTLE_JUMP_LIMIT`, so a removal at the release is a jump.
 */
export const SETTLE_LONG_DRAG = 250;
const FLICK = 120;
const SNAP_DRAG = 200;
/** The snap points of `DrawerSnapPoints`, in pixels from the bottom of the viewport. */
const SNAP_POINTS = { low: 240, high: 480 };
/** How far a drawer at rest can be from its place, in pixels. */
const PLACE_TOLERANCE = 1;
/** How far a drawer at rest can be from a snap point, in pixels. */
const SNAP_TOLERANCE = 2;

const UIKIT_SHEET = {
  text: 'UIKit, UISheetPresentationController',
  url: 'https://developer.apple.com/documentation/uikit/uisheetpresentationcontroller',
};
const ANDROID_BOTTOM_SHEET = {
  text: 'Android, BottomSheetBehavior',
  url: 'https://developer.android.com/reference/com/google/android/material/bottomsheet/BottomSheetBehavior',
};
const POINTERS = ['mouse', 'touch'];

function kindOf(caseName: string | null): PointerKind {
  return caseName === 'touch' ? 'touch' : 'mouse';
}

function result(pass: boolean, measure: string, reason = measure): CaseResult {
  return pass ? { verdict: 'pass', measure } : { verdict: 'fail', measure, reason };
}

function viewportHeight(page: Page): number {
  const size = page.viewportSize();
  if (size === null) {
    throw new Error('The page has no viewport size.');
  }
  return size.height;
}

/**
 * The top edge of a marker in a frame, or `undefined` when no element of it shows in the viewport.
 */
function topOf(frame: Frame, marker: string, height: number): number | undefined {
  const top = frame.elements[marker]?.find((element) => element.visible)?.rect.y;
  return top === undefined || top >= height ? undefined : top;
}

/**
 * The largest move of the top edge of a marker between two frames, or `undefined` when the first
 * frame does not show the marker in the viewport. In a frame in which the marker does not show in
 * the viewport, the edge is at the bottom of the viewport, so a removal while the drawer shows is a
 * move too.
 */
export function largestMove(
  frames: readonly Frame[],
  marker: string,
  height: number,
): number | undefined {
  const [first] = frames;
  if (first === undefined || topOf(first, marker, height) === undefined) {
    return undefined;
  }
  const edge = (frame: Frame) => topOf(frame, marker, height) ?? height;
  let largest = 0;
  for (let index = 1; index < frames.length; index++) {
    const move = Math.abs(edge(frames[index] as Frame) - edge(frames[index - 1] as Frame));
    largest = Math.max(largest, move);
  }
  return largest;
}

/**
 * The top edge of a drawer `LAYER_WAIT` after an input, or `undefined` when the drawer is gone by
 * then. A check reads the place at the end of its time limit, so a library that waits after a release
 * before it moves the drawer gets the whole time.
 */
async function topAfterLimit(page: Page, marker: string): Promise<number | undefined> {
  const height = viewportHeight(page);
  const { frame } = await waitForFrame(
    page,
    [marker],
    (sample) => topOf(sample, marker, height) === undefined,
  );
  return topOf(frame, marker, height);
}

/** The center of the handle of a drawer, where each drag starts. */
function handleOf(page: Page, marker: string) {
  return centerOf(page, `${marker}-handle`);
}

/** Opens a drawer with the keyboard, and returns its top edge at the end of its enter. */
async function openDrawer(page: Page, marker: string): Promise<number> {
  await enterOn(page, `${marker}-trigger`);
  const top = topOf(await waitForRest(page, marker), marker, viewportHeight(page));
  if (top === undefined) {
    throw new Error(
      `${marker.charAt(0).toUpperCase()}${marker.slice(1).replace('-', ' ')} is at rest below the viewport.`,
    );
  }
  return top;
}

/** After a slow drag of drawer 1, the drawer follows the pointer within `DRAWER_TOLERANCE`. */
async function followsPointer(page: Page, caseName: string | null): Promise<CaseResult> {
  const height = viewportHeight(page);
  const place = await openDrawer(page, FIRST);
  let top: number | undefined;
  await slowDrag(
    page,
    kindOf(caseName),
    await handleOf(page, FIRST),
    { x: 0, y: SHORT_DRAG },
    async () => {
      top = topOf(await read(page, [FIRST]), FIRST, height);
    },
  );
  if (top === undefined) {
    return result(false, 'Drawer 1 closes during the drag.');
  }
  const moved = Math.round(top - place);
  return result(
    Math.abs(moved - SHORT_DRAG) <= DRAWER_TOLERANCE,
    `A drag of ${String(SHORT_DRAG)} px moves drawer 1 ${String(moved)} px.`,
  );
}

/** 1 s after a short, slow drag and the release, drawer 1 is at its place. */
async function returnsAfterShortDrag(page: Page, caseName: string | null): Promise<CaseResult> {
  const place = await openDrawer(page, FIRST);
  await slowDrag(page, kindOf(caseName), await handleOf(page, FIRST), { x: 0, y: SHORT_DRAG });
  const top = await topAfterLimit(page, FIRST);
  if (top === undefined) {
    return result(false, `A drag of ${String(SHORT_DRAG)} px closes drawer 1.`);
  }
  return Math.abs(top - place) <= PLACE_TOLERANCE
    ? result(true, 'Drawer 1 is back at its place.')
    : result(
        false,
        `Drawer 1 is ${String(Math.round(top - place))} px from its place 1 s after the release.`,
      );
}

/** After a release, drawer 1 is gone no later than `LAYER_WAIT`. */
async function closesAfterRelease(page: Page, place: number, input: string): Promise<CaseResult> {
  if (await waitUntilGone(page, FIRST)) {
    return result(true, `Drawer 1 is gone 1 s after the ${input}.`);
  }
  const top = topOf(await read(page, [FIRST]), FIRST, viewportHeight(page));
  const distance =
    top === undefined
      ? 'below the viewport'
      : `${String(Math.round(top - place))} px from its place`;
  return result(false, `Drawer 1 is open 1 s after the ${input}, ${distance}.`);
}

async function closesAfterLongDrag(page: Page, caseName: string | null): Promise<CaseResult> {
  const place = await openDrawer(page, FIRST);
  await slowDrag(page, kindOf(caseName), await handleOf(page, FIRST), { x: 0, y: LONG_DRAG });
  return closesAfterRelease(page, place, 'release');
}

async function closesAfterFlick(page: Page, caseName: string | null): Promise<CaseResult> {
  const place = await openDrawer(page, FIRST);
  await flick(page, kindOf(caseName), await handleOf(page, FIRST), { x: 0, y: FLICK });
  return closesAfterRelease(page, place, 'flick');
}

/**
 * After the short drag and the long drag, no frame from the release until the drawer is gone, or
 * for `LAYER_WAIT`, moves the top edge of drawer 1 by more than `SETTLE_JUMP_LIMIT`. A removal is a
 * move to the bottom of the viewport, the closed place, so a drawer that closes must reach it by
 * motion. The limit has no term for the time of a frame, so a slow frame does not hide a removal.
 */
async function settlesWithNoJump(page: Page, caseName: string | null): Promise<CaseResult> {
  const height = viewportHeight(page);
  const moves: number[] = [];
  for (const [drag, distance] of [
    ['short', SHORT_DRAG],
    ['long', SETTLE_LONG_DRAG],
  ] as const) {
    // Each drag starts in a new page, as in the checks of the short and the long drag. In WebKit
    // on Linux, the drawer of one library does not move with a second drag in one page.
    if (drag === 'long') {
      await page.reload();
      await page.locator('[data-bench="instance"] > *').first().waitFor();
    }
    await openDrawer(page, FIRST);
    await slowDrag(page, kindOf(caseName), await handleOf(page, FIRST), { x: 0, y: distance }, () =>
      // The first frame of the recording comes before the release, so a jump at the release counts.
      page.evaluate(async (marker) => {
        window.behaviorRecorder.start([marker]);
        await window.behaviorRecorder.nextFrame([]);
      }, FIRST),
    );
    await waitUntilGone(page, FIRST);
    const recording = await page.evaluate(() => window.behaviorRecorder.stop());
    if (!isValid(recording)) {
      return {
        verdict: 'not-valid',
        measure: `A gap of ${String(Math.round(largestFrameGap(recording.frames)))} ms between two frames.`,
      };
    }
    const move = largestMove(recording.frames, FIRST, height);
    if (move === undefined) {
      return result(false, `Drawer 1 is not on the screen at the release of the ${drag} drag.`);
    }
    moves.push(Math.round(move));
  }
  const [short = 0, long = 0] = moves;
  return result(
    Math.max(short, long) <= SETTLE_JUMP_LIMIT,
    `The largest move in one frame is ${String(short)} px after the short drag and ${String(long)} px after the long drag.`,
  );
}

/** A flick on drawer 2 closes it, and drawer 1 stays open at its place. */
async function swipeClosesTop(page: Page, caseName: string | null): Promise<CaseResult> {
  const place = await openDrawer(page, FIRST);
  await openDrawer(page, SECOND);
  await flick(page, kindOf(caseName), await handleOf(page, SECOND), { x: 0, y: FLICK });
  if (!(await waitUntilGone(page, SECOND))) {
    return result(false, 'Drawer 2 is open 1 s after the flick.');
  }
  const top = await topAfterLimit(page, FIRST);
  if (top === undefined) {
    return result(false, 'The flick on drawer 2 closes drawer 1 too.');
  }
  return Math.abs(top - place) <= PLACE_TOLERANCE
    ? result(true, 'Drawer 2 is gone, and drawer 1 is at its place.')
    : result(
        false,
        `Drawer 2 is gone, and drawer 1 is ${String(Math.round(top - place))} px from its place.`,
      );
}

/** 1 s after a slow drag from the higher snap point toward the lower one, the drawer is on it. */
async function settlesAtSnapPoint(page: Page, caseName: string | null): Promise<CaseResult> {
  const height = viewportHeight(page);
  const start = await openDrawer(page, SNAP_DRAWER);
  if (Math.abs(start - (height - SNAP_POINTS.high)) > SNAP_TOLERANCE) {
    return result(
      false,
      `The drawer opens with its top edge at ${String(Math.round(start))} px, not at the snap point of ${String(SNAP_POINTS.high)} px.`,
    );
  }
  await slowDrag(page, kindOf(caseName), await handleOf(page, SNAP_DRAWER), {
    x: 0,
    y: SNAP_DRAG,
  });
  const top = await topAfterLimit(page, SNAP_DRAWER);
  if (top === undefined) {
    return result(false, `A drag of ${String(SNAP_DRAG)} px closes the drawer.`);
  }
  const shown = Math.round(height - top);
  return result(
    Math.abs(shown - SNAP_POINTS.low) <= SNAP_TOLERANCE,
    `The drawer is ${String(shown)} px high 1 s after the release.`,
  );
}

/**
 * The fixture `NestedDrawers`: `drawer-1-trigger` opens `drawer-1`, a bottom drawer of 400 px. Its
 * handle `drawer-1-handle` is at the top. Under the handle, a row holds `drawer-1-action`, which
 * counts its presses in `drawer-1-count`, and `drawer-2-trigger`, which opens `drawer-2`, a bottom
 * drawer of 300 px with the handle `drawer-2-handle` and `drawer-2-action`. Each drawer has a title,
 * a description and a Close button.
 *
 * The fixture `DrawerSnapPoints`: `drawer-trigger` opens `drawer`, a bottom drawer of 480 px with
 * the handle `drawer-handle` and the snap points 240 px and 480 px, open at 480 px.
 */
export const DRAWERS: Group = {
  id: 'drawers',
  title: 'Drawers',
  notes: {
    'reka-ui': 'Alpha in its docs. The docs give no nested pattern.',
    'ark-ui': 'Preview in its docs. The docs give no nested pattern.',
  },
  checks: [
    {
      id: 'follows-pointer',
      title: 'The drawer follows the pointer in a drag.',
      expectation: UIKIT_SHEET,
      scenario: NESTED,
      cases: POINTERS,
      run: followsPointer,
    },
    {
      id: 'returns-after-short-drag',
      title: 'A short, slow drag returns the drawer to its place.',
      expectation: ANDROID_BOTTOM_SHEET,
      scenario: NESTED,
      cases: POINTERS,
      run: returnsAfterShortDrag,
    },
    {
      id: 'closes-after-long-drag',
      title: 'A drag past three quarters of the height closes the drawer.',
      expectation: ANDROID_BOTTOM_SHEET,
      scenario: NESTED,
      cases: POINTERS,
      run: closesAfterLongDrag,
    },
    {
      id: 'closes-after-flick',
      title: 'A fast flick closes the drawer.',
      expectation: ANDROID_BOTTOM_SHEET,
      scenario: NESTED,
      cases: POINTERS,
      run: closesAfterFlick,
    },
    {
      id: 'settles-with-no-jump',
      title: `After the release, the drawer moves on from the place of the release. No frame moves it more than ${String(SETTLE_JUMP_LIMIT)} px, and a removal counts as a move to the bottom of the viewport.`,
      expectation: ANDROID_BOTTOM_SHEET,
      scenario: NESTED,
      cases: POINTERS,
      run: settlesWithNoJump,
    },
    {
      id: 'swipe-closes-top',
      title: 'A swipe on the drawer on top closes only that drawer.',
      expectation: UIKIT_SHEET,
      scenario: NESTED,
      cases: POINTERS,
      run: swipeClosesTop,
    },
    {
      id: 'escape-closes-top',
      title: 'Escape closes only the drawer on top.',
      expectation: {
        text: 'HTML, close requests',
        url: 'https://html.spec.whatwg.org/multipage/interaction.html#close-requests',
      },
      scenario: NESTED,
      run: (page) => escapeClosesTop(page, PREFIX),
    },
    {
      id: 'focus-returns',
      title: 'The focus returns to the button that opened the drawer.',
      expectation: {
        text: 'WAI-ARIA APG, Dialog (Modal) Pattern',
        url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/',
      },
      scenario: NESTED,
      cases: [`${PREFIX} 2`, `${PREFIX} 1`],
      run: (page, caseName) => focusReturns(page, PREFIX, caseName),
    },
    {
      id: 'below-is-inert',
      title: 'A press on a button of the drawer below does not use that button.',
      expectation: {
        text: 'HTML, show a modal dialog',
        url: 'https://html.spec.whatwg.org/multipage/interactive-elements.html#show-a-modal-dialog',
      },
      scenario: NESTED,
      run: (page) => belowIsInert(page, PREFIX),
    },
    {
      id: 'settles-at-snap-point',
      title: 'A release near a snap point puts the drawer on that point.',
      expectation: UIKIT_SHEET,
      scenario: SNAP,
      cases: POINTERS,
      run: settlesAtSnapPoint,
    },
    {
      id: 'input-during-exit',
      title: 'The drawer below takes the input while the drawer on top leaves.',
      expectation: {
        text: 'HTML, close the dialog',
        url: 'https://html.spec.whatwg.org/multipage/interactive-elements.html#close-the-dialog',
      },
      scenario: NESTED,
      cases: ['focus', 'escape', 'press'],
      run: (page, caseName) => inputDuringExit(page, PREFIX, caseName),
    },
  ],
};
