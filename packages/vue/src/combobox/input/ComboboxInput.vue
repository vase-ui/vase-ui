<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Side } from '../../internals/useAnchorPositioning';

export interface ComboboxInputState extends FieldRootState {
  /**
   * Whether the corresponding popup is open.
   */
  open: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
interface ComboboxInputAutocomplete {
  autocomplete?: string | undefined;
}

export interface ComboboxInputProps
  extends
    VaseUIComponentProps<ComboboxInputState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<InputHTMLAttributes>, 'autocomplete' | 'disabled'>,
    /* @vue-ignore */ ComboboxInputAutocomplete {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, provide, shallowRef, toRaw, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { platform } from '../../common/platform';
import { useTimeout } from '../../common/useTimeout';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { DEFAULT_FIELD_STATE_ATTRIBUTES } from '../../internals/field-constants';
import {
  DEFAULT_FIELD_ROOT_CONTEXT,
  FieldRootContext,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useDeferredServerRender, useLabelableContext } from '../../internals/labelable-provider';
import { REASONS } from '../../internals/reasons';
import { resolveElement } from '../../internals/resolveElement';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { stopEvent } from '../../utils/popups/event';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { useComboboxInputValueContext, useComboboxRootContext } from '../root/ComboboxRootContext';
import ComboboxInternalDismissButton from '../utils/ComboboxInternalDismissButton.vue';
import {
  clickHighlightedItem,
  getChipNavigationKeys,
  useListEmpty,
  usePopupSide,
} from '../utils/parts';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxInputProps>(), { as: 'input', disabled: false });

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, ComboboxInputState>;
}>();

const {
  state: fieldState,
  disabled: fieldDisabled,
  setTouched,
  validationMode,
  validation,
} = useFieldRootContext();
const { labelId: fieldLabelId } = useLabelableContext();
const chipsContext = useComboboxChipsContext();
const hasPositionerParent = useComboboxPositionerContext(true) !== undefined;
const store = useComboboxRootContext();
// `inputValue` can't be placed in the store.
// https://github.com/mui/base-ui/issues/2703
const inputValue = useComboboxInputValueContext();
const direction = useDirection();

// An input in the popup is not the control of the field. A part that the input renders, such as
// a field control in its `as`, then gets no field.
if (hasPositionerParent) {
  provide(FieldRootContext, DEFAULT_FIELD_ROOT_CONTEXT);
}

// The input binds `aria-labelledby` and `aria-describedby`, and a label or a message can come
// after it.
useDeferredServerRender();

const open = computed(() => store.select('open'));
const readOnly = computed(() => store.select('readOnly'));
const selectionMode = computed(() => store.select('selectionMode'));
const autoHighlightMode = computed(() => store.select('autoHighlight'));
const inline = computed(() => store.select('inline'));
const popupSide = usePopupSide(store);
const listEmpty = useListEmpty();
const isDisabled = computed(() =>
  Boolean(fieldDisabled.value || store.select('disabled') || props.disabled),
);

const setFocused = useSetFieldFocused(isDisabled, () => store.context.inputRef.value);

const isInsidePopup = computed(() => hasPositionerParent || inline.value);
const focusManagerModal = computed(() => !isInsidePopup.value || store.select('modal'));
const generatedId = useVaseUiId();
const id = computed(() => (isInsidePopup.value ? generatedId.value : store.select('id')));

const state = computed<ComboboxInputState>(() => ({
  ...(hasPositionerParent ? DEFAULT_FIELD_STATE_ATTRIBUTES : fieldState.value),
  open: open.value,
  disabled: isDisabled.value,
  readOnly: readOnly.value,
  popupSide: popupSide.value,
  listEmpty: listEmpty.value,
}));

// The text of the input while a composition runs. A render then keeps the composed text.
const composingValue = shallowRef<string | null>(null);
let isComposing = false;
let lastActiveIndex: number | null = null;

// The input does not write the input value while a composition runs. A write of the root then
// comes from outside the input, such as a pick with the mouse, and its text replaces the composed
// text.
watch(inputValue, () => {
  composingValue.value = null;
});

// Restore the saved highlight on refocus only within the same open cycle.
watch(open, (nextOpen) => {
  if (!nextOpen) {
    lastActiveIndex = null;
  }
});

const inputOwnsFormValue = computed(() => selectionMode.value === 'none' && !hasPositionerParent);

