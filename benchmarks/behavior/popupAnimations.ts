import type { Page } from 'playwright';
import { centerOf, pressAt } from './input.ts';
import { isShown, waitForFrame, waitUntilGone } from './layers.ts';
import type { Frame, Recording } from './recorder.ts';
import {
  DURATION,
  DURATION_TOLERANCE,
  FULL_OPACITY,
  GOING_BACK_LIMIT,
  HIDDEN_LIMIT,
  JUMP_LIMIT,
  LAYER_WAIT,
  frameAt,
  isValid,
  largestFrameGap,
  largestJump,
  originPoint,
  shownOpacity,
} from './samples.ts';
import type { CaseResult, Group } from './types.ts';

const POPUPS = [
  'Dialog',
  'Popover',
  'Menu',
  'Select',
  'Tooltip',
  'PreviewCard',
  'Combobox',
  'NavigationMenu',
  'Drawer',
];
const ANCHORED_POPUPS = [
  'Popover',
  'Menu',
  'Select',
  'Tooltip',
  'PreviewCard',
  'Combobox',
  'NavigationMenu',
];
const HOVER_POPUPS = new Set(['Tooltip', 'PreviewCard']);
const DIALOG_POPUPS = new Set(['Dialog', 'Drawer']);
const FIXTURES = Object.fromEntries(POPUPS.map((popup) => [popup, `Animated${popup}`]));

/** Returns `true` when the popup opens on pointer hover and closes when the pointer moves away. */
export function isHoverPopup(popup: string | null): boolean {
  return popup !== null && HOVER_POPUPS.has(popup);
}

/** Returns `true` when the check places the popup in the center of the viewport. */
export function isDialogPopup(popup: string | null): boolean {
  return popup !== null && DIALOG_POPUPS.has(popup);
}

const STARTING = {
  text: 'CSS Transitions, starting of transitions',
  url: 'https://www.w3.org/TR/css-transitions-1/#starting',
};
const REVERSING = {
  text: 'CSS Transitions, reversing of interrupted transitions',
  url: 'https://www.w3.org/TR/css-transitions-1/#reversing',
};
const ANCHOR_ORIGIN = {
  text: 'Android, DropdownMenuPopupPositionProvider',
  url: 'https://developer.android.com/reference/kotlin/androidx/compose/material3/DropdownMenuPopupPositionProvider',
};

const MARKER = 'popup';
/** The time from the first visible frame of the enter, or from the close, to the interruption. */
const INTERRUPTION_DELAY = 250;
/** Where the pointer goes to close a hover popup: away from the trigger and from the popup. */
const AWAY = { x: 8, y: 8 };
/** How far the origin can be from the anchor, beyond the gap between the popup and the anchor. */
const ORIGIN_TOLERANCE = 2;
/** A popup grows when its smallest width in the enter is at most this part of its width at rest. */
const GROWTH_LIMIT = 0.9;

/**
 * The place of a dialog or a drawer in each library: the center of the viewport. A fixture has no
 * style but the animation, as a fixture of the timing run. With no style, a dialog or a drawer
 * shows at the top of the page, on the trigger.
 */
const DIALOG_STYLE = `
[data-bench='popup'] {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  width: 320px;
  height: 200px;
  margin: auto;
}`;
/**
 * Puts the trigger at the edge of the viewport on the side where the popup opens, so that the popup
 * has no room on that side.
 */
const EDGE_STYLES = {
  above: '.bench-page { top: 0; }',
  below: '.bench-page { top: auto; bottom: 0; }',
};

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The input of a popup: a press on the trigger and Escape, or the pointer on the trigger and away. */
function inputOf(page: Page, popup: string | null) {
  const hover = isHoverPopup(popup);
  return {
    openName: hover ? 'pointer on the trigger' : 'press',
    open: async () => {
      const { x, y } = await centerOf(page, 'trigger');
      await (hover ? page.mouse.move(x, y) : pressAt(page, { x, y }));
    },
    close: () => (hover ? page.mouse.move(AWAY.x, AWAY.y) : page.keyboard.press('Escape')),
  };
}

