<script lang="ts">
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { SelectItems } from '../store';

type SelectInputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? readonly Value[]
  : Value;

type SelectOutputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value;

export interface SelectRootProps<Value, Multiple extends boolean | undefined = false> {
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the select is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Provides a hint to the browser for autofill.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  autoComplete?: string | undefined;
  /**
   * The id of the Select.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the select popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether multiple items can be selected.
   * @default false
   */
  multiple?: (Multiple & boolean) | undefined;
  /**
   * Whether the select popup is initially open.
   *
   * To render a controlled select popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the select popup is currently open.
   */
  open?: boolean | undefined;
  /**
   * Data structure of the items rendered in the select popup.
   * When specified, `<Select.Value>` renders the label of the selected item instead of the raw value.
   * A label is a string, a number, or a function that returns the content of the label.
   * @example
   * ```ts
   * const items = {
   *   sans: 'Sans-serif',
   *   serif: 'Serif',
   *   mono: 'Monospace',
   *   cursive: 'Cursive',
   * };
   * ```
   */
  items?: SelectItems;
  /**
   * When the item values are objects (`<Select.Item :value="object">`), this function converts the object value to a string representation for display in the trigger.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringLabel?: ((itemValue: Value) => string) | undefined;
  /**
   * When the item values are objects (`<Select.Item :value="object">`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: Value) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a select item value matches the current selected value. Useful when item values are objects without matching referentially.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: Value, value: Value) => boolean) | undefined;
  /**
   * The uncontrolled value of the select when it's initially rendered.
   *
   * To render a controlled select, use the `value` prop instead.
   */
  defaultValue?: SelectInputValue<Value, Multiple> | null | undefined;
  /**
   * The value of the select. Use when controlled.
   */
  value?: SelectInputValue<Value, Multiple> | null | undefined;
}

export interface SelectRootState {}

export interface SelectRootActions {
  /**
   * Ends the closing phase of the select after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `openChange` first, otherwise the select completes closing on
   * its own.
   */
  unmount: () => void;
  /**
   * Closes the select imperatively when called.
   */
  close: () => void;
}

export type SelectRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.windowResize
  | typeof REASONS.itemPress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.cancelOpen
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type SelectRootChangeEventDetails = VaseUIChangeEventDetails<SelectRootChangeEventReason>;

export type SelectRootOpenChangeEventDetails = SelectRootChangeEventDetails & {
  /** Prevents the popup from unmounting until the `unmount` action is called. */
  preventUnmountOnClose: () => void;
};
</script>

<script setup lang="ts" generic="Value, Multiple extends boolean | undefined = false">
import { computed, nextTick, onMounted, provide, shallowRef, toRaw, watch } from 'vue';
import type { HTMLAttributes } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../common/empty';
import { ownerWindow } from '../../common/owner';
import { useControlled } from '../../common/useControlled';
import type { InteractionType } from '../../common/useEnhancedClickHandler';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useRegisterFieldControl } from '../../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { useFormContext } from '../../internals/form-context';
import { getHiddenInputType } from '../../internals/getHiddenInputType';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import {
  defaultItemEquality,
  findSelectionIndex,
  isSelectedValueDirty,
} from '../../internals/itemEquality';
import { createLabelIdRegistry, useLabelableId } from '../../internals/labelable-provider';
import { NOOP } from '../../internals/noop';
import { stringifyAsLabel, stringifyAsValue } from '../../internals/resolveValueLabel';
import type { HTMLProps } from '../../internals/types';
import { useFormReset } from '../../internals/useFormReset';
import { useValueChanged } from '../../internals/useValueChanged';
import { mergeProps } from '../../merge-props';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { useOpenInteractionType } from '../../utils/popups/interactions/useOpenInteractionType';
import { useSingleAnchorPopupRoot } from '../../utils/popups/popupRoot';
import {
  FOCUSABLE_POPUP_PROPS,
  usePopupInteractionProps,
} from '../../utils/popups/popupStoreUtils';
import { createInitialPopupStoreState, createPopupStoreContext } from '../../utils/popups/store';
import { SelectStore, selectors } from '../store';
import { SelectRootContext } from './SelectRootContext';

