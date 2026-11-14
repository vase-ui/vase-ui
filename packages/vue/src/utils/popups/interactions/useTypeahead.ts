import { onDeactivated, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { EMPTY_ARRAY } from '../../../common/empty';
import { contains } from '../../../common/shadowDom';
import { useTimeout } from '../../../common/useTimeout';
import { isElementVisible, isListIndexDisabled } from '../../../internals/composite/listIndex';
import type { DisabledIndices } from '../../../internals/composite/listIndex';
import { stopEvent } from '../event';
import type { InteractionProps, PopupInteractionStore, TypeaheadElementProps } from '../types';

export interface UseTypeaheadProps {
  /**
   * A ref which contains an array of strings whose indices match the HTML
   * elements of the list. The composable reads it only in a handler.
   */
  listRef: Readonly<Ref<Array<string | null>>>;
  /**
   * The index of the active (focused or highlighted) item in the list.
   */
  activeIndex: MaybeRefOrGetter<number | null>;
  /**
   * Callback invoked with the matching index if found as the user types.
   */
  onMatch?: ((index: number, event: KeyboardEvent) => void) | undefined;
  /**
   * Optional list of item elements that correspond to `listRef` indices.
   * When an element exists for an index, typeahead skips it if it is hidden by
   * `display: none`, `visibility: hidden|collapse`, other browser-reported
   * visibility checks, or native disabled state.
   */
  elementsRef?: Readonly<Ref<Array<HTMLElement | null>>> | undefined;
  /**
   * Indices that are disabled, either as an array or a predicate (the same shape as
   * `useListNavigation`'s `disabledIndices`). Disabled items are skipped while matching,
   * so a single keypress advances to the next selectable item (matching native `<select>`
   * and arrow-key navigation). The explicit disabled check doesn't read `elementsRef`, so
   * consumers whose items stay mounted-but-hidden while closed can still skip disabled items
   * without passing `elementsRef`. The composable reads the option one time, so a function is the
   * form that follows a change.
   */
  disabledIndices?: DisabledIndices | undefined;
  /**
   * Callback invoked with the current typing activity as the user types.
   */
  onTyping?: ((isTyping: boolean) => void) | undefined;
  /**
   * Whether the composable is enabled, including its event handlers.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * The number of milliseconds to wait before resetting the typed string.
   * @default 750
   */
  resetMs?: MaybeRefOrGetter<number | undefined>;
  /**
   * The index of the selected item in the list, if available.
   * @default null
   */
  selectedIndex?: MaybeRefOrGetter<number | null | undefined>;
}

/**
 * Provides a matching callback that can be used to focus an item as the user
 * types, often used in tandem with `useListNavigation()`.
 * @see https://floating-ui.com/docs/useTypeahead
 */
export function useTypeahead(
  store: PopupInteractionStore,
  props: UseTypeaheadProps,
): TypeaheadElementProps {
  const { listRef, elementsRef, onMatch, disabledIndices, onTyping } = props;

  const getActiveIndex = () => toValue(props.activeIndex);
  const getSelectedIndex = () => toValue(props.selectedIndex) ?? null;

  const timeout = useTimeout();
  let typed = '';
  let prevIndex: number | null = getSelectedIndex() ?? getActiveIndex() ?? -1;
  let matchIndex: number | null = null;

  function onKeydown(event: KeyboardEvent) {
    if (!(toValue(props.enabled) ?? true)) {
      return;
    }

    function getElement(index: number) {
      return elementsRef?.value[index];
    }

    function isItemAvailable(index: number) {
      const element = getElement(index);
      if ((element && !isElementVisible(element)) || element?.matches(':disabled')) {
        return false;
      }
      // Visibility and native disabled state are handled above; pass an empty
      // element list so `isListIndexDisabled` resolves only the explicit
      // `disabledIndices` (array/predicate) and skips its own fallbacks.
      // Consumers that don't pass `disabledIndices` keep matching every visible
      // item except native disabled elements provided through `elementsRef`.
      return disabledIndices == null || !isListIndexDisabled(EMPTY_ARRAY, index, disabledIndices);
    }

    function getMatchingIndex(list: Array<string | null>, string: string, startIndex = 0) {
      if (list.length === 0) {
        return -1;
      }

      const normalizedStartIndex = ((startIndex % list.length) + list.length) % list.length;
      const lowerString = string.toLowerCase();

      for (let offset = 0; offset < list.length; offset += 1) {
        const index = (normalizedStartIndex + offset) % list.length;
        const text = list[index];
        if (!text?.toLowerCase().startsWith(lowerString) || !isItemAvailable(index)) {
          continue;
        }
        return index;
      }
      return -1;
    }

    const listContent = listRef.value;
    const selectedIndex = getSelectedIndex();
    const activeIndex = getActiveIndex();

    if (typed.length > 0 && event.key === ' ') {
      // Space should continue the in-progress typeahead session.
      stopEvent(event);
      onTyping?.(true);
    }

    if (typed.length > 0 && typed[0] !== ' ') {
      if (getMatchingIndex(listContent, typed) === -1 && event.key !== ' ') {
        onTyping?.(false);
      }
    }

    if (
      // Character key.
      event.key.length !== 1 ||
      // Modifier key.
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    if (store.select('open') && event.key !== ' ') {
      stopEvent(event);
      onTyping?.(true);
    }

    // Capture whether this is a new typing session before mutating the string.
    const isNewSession = typed === '';
    if (isNewSession) {
      prevIndex = selectedIndex ?? activeIndex ?? -1;
    }

    // Bail out if the list contains a word like "llama" or "aaron". TODO:
    // allow it in this case, too. Unavailable items are skipped while matching, so
    // they must be ignored here as well — otherwise a hidden or disabled double-letter
    // label would block rapid cycling through the available items.
    const allowRapidSuccessionOfFirstLetter = listContent.every((text, index) =>
      text && isItemAvailable(index) ? text[0]?.toLowerCase() !== text[1]?.toLowerCase() : true,
    );

    // Allows the user to cycle through items that start with the same letter
    // in rapid succession.
    if (allowRapidSuccessionOfFirstLetter && typed === event.key) {
      typed = '';
      prevIndex = matchIndex;
    }

    typed += event.key;
    timeout.start(toValue(props.resetMs) ?? 750, () => {
      typed = '';
      prevIndex = matchIndex;
      onTyping?.(false);
    });

    // Compute the starting index for this search.
    // If this is a new typing session (string is empty), base it on the current
    // selection/active item; otherwise continue from the last matched index.
    const searchFrom = isNewSession ? (selectedIndex ?? activeIndex ?? -1) : prevIndex;
    const startIndex = (searchFrom ?? 0) + 1;

    const index = getMatchingIndex(listContent, typed, startIndex);

    if (index !== -1) {
      onMatch?.(index, event);
      matchIndex = index;
    } else if (event.key !== ' ') {
      typed = '';
      onTyping?.(false);
    }
  }

  function endSession() {
    timeout.clear();
    typed = '';
    prevIndex = matchIndex;
    onTyping?.(false);
  }

  function onFocusout(event: FocusEvent) {
    if (!(toValue(props.enabled) ?? true)) {
      return;
    }

    const next = event.relatedTarget as Element | null;
    const withinComposite =
      contains(store.select('anchorElement'), next) ||
      contains(store.select('positionerElement'), next);

    // Keep the session if focus moves within the composite (reference <-> floating).
    if (withinComposite) {
      return;
    }

    // End the current typing session when focus leaves the composite entirely.
    endSession();
  }

  watch([() => store.select('open'), getSelectedIndex], ([open, selectedIndex]) => {
    if (!open && selectedIndex !== null) {
      return;
    }

    timeout.clear();
    matchIndex = null;

    if (typed !== '') {
      typed = '';
      onTyping?.(false);
    }
  });

  // `KeepAlive` takes the list out of the document, and the focus can leave it with no
  // `focusout`. The session ends as it ends when the focus leaves the list.
  onDeactivated(() => {
    if (typed !== '') {
      endSession();
    }
  });

  const sharedProps: InteractionProps = { onKeydown, onFocusout };

  return { reference: sharedProps, floating: sharedProps };
}
