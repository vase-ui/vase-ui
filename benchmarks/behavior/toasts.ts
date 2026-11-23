import type { Page } from 'playwright';
import type { Library } from '../scenarios.ts';
import { enterOn, flick, pressAt, type PointerKind } from './input.ts';
import { isShown, read, readAfterInput, waitForFrame, waitUntilGone } from './layers.ts';
import type { ElementSample, Frame, Recording } from './recorder.ts';
import { isValid, largestFrameGap, LAYER_WAIT } from './samples.ts';
import type { CaseResult, Group } from './types.ts';

const SCENARIO = 'Toasts';
const TOAST = 'toast';
const PAGE_BUTTONS = ['add-toast', 'add-important-toast'] as const;
const TITLE = 'Saved';
const DESCRIPTION = 'The file is saved.';
/** A point outside the toasts and the buttons of the page. */
const OUTSIDE = { x: 8, y: 8 };

/** The time of a toast in the timer checks, in milliseconds. */
const TIMER_TIMEOUT = 2000;
// The times of the timer checks, in milliseconds after the toast shows.
/** The pointer or the focus goes on the toast. */
const PAUSE_AT = 500;
/** The toast must still show. Then the pointer or the focus leaves. */
const STILL_SHOWN_AT = 4000;
/** The toast must be gone. */
const GONE_BY = 7000;
/** The most Tab presses that a path of the keyboard can take. */
const TAB_LIMIT = 10;
/** The drag of a swipe, to the right: a direction of the swipe of each library that has one. */
const SWIPE = { x: 200, y: 0 };
/** A toast that moves less than this, in pixels, has no move to check. */
const STACK_MOVE_MIN = 16;
/** The largest part of the move of a toast that one frame can show. */
const STACK_STEP_LIMIT = 0.5;
/** The number of frames with no move that shows that the toasts are at rest. */
const REST_FRAMES = 6;
/** The longest wait for the toasts to come to rest, in milliseconds. */
const REST_WAIT = 3000;

type ToastLibrary = Exclude<Library['id'], 'headless-ui'>;

/** What the docs of each library give for the steps of the checks. `hotkey` is a key of Playwright. */
const DOCS: Record<ToastLibrary, { hotkey?: string; swipe: boolean; priority: boolean }> = {
  // https://vase-ui.com/components/toast#general-usage
  'vase-ui': { hotkey: 'F6', swipe: true, priority: true },
  // https://base-ui.com/react/components/toast
  'base-ui': { hotkey: 'F6', swipe: true, priority: true },
  // https://reka-ui.com/docs/components/toast#keyboard-interactions
  'reka-ui': { hotkey: 'F8', swipe: true, priority: true },
  // https://ark-ui.com/vue/docs/components/toast: the hotkey Alt+T, no swipe and no priority.
  'ark-ui': { hotkey: 'Alt+KeyT', swipe: false, priority: false },
  // https://0.vuetifyjs.com/components/semantic/snackbar: no hotkey and no swipe.
  vuetify0: { swipe: false, priority: true },
};

/** The library of the page, from its address `<setup>/<library>/behavior/<scenario>/`. */
function libraryOf(page: Page): ToastLibrary {
  const segments = new URL(page.url()).pathname.split('/');
  const id = segments[segments.indexOf('behavior') - 1] ?? '';
  if (!Object.hasOwn(DOCS, id)) {
    throw new Error(`The address ${page.url()} names no library with toasts.`);
  }
  return id as ToastLibrary;
}

function result(pass: boolean, measure: string, reason: string): CaseResult {
  return pass ? { verdict: 'pass', measure } : { verdict: 'fail', measure, reason };
}

/**
 * The focused element: its marker or the marker of an ancestor in the fixture, else its tag name and
 * role, such as `ol` or `div with the role region`.
 */
