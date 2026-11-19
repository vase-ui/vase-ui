<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { FieldRootState } from '../../field/types';
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
  autocomplete?: string | null | undefined;
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
import { triggerBindings } from '../../utils/popups/popupBindings';
import { computed, inject, onMounted, provide, shallowRef, toRaw, watch } from 'vue';
import { useValueBeforeHydration } from '../../common/hydration';
import { platform } from '../../common/platform';
import { useTimeout } from '../../common/useTimeout';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useDeferredServerRender } from '../../common/deferredServerRender';
import { controlAria, describedByWith, fieldKey } from '../../field/control';
import { DEFAULT_FIELD_STATE_ATTRIBUTES } from '../../internals/field-constants';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps, VaseUIEvent } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useFormEntryValue } from '../../internals/useFormEntryValue';
import { useInputRender } from '../../internals/useInputRender';
import { useRenderElement } from '../../internals/useRenderElement';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import { stopEvent } from '../../utils/popups/event';
import { useElementSiblings } from '../../utils/popups/focus/useElementSiblings';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { useComboboxInputValueContext, useComboboxRootContext } from '../root/ComboboxRootContext';
import { useDismissButton } from '../utils/ComboboxInternalDismissButton';
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

const field = inject(fieldKey, null);
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
  provide(fieldKey, null);
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
  Boolean(field?.disabled || store.select('disabled') || props.disabled),
);

const isInsidePopup = computed(() => hasPositionerParent || inline.value);
const focusManagerModal = computed(() => !isInsidePopup.value || store.select('modal'));
const generatedId = useVaseUiId();
const id = computed(() => (isInsidePopup.value ? generatedId.value : store.select('id')));

const state = computed<ComboboxInputState>(() => ({
  ...((!hasPositionerParent && field?.state) || DEFAULT_FIELD_STATE_ATTRIBUTES),
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
// A reactive read of the old element in this ref setter would subscribe the Vapor render to it.
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
    inputOwnsFormValue: state.selectionMode === 'none' && !hasPositionerParent,
  });
}

// Vue calls the function ref while it hydrates the input, before it hydrates the next parts.
// A write there can give a later trigger a different `tabindex` and `id` in its first render.
// Vue compares both attributes, warns if they differ, and keeps their server values.
onMounted(() => {
  store.update({ inputInsidePopup: isInsidePopup.value });
});

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

const writesValue = useValueBeforeHydration(props, () => element.value);

const { valueProps, renderValue } = useInputRender();

// A write to the input while a composition runs stops the composition.
function restoreText() {
  if (!isComposing) {
    renderValue();
  }
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
  store.context.setInputValue(next, createChangeEventDetails(REASONS.inputChange, event));
  // WebKit sends the last `input` event of a composition after `compositionend`, so the render
  // waits for the next task.
  compositionTimeout.start(0, restoreText);
}

function handleInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const value = input.value;
  const isOpen = open.value;
  const autoHighlightEnabled = Boolean(autoHighlightMode.value);
  // Autofill may not provide `inputType` (Chrome) or may report
  // `insertReplacementText` (Firefox).
  const inputType = (event as InputEvent).inputType;
  if (
    !isComposing &&
    compositionTimeout.isStarted() &&
    (inputType === 'insertCompositionText' || inputType === 'insertFromComposition')
  ) {
    return;
  }
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
  // A listener can cancel the change, and the consumer can keep its value.
  restoreText();

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

function handleFocusin(event: FocusEvent) {
  if (element.value !== event.currentTarget) return;

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

function handleFocusout(event: FocusEvent) {
  if (element.value !== event.currentTarget) return;
  field?.onLeave(event.currentTarget as Element);

  const activeIndex = toRaw(store.state).activeIndex;
  if (inline.value && activeIndex !== null && autoHighlightMode.value !== 'always') {
    lastActiveIndex = activeIndex;
    store.context.setIndices({ activeIndex: null });
  }
}

function getChipIndexForKey(event: KeyboardEvent, input: HTMLInputElement, selectedValue: unknown) {
  if (!chipsContext || !Array.isArray(selectedValue)) {
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

function handleKeydown(event: VaseUIEvent<KeyboardEvent>) {
  const input = event.currentTarget as HTMLInputElement;
  const state = toRaw(store.state);

  if (event.key === 'Home' || event.key === 'End') {
    // Home and End edit the text, also with a modifier key. The list navigation takes the two keys
    // when the input is in the popup or the list is inline (`VUE-100`). Elsewhere its handler
    // runs, because it records each key as keyboard input.
    if (state.inputInsidePopup) {
      event.preventVaseUIHandler();
    }
    // A textarea keeps the Home and End keys of the browser, as each other textarea does (`VUE-97`).
    if (input.tagName !== 'INPUT') {
      return;
    }
  }

  if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
    return;
  }

  const isOpen = open.value;

  if (isDisabled.value || state.readOnly) {
    // Browsing can highlight an item, and Enter there must not submit the form.
    if (state.readOnly && event.key === 'Enter' && isOpen && state.activeIndex !== null) {
      stopEvent(event);
    }
    return;
  }

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
    // The root emits no change for a value that is already empty (`VUE-91`). The call would also
    // ask again to clear text that an `inputValueChange` listener kept.
    if (!isClear) {
      store.context.setSelectedValue(value, details);
    }

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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('input', props, {
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
      triggerBindings(store, true),
      !hasPositionerParent && field ? controlAria(field) : undefined,
      {
        ...(writesValue.value ? valueProps(composingValue.value ?? inputValue.value) : undefined),
        'aria-readonly': readOnly.value || undefined,
        'aria-required': required || undefined,
        // In the popup, the label of the combobox also names the input.
        'aria-labelledby': resolveAriaLabelledBy(
          field?.labelId,
          hasPositionerParent ? store.context.labelId.value : undefined,
        ),
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
        onKeydown: handleKeydown,
      },
      autocorrect === undefined ? undefined : { autoCorrect: autocorrect },
      elementAttrs,
      !hasPositionerParent && field
        ? { 'aria-describedby': describedByWith(field, elementAttrs['aria-describedby']) }
        : undefined,
    ];
  },
  stateAttributesMapping: triggerStateAttributesMapping,
});

useFormEntryValue(element, () => displayText(inputValue.value));

const dismissButton = useDismissButton(
  element,
  () => open.value && focusManagerModal.value,
  store.context.startDismissRef,
);
useElementSiblings(
  element,
  computed(() => (dismissButton.value ? { before: [dismissButton.value] } : null)),
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef" />
</template>
