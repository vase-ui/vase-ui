import { shallowRef } from 'vue';
import { useTimeout } from '../common/useTimeout';
import { isComposing } from '../popup/layer';
import type { List, ListItem } from './list';

export interface MatchOptions {
  /** A disabled item does not match. */
  skipDisabled?: boolean | undefined;
  /** The items that are not shown also match, such as those of a closed popup. */
  hidden?: boolean | undefined;
}

/**
 * The first item after `from` whose text starts with `typed`, with no regard to case. The search
 * goes on from the first item after the last one.
 */
export function nextMatch(
  list: List,
  typed: string,
  from: ListItem | null,
  options: MatchOptions = {},
): ListItem | undefined {
  const items = list.items({ hidden: options.hidden });
  const start = from ? items.indexOf(from) + 1 : 0;
  const search = typed.toLocaleLowerCase();
  return [...items.slice(start), ...items.slice(0, start)].find(
    (item) =>
      !(options.skipDisabled && item.disabled) &&
      list.text(item).toLocaleLowerCase().startsWith(search),
  );
}

/**
 * The typeahead of a list: the keys of one character make a string, and the string goes 500 ms
 * after the last key. Each key of one string searches from the item after the one that had the
 * highlight when the string began.
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
      timer.start(options.resetMs ?? 500, () => (typed.value = ''));
      event.preventDefault();
      // With no item that starts with a double letter, the same key again goes to the next item
      // with that letter.
      const match =
        nextMatch(list, text, from, options) ??
        (text === key.repeat(text.length / key.length)
          ? nextMatch(list, key, last, options)
          : undefined);
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
