import { computed, nextTick, onMounted, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { platform } from '../../common/platform';
import { useTimeout } from '../../common/useTimeout';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import type { UseRenderElementParameters } from '../../internals/useRenderElement';
import {
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from '../root/FilterDropdownRootContext';
import { isRefocusingOwner, refocusOwner } from '../utils/refocusOwner';

/**
 * The filter input of a filter dropdown. The part that calls it gives `state`, `ref` and `props`
 * to `useRenderElement` with the default tag `input`.
 *
 * Call it in `setup`.
 *
 * @internal
 */
export function useFilterDropdownInput(
  params: UseFilterDropdownInputParameters,
): UseFilterDropdownInputReturnValue {
  // Browsers flag a form field with neither an id nor a name.
  const id = useVaseUiId(params.id);

  const context = useFilterDropdownRootContext();
  const { listRef } = useFilterDropdownItemContext();
  const value = useFilterDropdownValueContext();

  // IME text isn't committed until the composition ends, so filtering waits for it.
  const composingValue = shallowRef<string | null>(null);
  let isComposing = false;

  let inputElement: HTMLInputElement | null = null;

  // A template can mount the input that replaces this input before it unmounts this input. The
  // input then clears the focus owner only when the owner is its own element.
  function setInputElement(element: HTMLInputElement | null) {
    if (element !== null || context.focusOwnerRef.value === inputElement) {
      context.focusOwnerRef.value = element;
    }
    inputElement = element;
  }

  // The value that the input has after the last event that the part handled, or after the last
  // write of Vue or of the part.
  let handledValue: string | undefined;

  function syncHandledValue() {
    handledValue = inputElement?.value;
  }
  onMounted(syncHandledValue);
  watch(() => composingValue.value ?? value.value, syncHandledValue, { flush: 'post' });

  // Vue writes the DOM value only when the part renders. The part does not render when a listener
  // cancels the change or the consumer keeps its value.
  function writeValueToInput() {
    if (inputElement === null || isComposing) {
      return;
    }
    if (inputElement.value !== value.value) {
      inputElement.value = value.value;
    }
    handledValue = inputElement.value;
  }

  const compositionTimeout = useTimeout();

  function commitValue(nextValue: string, event: Event) {
    // The input keeps focus until the popup unmounts. The query is held in place while it
    // animates out, so an edit made then would change the committed value behind it.
    if (!context.open.value) {
      return;
    }
    const reason = nextValue === '' ? REASONS.inputClear : REASONS.inputChange;
    context.onValueChange(nextValue, createChangeEventDetails(reason, event));
  }

  function handleCompositionstart(event: CompositionEvent) {
    // Some Android keyboards treat all typing as one composition.
    if (platform.os.android) {
      return;
    }
    isComposing = true;
    composingValue.value = (event.currentTarget as HTMLInputElement).value;
  }

  function handleCompositionend(event: CompositionEvent) {
    if (!isComposing) {
      return;
    }
    isComposing = false;
    composingValue.value = null;
    const nextValue = (event.currentTarget as HTMLInputElement).value;
    handledValue = nextValue;
    commitValue(nextValue, event);
    // WebKit sends the last `input` event of a composition after `compositionend`, so the write
    // waits for the next task.
    compositionTimeout.start(0, writeValueToInput);
  }

  // React calls `onChange` of a text input for an `input` event and for a `change` event, when the
  // value is new.
  function handleInput(event: Event) {
    const nextValue = (event.currentTarget as HTMLInputElement).value;
    if (!isComposing && nextValue === handledValue) {
      return;
    }
    handledValue = nextValue;

    if (isComposing) {
      composingValue.value = nextValue;
      return;
    }
    commitValue(nextValue, event);
    void nextTick(writeValueToInput);
  }

  const listeners: HTMLProps = {
    onCompositionstart: handleCompositionstart,
    onCompositionend: handleCompositionend,
    onInput: handleInput,
    onChange: handleInput,
    onKeydown() {
      context.setKeyboardModality(true);
    },
    onPointerdown() {
      context.setKeyboardModality(false);
    },
    onMouseenter(event: MouseEvent) {
      context.setKeyboardModality(false);
      // Take focus so typing filters immediately.
      if (context.open.value) {
        refocusOwner(event.currentTarget as HTMLElement);
      }
    },
    onFocusin(event: FocusEvent) {
      context.setInputFocusVisible(true);

      // A screen reader that followed `aria-activedescendant` put real focus on the item, so
      // focus returning from an item means the user moved back to the input on purpose and
      // the highlight no longer reflects where they are. The list's own key replay and
      // pointer refocus also pass through here and keep it.
      if (context.autoHighlight.value === 'always' || isRefocusingOwner()) {
        return;
      }
      const from = event.relatedTarget as HTMLElement | null;
      if (from !== null && listRef.value.includes(from)) {
        context.setActiveIndex(null);
      }
    },
    onFocusout() {
      context.setInputFocusVisible(false);
    },
  };

  const state = computed<FilterDropdownInputState>(() => ({
    highlighted:
      context.inputFocusVisible.value &&
      (!context.keyboardModality.value || toValue(params.activeItemId) == null),
  }));

  return {
    state,
    ref: setInputElement,
    props: (attrs) => {
      // Vue before 3.5.14 sets the key `autocorrect` as a boolean DOM property, and the string
      // `off` then turns autocorrect on. The key `autoCorrect` is always an attribute. The value of
      // the consumer moves to that key, because two keys for one attribute give two attributes on
      // a server.
      const { autocorrect, ...elementAttrs } = attrs;
      return [
        toValue(params.navigationProps),
        {
          id: id.value,
          type: 'text',
          disabled: context.disabled.value || toValue(params.disabled) ? '' : undefined,
          'aria-activedescendant': toValue(params.activeItemId),
          role: 'searchbox',
          inputmode: 'search',
          autocomplete: 'off',
          spellcheck: 'false',
          autoCorrect: 'off',
          autocapitalize: 'none',
          // The aria-autocomplete 'list' value is only valid with `aria-haspopup` so we depend
          // on the searchbox role to communicate affordance, with an input label as fallback
          // https://w3c.github.io/aria/#aria-autocomplete
          'aria-autocomplete': undefined,
          'aria-controls': context.listId.value,
          value: composingValue.value ?? value.value,
          ...listeners,
        },
        autocorrect === undefined ? undefined : { autoCorrect: autocorrect },
        elementAttrs,
      ];
    },
  };
}

export interface FilterDropdownInputState {
  /**
   * Whether the input shows its focus ring.
   * Cleared when keyboard navigation highlights an item.
   */
  highlighted: boolean;
}

export interface UseFilterDropdownInputParameters {
  /** The `id` of the input. A generated id when `undefined`. */
  id?: MaybeRefOrGetter<string | undefined> | undefined;
  /** Whether the input ignores user interaction. */
  disabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * The id of the item the host highlights, which the input points at while it holds focus.
   */
  activeItemId?: MaybeRefOrGetter<string | undefined> | undefined;
  /**
   * The host's list navigation props. The host routes key presses itself, so these exclude a
   * key handler.
   */
  navigationProps?: MaybeRefOrGetter<HTMLProps | undefined> | undefined;
}

export interface UseFilterDropdownInputReturnValue {
  state: ComputedRef<FilterDropdownInputState>;
  /** The function ref of the input element. */
  ref: (element: HTMLInputElement | null) => void;
  props: NonNullable<UseRenderElementParameters<FilterDropdownInputState>['props']>;
}