function focusedElement(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    const marker = active?.closest('[data-bench]')?.getAttribute('data-bench');
    if (active === null || active === document.body) {
      return 'body';
    }
    if (marker !== undefined && marker !== null && marker !== 'instance') {
      return marker;
    }
    const role = active.getAttribute('role');
    return `${active.tagName.toLowerCase()}${role === null ? '' : ` with the role ${role}`}`;
  });
}

function shownToasts(frame: Frame): ElementSample[] {
  return (frame.elements[TOAST] ?? []).filter((element) => element.visible);
}

/** Presses Enter on a button of the page, and waits until one more toast shows. */
async function addToast(page: Page, button: string): Promise<void> {
  const before = shownToasts(await read(page, [TOAST])).length;
  await enterOn(page, button);
  const { done } = await waitForFrame(page, [TOAST], (frame) => shownToasts(frame).length > before);
  if (!done) {
    throw new Error(`Enter on ${button} shows no toast.`);
  }
}

/** Waits until no shown toast moves for `REST_FRAMES` frames. */
async function waitForRest(page: Page): Promise<void> {
  let still = 0;
  let previous = '';
  const { done } = await waitForFrame(
    page,
    [TOAST],
    (frame) => {
      const rects = JSON.stringify(
        shownToasts(frame).map(({ rect }) => [rect.x, rect.y, rect.width, rect.height]),
      );
      still = rects === previous ? still + 1 : 0;
      previous = rects;
      return still >= REST_FRAMES;
    },
    REST_WAIT,
  );
  if (!done) {
    throw new Error('The toasts do not come to rest.');
  }
}

/** Opens the page again with the URL parameter `timeout`, which sets the time of each toast. */
async function openWithTimeout(page: Page, timeout: number): Promise<void> {
  const url = new URL(page.url());
  url.searchParams.set('timeout', String(timeout));
  await page.goto(url.href);
  await page.locator('[data-bench="instance"] > *').first().waitFor();
}

/** A live region that holds a text of the toast. */
interface LiveRegion {
  /** The role of the region, such as `role alert`, else its tag name. */
  element: string;
  politeness: 'polite' | 'assertive';
  /** Whether `aria-hidden` takes the text out of the accessibility tree. */
  hidden: boolean;
}

/** In the page: the live regions that hold a text. */
function liveRegionsOf(texts: readonly string[]): LiveRegion[] {
  const LIVE_ROLES: Record<string, string> = {
    alert: 'assertive',
    status: 'polite',
    log: 'polite',
  };
  const regions = new Map<string, LiveRegion>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const content = node.textContent ?? '';
    const parent = node.parentElement;
    // The nearest element with `aria-live` or a live role gives the politeness of a text.
    const region = parent?.closest('[aria-live], [role="alert"], [role="status"], [role="log"]');
    if (
      parent === null ||
      region === undefined ||
      region === null ||
      !texts.some((text) => content.includes(text))
    ) {
      continue;
    }
    const role = region.getAttribute('role') ?? '';
    const politeness = region.getAttribute('aria-live') ?? LIVE_ROLES[role];
    if (politeness === 'polite' || politeness === 'assertive') {
      const found: LiveRegion = {
        element: region.hasAttribute('role') ? `role ${role}` : region.tagName.toLowerCase(),
        politeness,
        hidden: parent.closest('[aria-hidden="true"]') !== null,
      };
      regions.set(JSON.stringify(found), found);
    }
  }
  return [...regions.values()];
}

/**
 * Adds a toast with a button, and reads the live regions that hold its text in each frame, for
 * `LAYER_WAIT` at most. A library can fill a live region some frames after the toast shows.
 */
async function liveRegionsAfter(
  page: Page,
  button: string,
  isDone: (region: LiveRegion) => boolean,
): Promise<LiveRegion[]> {
  await addToast(page, button);
  const start = performance.now();
  for (;;) {
    const regions = await page.evaluate(liveRegionsOf, [TITLE, DESCRIPTION]);
    if (regions.some(isDone) || performance.now() - start > LAYER_WAIT) {
      return regions;
    }
    await readAfterInput(page, []);
  }
}

