const PERCENT = /^(-?\d*\.?\d+)%?$/;

/**
 * The percent of a size: a number, or a string of a number with an optional `%`.
 * Another form throws.
 */
export function parseSize(value: number | string): number {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value;
    }
  } else {
    const [, text] = PERCENT.exec(value.trim()) ?? [];
    if (text !== undefined) {
      return Number(text);
    }
  }
  throw new Error(
    `Vase UI: The size ${typeof value === 'string' ? `"${value}"` : value} is not valid. A panel cannot take a size from it. Use a number, or a string of a number with an optional "%": 30, "30" or "30%".`,
  );
}
