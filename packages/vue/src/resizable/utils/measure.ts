import { ownerDocument, ownerWindow } from '../../common/owner';
import type { Orientation } from '../../internals/types';
import type { Measurement } from './layout';

/**
 * What the root reads from the page after the mount. A pixel is a layout pixel: a scale transform
 * around the root does not change a length, a pin or a reported size.
 */
export interface RootMeasurement {
  /**
   * The room that the panels share on the axis of the root, in pixels: the sum of the content boxes
   * of the panel elements. It is greater than 0.
   */
  space: number;
  /**
   * The size of the root on the screen over its size in layout pixels.
   */
  scale: number;
  /**
   * The font size of the root element of the document.
   */
  rem: number;
  /**
   * The font size of the element of `Resizable.Root`.
   */
  rootFontSize: number;
  /**
   * The font size of each panel element, by panel id.
   */
  panelFontSizes: ReadonlyMap<string, number>;
  viewportWidth: number;
  viewportHeight: number;
}

interface MeasuredPanel {
  id: string;
  element: HTMLElement | null;
}

// The rectangle of an element has fractions of a pixel. Two reads of a layout that did not change
// can differ by a few of them.
const SPACE_TOLERANCE = 0.05;

/**
 * Reads the measurement of a root. A root that has no room for its panels, such as a root with
 * `display: none`, has no measurement.
 */
export function readMeasurement(
  rootElement: HTMLElement,
  panels: readonly MeasuredPanel[],
  orientation: Orientation,
): RootMeasurement | undefined {
  const horizontal = orientation === 'horizontal';
  const win = ownerWindow(rootElement);
  const rootRect = rootElement.getBoundingClientRect();
  const screenSize = horizontal ? rootRect.width : rootRect.height;
  const layoutSize = horizontal ? rootElement.offsetWidth : rootElement.offsetHeight;
  // `offsetWidth` is a whole number. A root with a fraction in its size then differs from its
  // rectangle by less than 1 px, with no scale.
  const scale =
    layoutSize === 0 || Math.abs(screenSize - layoutSize) < 1 ? 1 : screenSize / layoutSize;
  const rootFontSize = Number.parseFloat(win.getComputedStyle(rootElement).fontSize);
  const panelFontSizes = new Map<string, number>();
  let space = 0;
  for (const { id, element } of panels) {
    if (element === null) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    const style = win.getComputedStyle(element);
    // A panel adds its padding and its border to the share that its size gives. They are not in the
    // room that the panels share.
    const edges = (
      horizontal
        ? [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth]
        : [style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth]
    ).reduce((total, edge) => total + Number.parseFloat(edge), 0);
    space += Math.max((horizontal ? rect.width : rect.height) / scale - edges, 0);
    panelFontSizes.set(id, Number.parseFloat(style.fontSize));
  }
  if (space <= 0) {
    return undefined;
  }
  return {
    space,
    scale,
    rem: Number.parseFloat(
      win.getComputedStyle(ownerDocument(rootElement).documentElement).fontSize,
    ),
    rootFontSize,
    panelFontSizes,
    viewportWidth: win.innerWidth,
    viewportHeight: win.innerHeight,
  };
}

export function isSameMeasurement(a: RootMeasurement, b: RootMeasurement): boolean {
  return (
    Math.abs(a.space - b.space) < SPACE_TOLERANCE &&
    a.scale === b.scale &&
    a.rem === b.rem &&
    a.rootFontSize === b.rootFontSize &&
    a.viewportWidth === b.viewportWidth &&
    a.viewportHeight === b.viewportHeight &&
    a.panelFontSizes.size === b.panelFontSizes.size &&
    [...a.panelFontSizes].every(([id, size]) => b.panelFontSizes.get(id) === size)
  );
}

/**
 * The numbers that change a size of a panel into percent. Without an id they are the numbers of
 * the root, where `em` is the font size of the element of `Resizable.Root`.
 */
export function getMeasurement(measurement: RootMeasurement, id?: string): Measurement {
  const { space, rem, viewportWidth, viewportHeight } = measurement;
  return {
    space,
    rem,
    em:
      id === undefined
        ? measurement.rootFontSize
        : (measurement.panelFontSizes.get(id) ?? measurement.rootFontSize),
    viewportWidth,
    viewportHeight,
  };
}

/**
 * The size of a panel that the `resize` event and `getSize()` report. The pixels have three
 * decimals, and they are 0 while there is no measurement.
 */
export function getPanelSize(
  percent: number,
  space: number | undefined,
): { percent: number; pixels: number } {
  return {
    percent,
    pixels: space === undefined ? 0 : Math.round((percent / 100) * space * 1000) / 1000,
  };
}