function pageTime(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

/** Runs an input, and returns the time of the page just before it. */
async function timed(page: Page, input: () => Promise<void>): Promise<number> {
  const time = await pageTime(page);
  await input();
  return time;
}

async function waitUntil(page: Page, time: number): Promise<void> {
  await page.waitForTimeout(Math.max(0, time - (await pageTime(page))));
}

/** Starts the recorder, and returns after it reads two frames, so that the input comes after them. */
async function startRecording(page: Page): Promise<void> {
  await page.evaluate(
    (marker) =>
      new Promise((resolve) => {
        window.behaviorRecorder.start([marker]);
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
    MARKER,
  );
}

/** The ids of the visible elements of the popup in a frame. */
function shownIdList(frame: Frame): number[] {
  return (frame.elements[MARKER] ?? [])
    .filter((element) => element.visible)
    .map((element) => element.id);
}

/** The ids of the visible elements of the popup in a frame, such as `3`. */
function shownIds(frame: Frame): string {
  return shownIdList(frame).join(',');
}

/**
 * Removes a wrong reading of WebKit from the frames. In the frame where a transition ends, WebKit
 * can give an opacity near the start of the transition (about 0.03 at an enter end, or about 0.97
 * at an exit end). At the end of an enter, the frame drops by more than `JUMP_LIMIT`, and the next
 * frame shows the same element at full opacity. At the end of an exit, the frame rises by more
 * than `JUMP_LIMIT` from `HIDDEN_LIMIT` or less to below `FULL_OPACITY`, and the element leaves
 * next (nothing shows, or a new element starts at `HIDDEN_LIMIT` or less). A real flash to full
 * opacity before removal stays. Chromium and Firefox give no such reading, so in their frames the
 * same change is a jump.
 */
export function withoutWebKitEndReadings(recording: Recording, engine: string): Recording {
  if (engine !== 'webkit') {
    return recording;
  }
  const { frames } = recording;
  const isEndReading = (frame: Frame, index: number) => {
    const before = frames[index - 1];
    const after = frames[index + 1];
    if (before === undefined || after === undefined) {
      return false;
    }
    const idList = shownIdList(frame);
    const id = idList.join(',');
    if (id === '' || shownIds(before) !== id) {
      return false;
    }
    const previous = shownOpacity(before, MARKER);
    const current = shownOpacity(frame, MARKER);
    const enterEnd =
      shownIds(after) === id &&
      shownOpacity(after, MARKER) >= FULL_OPACITY &&
      previous - current > JUMP_LIMIT;
    const afterIds = new Set(shownIdList(after));
    const left = idList.every((each) => !afterIds.has(each));
    const exitEnd =
      left &&
      previous <= HIDDEN_LIMIT &&
      current < FULL_OPACITY &&
      current - previous > JUMP_LIMIT &&
      shownOpacity(after, MARKER) <= HIDDEN_LIMIT;
    return enterEnd || exitEnd;
  };
  return { ...recording, frames: frames.filter((frame, index) => !isEndReading(frame, index)) };
}

/**
 * Stops the recorder two frames later, so that its last frames hold the state that a wait found. A
 * wait reads its own frames, and in WebKit two reads in one frame can give two opacities.
 */
async function stopRecording(page: Page): Promise<Recording> {
  const recording = await page.evaluate(
    () =>
      new Promise<Recording>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            resolve(window.behaviorRecorder.stop());
          }),
        );
      }),
  );
  return withoutWebKitEndReadings(recording, page.context().browser()?.browserType().name() ?? '');
}

/** Waits until the popup shows at full opacity. Returns `false` when it does not. */
async function waitForRest(page: Page): Promise<boolean> {
  const { done } = await waitForFrame(
    page,
    [MARKER],
    (frame) => shownOpacity(frame, MARKER) >= FULL_OPACITY,
    // The enter of the shared look is 500 ms, so the wait has two times the usual limit.
    2 * LAYER_WAIT,
  );
  return done;
}

async function placeDialog(page: Page, popup: string | null): Promise<void> {
  if (isDialogPopup(popup)) {
    await page.addStyleTag({ content: DIALOG_STYLE });
  }
}

