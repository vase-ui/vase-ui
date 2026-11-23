import type { Page } from 'playwright';
import { centerOf, slowDrag } from './input.ts';
import { readAfterInput } from './layers.ts';
import { HANDLE_TOLERANCE } from './samples.ts';
import type { CaseResult, Group } from './types.ts';

const SCENARIO = 'ResizablePanels';
const PANEL = 'panel-1';
const HANDLE = 'handle';

/** The sizes of `panel-1` in the fixture, in percent. */
const SIZES = { default: 50, min: 20, max: 80, collapsed: 0 };
/** How far a size after a key can be from the expected size, in pixels. */
const KEY_TOLERANCE = 1;
/** How far the size after Home or End can be from the expected size, in pixels. */
const END_TOLERANCE = 2;
/** How far `aria-valuenow` can be from the size of `panel-1` in percent. */
const VALUE_TOLERANCE = 1;
/** The pointer moves of the drags, in pixels. */
const DRAG = { follow: -100, overFrame: 150, pastLimit: -400 };
/** The pointer move of each event on the way back of the drag past the limit, as in `slowDrag`. */
const RETURN_STEP = 5;

const APG_SPLITTER = {
  text: 'WAI-ARIA APG, Window Splitter Pattern',
  url: 'https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/',
};
const POINTER_CAPTURE = {
  text: 'Pointer Events, pointer capture',
  url: 'https://www.w3.org/TR/pointerevents3/#pointer-capture',
};

interface Layout {
  /** The width of `panel-1`. */
  width: number;
  /** The horizontal center of the handle. */
  center: number;
  /** `aria-valuenow` of the handle, or `NaN` with no such attribute. */
  value: number;
}

function result(pass: boolean, measure: string, reason: string): CaseResult {
  return pass ? { verdict: 'pass', measure } : { verdict: 'fail', measure, reason };
}

function handleOf(page: Page) {
  return page.locator(`[data-bench="${HANDLE}"]`);
}

function px(value: number): string {
  return `${String(Math.round(value))} px`;
}

/** A move on the horizontal axis in words, such as `100 px to the left`. */
function move(by: number): string {
  return Math.round(by) === 0 ? '0 px' : `${px(Math.abs(by))} to the ${by < 0 ? 'left' : 'right'}`;
}

/** The layout two frames after an input, so that a library that waits for a frame has drawn it. */
async function layoutOf(page: Page): Promise<Layout> {
  const frame = await readAfterInput(page, [PANEL, HANDLE]);
  const [panel] = frame.elements[PANEL] ?? [];
  const [handle] = frame.elements[HANDLE] ?? [];
  if (panel === undefined || handle === undefined) {
    throw new Error('The page shows no panel 1 or no handle.');
  }
  return {
    width: panel.rect.width,
    center: handle.rect.x + handle.rect.width / 2,
    value: Number((await handleOf(page).getAttribute('aria-valuenow')) ?? Number.NaN),
  };
}

/**
 * The width that is 100% for the library: `panel-1` has its default size at the start. A library
 * can take the room of the handle into the 100%, so the base is not always 800 px.
 */
function baseOf(start: Layout): number {
  return (start.width * 100) / SIZES.default;
}

function isNear(value: number, expected: number, tolerance: number): boolean {
  return Math.abs(value - expected) <= tolerance;
}

