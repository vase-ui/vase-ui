/** The time in milliseconds after the last key, after which a typed string starts again. */
export const TYPEAHEAD_RESET_MS = 500;

/**
 * The index of the next text that starts with the typed string, with no regard to case, or -1.
 * Each key of one string searches from the text after `start`, the text that had the highlight
 * when the string began. When no text starts with a string of one letter typed more than one time,
 * the search is for that letter, from the text after `current`.
 */
export function nextTextMatch(
  texts: readonly string[],
  typed: string,
  start: number,
  current: number,
): number {
  const lower = typed.toLowerCase();
  const fits = (text: string, prefix: string) => text.toLowerCase().startsWith(prefix);
  let prefix = lower;
  let from = start;
  // One letter typed more than one time.
  const repeated = /^(.)\1+$/su.exec(lower);
  if (repeated && !texts.some((text) => fits(text, lower))) {
    prefix = repeated[1] ?? '';
    from = current;
  }
  for (let step = 1; step <= texts.length; step += 1) {
    const index = (from + step + texts.length) % texts.length;
    if (fits(texts[index] ?? '', prefix)) return index;
  }
  return -1;
}