/** Opens the popup and waits for the end of its enter. Returns the reason when it does not open. */
async function openToRest(page: Page, popup: string | null): Promise<string | undefined> {
  const input = inputOf(page, popup);
  await input.open();
  return (await waitForRest(page)) ? undefined : `The ${input.openName} does not open the popup.`;
}

function notValid(recording: Recording): CaseResult {
  return {
    verdict: 'not-valid',
    measure: `A gap of ${String(Math.round(largestFrameGap(recording.frames)))} ms between two frames.`,
  };
}

function fail(measure: string, reason = measure): CaseResult {
  return { verdict: 'fail', measure, reason };
}

const opacityText = (frame: Frame) => shownOpacity(frame, MARKER).toFixed(2);
const milliseconds = (time: number) => `${String(Math.round(time))} ms`;
/** A time from the close, such as `532 ms after the close` or `1 ms before the close`. */
const fromClose = (time: number) =>
  time < 0 ? `${milliseconds(-time)} before the close` : `${milliseconds(time)} after the close`;

/** A pass, or a fail with the first reason of the list. A condition that holds gives `false`. */
function verdictOf(measure: string, reasons: (string | false)[]): CaseResult {
  const [reason] = reasons.filter((item) => item !== false);
  return reason === undefined ? { verdict: 'pass', measure } : fail(measure, reason);
}

async function enterFromFirstFrame(page: Page, popup: string | null): Promise<CaseResult> {
  await placeDialog(page, popup);
  const input = inputOf(page, popup);
  await startRecording(page);
  await input.open();
  const atRest = await waitForRest(page);
  const recording = await stopRecording(page);
  if (!isValid(recording)) {
    return notValid(recording);
  }
  const first = recording.frames.find((frame) => isShown(frame, MARKER));
  if (first === undefined) {
    return fail(`The ${input.openName} does not open the popup.`);
  }
  const full = recording.frames.find((frame) => shownOpacity(frame, MARKER) >= FULL_OPACITY);
  const jump = largestJump(recording.frames, MARKER, DURATION);
  const end = full && full.time - first.time;
  const measure = `First frame: opacity ${opacityText(first)}. Full opacity ${
    end === undefined ? 'not reached' : `after ${milliseconds(end)}`
  }. Largest jump ${jump.toFixed(2)}.`;
  return verdictOf(measure, [
    shownOpacity(first, MARKER) > HIDDEN_LIMIT &&
      `The first frame shows the popup at an opacity of ${opacityText(first)}.`,
    (!atRest || end === undefined) &&
      `The popup does not reach full opacity in ${milliseconds(2 * LAYER_WAIT)}.`,
    end !== undefined &&
      Math.abs(end - DURATION) > DURATION_TOLERANCE &&
      `The enter ends ${milliseconds(end)} after the first frame.`,
    jump > JUMP_LIMIT && `The opacity jumps by ${jump.toFixed(2)} in one frame.`,
  ]);
}

async function exitBeforeRemoval(page: Page, popup: string | null): Promise<CaseResult> {
  await placeDialog(page, popup);
  const notOpen = await openToRest(page, popup);
  if (notOpen !== undefined) {
    return fail(notOpen);
  }
  await startRecording(page);
  const closeTime = await timed(page, inputOf(page, popup).close);
  const gone = await waitUntilGone(page, MARKER);
  const recording = await stopRecording(page);
  if (!isValid(recording)) {
    return notValid(recording);
  }
  if (!gone) {
    return fail(`The popup still shows ${milliseconds(LAYER_WAIT)} after the close.`);
  }
  const last = recording.frames.findLast((frame) => isShown(frame, MARKER));
  if (last === undefined) {
    return fail('The popup does not show.');
  }
  const jump = largestJump(recording.frames, MARKER, DURATION);
  const end = last.time - closeTime;
  const measure = `Last frame: opacity ${opacityText(last)}, ${fromClose(end)}. Largest jump ${jump.toFixed(2)}.`;
  return verdictOf(measure, [
    shownOpacity(last, MARKER) > HIDDEN_LIMIT &&
      `The last frame shows the popup at an opacity of ${opacityText(last)}.`,
    Math.abs(end - DURATION) > DURATION_TOLERANCE && `The last frame comes ${fromClose(end)}.`,
    jump > JUMP_LIMIT && `The opacity jumps by ${jump.toFixed(2)} in one frame.`,
  ]);
}

