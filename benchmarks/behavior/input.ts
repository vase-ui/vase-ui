// Real input of a person. A script event is not used: a library that calls `setPointerCapture`
// throws for a pointer event that a script dispatches.
import type { Page } from 'playwright';

export type PointerKind = 'mouse' | 'touch';

interface Point {
  x: number;
  y: number;
}

/** The center of the first visible element of a marker. */
export async function centerOf(page: Page, marker: string): Promise<Point> {
  const box = await page
    .locator(`[data-bench="${marker}"]`)
    .filter({ visible: true })
    .first()
    .boundingBox();
  if (box === null) {
    throw new Error(`The page shows no ${marker}.`);
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * A real mouse press at a point. Unlike `locator.click()`, it does not wait for an element that
 * takes events, so it can press on an inert element.
 */
export async function pressAt(page: Page, point: Point): Promise<void> {
  await page.mouse.click(point.x, point.y);
}

/**
 * Moves the focus to the element of a marker, then presses Enter. In WebKit a mouse press does not
 * focus a button, so a layer that a press opens has no trigger to give the focus back to.
 */
export async function enterOn(page: Page, marker: string): Promise<void> {
  await page.locator(`[data-bench="${marker}"]`).filter({ visible: true }).first().focus();
  await page.keyboard.press('Enter');
}

/** A pointer of one kind. Touch goes through the Chrome DevTools Protocol, in Chromium only. */
interface Pointer {
  down: (point: Point) => Promise<void>;
  move: (point: Point) => Promise<void>;
  up: () => Promise<void>;
}

async function pointerOf(page: Page, kind: PointerKind): Promise<Pointer> {
  if (kind === 'mouse') {
    return {
      down: async ({ x, y }) => {
        await page.mouse.move(x, y);
        await page.mouse.down();
      },
      move: ({ x, y }) => page.mouse.move(x, y),
      up: () => page.mouse.up(),
    };
  }
  const cdp = await page.context().newCDPSession(page);
  return {
    down: async (point) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    },
    move: async (point) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    },
    up: async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
}

/** The step of a slow drag: 5 pixels each 25 ms. */
const SLOW_STEP = { pixels: 5, milliseconds: 25 };
/** The hold before the release of a slow drag, so that the release has no speed. */
const SLOW_HOLD = 200;
/** The moves of a flick, with no wait between them. */
const FLICK_MOVES = 3;

/**
 * A slow drag from a point by a distance: 5 pixels each 25 ms, then a hold of 200 ms.
 * `beforeRelease` runs while the pointer is still down.
 */
export async function slowDrag(
  page: Page,
  kind: PointerKind,
  from: Point,
  by: Point,
  beforeRelease?: () => Promise<void>,
): Promise<void> {
  const pointer = await pointerOf(page, kind);
  const steps = Math.ceil(Math.hypot(by.x, by.y) / SLOW_STEP.pixels);
  await pointer.down(from);
  for (let step = 1; step <= steps; step++) {
    await pointer.move({ x: from.x + (by.x * step) / steps, y: from.y + (by.y * step) / steps });
    await page.waitForTimeout(SLOW_STEP.milliseconds);
  }
  await page.waitForTimeout(SLOW_HOLD);
  await beforeRelease?.();
  await pointer.up();
}

/** A flick from a point by a distance: three moves with no wait, and a release at once. */
export async function flick(page: Page, kind: PointerKind, from: Point, by: Point): Promise<void> {
  const pointer = await pointerOf(page, kind);
  await pointer.down(from);
  for (let move = 1; move <= FLICK_MOVES; move++) {
    await pointer.move({
      x: from.x + (by.x * move) / FLICK_MOVES,
      y: from.y + (by.y * move) / FLICK_MOVES,
    });
  }
  await pointer.up();
}