// A template can mount the input that replaces this input before it unmounts this input. The
// input then clears the element of the root only when the root holds its own element.
let ownInput: HTMLInputElement | null = null;
function setInputElement(element: HTMLElement | null) {
  const input = element as HTMLInputElement | null;
  const state = toRaw(store.state);
  const isOwnInput = state.inputElement === ownInput;
  ownInput = input;
  if (input === null && !isOwnInput) {
    return;
  }

  store.context.inputRef.value = input;
  const nextIsInsidePopup = hasPositionerParent || state.inline;
  if (nextIsInsidePopup && !state.hasInputValue) {
    store.context.setInputValue('', createChangeEventDetails(REASONS.none));
  }
  store.update({
    inputElement: input,
    inputInsidePopup: nextIsInsidePopup,
    inputOwnsFormValue: state.selectionMode === 'none' && !hasPositionerParent,
  });
}

let ownDismissButton: HTMLSpanElement | null = null;
function setStartDismissButton(value: unknown) {
  const button = resolveElement(value as ComponentPublicInstance | null) as HTMLSpanElement | null;
  // Vue calls a function ref again on each patch, with the same component.
  if (button === ownDismissButton) {
    return;
  }
  if (button !== null || store.context.startDismissRef.value === ownDismissButton) {
    store.context.startDismissRef.value = button;
  }
  ownDismissButton = button;
}

function clearHighlight(event: Event) {
  store.context.setIndices({
    activeIndex: null,
    selectedIndex: null,
    type: getHighlightReason(event),
    event,
  });
}

function displayText(value: unknown) {
  return value == null ? '' : String(value);
}

// The value that the input has after the last event that the part handled. A write of Vue or of
// the part sets it too.
let handledValue: string | undefined;

function syncHandledValue() {
  handledValue = (element.value as HTMLInputElement | null)?.value;
}
onMounted(syncHandledValue);
watch(() => composingValue.value ?? inputValue.value, syncHandledValue, { flush: 'post' });

// Vue writes the DOM value only when the part renders. The part does not render when a listener
// cancels the change or the consumer keeps its value.
function writeStateToInput() {
  const input = element.value as HTMLInputElement | null;
  if (!input || isComposing) {
    return;
  }
  const text = displayText(inputValue.value);
  if (input.value !== text) {
    input.value = text;
  }
  handledValue = input.value;
}

const compositionTimeout = useTimeout();

function handleCompositionstart(event: CompositionEvent) {
  if (platform.os.android) {
    return;
  }
  isComposing = true;
  composingValue.value = (event.currentTarget as HTMLInputElement).value;
}

function handleCompositionend(event: CompositionEvent) {
  isComposing = false;
  const next = (event.currentTarget as HTMLInputElement).value;
  composingValue.value = null;
  handledValue = next;
  store.context.setInputValue(next, createChangeEventDetails(REASONS.inputChange, event));
  // WebKit sends the last `input` event of a composition after `compositionend`, so the write
  // waits for the next task.
  compositionTimeout.start(0, writeStateToInput);
}