/** A run of a close during the enter, or of an open during the exit. */
interface Interruption {
  recording: Recording;
  /** The time of the interruption. */
  time: number;
  /** Why the run did not give the state that the row needs. */
  reason?: string;
}

/** Opens the popup, and closes it `INTERRUPTION_DELAY` after the first visible frame of the enter. */
async function closeDuringEnter(page: Page, popup: string | null): Promise<Interruption> {
  await placeDialog(page, popup);
  const input = inputOf(page, popup);
  await startRecording(page);
  await input.open();
  const { frame, done } = await waitForFrame(page, [MARKER], (sample) => isShown(sample, MARKER));
  if (!done) {
    return {
      recording: await stopRecording(page),
      time: Number.NaN,
      reason: `The ${input.openName} does not open the popup.`,
    };
  }
  await waitUntil(page, frame.time + INTERRUPTION_DELAY);
  const time = await timed(page, input.close);
  const gone = await waitUntilGone(page, MARKER);
  return {
    recording: await stopRecording(page),
    time,
    ...(gone ? {} : { reason: 'The close during the enter did not close the popup.' }),
  };
}

/** Opens the popup, closes it, and opens it `INTERRUPTION_DELAY` after the close. */
async function openDuringExit(page: Page, popup: string | null): Promise<Interruption> {
  await placeDialog(page, popup);
  const input = inputOf(page, popup);
  const notOpen = await openToRest(page, popup);
  if (notOpen !== undefined) {
    return { recording: { frames: [], inputs: [] }, time: Number.NaN, reason: notOpen };
  }
  await startRecording(page);
  const closeTime = await timed(page, input.close);
  await waitUntil(page, closeTime + INTERRUPTION_DELAY);
  const time = await timed(page, input.open);
  const atRest = await waitForRest(page);
  return {
    recording: await stopRecording(page),
    time,
    ...(atRest ? {} : { reason: `The ${input.openName} during the exit did not open the popup.` }),
  };
}

/** The interruption shows no jump in the opacity. */
function noJump({ recording, reason }: Interruption): CaseResult {
  if (reason !== undefined) {
    return fail(reason);
  }
  if (!isValid(recording)) {
    return notValid(recording);
  }
  const jump = largestJump(recording.frames, MARKER, DURATION);
  return verdictOf(`Largest jump ${jump.toFixed(2)}.`, [
    jump > JUMP_LIMIT && `The opacity jumps by ${jump.toFixed(2)} in one frame.`,
  ]);
}

/**
 * After the interruption, the opacity goes on in its old direction by `GOING_BACK_LIMIT` at most.
 * `direction` is 1 for an enter, which goes up, and -1 for an exit.
 */
function goesBack({ recording, time, reason }: Interruption, direction: 1 | -1): CaseResult {
  if (reason !== undefined) {
    return fail(reason);
  }
  if (!isValid(recording)) {
    return notValid(recording);
  }
  const atInput = frameAt(recording, time);
  const opacity = atInput === undefined ? 0 : shownOpacity(atInput, MARKER);
  const after = recording.frames
    .filter((frame) => frame.time > time)
    .map((frame) => shownOpacity(frame, MARKER));
  const farthest = direction === 1 ? Math.max(opacity, ...after) : Math.min(opacity, ...after);
  const goesOn = (farthest - opacity) * direction;
  const input = direction === 1 ? 'close' : 'open';
  const measure = `Opacity at the ${input}: ${opacity.toFixed(2)}. ${
    direction === 1 ? 'Highest' : 'Lowest'
  } after it: ${farthest.toFixed(2)}.`;
  return verdictOf(measure, [
    direction === 1 &&
      opacity >= FULL_OPACITY &&
      'The enter is over at the close: the popup shows at full opacity.',
    direction === -1 && opacity === 0 && 'The exit is over at the open: the popup does not show.',
    goesOn > GOING_BACK_LIMIT &&
      `After the ${input}, the opacity goes on to ${farthest.toFixed(2)} before it goes back.`,
  ]);
}

