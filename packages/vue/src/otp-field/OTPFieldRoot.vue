<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  nextTick,
  provide,
  shallowReactive,
  shallowRef,
  useAttrs,
  useId,
  watch,
  watchPostEffect,
} from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { byDocumentOrder, useElement, type ElementSlotProps } from '../common/element';
import { useFormReset } from '../common/formEvents';
import { givenId } from '../common/id';
import { submitAtEnter } from '../common/implicitSubmission';
import { useModel } from '../common/model';
import { visuallyHiddenInput } from '../common/visuallyHidden';
import { warn } from '../common/warn';
import { fieldKey, fieldStateAttributes, joinDescribedBy } from '../field/control';
import { fieldsetKey, useInDisabledFieldset } from '../fieldset/part';
import { inputmodeOf, patternOf, removeAt, toCode, writeAt } from './code';
import { otpFieldKey } from './root';
import type {
  OTPFieldRootChangeEventDetails,
  OTPFieldRootCompleteEventDetails,
  OTPFieldRootEmits,
  OTPFieldRootInvalidEventDetails,
  OTPFieldRootProps,
  OTPFieldRootState,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<OTPFieldRootProps>(), {
  modelValue: undefined,
  defaultValue: '',
  validationType: 'numeric',
  autocomplete: 'one-time-code',
});
const emit = defineEmits<OTPFieldRootEmits>();
defineSlots<{
  default?(scope: { state: OTPFieldRootState }): unknown;
  /**
   * Renders your element in place of the element of the root. Bind `props` with `v-bind` and
   * `elementRef` with `:ref`. The root renders the form input after your element.
   */
  element?(scope: ElementSlotProps<OTPFieldRootState>): unknown;
}>();

/** An edit that waits for its code: the focus and the completion of the edit. */
interface Edit {
  code: string;
  focus: number | undefined;
  complete: OTPFieldRootCompleteEventDetails | undefined;
}

const attrs = useAttrs();
const field = inject(fieldKey, null);
const fieldset = inject(fieldsetKey, null);
// The label and the messages of the field can come after the root.
useDeferredServerRender();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const { element: formInput, setElement: setFormInput } = useElement<HTMLInputElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

const { value, setOwn, resetValue } = useModel(
  () => props.modelValue,
  props.modelValue ?? props.defaultValue,
);
const code = computed(() => toCode(value.value, props).code);
const characters = computed(() => Array.from(code.value));
const validLength = computed(() => Number.isInteger(props.length) && props.length > 0);
const end = computed(() => Math.min(characters.value.length, props.length - 1));

const mountedSlots = shallowReactive<HTMLInputElement[]>([]);
const sortedSlots = computed(() => [...mountedSlots].sort(byDocumentOrder));
// The slot of the last `focus` event, while the focus is in the field.
const focused = shallowRef<HTMLInputElement>();
const tabStop = computed(() => {
  // A slot that went is in no list, so the end slot then has the tab stop.
  const index = indexOf(focused.value ?? null);
  return index >= 0 ? index : end.value;
});
let claimed = 0;
let pending: Edit | undefined;

const elementId = computed(() => givenId(props.id) ?? field?.controlId ?? generatedId);
const isDisabled = computed(() => props.disabled || !!field?.disabled || inDisabledFieldset.value);
const locked = () => isDisabled.value || props.readonly;
const state = computed<OTPFieldRootState>(() => ({
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: code.value !== '',
  complete: characters.value.length === props.length,
  disabled: isDisabled.value,
  readonly: props.readonly,
  required: props.required,
  length: props.length,
  value: code.value,
}));
const keyboardHint = computed(() => props.inputmode ?? inputmodeOf(props.validationType));
// `maxlength` counts UTF-16 code units, and one character of `none` can take two.
const maxlength = computed(() =>
  props.validationType === 'none' ? props.length * 2 : props.length,
);
const entryName = computed(() => field?.name ?? props.name);

watch(code, (next) => field?.setValue(next, next !== ''), { immediate: true });

// The focus move and the completion of an edit wait for its code, so a parent that writes the code
// later still gets them.
watch(
  code,
  (next) => {
    const edit = pending;
    pending = undefined;
    if (edit?.code === next) {
      // A parent can write the code after the user left the field.
      if (edit.focus !== undefined && element.value?.matches(':focus-within')) {
        focusSlot(edit.focus);
      }
      if (edit.complete) complete(edit.complete);
    }
    if (activeIndex() > end.value) focusSlot(end.value);
  },
  { flush: 'post' },
);

