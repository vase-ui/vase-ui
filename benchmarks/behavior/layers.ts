// The checks of two modal layers, one on the other: a dialog in a dialog, or a drawer in a drawer.
// The markers of a fixture have a prefix, such as `dialog`: `dialog-1-trigger` opens the layer
// `dialog-1`, which holds `dialog-1-action`, `dialog-1-count` and `dialog-2-trigger`.
import type { Page } from 'playwright';
import { centerOf, enterOn, pressAt } from './input.ts';
import type { Frame } from './recorder.ts';
import { FULL_OPACITY, INPUT_DURING_EXIT_DELAY, LAYER_WAIT, shownOpacity } from './samples.ts';
import type { CaseResult } from './types.ts';

/** The markers of the two layers of a fixture. */
export function markersOf(prefix: string) {
  return {
    first: `${prefix}-1`,
    second: `${prefix}-2`,
    firstTrigger: `${prefix}-1-trigger`,
    secondTrigger: `${prefix}-2-trigger`,
    firstAction: `${prefix}-1-action`,
    firstCount: `${prefix}-1-count`,
  };
}

const LAYER_NAMES = ['1', '2'];

/** Reads the markers now. */
export function read(page: Page, markers: readonly string[]): Promise<Frame> {
  return page.evaluate((pageMarkers) => window.behaviorRecorder.read(pageMarkers), markers);
}

function nextFrame(page: Page, markers: readonly string[]): Promise<Frame> {
  return page.evaluate((pageMarkers) => window.behaviorRecorder.nextFrame(pageMarkers), markers);
}

/**
 * Reads the markers two frames after an input, so that work that a library defers to the next
 * frame, such as a move of the focus, is done.
 */
export async function readAfterInput(page: Page, markers: readonly string[]): Promise<Frame> {
  await nextFrame(page, markers);
  return nextFrame(page, markers);
}

/** Reads the markers in each frame until `isDone` holds, for `limit` ms at most. */
export async function waitForFrame(
  page: Page,
  markers: readonly string[],
  isDone: (frame: Frame) => boolean,
  limit = LAYER_WAIT,
): Promise<{ frame: Frame; done: boolean }> {
  const start = performance.now();
  for (;;) {
    const frame = await nextFrame(page, markers);
    if (isDone(frame)) {
      return { frame, done: true };
    }
    if (performance.now() - start > limit) {
      return { frame, done: false };
    }
  }
}

export function isShown(frame: Frame, marker: string): boolean {
  return (frame.elements[marker] ?? []).some((element) => element.visible);
}

/** The layers that show in a frame, such as `dialog 1, dialog 2`, or `none`. */
export function shownLayers(frame: Frame, prefix: string): string {
  const shown = LAYER_NAMES.filter((name) => isShown(frame, `${prefix}-${name}`));
  return shown.length === 0 ? 'none' : shown.map((name) => `${prefix} ${name}`).join(', ');
}

/** The text of a count, two frames after the input, so that the app has rendered it. */
export async function countAfterInput(page: Page, marker: string): Promise<string> {
  await readAfterInput(page, []);
  return (await page.locator(`[data-bench="${marker}"]`).textContent()) ?? 'none';
}

/** Waits until a layer shows at full opacity, so that its enter is over. */
async function waitForRest(page: Page, marker: string): Promise<void> {
  const { done } = await waitForFrame(
    page,
    [marker],
    (frame) => shownOpacity(frame, marker) >= FULL_OPACITY,
    // The enter of the shared look is 500 ms, so the wait has two times the usual limit.
    2 * LAYER_WAIT,
  );
  if (!done) {
    throw new Error(
      `${marker.charAt(0).toUpperCase()}${marker.slice(1).replace('-', ' ')} does not open.`,
    );
  }
}

/** Waits until no element of a layer shows. Returns `false` when the layer still shows. */
export async function waitUntilGone(page: Page, marker: string): Promise<boolean> {
  const { done } = await waitForFrame(page, [marker], (frame) => !isShown(frame, marker));
  return done;
}

/** Opens the first layer with the keyboard, and waits for the end of its enter. */
export async function openFirst(page: Page, prefix: string): Promise<void> {
  const markers = markersOf(prefix);
  await enterOn(page, markers.firstTrigger);
  await waitForRest(page, markers.first);
}

/** Opens the second layer from the first with the keyboard, and waits for the end of its enter. */
export async function openSecond(page: Page, prefix: string): Promise<void> {
  const markers = markersOf(prefix);
  await enterOn(page, markers.secondTrigger);
  await waitForRest(page, markers.second);
}

export async function openBoth(page: Page, prefix: string): Promise<void> {
  await openFirst(page, prefix);
  await openSecond(page, prefix);
}

function result(pass: boolean, measure: string, reason: string): CaseResult {
  return pass ? { verdict: 'pass', measure } : { verdict: 'fail', measure, reason };
}

/** The focus is in the layer on top no later than `LAYER_WAIT` after its open. */
export async function focusMovesIn(page: Page, prefix: string): Promise<CaseResult> {
  const { second, secondTrigger } = markersOf(prefix);
  await openFirst(page, prefix);
  await enterOn(page, secondTrigger);
  const { frame, done } = await waitForFrame(
    page,
    [second],
    (sample) => sample.focusInLayer[second] === true,
  );
  return result(done, `Focus: ${frame.active}.`, `The focus is on ${frame.active}.`);
}