/** The distance from a point to a rectangle, 0 inside it. */
function distanceToRect(point: { x: number; y: number }, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

/** The distance between two rectangles, 0 when they touch or overlap. */
function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width));
  const dy = Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height));
  return Math.hypot(dx, dy);
}

const CLOSES_BY_ITSELF = 'The popup closes by itself after its enter.';

interface Place {
  origin: string;
  popup: Rect;
  anchor: Rect;
}

/**
 * The computed `transform-origin` of the popup that shows, its rectangle and that of its anchor,
 * after the end of each animation. Right after a transition of `transform` ends, WebKit can give the
 * rectangle of the first frame of the transition.
 */
async function readPlace(page: Page): Promise<Place | undefined> {
  await page.waitForFunction(() => document.getAnimations().length === 0, undefined, {
    timeout: LAYER_WAIT,
  });
  return page.evaluate(() => {
    const popup = Array.from(document.querySelectorAll('[data-bench="popup"]')).find((element) =>
      element.checkVisibility(),
    );
    const anchor =
      document.querySelector('[data-bench="anchor"]') ??
      document.querySelector('[data-bench="trigger"]');
    if (popup === undefined || anchor === null) {
      return undefined;
    }
    const rectOf = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      origin: getComputedStyle(popup).transformOrigin,
      popup: rectOf(popup),
      anchor: rectOf(anchor),
    };
  });
}

/** Where the popup is from its anchor: above it, below it, beside it or on it. */
function sideOf({ popup, anchor }: Place): 'above' | 'below' | 'beside' | 'on' {
  if (popup.y + popup.height <= anchor.y + ORIGIN_TOLERANCE) {
    return 'above';
  }
  if (popup.y >= anchor.y + anchor.height - ORIGIN_TOLERANCE) {
    return 'below';
  }
  return gapBetween(popup, anchor) > 0 ? 'beside' : 'on';
}

/**
 * The popup grows in its enter, and the point of its computed `transform-origin` is no further from
 * the anchor than the gap between them, plus `ORIGIN_TOLERANCE`. With `flipped`, the run first
 * finds the side where the popup opens. Then it puts the anchor at that edge of the viewport, and
 * the popup must open on the other side.
 */
async function originAtAnchor(
  page: Page,
  popup: string | null,
  flipped: boolean,
): Promise<CaseResult> {
  const input = inputOf(page, popup);
  let expected: 'above' | 'below' | undefined;
  if (flipped) {
    const notOpen = await openToRest(page, popup);
    if (notOpen !== undefined) {
      return fail(notOpen);
    }
    const opened = await readPlace(page);
    if (opened === undefined) {
      return fail(CLOSES_BY_ITSELF);
    }
    const opensAbove = sideOf(opened) === 'above';
    await input.close();
    if (!(await waitUntilGone(page, MARKER))) {
      return fail(`The popup still shows ${milliseconds(LAYER_WAIT)} after the close.`);
    }
    await page.addStyleTag({ content: EDGE_STYLES[opensAbove ? 'above' : 'below'] });
    expected = opensAbove ? 'below' : 'above';
  }
  await startRecording(page);
  await input.open();
  const atRest = await waitForRest(page);
  const recording = await stopRecording(page);
  if (!atRest) {
    return fail(`The ${input.openName} does not open the popup.`);
  }
  if (!isValid(recording)) {
    return notValid(recording);
  }
  const place = await readPlace(page);
  if (place === undefined) {
    return fail(CLOSES_BY_ITSELF);
  }
  const widths = recording.frames.flatMap((frame) =>
    (frame.elements[MARKER] ?? [])
      .filter((element) => element.visible)
      .map(({ rect }) => rect.width),
  );
  const growth = Math.min(...widths) / place.popup.width;
  const distance = distanceToRect(originPoint(place.origin, place.popup), place.anchor);
  const gap = gapBetween(place.popup, place.anchor);
  const side = sideOf(place);
  const edge = expected === 'above' ? 'bottom' : 'top';
  const sideText =
    expected === undefined ? '' : ` At the ${edge} edge, the popup is ${side} the anchor.`;
  const measure = `Origin ${distance.toFixed(1)} px from the anchor. Gap ${gap.toFixed(1)} px.${sideText}`;
  return verdictOf(measure, [
    expected !== undefined &&
      side !== expected &&
      `The popup does not flip: at the ${edge} edge, it is ${side} the anchor.`,
    growth > GROWTH_LIMIT &&
      `The popup does not grow: its smallest width in the enter is ${String(Math.round(growth * 100))}% of its width at rest.`,
    distance > gap + ORIGIN_TOLERANCE &&
      `The origin is ${distance.toFixed(1)} px from the anchor, and the gap is ${gap.toFixed(1)} px.`,
  ]);
}