// React calls `onChange` of a text input for an `input` event and for a `change` event, when the
// value is new. Some programs that fill a form send only `change`, and some send both events for
// one change. WebKit sends the last `input` event of a composition after `compositionend`.
function handleInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const value = input.value;
  if (!isComposing && value === handledValue) {
    return;
  }
  handledValue = value;

  const isOpen = open.value;
  const autoHighlightEnabled = Boolean(autoHighlightMode.value);
  // Autofill may not provide `inputType` (Chrome) or may report
  // `insertReplacementText` (Firefox).
  const inputType = (event as InputEvent).inputType;
  const autofillLikeInput = !inputType || inputType === 'insertReplacementText';
  // During composition the input is always considered typed into.
  const shouldOpenOnInput = isComposing || !autofillLikeInput;

  function maybeOpenOnInput(trimmed: string) {
    if (readOnly.value || isDisabled.value || !trimmed || !shouldOpenOnInput) {
      return;
    }

    store.setOpen(true, createChangeEventDetails(REASONS.inputChange, event));
    // When autoHighlight is enabled, keep the highlight (will be set to 0 in root).
    if (!autoHighlightEnabled) {
      clearHighlight(event);
    }
  }

  // During IME composition, avoid propagating controlled updates to prevent
  // filtering the options prematurely so `Empty` won't show incorrectly.
  // We can't rely on this check for Android due to how it handles composition
  // events with some keyboards (e.g. Samsung keyboard with predictive text on
  // treats all text as always-composing).
  // https://github.com/mui/base-ui/issues/2942
  if (isComposing) {
    composingValue.value = value;

    const state = toRaw(store.state);
    if (value === '' && !state.openOnInputClick && !state.inputInsidePopup) {
      store.setOpen(false, createChangeEventDetails(REASONS.inputClear, event));
    }

    const trimmed = value.trim();
    const shouldMaintainHighlight = autoHighlightEnabled && trimmed !== '';

    maybeOpenOnInput(trimmed);

    if (isOpen && toRaw(store.state).activeIndex !== null && !shouldMaintainHighlight) {
      clearHighlight(event);
    }

    return;
  }

  const inputChangeDetails = createChangeEventDetails(REASONS.inputChange, event);
  store.context.setInputValue(value, inputChangeDetails);
  void nextTick(writeStateToInput);

  if (inputChangeDetails.isCanceled) {
    return;
  }

  const clearDetails = createChangeEventDetails(REASONS.inputClear, event);
  const state = toRaw(store.state);

  if (value === '' && !state.inputInsidePopup) {
    if (selectionMode.value === 'single') {
      store.context.setSelectedValue(null, clearDetails);
    }

    if (!state.openOnInputClick) {
      store.setOpen(false, clearDetails);
    }
  }

  maybeOpenOnInput(value.trim());

  // When the user types, ensure the list resets its highlight so that
  // virtual focus returns to the input (aria-activedescendant is
  // cleared).
  if (isOpen && toRaw(store.state).activeIndex !== null && !autoHighlightEnabled) {
    clearHighlight(event);
  }
}

function handleFocusin() {
  setFocused(true);

  if (!inline.value) {
    return;
  }

  const nextActiveIndex = lastActiveIndex;
  lastActiveIndex = null;

  if (
    nextActiveIndex == null ||
    // `valuesRef` can be sparse, so guard against restoring a removed slot.
    !Object.hasOwn(store.context.valuesRef.value, nextActiveIndex)
  ) {
    return;
  }

  store.context.setIndices({ activeIndex: nextActiveIndex });
}

function handleFocusout() {
  setTouched(true);
  setFocused(false);

  const activeIndex = toRaw(store.state).activeIndex;
  if (inline.value && activeIndex !== null && autoHighlightMode.value !== 'always') {
    lastActiveIndex = activeIndex;
    store.context.setIndices({ activeIndex: null });
  }

  // With a selection mode, an input in the popup is not the control of the field. The trigger and
  // the root validate in its place, and they count a missing value (BUG-1425). A validation here
  // would not count it, and it can come after theirs.
  if (
    validationMode.value === 'onBlur' &&
    !(hasPositionerParent && selectionMode.value !== 'none')
  ) {
    const valueToValidate =
      selectionMode.value === 'none' ? inputValue.value : toRaw(store.state).selectedValue;
    void validation.commit(valueToValidate);
  }
}