/** Tab and Shift+Tab, four times each, keep the focus in the layer on top. */
export async function tabStaysIn(page: Page, prefix: string): Promise<CaseResult> {
  const { second } = markersOf(prefix);
  await openBoth(page, prefix);
  const keys = ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab'];
  for (const [index, key] of keys.entries()) {
    await page.keyboard.press(key);
    const frame = await readAfterInput(page, [second]);
    if (frame.focusInLayer[second] !== true) {
      const press = `Press ${String(index + 1)} of 8 (${key})`;
      return result(
        false,
        `${press}: ${frame.active}.`,
        `${press} moves the focus to ${frame.active}.`,
      );
    }
  }
  return result(true, `Each of 8 presses keeps the focus in ${prefix} 2.`, '');
}

/** A real press on a button of the layer below does not use the button. */
export async function belowIsInert(page: Page, prefix: string): Promise<CaseResult> {
  const { firstAction, firstCount } = markersOf(prefix);
  await openBoth(page, prefix);
  await pressAt(page, await centerOf(page, firstAction));
  const count = await countAfterInput(page, firstCount);
  // A layer that the press closes runs its exit, so the read of the open layers waits for its end.
  await page.waitForTimeout(LAYER_WAIT);
  const frame = await read(page, [`${prefix}-1`, `${prefix}-2`]);
  return result(
    count === '0',
    `Count ${count}. Open: ${shownLayers(frame, prefix)}.`,
    `The press on ${prefix} 1 uses its button.`,
  );
}

/** One Escape closes the layer on top only. A second Escape closes the layer below. */
export async function escapeClosesTop(page: Page, prefix: string): Promise<CaseResult> {
  const { first, second } = markersOf(prefix);
  const layers = [first, second];
  await openBoth(page, prefix);
  await page.keyboard.press('Escape');
  await waitUntilGone(page, second);
  const afterFirst = await read(page, layers);
  if (isShown(afterFirst, second) || !isShown(afterFirst, first)) {
    const open = shownLayers(afterFirst, prefix);
    return result(false, `After one Escape, open: ${open}.`, `After one Escape, open: ${open}.`);
  }
  await page.keyboard.press('Escape');
  await waitUntilGone(page, first);
  const afterSecond = await read(page, layers);
  const open = shownLayers(afterSecond, prefix);
  return result(
    open === 'none',
    `After two Escape presses, open: ${open}.`,
    `After two Escape presses, open: ${open}.`,
  );
}

/**
 * After each close by Escape, the focus is on the trigger of the closed layer. The case is the
 * layer: `${prefix} 2` reads the focus after the first Escape, `${prefix} 1` after the second.
 */
export async function focusReturns(
  page: Page,
  prefix: string,
  caseName: string | null,
): Promise<CaseResult> {
  const { first, second, firstTrigger, secondTrigger } = markersOf(prefix);
  await openBoth(page, prefix);
  await page.keyboard.press('Escape');
  await waitUntilGone(page, second);
  if (caseName === `${prefix} 1`) {
    await page.keyboard.press('Escape');
    await waitUntilGone(page, first);
  }
  const trigger = caseName === `${prefix} 1` ? firstTrigger : secondTrigger;
  const frame = await readAfterInput(page, [trigger]);
  return result(
    frame.focus[trigger] === true,
    `Focus: ${frame.active}.`,
    frame.active === 'body' ? 'The focus is lost.' : `The focus goes to ${frame.active}.`,
  );
}

/**
 * The layer below takes the input `INPUT_DURING_EXIT_DELAY` ms after an Escape closes the layer on
 * top, while that layer can still be in its exit. The cases: `focus` (the focus is in the layer
 * below), `escape` (a second Escape closes the layer below), `press` (a press on the button of the
 * layer below counts).
 */
export async function inputDuringExit(
  page: Page,
  prefix: string,
  caseName: string | null,
): Promise<CaseResult> {
  const { first, second, firstAction, firstCount } = markersOf(prefix);
  const layers = [first, second];
  await openBoth(page, prefix);
  const actionCenter = await centerOf(page, firstAction);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(INPUT_DURING_EXIT_DELAY);
  const atInput = await read(page, layers);
  const measure = `Opacity of ${prefix} 2 at the input: ${shownOpacity(atInput, second).toFixed(2)}.`;
  if (caseName === 'focus') {
    const pass = atInput.focusInLayer[first] === true && atInput.focusInLayer[second] !== true;
    return result(
      pass,
      `${measure} Focus: ${atInput.active}.`,
      `The focus is on ${atInput.active}.`,
    );
  }
  if (caseName === 'escape') {
    await page.keyboard.press('Escape');
    const gone = await waitUntilGone(page, first);
    return result(gone, measure, `The second Escape does not close ${prefix} 1.`);
  }
  await pressAt(page, actionCenter);
  const count = await countAfterInput(page, firstCount);
  return result(count === '1', `${measure} Count ${count}.`, 'The press does not count.');
}