function regionsText(regions: readonly LiveRegion[]): string {
  const names = regions.map(
    ({ element, politeness, hidden }) =>
      `${element} (${politeness})${hidden ? ' under aria-hidden' : ''}`,
  );
  return `Live regions of the text: ${names.length === 0 ? 'none' : names.join(', ')}.`;
}

async function liveRegion(page: Page): Promise<CaseResult> {
  const isShownToReaders = (region: LiveRegion) => !region.hidden;
  const regions = await liveRegionsAfter(page, 'add-toast', isShownToReaders);
  return result(
    regions.some(isShownToReaders),
    regionsText(regions),
    regions.length === 0
      ? 'The text of the toast is in no live region.'
      : 'The live region of the toast is under aria-hidden.',
  );
}

async function importantIsAssertive(page: Page): Promise<CaseResult> {
  const isAssertive = (region: LiveRegion) => !region.hidden && region.politeness === 'assertive';
  const regions = await liveRegionsAfter(page, 'add-important-toast', isAssertive);
  const hiddenAssertive = regions.some((region) => region.politeness === 'assertive');
  return result(
    regions.some(isAssertive),
    regionsText(regions),
    !DOCS[libraryOf(page)].priority
      ? 'The library has no option for a toast of high priority.'
      : hiddenAssertive
        ? 'The assertive live region of the toast is under aria-hidden.'
        : 'The important toast is in no assertive live region.',
  );
}

async function keepsFocus(page: Page): Promise<CaseResult> {
  await addToast(page, 'add-toast');
  const frame = await readAfterInput(page, ['add-toast']);
  const focused = await focusedElement(page);
  return result(
    frame.focus['add-toast'] === true,
    `Focus: ${focused}.`,
    `The toast moves the focus to ${focused}.`,
  );
}

/**
 * A path of the keyboard: its keys, the page button that had the focus last, whether the focus is in
 * a toast at the end, and the focused element at the end.
 */
interface KeyboardPath {
  keys: string[];
  lastPageButton: string;
  inToast: boolean;
  focused: string;
}

/**
 * Moves the focus from `add-toast` into the toast: the hotkey of the docs, then Tab presses until
 * the focus is in a toast, `TAB_LIMIT` at most.
 */
async function focusToast(page: Page): Promise<KeyboardPath> {
  const markers = [TOAST, ...PAGE_BUTTONS];
  const { hotkey } = DOCS[libraryOf(page)];
  const keys: string[] = [];
  let lastPageButton = 'none';
  let frame = await read(page, markers);
  for (;;) {
    lastPageButton = PAGE_BUTTONS.find((button) => frame.focus[button]) ?? lastPageButton;
    const tabs = keys.filter((key) => key === 'Tab').length;
    if (frame.focus[TOAST] === true || tabs === TAB_LIMIT) {
      return {
        keys,
        lastPageButton,
        inToast: frame.focus[TOAST] === true,
        focused: await focusedElement(page),
      };
    }
    const key = hotkey !== undefined && keys.length === 0 ? hotkey : 'Tab';
    await page.keyboard.press(key);
    keys.push(key);
    frame = await readAfterInput(page, markers);
  }
}

/** The name in the docs of a key of Playwright that the docs name in another way. */
const KEY_NAMES: Readonly<Record<string, string>> = { 'Alt+KeyT': 'Alt+T' };

/** The keys of a path, such as `F6 and 1 Tab press`. */
function keysText(keys: readonly string[]): string {
  const tabs = keys.filter((key) => key === 'Tab').length;
  const presses = tabs === 0 ? [] : [`${String(tabs)} Tab ${tabs === 1 ? 'press' : 'presses'}`];
  const hotkeys = keys.filter((key) => key !== 'Tab').map((key) => KEY_NAMES[key] ?? key);
  return [...hotkeys, ...presses].join(' and ') || 'no key';
}