// The browser sends no `blur` when a focused field becomes disabled.
watch(isDisabled, (disabled) => {
  if (disabled) focused.value = undefined;
});

watch(
  [() => sortedSlots.value[0], formInput],
  ([first, input], _, onCleanup) => {
    const control = first ?? input;
    if (!control || !field) return;
    onCleanup(
      field.setControl({
        element: control,
        get id() {
          return first?.id || elementId.value;
        },
        get name() {
          return props.name;
        },
        get disabled() {
          return props.disabled || inDisabledFieldset.value;
        },
        get readOnly() {
          return props.readonly;
        },
        get inputs() {
          return formInput.value ? [formInput.value] : [];
        },
        get focusElement() {
          return sortedSlots.value[tabStop.value];
        },
      }),
    );
  },
  { flush: 'post' },
);

useFormReset(formInput, () => {
  const reset = toCode(resetValue(props.defaultValue), props).code;
  field?.onReset(reset);
  if (code.value === reset) return;
  setOwn(reset);
  emit('update:modelValue', reset);
});

if (process.env.NODE_ENV !== 'production') {
  watchPostEffect(() => {
    if (!validLength.value) {
      warn(
        `<OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(props.length)}}\`.`,
      );
    }
  });
  // A slot adds itself in a later post-flush callback than this one, so the count waits a tick.
  watch(
    [() => mountedSlots.length, () => props.length],
    async () => {
      await nextTick();
      const count = mountedSlots.length;
      if (!validLength.value || count === 0 || count === props.length) return;
      warn(
        '<OTPField.Root> `length` must match the number of rendered ' +
          `<OTPField.Input /> parts. Received \`length={${props.length}}\` but rendered ` +
          `${count} input${count === 1 ? '' : 's'}.`,
      );
    },
    { flush: 'post' },
  );
}

provide(otpFieldKey, {
  get characters() {
    return characters.value;
  },
  get state() {
    return state.value;
  },
  get id() {
    return elementId.value;
  },
  get inputmode() {
    return keyboardHint.value;
  },
  get autocomplete() {
    return props.autocomplete;
  },
  get form() {
    return props.form;
  },
  get maxlength() {
    return maxlength.value;
  },
  get labelledBy() {
    return field?.labelId ?? fieldset?.legendId;
  },
  get end() {
    return end.value;
  },
  get tabStop() {
    return tabStop.value;
  },
  claimIndex: () => claimed++,
  indexOf,
  addSlot(slot) {
    mountedSlots.push(slot);
    return () => mountedSlots.splice(mountedSlots.indexOf(slot), 1);
  },
  enter,
  remove,
  focusSlot,
  onFocus(index, slot) {
    if (index > end.value) {
      focusSlot(end.value);
      return;
    }
    focused.value = slot;
    slot.select();
  },
  onEnter: (event) => submitAtEnter(event, [...mountedSlots, formInput.value]),
});

defineExpose({ element });

function elementProps() {
  const named = 'aria-label' in attrs || 'aria-labelledby' in attrs;
  const on = (value: boolean) => (value ? '' : undefined);
  return mergeProps(
    {
      role: 'group',
      'aria-labelledby': named ? undefined : (field?.labelId ?? fieldset?.legendId),
      ...fieldStateAttributes(state.value, isDisabled.value),
      'data-readonly': on(props.readonly),
      'data-required': on(props.required),
      'data-complete': on(state.value.complete),
      onFocusout,
    },
    joinDescribedBy(attrs, field),
  );
}

function formInputProps() {
  return {
    type: 'text',
    id: entryName.value == null ? `${elementId.value}-hidden-input` : undefined,
    name: entryName.value,
    form: props.form,
    value: code.value,
    autocomplete: props.autocomplete,
    inputmode: keyboardHint.value,
    maxlength: maxlength.value,
    pattern: patternOf(props.validationType, props.length),
    disabled: isDisabled.value,
    readonly: props.readonly,
    required: props.required,
    'aria-hidden': true,
    tabindex: -1,
    style: visuallyHiddenInput,
    onInput: onFormInput,
    // A form that finds the code invalid gives the input the focus.
    onFocus: () => focusSlot(end.value),
  };
}

function indexOf(slot: HTMLInputElement | null) {
  return slot ? sortedSlots.value.indexOf(slot) : -1;
}

function activeIndex() {
  return sortedSlots.value.findIndex((slot) => slot.matches(':focus'));
}

function focusSlot(index: number) {
  sortedSlots.value[index]?.focus();
}