const props = withDefaults(defineProps<SelectRootProps<Value, Multiple>>(), {
  open: undefined,
  defaultOpen: false,
  value: undefined,
  defaultValue: null,
  disabled: false,
  readOnly: false,
  required: false,
});

const emit = defineEmits<{
  /**
   * Event handler called when the value of the select changes.
   */
  valueChange: [
    value: SelectOutputValue<Value, Multiple> | (Multiple extends true ? never : null),
    eventDetails: SelectRootChangeEventDetails,
  ];
  'update:value': [
    value: SelectOutputValue<Value, Multiple> | (Multiple extends true ? never : null),
  ];
  /**
   * Event handler called when the select popup is opened or closed.
   */
  openChange: [open: boolean, eventDetails: SelectRootOpenChangeEventDetails];
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the select popup is opened or closed.
   */
  openChangeComplete: [open: boolean];
}>();

defineSlots<{ default(): unknown }>();

const { clearErrors } = useFormContext();
const {
  setDirty,
  setTouched,
  setFocused,
  validityData,
  setFilled,
  name: fieldName,
  disabled: fieldDisabled,
  validation,
  validationMode,
  setValidityData,
} = useFieldRootContext();

const controlId = useLabelableId({ id: () => props.id });

const isDisabled = computed(() => Boolean(fieldDisabled.value || props.disabled));
const isMultiple = computed(() => Boolean(props.multiple));
const inputName = computed(() => fieldName.value ?? props.name);
const comparer = computed(() => props.isItemEqualToValue ?? defaultItemEquality);
const clearFieldError = useClearFieldError(inputName);

function getDefaultValue() {
  return isMultiple.value ? (props.defaultValue ?? EMPTY_ARRAY) : props.defaultValue;
}

const [selectedValue, setSelectedValue] = useControlled<any>({
  controlled: () => props.value,
  default: getDefaultValue,
  name: 'Select',
  state: 'value',
});

const { labelId, registerLabelId } = createLabelIdRegistry();

function copyItems(items: SelectItems): SelectItems {
  if (items === undefined) {
    return undefined;
  }
  const rawItems = toRaw(items);
  return Array.isArray(rawItems) ? [...rawItems] : { ...rawItems };
}

// A consumer can change a reactive `items` record in place. The deep `watch` sees that change.
// The copy gives the store a new object to follow, because Vue tracks no `Object.hasOwn` of a
// reactive proxy.
const plainItems = shallowRef(copyItems(props.items));

watch(
  () => props.items,
  (next) => {
    plainItems.value = copyItems(next);
  },
  { deep: true },
);