async function keyboardReachesAction(page: Page): Promise<CaseResult> {
  await addToast(page, 'add-toast');
  const { keys, inToast, focused } = await focusToast(page);
  return result(
    inToast,
    `Keys: ${keysText(keys)}. Focus: ${focused}.`,
    `After ${keysText(keys)}, the focus is on ${focused}.`,
  );
}

async function focusReturns(page: Page): Promise<CaseResult> {
  await addToast(page, 'add-toast');
  const { keys, lastPageButton, inToast, focused } = await focusToast(page);
  if (!inToast) {
    const measure = `After ${keysText(keys)}, the focus is on ${focused}.`;
    return result(false, measure, 'The keyboard does not reach the toast.');
  }
  let close = await read(page, ['toast-close']);
  for (let press = 0; close.focus['toast-close'] !== true && press < TAB_LIMIT; press++) {
    await page.keyboard.press('Tab');
    close = await readAfterInput(page, ['toast-close']);
  }
  if (close.focus['toast-close'] !== true) {
    const measure = `In the toast, Tab does not reach toast-close. Focus: ${await focusedElement(page)}.`;
    return result(false, measure, 'The keyboard does not reach the close button.');
  }
  await page.keyboard.press('Enter');
  if (!(await waitUntilGone(page, TOAST))) {
    return result(false, 'The toast shows 1 s after Enter.', 'Enter does not close the toast.');
  }
  const after = await readAfterInput(page, [lastPageButton]);
  const focusedAfter = await focusedElement(page);
  return result(
    after.focus[lastPageButton] === true,
    `Focus before the toast: ${lastPageButton}. Focus after the close: ${focusedAfter}.`,
    focusedAfter === 'body' ? 'The focus is lost.' : `The focus goes to ${focusedAfter}.`,
  );
}

/** Waits until a time from a start, both from `performance.now()`. */
async function waitUntil(page: Page, start: number, time: number): Promise<void> {
  await page.waitForTimeout(Math.max(0, start + time - performance.now()));
}

/**
 * With a toast time of `TIMER_TIMEOUT`, the pointer or the keyboard focus goes on the toast at
 * `PAUSE_AT`. The toast must show at `STILL_SHOWN_AT`. Then the pointer or the focus leaves, and the
 * toast must be gone by `GONE_BY`.
 */