function enter(index: number, text: string, reason: 'input-change' | 'input-paste', event: Event) {
  if (locked()) {
    nextTick(showValue);
    return;
  }
  if (text === '' && reason === 'input-change') {
    edit(removeAt(code.value, index), 'input-clear', event, undefined);
    return;
  }
  const accepted = accept(text, reason, event);
  if (accepted === '') {
    nextTick(showValue);
    return;
  }
  const next = writeAt(code.value, index, accepted, props);
  // The key of the character that a slot has moves the focus too.
  const moves =
    (event.currentTarget as HTMLInputElement).matches(':focus') &&
    (next !== code.value ||
      reason === 'input-paste' ||
      (event as InputEvent).inputType === 'insertText');
  const focus = moves ? Math.min(index + Array.from(accepted).length, props.length - 1) : undefined;
  edit(next, reason, event, focus, completion(next, reason, event));
}

function remove(index: number, key: 'Backspace' | 'Delete', all: boolean, event: KeyboardEvent) {
  if (locked()) return;
  const before = Math.max(index - 1, 0);
  let next: string;
  if (all) next = '';
  else if (key === 'Delete') next = removeAt(code.value, index);
  else next = removeAt(code.value, characters.value[index] ? index : before);
  edit(next, 'keyboard', event, all ? 0 : key === 'Delete' ? index : before);
}

// A password manager or the browser fills the form input.
function onFormInput(event: Event) {
  if (locked()) {
    nextTick(showValue);
    return;
  }
  const next = accept((event.currentTarget as HTMLInputElement).value, 'input-change', event);
  // A fill must not take the focus from another control.
  const focus = element.value?.matches(':focus-within')
    ? Math.min(Array.from(next).length, props.length - 1)
    : undefined;
  edit(next, 'input-change', event, focus, completion(next, 'input-change', event));
}

/** The code of a text of the user. Emits `valueInvalid` when the text loses characters. */
function accept(text: string, reason: 'input-change' | 'input-paste', event: Event) {
  const { code: accepted, refused } = toCode(text, props);
  if (refused) emit('valueInvalid', text, { reason, event } as OTPFieldRootInvalidEventDetails);
  return accepted;
}

function completion(next: string, reason: 'input-change' | 'input-paste', event: Event) {
  const completes =
    Array.from(next).length === props.length &&
    (reason === 'input-paste' || characters.value.length < props.length);
  return completes ? ({ reason, event } as OTPFieldRootCompleteEventDetails) : undefined;
}

function edit(
  next: string,
  reason: OTPFieldRootChangeEventDetails['reason'],
  event: Event,
  focus: number | undefined,
  completes?: OTPFieldRootCompleteEventDetails,
) {
  let changed = false;
  if (next === code.value) {
    if (focus !== undefined) focusSlot(focus);
    if (completes) complete(completes);
  } else {
    const details = createChangeEventDetails(reason, event) as OTPFieldRootChangeEventDetails;
    emit('valueChange', next, details);
    if (!details.isCanceled) {
      changed = true;
      pending = { code: next, focus, complete: completes };
      setOwn(next);
      emit('update:modelValue', next);
    }
  }
  // The parent can refuse or change a controlled value. Its answer arrives with its next render.
  nextTick(() => {
    showValue();
    if (changed) field?.onEdit();
  });
}

function complete(details: OTPFieldRootCompleteEventDetails) {
  emit('valueComplete', code.value, details);
  if (props.autoSubmit) formInput.value?.form?.requestSubmit();
}

// The binding of `value` writes only a value that changed. After a refused character, a cancelled
// change or a value that the parent kept, each input must show the code again.
function showValue() {
  sortedSlots.value.forEach((slot, index) => {
    const character = characters.value[index] ?? '';
    if (slot.value !== character) slot.value = character;
  });
  if (formInput.value && formInput.value.value !== code.value) formInput.value.value = code.value;
  sortedSlots.value[activeIndex()]?.select();
}

function onFocusout(event: FocusEvent) {
  // A move of the focus between two slots is not a leave.
  if (element.value?.contains(event.relatedTarget as Node | null)) return;
  focused.value = undefined;
  field?.onLeave(event.target as Element);
}
</script>

<template>
  <template v-if="$slots.element">
    <slot name="element" :props="elementProps()" :elementRef="setElement" :state="state" />
    <input v-if="validLength" v-bind="formInputProps()" :ref="setFormInput" />
  </template>
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <input v-if="validLength" v-bind="formInputProps()" :ref="setFormInput" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <input v-if="validLength" v-bind="formInputProps()" :ref="setFormInput" />
  </div>
</template>