const {
  store,
  open: isOpen,
  actions,
} = useSingleAnchorPopupRoot(
  props,
  (initialState, defaultPopupId) =>
    new SelectStore(
      {
        ...createInitialPopupStoreState(defaultPopupId),
        ...initialState,
        id: controlId.value,
        labelId: labelId.value,
        modal: true,
        selectionMode: isMultiple.value ? 'multiple' : 'single',
        disabled: isDisabled.value,
        readOnly: props.readOnly,
        required: props.required,
        highlightItemOnHover: true,
        itemToStringLabel: props.itemToStringLabel,
        itemToStringValue: props.itemToStringValue,
        isItemEqualToValue: comparer.value,
        selectedValue: selectedValue.value,
        items: plainItems.value,
        forceMounted: false,
        openMethod: null,
        activeIndex: null,
        selectedIndex: null,
        itemRoot: {
          props: EMPTY_OBJECT as HTMLProps,
          multiple: isMultiple.value,
          disabled: isDisabled.value,
          readOnly: props.readOnly,
          isItemEqualToValue: comparer.value,
        },
        triggerElement: null,
        listElement: null,
        popupSide: null,
        scrollUpArrowVisible: false,
        scrollDownArrowVisible: false,
        hasScrollArrows: false,
      },
      {
        ...createPopupStoreContext(),
        isItemEqualToValue: comparer.value,
        setValue: () => false,
        handleScrollArrowVisibility: NOOP,
        listRef: shallowRef([]),
        labelsRef: shallowRef([]),
        valuesRef: shallowRef([]),
        scrollHandlerRef: shallowRef(null),
        valueRef: shallowRef(null),
        typingRef: { value: false },
        selectionRef: {
          value: { allowSelectedMouseUp: false, allowUnselectedMouseUp: false, dragY: 0 },
        },
        firstItemTextRef: { value: null },
        selectedItemTextRef: { value: null },
        alignItemWithTriggerActiveRef: { value: false },
        initialValueRef: { value: selectedValue.value },
        itemValues: new WeakMap(),
        labelId,
        registerLabelId,
      },
      selectors,
    ),
  {
    name: 'Select',
    onOpenChange(nextOpen, eventDetails) {
      emit('openChange', nextOpen, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      emit('update:open', nextOpen);

      if (
        !nextOpen &&
        (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
      ) {
        setTouched(true);
        setFocused(false);

        if (validationMode.value === 'onBlur') {
          void validation.commit(selectedValue.value, true);
        }
      }
    },
    onOpenChangeComplete(nextOpen) {
      emit('openChangeComplete', nextOpen);
    },
  },
);

const serializedValue = computed(() => {
  // In multiple mode the shared input is nameless; per-value entries are submitted via
  // `hiddenInputs`. Its value is therefore irrelevant, and passing the whole array to
  // `stringifyAsValue` would invoke a user `itemToStringValue` with an array it doesn't expect.
  if (isMultiple.value) {
    return '';
  }
  return stringifyAsValue(selectedValue.value, props.itemToStringValue);
});

const fieldStringValue = computed(() => {
  const value = selectedValue.value;
  if (isMultiple.value && Array.isArray(value)) {
    return value.map((currentValue) => stringifyAsValue(currentValue, props.itemToStringValue));
  }
  return stringifyAsValue(value, props.itemToStringValue);
});

useRegisterFieldControl(
  () => store.select('triggerElement'),
  controlId,
  () => selectedValue.value,
  () => fieldStringValue.value,
  () => !isDisabled.value,
  () => props.name,
);

// Mirror the `hasSelectedValue` store selector so the Field's filled state agrees with the
// trigger/value placeholder semantics (a value serializing to `''` counts as empty).
const hasSelectedValue = computed(() => {
  const value = selectedValue.value;
  return isMultiple.value
    ? Array.isArray(value) && value.length > 0
    : value != null && serializedValue.value !== '';
});

setFilled(hasSelectedValue.value);
watch(hasSelectedValue, setFilled);

// The items write their values after the DOM update, so the sync runs after it too.
function syncSelectedIndex() {
  const nextIndex = findSelectionIndex(
    store.context.valuesRef.value,
    selectedValue.value,
    comparer.value,
    isMultiple.value,
  );

  if (nextIndex === null) {
    store.context.selectedItemTextRef.value = null;
  }

  if (isOpen.value) {
    return;
  }

  store.set('selectedIndex', nextIndex);
}

onMounted(syncSelectedIndex);
watch([isMultiple, isOpen, selectedValue, comparer], syncSelectedIndex, { flush: 'post' });

// The change of a reset reaches `useValueChanged` after the reset timeout. The timeout sets this
// flag, and the callback clears the field and starts no validation.
let isResetChangePending = false;

useValueChanged(selectedValue, () => {
  clearErrors(inputName.value);
  setDirty(
    isSelectedValueDirty(selectedValue.value, validityData.value.initialValue, comparer.value),
  );

  if (isResetChangePending) {
    isResetChangePending = false;
    clearFieldError(selectedValue.value);
    return;
  }

  void validation.change(selectedValue.value);
});

function setValue(nextValue: any, eventDetails: SelectRootChangeEventDetails) {
  emit('valueChange', nextValue, eventDetails);

  if (eventDetails.isCanceled) {
    return false;
  }

  emit('update:value', nextValue);
  setSelectedValue(nextValue);
  return true;
}

store.context.setValue = setValue;
watch(comparer, (nextComparer) => {
  store.context.isItemEqualToValue = nextComparer;
});

// `readOnly` locks the value, not the interaction: the popup can be opened and browsed so the
// user can see the available options and which one is selected.
const click = useClick(store, {
  enabled: () => !isDisabled.value,
  event: 'mousedown',
});

const dismiss = useDismiss(store);

const { openMethod, triggerProps: interactionTypeProps } = useOpenInteractionType(isOpen);

// The popup keeps the method of the last open while it closes.
const renderedOpenMethod = shallowRef<InteractionType | null>(null);
watch(
  openMethod,
  (method) => {
    if (method !== null) {
      renderedOpenMethod.value = method;
    }
  },
  { flush: 'sync' },
);

// `Select.Trigger` applies the id itself from the store, so it's deliberately not merged here.
const triggerProps: HTMLAttributes = mergeProps(
  dismiss.reference,
  click.reference,
  interactionTypeProps,
);
const popupProps: HTMLAttributes = mergeProps(FOCUSABLE_POPUP_PROPS, dismiss.floating);

const itemRoot = computed(() => ({
  props: EMPTY_OBJECT as HTMLProps,
  multiple: isMultiple.value,
  disabled: isDisabled.value,
  readOnly: props.readOnly,
  isItemEqualToValue: comparer.value,
}));

usePopupInteractionProps(store, () => ({
  id: controlId.value,
  labelId: labelId.value,
  selectionMode: isMultiple.value ? ('multiple' as const) : ('single' as const),
  disabled: isDisabled.value,
  readOnly: props.readOnly,
  required: props.required,
  selectedValue: selectedValue.value,
  popupProps,
  activeTriggerProps: triggerProps,
  inactiveTriggerProps: EMPTY_OBJECT as HTMLAttributes,
  itemRoot: itemRoot.value,
  items: plainItems.value,
  itemToStringLabel: props.itemToStringLabel,
  itemToStringValue: props.itemToStringValue,
  isItemEqualToValue: comparer.value,
  openMethod: openMethod.value ?? renderedOpenMethod.value,
}));

provide(SelectRootContext, store);

const inputElement = shallowRef<HTMLInputElement | null>(null);

function setInputElement(value: unknown) {
  const input = value as HTMLInputElement | null;
  // Vue calls a function ref again on each patch, with the same element.
  if (input === inputElement.value) {
    return;
  }
  inputElement.value = input;
  validation.inputRef.value = input;
}

// The value that the input has after the last event that the root handled. A write of Vue or of
// the root sets it too.
let handledValue: string | undefined;

// Vue writes the value to the input only when the root renders. A browser can change the input
// with no change of the state: an autofill, and the restore of the form state of a page. A form
// would then submit a value that the select does not show.
function writeValueToInput() {
  const input = inputElement.value;
  if (input && input.value !== serializedValue.value) {
    input.value = serializedValue.value;
  }
  handledValue = input?.value;
}

onMounted(() => {
  handledValue = inputElement.value?.value;
});
watch(
  serializedValue,
  () => {
    handledValue = inputElement.value?.value;
  },
  { flush: 'post' },
);

// A browser autofills the hidden input with the value or the text of an item.
function selectAutofilledItem(autofilledValue: string, eventDetails: SelectRootChangeEventDetails) {
  // Browser autofill only writes a single scalar value.
  if (isMultiple.value) {
    return;
  }

  const { valuesRef, labelsRef } = store.context;
  // Preserve the original serialized matching, then fall back to rendered text,
  // which browsers can autofill for primitive values like
  // `value="US">United States`.
  const autofilledValueLower = autofilledValue.toLowerCase();
  let matchingIndex = valuesRef.value.findIndex(
    (candidate) =>
      stringifyAsValue(candidate, props.itemToStringValue).toLowerCase() === autofilledValueLower ||
      stringifyAsLabel(candidate, props.itemToStringLabel).toLowerCase() === autofilledValueLower,
  );

  if (matchingIndex === -1) {
    matchingIndex = valuesRef.value.findIndex((_, index) => {
      const renderedLabel = labelsRef.value[index];
      return renderedLabel != null && renderedLabel.toLowerCase() === autofilledValueLower;
    });
  }

  const matchingValue = valuesRef.value[matchingIndex];
  if (matchingValue != null) {
    // `setValue` may be canceled by `valueChange`; rely on `useValueChanged` to
    // mark the field dirty and run validation only when the value actually changes.
    setValue(matchingValue, eventDetails);
  }
}

function handleHiddenInputChange(event: Event) {
  const autofilledValue = (event.currentTarget as HTMLInputElement).value;
  const isNewValue = autofilledValue !== handledValue;
  handledValue = autofilledValue;

  if (!isNewValue || event.defaultPrevented || isDisabled.value || props.readOnly) {
    void nextTick(writeValueToInput);
    return;
  }

  const eventDetails = createChangeEventDetails(REASONS.none, event);
  // The items of a closed select mount in the next flush, and they then give their values.
  store.set('forceMounted', true);
  void nextTick(() => {
    selectAutofilledItem(autofilledValue, eventDetails);
    void nextTick(writeValueToInput);
  });
}

useFormReset(inputElement, (event) => {
  const defaultValue = getDefaultValue();
  const hasChanged =
    props.value === undefined &&
    isSelectedValueDirty(selectedValue.value, defaultValue, comparer.value) &&
    setValue(defaultValue, createChangeEventDetails(REASONS.none, event));

  if (hasChanged) {
    isResetChangePending = true;
  } else {
    clearFieldError(selectedValue.value);
  }

  void nextTick(writeValueToInput);
});

watch(
  inputElement,
  (input, _previous, onCleanup) => {
    if (!input) {
      return;
    }

    // Chromium restores the form state of a page after `load`, with no event on the input.
    onCleanup(addEventListener(ownerWindow(input), 'pageshow', writeValueToInput));
  },
  { flush: 'post' },
);

const hiddenInputName = computed(() => (isMultiple.value ? undefined : inputName.value));

const hiddenValues = computed(() => {
  const value = selectedValue.value;
  if (!isMultiple.value || !Array.isArray(value) || !inputName.value) {
    return EMPTY_ARRAY as string[];
  }
  return value.map((currentValue) => stringifyAsValue(currentValue, props.itemToStringValue));
});

// The style is the constant itself, in an object that no `mergeProps` call makes.
// `handleHiddenInputInvalid` then keeps the size that it writes.
function inputProps() {
  return {
    ...validation.getValidationProps(isDisabled.value),
    ref: setInputElement,
    id:
      controlId.value && hiddenInputName.value == null
        ? `${controlId.value}-hidden-input`
        : undefined,
    form: props.form,
    name: hiddenInputName.value,
    type: getHiddenInputType(
      setValidityData !== NOOP,
      inputName.value,
      props.autoComplete,
      props.required,
    ),
    autocomplete: props.autoComplete,
    value: serializedValue.value,
    disabled: isDisabled.value,
    required: props.required && !(isMultiple.value && hasSelectedValue.value),
    readonly: props.readOnly,
    style: inputName.value ? visuallyHiddenInput : visuallyHiddenInputPinned,
    tabindex: -1,
    'aria-hidden': true,
    onInvalid: handleHiddenInputInvalid,
    onFocusin() {
      // Move focus to the trigger element when the hidden input is focused.
      store.select('triggerElement')?.focus({
        // Supported in Chrome from 144 (January 2026)
        focusVisible: true,
      } as FocusOptions);
    },
    onInput: handleHiddenInputChange,
    onChange: handleHiddenInputChange,
  };
}

defineExpose({ ...actions, inputElement });
</script>

<template>
  <slot />
  <input v-bind="inputProps()" />
  <input
    v-for="hiddenValue in hiddenValues"
    :key="hiddenValue"
    type="hidden"
    :form="form"
    :name="inputName"
    :value="hiddenValue"
    :disabled="isDisabled"
  />
</template>