async function separatorRole(page: Page, caseName: string | null): Promise<CaseResult> {
  const handle = handleOf(page);
  const attribute = async (name: string) => (await handle.getAttribute(name)) ?? 'none';
  if (caseName === 'limits') {
    const min = await attribute('aria-valuemin');
    const max = await attribute('aria-valuemax');
    // The APG: aria-valuemin is "the position where the primary pane has its minimum size. This is
    // typically 0." Enter and Home can collapse the panel, so that position can be the collapsed size.
    const minPasses = [SIZES.min, SIZES.collapsed].some((size) =>
      isNear(Number(min), size, VALUE_TOLERANCE),
    );
    const measure = `aria-valuemin ${min}, aria-valuemax ${max}.`;
    return result(minPasses && isNear(Number(max), SIZES.max, VALUE_TOLERANCE), measure, measure);
  }
  if (caseName === 'controls') {
    const named = await handle.evaluate((element) =>
      (element.getAttribute('aria-controls') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map(
          (id) =>
            element.ownerDocument
              .getElementById(id)
              ?.closest('[data-bench]')
              ?.getAttribute('data-bench') ?? `no element "${id}"`,
        ),
    );
    const measure =
      named.length === 0 ? 'No aria-controls.' : `aria-controls names ${named.join(', ')}.`;
    return result(named.length === 1 && named[0] === PANEL, measure, measure);
  }
  const role = await attribute('role');
  await page.keyboard.press('Tab');
  const focused = await handle.evaluate((element) => element === document.activeElement);
  const value = await attribute('aria-valuenow');
  const measure = `Role ${role}. ${focused ? 'Tab focuses the handle' : 'Tab does not focus the handle'}. aria-valuenow ${value}.`;
  return result(
    role === 'separator' && focused && isNear(Number(value), SIZES.default, VALUE_TOLERANCE),
    measure,
    measure,
  );
}

/**
 * Whether `aria-valuenow` gives the width of `panel-1` in percent of the base after a key, and
 * changes in the direction of the width. A key step of 1% is in the tolerance, so the direction
 * finds a value that is one key late.
 */
function valueFollows(after: Layout, before: Layout, base: number): boolean {
  return (
    isNear(after.value, (after.width * 100) / base, VALUE_TOLERANCE) &&
    Math.sign(after.value - before.value) === Math.sign(Math.round(after.width - before.width))
  );
}

async function arrowKeys(page: Page): Promise<CaseResult> {
  await handleOf(page).focus();
  const start = await layoutOf(page);
  const base = baseOf(start);
  const widths = [px(start.width)];
  let before = start;
  const presses = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft'];
  for (const [index, key] of presses.entries()) {
    await page.keyboard.press(key);
    const after = await layoutOf(page);
    widths.push(px(after.width));
    const press = `${key} ${String((index % 3) + 1)}`;
    const measure = `Panel 1: ${widths.join(', ')}.`;
    if (key === 'ArrowRight' && after.width <= before.width) {
      return result(false, measure, `${press} does not make panel 1 wider.`);
    }
    if (!valueFollows(after, before, base)) {
      return result(
        false,
        measure,
        `After ${press}, aria-valuenow is ${String(after.value)} while panel 1 is ${((after.width * 100) / base).toFixed(1)}%.`,
      );
    }
    before = after;
  }
  const measure = `Panel 1: ${widths.join(', ')}.`;
  return result(
    isNear(before.width, start.width, KEY_TOLERANCE),
    measure,
    `After three ArrowLeft presses, panel 1 is ${px(before.width)}, not ${px(start.width)}.`,
  );
}

async function homeAndEnd(page: Page, caseName: string | null): Promise<CaseResult> {
  await handleOf(page).focus();
  const base = baseOf(await layoutOf(page));
  const key = caseName === 'End' ? 'End' : 'Home';
  await page.keyboard.press(key);
  const { width } = await layoutOf(page);
  const measure = `${key}: panel 1 is ${px(width)}.`;
  if (key === 'End') {
    const largest = (base * SIZES.max) / 100;
    return result(
      isNear(width, largest, END_TOLERANCE),
      measure,
      `End gives ${px(width)}, not ${px(largest)}.`,
    );
  }
  // "This may completely collapse the primary pane." (APG, Home)
  const smallest = (base * SIZES.min) / 100;
  const collapsed = (base * SIZES.collapsed) / 100;
  return result(
    isNear(width, smallest, END_TOLERANCE) || isNear(width, collapsed, END_TOLERANCE),
    isNear(width, collapsed, END_TOLERANCE) ? `${measure} The panel collapses.` : measure,
    `Home gives ${px(width)}, not ${px(smallest)} or ${px(collapsed)}.`,
  );
}

async function enterCollapses(page: Page): Promise<CaseResult> {
  await handleOf(page).focus();
  const start = await layoutOf(page);
  const collapsed = (baseOf(start) * SIZES.collapsed) / 100;
  await page.keyboard.press('Enter');
  const first = await layoutOf(page);
  await page.keyboard.press('Enter');
  const second = await layoutOf(page);
  const measure = `Panel 1: ${px(start.width)}, then ${px(first.width)}, then ${px(second.width)}.`;
  if (!isNear(first.width, collapsed, KEY_TOLERANCE)) {
    return result(false, measure, `Enter gives ${px(first.width)}, not ${px(collapsed)}.`);
  }
  return result(
    isNear(second.width, start.width, KEY_TOLERANCE),
    measure,
    `The second Enter gives ${px(second.width)}, not ${px(start.width)}.`,
  );
}

/** A slow mouse drag of the handle by `by` pixels. The handle is read before the release. */
async function dragBy(page: Page, by: number): Promise<CaseResult> {
  const from = await centerOf(page, HANDLE);
  const start = await layoutOf(page);
  let end = start;
  await slowDrag(page, 'mouse', from, { x: by, y: 0 }, async () => {
    end = await layoutOf(page);
  });
  const moved = end.center - start.center;
  const measure = `The handle moves ${move(moved)} with a pointer move of ${move(by)}.`;
  return result(isNear(moved, by, HANDLE_TOLERANCE), measure, measure);
}

/**
 * A slow drag past the least size of `panel-1`, then back to the start, before the release. A handle
 * that adds the moves of the pointer from the limit, in place of its position, ends past the start.
 */
async function returnsUnderPointer(page: Page): Promise<CaseResult> {
  const from = await centerOf(page, HANDLE);
  const start = await layoutOf(page);
  let far = start;
  let back = start;
  await slowDrag(page, 'mouse', from, { x: DRAG.pastLimit, y: 0 }, async () => {
    far = await layoutOf(page);
    await page.mouse.move(from.x, from.y, { steps: Math.abs(DRAG.pastLimit) / RETURN_STEP });
    back = await layoutOf(page);
  });
  const offset = back.center - start.center;
  const place = Math.round(offset) === 0 ? 'under the pointer' : `${move(offset)} of the pointer`;
  const measure = `At the far end, the handle moves ${move(far.center - start.center)}. Back at the start, the handle is ${place}.`;
  return result(isNear(offset, 0, HANDLE_TOLERANCE), measure, measure);
}

/**
 * The fixture `ResizablePanels`: a horizontal `group` of 800 px of panels, `panel-1` with a default
 * size of 50%, a least size of 20%, a greatest size of 80% and a collapsed size of 0, then `handle`,
 * then `panel-2`, which holds the iframe `frame`.
 */
export const RESIZABLE_PANELS: Group = {
  id: 'resizable-panels',
  title: 'Resizable panels',
  notes: { 'ark-ui': 'Preview in its docs.' },
  checks: [
    {
      id: 'separator-role',
      title:
        'The handle has the role separator with its value, its limits and the panel that it controls. The APG says that aria-valuemin gives "the position where the primary pane has its minimum size", and that "This is typically 0". So 0 passes, and so does the least size of 20%.',
      expectation: APG_SPLITTER,
      scenario: SCENARIO,
      cases: ['role and value', 'limits', 'controls'],
      run: separatorRole,
    },
    {
      id: 'arrow-keys',
      title: 'The arrow keys move the handle.',
      expectation: APG_SPLITTER,
      scenario: SCENARIO,
      run: arrowKeys,
    },
    {
      id: 'home-and-end',
      title:
        'Home and End move the handle to the smallest and the largest size. The APG calls these keys optional, and says of Home: "This may completely collapse the primary pane."',
      expectation: APG_SPLITTER,
      scenario: SCENARIO,
      cases: ['Home', 'End'],
      run: homeAndEnd,
    },
    {
      id: 'enter-collapses',
      title: 'Enter collapses the panel, and Enter again gives its size back.',
      expectation: APG_SPLITTER,
      scenario: SCENARIO,
      run: enterCollapses,
    },
    {
      id: 'follows-pointer',
      title: 'The handle follows the pointer in a drag.',
      expectation: POINTER_CAPTURE,
      scenario: SCENARIO,
      run: (page) => dragBy(page, DRAG.follow),
    },
    {
      id: 'drag-over-iframe',
      title: 'The drag goes on while the pointer is over an iframe.',
      expectation: POINTER_CAPTURE,
      scenario: SCENARIO,
      run: (page) => dragBy(page, DRAG.overFrame),
    },
    {
      id: 'returns-under-pointer',
      title: 'After a drag past the limit and back, the handle is under the pointer again.',
      expectation: POINTER_CAPTURE,
      scenario: SCENARIO,
      run: returnsUnderPointer,
    },
  ],
};