/**
 * The fixtures `Animated<Popup>`: `trigger` opens the popup `popup`, which has the animation. The
 * popup goes from the hidden style of `style.css` to opacity 1 and scale 1 in 500 ms, linear, and
 * back the same way. A press on the trigger and Escape open and close Dialog, Popover, Menu,
 * Select, Combobox, NavigationMenu and Drawer. The pointer on the trigger and away opens and
 * closes Tooltip and PreviewCard, with an open delay and a close delay of 0. A fixture whose
 * positioner anchors to a wrapper marks that element with `anchor`.
 */
export const POPUP_ANIMATIONS: Group = {
  id: 'popup-animations',
  title: 'Popup animations',
  notes: {
    'vase-ui': 'A CSS transition on the classes of a Vue `<Transition>`, as the handbook shows.',
    'reka-ui':
      'A CSS transition on the classes of a Vue `<Transition>`, as the animation guide shows. For an anchored popup, Vue puts the classes on the element that places the popup. The inline `transform` of that element replaces the scale.',
    'ark-ui': 'CSS keyframes on `data-state`, the only form of the docs.',
    'headless-ui':
      'A CSS transition on the classes of `TransitionChild` for Dialog, and of a Vue `<Transition>` for the other popups, as the docs show.',
    vuetify0: 'The docs give no animation of a popup.',
    'base-ui':
      'A CSS transition on `data-starting-style` and `data-ending-style`, as the docs show.',
  },
  checks: [
    {
      id: 'enter-from-first-frame',
      title: 'The enter starts in the first frame and ends after one duration.',
      expectation: STARTING,
      scenario: FIXTURES,
      cases: POPUPS,
      run: enterFromFirstFrame,
    },
    {
      id: 'exit-before-removal',
      title: 'The exit runs to its end before the popup leaves the screen.',
      expectation: STARTING,
      scenario: FIXTURES,
      cases: POPUPS,
      run: exitBeforeRemoval,
    },
    {
      id: 'close-during-enter-no-jump',
      title: 'A close during the enter shows no jump.',
      expectation: REVERSING,
      scenario: FIXTURES,
      cases: POPUPS,
      run: async (page, popup) => noJump(await closeDuringEnter(page, popup)),
    },
    {
      id: 'close-during-enter-goes-back',
      title: 'A close during the enter goes back from where the popup is.',
      expectation: REVERSING,
      scenario: FIXTURES,
      cases: POPUPS,
      run: async (page, popup) => goesBack(await closeDuringEnter(page, popup), 1),
    },
    {
      id: 'reopen-during-exit-no-jump',
      title: 'An open during the exit shows no jump.',
      expectation: REVERSING,
      scenario: FIXTURES,
      cases: POPUPS,
      run: async (page, popup) => noJump(await openDuringExit(page, popup)),
    },
    {
      id: 'reopen-during-exit-goes-back',
      title: 'An open during the exit goes back from where the popup is.',
      expectation: REVERSING,
      scenario: FIXTURES,
      cases: POPUPS,
      run: async (page, popup) => goesBack(await openDuringExit(page, popup), -1),
    },
    {
      id: 'origin-at-anchor',
      title: 'The popup grows from its anchor.',
      expectation: ANCHOR_ORIGIN,
      scenario: FIXTURES,
      cases: ANCHORED_POPUPS,
      run: (page, popup) => originAtAnchor(page, popup, false),
    },
    {
      id: 'origin-after-flip',
      title: 'After a flip to the other side, the popup grows from its anchor.',
      expectation: ANCHOR_ORIGIN,
      scenario: FIXTURES,
      cases: ANCHORED_POPUPS,
      run: (page, popup) => originAtAnchor(page, popup, true),
    },
  ],
};
