import { shallowRef } from 'vue';
import { useTimeout } from '../common/useTimeout';
import { isComposing } from '../popup/layer';
import type { List, ListItem } from './list';

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
  // The match is the same in each runtime: `toLocaleLowerCase()` follows the locale of the
  // visitor, and in Turkish it gives `ı` for `I`.
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

export interface MatchOptions {
  /** A disabled item does not match. */
  skipDisabled?: boolean | undefined;
  /** The items that are not shown also match, such as those of a closed popup. */
  hidden?: boolean | undefined;
}

/**
 * The typeahead of a list: the keys of one character make a string, and the string goes 500 ms
 * after the last key. The match follows `nextTextMatch`.
 */
export function useTypeahead(
  list: List,
  options: MatchOptions & {
    resetMs?: number | undefined;
    /** The item that a new string starts after. The default is the highlighted item. */
    current?: (() => ListItem | null) | undefined;
    /** Acts on a match. The default highlights the item. */
    onMatch?: ((item: ListItem, event: KeyboardEvent) => void) | undefined;
  } = {},
) {
  const typed = shallowRef('');
  const timer = useTimeout();
  let from: ListItem | null = null;
  let last: ListItem | null = null;

  return {
    /** A string is in progress, so Space is a character of it. */
    get typing() {
      return typed.value !== '';
    },
    /** Returns `true` when the typeahead used the key and prevented its default. */
    onKeydown(event: KeyboardEvent) {
      const { key } = event;
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return false;
      if (isComposing(event) || !/^.$/u.test(key) || (key === ' ' && !typed.value)) {
        return false;
      }
      if (!typed.value) {
        from = options.current ? options.current() : list.highlighted;
        last = from;
      }
      const text = typed.value + key;
      typed.value = text;
      timer.start(options.resetMs ?? TYPEAHEAD_RESET_MS, () => (typed.value = ''));
      event.preventDefault();
      const items = list.items({ hidden: options.hidden });
      const texts = items.map((item) =>
        options.skipDisabled && item.disabled ? '' : list.text(item),
      );
      const index = nextTextMatch(
        texts,
        text,
        from ? items.indexOf(from) : -1,
        last ? items.indexOf(last) : -1,
      );
      const match = items[index];
      if (!match) return true;
      last = match;
      if (options.onMatch) options.onMatch(match, event);
      else list.highlight(match, 'keyboard', event);
      return true;
    },
    /** Ends the string. */
    reset() {
      timer.clear();
      typed.value = '';
    },
  };
}