function getChipIndexForKey(event: KeyboardEvent, input: HTMLInputElement, selectedValue: any) {
  if (!chipsContext) {
    return undefined;
  }

  let nextIndex: number | undefined;

  const renderedChipsCount = chipsContext.chipsRef.value.length;
  const [previousChipKey] = getChipNavigationKeys(direction.value);

  if (
    event.key === previousChipKey &&
    (input.selectionStart ?? 0) === 0 &&
    selectedValue.length > 0
  ) {
    event.preventDefault();
    nextIndex = renderedChipsCount > 0 ? renderedChipsCount - 1 : undefined;
  }

  return nextIndex;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
    return;
  }

  const state = toRaw(store.state);
  const isOpen = state.open;

  if (isDisabled.value || state.readOnly) {
    // Browsing can highlight an item, and Enter there must not submit the form.
    if (state.readOnly && event.key === 'Enter' && isOpen && state.activeIndex !== null) {
      stopEvent(event);
    }
    return;
  }

  const input = event.currentTarget as HTMLInputElement;
  const scrollAmount = input.scrollWidth - input.clientWidth;
  const isRTL = direction.value === 'rtl';

  if (event.key === 'Home') {
    stopEvent(event);
    const cursor = platform.engine.gecko && isRTL ? input.value.length : 0;
    input.setSelectionRange(cursor, cursor);
    input.scrollLeft = 0;
    return;
  }

  if (event.key === 'End') {
    stopEvent(event);
    const cursor = platform.engine.gecko && isRTL ? 0 : input.value.length;
    input.setSelectionRange(cursor, cursor);
    input.scrollLeft = isRTL ? -scrollAmount : scrollAmount;
    return;
  }

  const selectedValue = state.selectedValue;

  if (!state.mounted && event.key === 'Escape') {
    const isClear =
      state.selectionMode === 'multiple' && Array.isArray(selectedValue)
        ? selectedValue.length === 0
        : selectedValue === null;

    const details = createChangeEventDetails(REASONS.escapeKey, event);
    const value = state.selectionMode === 'multiple' ? [] : null;
    store.context.setInputValue('', details);
    store.context.setSelectedValue(value, details);

    if (!isClear && !state.inline && !details.isPropagationAllowed) {
      event.stopPropagation();
    }

    return;
  }

  // Handle deletion when the input is empty.
  if (
    chipsContext &&
    event.key === 'Backspace' &&
    input.value === '' &&
    Array.isArray(selectedValue) &&
    selectedValue.length > 0
  ) {
    const renderedChipsCount = chipsContext.chipsRef.value.length;
    const removalIndex = renderedChipsCount > 0 ? renderedChipsCount - 1 : selectedValue.length - 1;

    const newValue = selectedValue.filter((_: any, index: number) => index !== removalIndex);
    // If the removed item was also the active (highlighted) item, clear highlight
    clearHighlight(event);
    store.context.setSelectedValue(newValue, createChangeEventDetails(REASONS.none, event));
    return;
  }

  const nextIndex = getChipIndexForKey(event, input, selectedValue);

  if (nextIndex !== undefined) {
    chipsContext?.chipsRef.value[nextIndex]?.focus();
  }

  // event.isComposing
  if (event.which === 229) {
    return;
  }

  // Space types into a non-empty input, and otherwise selects the highlighted item.
  if (event.key === ' ' && isOpen && input.value === '') {
    stopEvent(event);
    if (state.activeIndex !== null) {
      clickHighlightedItem(store, state.activeIndex, event);
    }
    return;
  }

  if (event.key === 'Enter' && isOpen) {
    const activeIndex = state.activeIndex;

    if (activeIndex === null) {
      if (state.inline) {
        return;
      }

      // Allow form submission when no item is highlighted.
      store.setOpen(false, createChangeEventDetails(REASONS.none, event));
      return;
    }

    stopEvent(event);
    clickHighlightedItem(store, activeIndex, event);
  }
}

const { element, elementProps } = useRenderElement('input', props, {
  state,
  ref: setInputElement,
  props: (attrs) => {
    // Vue before 3.5.14 sets the key `autocorrect` as a boolean DOM property, and the string `off`
    // then turns autocorrect on. The role props of the root give the key `autoCorrect`, which Vue
    // sets as an attribute. The value of the consumer moves to that key, because two keys for one
    // attribute give two attributes on a server.
    const { autocorrect, ...elementAttrs } = attrs;
    const required = store.select('required');
    const name = store.select('name');

    return [
      store.select('inputProps'),
      store.select('triggerProps', true),
      {
        value: composingValue.value ?? inputValue.value,
        'aria-readonly': readOnly.value || undefined,
        'aria-required': required || undefined,
        'aria-labelledby': fieldLabelId.value,
        disabled: isDisabled.value ? '' : undefined,
        readonly: readOnly.value ? '' : undefined,
        required: selectionMode.value === 'none' && required ? '' : undefined,
        form: store.select('form'),
        name: inputOwnsFormValue.value && name ? name : undefined,
        id: id.value,
        onFocusin: handleFocusin,
        onFocusout: handleFocusout,
        onCompositionstart: handleCompositionstart,
        onCompositionend: handleCompositionend,
        onInput: handleInput,
        onChange: handleInput,
        onKeydown: handleKeydown,
      },
      autocorrect === undefined ? undefined : { autoCorrect: autocorrect },
      elementAttrs,
      hasPositionerParent
        ? undefined
        : (merged) => validation.getValidationProps(isDisabled.value, merged),
    ];
  },
  stateAttributesMapping: triggerStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <ComboboxInternalDismissButton v-if="open && focusManagerModal" :ref="setStartDismissButton" />
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" />
</template>
