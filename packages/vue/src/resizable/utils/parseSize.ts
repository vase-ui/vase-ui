import type { Layout } from './layout';

/**
 * The numbers that change a size with a unit into percent of the panel space.
 */
export interface Measurement {
  /**
   * The room that the panels share on the axis of the root, in pixels. It is greater than 0.
   */
  space: number;
  /**
   * The font size of the root element of the document, in pixels.
   */
  rem: number;
  /**
   * The font size of the element that has the size, in pixels.
   */
  em: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * The size of each panel by panel id: a number, or a string of a number with a unit.
 * A string with no unit, or with `%`, is percent of the panel space.
 */
export type LayoutSnapshot = Record<string, number | string>;

type Length = 'px' | 'em' | 'rem' | 'vh' | 'vw';

const SIZE = /^(\d*\.?\d+)(%|px|em|rem|vh|vw)?$/;

function readSize(value: number | string): { amount: number; unit: '%' | Length } {
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value >= 0) {
      return { amount: value, unit: '%' };
    }
  } else {
    const [, text, unit = '%'] = SIZE.exec(value.trim()) ?? [];
    if (text !== undefined) {
      return { amount: Number(text), unit: isLengthUnit(unit) ? unit : '%' };
    }
  }
  throw new Error(
    `Vase UI: The size ${typeof value === 'string' ? `"${value}"` : value} is not valid. Resizable cannot use it as a size. Use a number of 0 or more, or a string of such a number with an optional unit: "%", "px", "em", "rem", "vh" or "vw". Examples are 30, "30%" and "200px".`,
  );
}

// The pattern of `SIZE` allows no other unit.
function isLengthUnit(unit: string): unit is Length {
  return unit !== '%';
}

function toPixels(amount: number, unit: Length, measurement: Measurement): number {
  switch (unit) {
    case 'px':
      return amount;
    case 'em':
      return amount * measurement.em;
    case 'rem':
      return amount * measurement.rem;
    case 'vh':
      return (amount / 100) * measurement.viewportHeight;
    case 'vw':
      return (amount / 100) * measurement.viewportWidth;
  }
}

/**
 * The percent of the panel space for a size. A number, and a string with no unit or with `%`, are
 * percent already. A length needs the measurement: with none, the result is `undefined`.
 * Another form throws.
 */
export function parseSize(
  value: number | string,
  measurement: Measurement | undefined,
): number | undefined {
  const { amount, unit } = readSize(value);
  if (!isLengthUnit(unit)) {
    return amount;
  }
  return measurement === undefined
    ? undefined
    : (toPixels(amount, unit, measurement) / measurement.space) * 100;
}

/**
 * The size in pixels of the panel space. It is `undefined` while there is no measurement.
 */
export function parsePixels(
  value: number | string,
  measurement: Measurement | undefined,
): number | undefined {
  if (measurement === undefined) {
    return undefined;
  }
  const { amount, unit } = readSize(value);
  return isLengthUnit(unit)
    ? toPixels(amount, unit, measurement)
    : (amount / 100) * measurement.space;
}

/**
 * The unit of a size, or `undefined` for a number and for a form that is not valid. This function
 * does not throw: `parseSize` reports a size that is not valid where the root uses the size.
 */
function getUnit(value: number | string | undefined): '%' | Length | undefined {
  if (typeof value !== 'string') {
    return value === undefined ? undefined : '%';
  }
  const [, text, unit = '%'] = SIZE.exec(value.trim()) ?? [];
  return text === undefined ? undefined : isLengthUnit(unit) ? unit : '%';
}

/**
 * Whether the size is a length: `px`, `em`, `rem`, `vh` or `vw`.
 */
export function isLength(value: number | string | undefined): boolean {
  const unit = getUnit(value);
  return unit !== undefined && isLengthUnit(unit);
}

/**
 * Whether the size is a length in `vh` or `vw`, which follow the size of the window.
 */
export function isViewportLength(value: number | string | undefined): boolean {
  const unit = getUnit(value);
  return unit === 'vh' || unit === 'vw';
}

/**
 * The layout in percent that a layout of sizes gives, and the pixels that it gives to the panels
 * that keep their size in pixels. An entry that is a length has no percent while there is no
 * measurement, so it is left out.
 */
export function normalizeLayout(
  snapshot: LayoutSnapshot,
  fixedIds: ReadonlySet<string>,
  getMeasurement: (id: string) => Measurement | undefined,
): { layout: Layout; pins: Record<string, number> } {
  const entries = Object.entries(snapshot).flatMap(([id, value]) => {
    const measurement = getMeasurement(id);
    const percent = parseSize(value, measurement);
    return percent === undefined ? [] : [{ id, value, percent, measurement }];
  });
  return {
    layout: Object.fromEntries(entries.map(({ id, percent }) => [id, percent])),
    pins: Object.fromEntries(
      entries.flatMap(({ id, value, measurement }) => {
        const pixels =
          fixedIds.has(id) && isLength(value) ? parsePixels(value, measurement) : undefined;
        return pixels === undefined ? [] : [[id, pixels]];
      }),
    ),
  };
}
