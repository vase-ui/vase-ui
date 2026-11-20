import { shallowRef } from 'vue';
import { useTimeout } from '../common/useTimeout';
import type { List, ListItem } from '../list/list';
import { isComposing } from '../popup/layer';

/**
 * The first item after `from` whose text starts with `typed`, with no regard to case. The search
 * goes on from the start of the list, and `from` comes last.
 */
export function nextMatch(list: List, typed: string, from: ListItem | null) {
  const items = list.items();
  const start = from ? items.indexOf(from) + 1 : 0;
  const ordered = [...items.slice(start), ...items.slice(0, start)];
  const lower = typed.toLocaleLowerCase();
  return ordered.find((item) => list.text(item).toLocaleLowerCase().startsWith(lower));
}

/**
 * Moves the highlight to the item whose text starts with the typed characters. The string ends
 * 500 ms after the last key.
 */
export function useTypeahead(list: List, options: { resetMs?: number } = {}) {
  const typed = shallowRef('');
  const timer = useTimeout();
  // Each key of one string searches from the item that had the highlight when the string began, so
  // that a match that still fits stays.
  let from: ListItem | null = null;

  return {
    /** The string is not empty: Space is a character of it. */
    get typing() {
      return typed.value !== '';
    },
    onKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return false;
      if (event.key.length !== 1 || isComposing(event)) return false;
      if (event.key === ' ' && typed.value === '') return false;
      if (typed.value === '') from = list.highlighted;
      const next = typed.value + event.key;
      typed.value = next;
      timer.start(options.resetMs ?? 500, () => (typed.value = ''));
      // With no text that starts with a double letter, the same key again goes to the next item
      // with that letter.
      const repeated = [...next].every((character) => character === next[0]);
      const match =
        nextMatch(list, next, from) ??
        (repeated ? nextMatch(list, event.key, list.highlighted) : undefined);
      event.preventDefault();
      if (match) list.highlight(match, 'keyboard', event);
      return true;
    },
  };
}