async function timerStops(page: Page, input: 'pointer' | 'focus'): Promise<CaseResult> {
  await openWithTimeout(page, TIMER_TIMEOUT);
  await addToast(page, 'add-toast');
  const start = performance.now();
  await waitUntil(page, start, PAUSE_AT);
  if (input === 'pointer') {
    const box = await page
      .locator(`[data-bench="${TOAST}"]`)
      .filter({ visible: true })
      .boundingBox();
    if (box === null) {
      return result(false, `At ${String(PAUSE_AT)} ms, no toast shows.`, 'The toast goes early.');
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    const { keys, inToast, focused } = await focusToast(page);
    if (!inToast) {
      const measure = `After ${keysText(keys)}, the focus is on ${focused}.`;
      return result(false, measure, 'The keyboard does not reach the toast.');
    }
  }
  await waitUntil(page, start, STILL_SHOWN_AT);
  if (!isShown(await read(page, [TOAST]), TOAST)) {
    const measure = `At ${String(STILL_SHOWN_AT)} ms, the toast is gone.`;
    return result(false, measure, `The toast goes while the ${input} is on it.`);
  }
  if (input === 'pointer') {
    await page.mouse.move(OUTSIDE.x, OUTSIDE.y);
  } else {
    await pressAt(page, OUTSIDE);
  }
  const { done } = await waitForFrame(
    page,
    [TOAST],
    (frame) => !isShown(frame, TOAST),
    start + GONE_BY - performance.now(),
  );
  const gone = Math.round(performance.now() - start);
  return result(
    done,
    done
      ? `At ${String(STILL_SHOWN_AT)} ms, the toast shows. It goes at ${String(gone)} ms.`
      : `At ${String(GONE_BY)} ms, the toast shows.`,
    `The toast stays after the ${input} leaves.`,
  );
}

async function swipeCloses(page: Page, caseName: string | null): Promise<CaseResult> {
  await addToast(page, 'add-toast');
  await waitForRest(page);
  const box = await page.locator(`[data-bench="${TOAST}"]`).filter({ visible: true }).boundingBox();
  if (box === null) {
    throw new Error('No toast shows.');
  }
  // A point on the text of the toast, away from its buttons.
  const from = { x: box.x + box.width / 4, y: box.y + box.height / 2 };
  await flick(page, (caseName ?? 'mouse') as PointerKind, from, SWIPE);
  const release = performance.now();
  const gone = await waitUntilGone(page, TOAST);
  return result(
    gone,
    gone
      ? `The toast is gone ${String(Math.round(performance.now() - release))} ms after the release.`
      : 'The toast shows 1 s after the release.',
    DOCS[libraryOf(page)].swipe
      ? 'The swipe does not close the toast.'
      : 'The library has no swipe.',
  );
}

interface Point {
  x: number;
  y: number;
}

function center({ rect }: ElementSample): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The whole move of a toast and its largest move between two frames, while it shows. */
function moveOf(recording: Recording, id: number): { move: number; largestStep: number } {
  const points = recording.frames.flatMap((frame) =>
    (frame.elements[TOAST] ?? [])
      .filter((element) => element.id === id && element.visible)
      .map(center),
  );
  let largestStep = 0;
  for (let index = 1; index < points.length; index++) {
    largestStep = Math.max(
      largestStep,
      distance(points[index] as Point, points[index - 1] as Point),
    );
  }
  const [first, last] = [points[0], points.at(-1)];
  return { move: first && last ? distance(first, last) : 0, largestStep };
}

async function stackMoves(page: Page): Promise<CaseResult> {
  for (let toast = 0; toast < 3; toast++) {
    await addToast(page, 'add-toast');
  }
  await waitForRest(page);
  // The recorder numbers an element when it first reads it, so the newest toast has the largest
  // number.
  const atRest = await read(page, [TOAST]);
  const toasts = shownToasts(atRest);
  const newest = Math.max(...toasts.map((element) => element.id));
  const index = atRest.elements[TOAST]?.findIndex((element) => element.id === newest) ?? 0;
  const close = page
    .locator(`[data-bench="${TOAST}"]`)
    .nth(index)
    .locator('[data-bench="toast-close"]');
  // The pointer goes on the button first, so that a stack that expands under the pointer comes to
  // rest before the press.
  const box = await close.boundingBox();
  if (box === null) {
    throw new Error('The newest toast shows no close button.');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await waitForRest(page);
  await page.evaluate((marker) => {
    window.behaviorRecorder.start([marker]);
  }, TOAST);
  await page.mouse.down();
  await page.mouse.up();
  const gone = await waitForFrame(page, [TOAST], (frame) =>
    (frame.elements[TOAST] ?? []).every((element) => element.id !== newest || !element.visible),
  );
  await waitForRest(page);
  const recording = await page.evaluate(() => window.behaviorRecorder.stop());
  if (!gone.done) {
    return result(
      false,
      'The newest toast shows 1 s after the press.',
      'The press does not close the toast.',
    );
  }
  if (!isValid(recording)) {
    return {
      verdict: 'not-valid',
      measure: `A gap of ${String(Math.round(largestFrameGap(recording.frames)))} ms between two frames.`,
    };
  }
  const older = toasts.filter((element) => element.id !== newest).sort((a, b) => a.id - b.id);
  const moves = older.map((element, order) => ({
    name: `Toast ${String(order + 1)}`,
    ...moveOf(recording, element.id),
  }));
  const measure = moves
    .map(
      ({ name, move, largestStep }) =>
        `${name} moves ${String(Math.round(move))} px, ${String(Math.round(largestStep))} px at most in one frame.`,
    )
    .join(' ');
  const jump = moves.find(
    ({ move, largestStep }) => move >= STACK_MOVE_MIN && largestStep > move * STACK_STEP_LIMIT,
  );
  return result(
    jump === undefined,
    measure,
    jump === undefined
      ? ''
      : `${jump.name} moves ${String(Math.round(jump.largestStep))} of its ${String(Math.round(jump.move))} px in one frame.`,
  );
}

const TIMING_ADJUSTABLE = {
  text: 'WCAG 2.2, Success Criterion 2.2.1 Timing Adjustable',
  url: 'https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html',
};

/**
 * The fixture `Toasts`: `add-toast` adds a toast (`toast`) with the title "Saved", the description
 * "The file is saved.", the action `toast-action` and the close button `toast-close`.
 * `add-important-toast` adds the same toast with the option of the docs for a high priority. The
 * URL parameter `timeout` sets the time of each toast, else 60,000 ms.
 */
export const TOASTS: Group = {
  id: 'toasts',
  title: 'Toasts',
  notes: {
    vuetify0:
      'The docs expand the stack with pointer listeners of the example, so the fixture keeps it collapsed.',
  },
  checks: [
    {
      id: 'keeps-focus',
      title: 'A new toast does not take the focus.',
      expectation: {
        text: 'WAI-ARIA APG, Alert Pattern',
        url: 'https://www.w3.org/WAI/ARIA/apg/patterns/alert/',
      },
      scenario: SCENARIO,
      run: keepsFocus,
    },
    {
      id: 'live-region',
      title: 'A toast is in a live region.',
      expectation: {
        text: 'WCAG 2.2, Success Criterion 4.1.3 Status Messages',
        url: 'https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html',
      },
      scenario: SCENARIO,
      run: liveRegion,
    },
    {
      id: 'important-is-assertive',
      title: 'An important toast is announced at once.',
      expectation: {
        text: 'WAI-ARIA 1.2, alert role',
        url: 'https://www.w3.org/TR/wai-aria-1.2/#alert',
      },
      scenario: SCENARIO,
      run: importantIsAssertive,
    },
    {
      id: 'timer-stops-at-hover',
      title: 'The timer stops while the pointer is on a toast.',
      expectation: TIMING_ADJUSTABLE,
      scenario: SCENARIO,
      run: (page) => timerStops(page, 'pointer'),
    },
    {
      id: 'timer-stops-at-focus',
      title: 'The timer stops while the focus is in a toast.',
      expectation: TIMING_ADJUSTABLE,
      scenario: SCENARIO,
      run: (page) => timerStops(page, 'focus'),
    },
    {
      id: 'keyboard-reaches-action',
      title: 'The keyboard reaches the action of a toast.',
      expectation: {
        text: 'WCAG 2.2, Success Criterion 2.1.1 Keyboard',
        url: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
      },
      scenario: SCENARIO,
      run: keyboardReachesAction,
    },
    {
      id: 'focus-returns',
      title: 'After the keyboard closes a toast, the focus goes back to where it was.',
      expectation: {
        text: 'WCAG 2.2, Success Criterion 2.4.3 Focus Order',
        url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
      },
      scenario: SCENARIO,
      run: focusReturns,
    },
    {
      id: 'swipe-closes',
      title: 'A swipe closes a toast.',
      expectation: {
        text: 'Android, SwipeDismissBehavior',
        url: 'https://developer.android.com/reference/com/google/android/material/behavior/SwipeDismissBehavior',
      },
      scenario: SCENARIO,
      cases: ['mouse', 'touch'],
      run: swipeCloses,
    },
    {
      id: 'stack-moves',
      title: 'When a toast closes, the toasts that stay move over more than one frame.',
      expectation: {
        text: 'Apple Human Interface Guidelines, Motion',
        url: 'https://developer.apple.com/design/human-interface-guidelines/motion',
      },
      scenario: SCENARIO,
      run: stackMoves,
    },
  ],
};
