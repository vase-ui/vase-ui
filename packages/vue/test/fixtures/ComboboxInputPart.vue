<script setup lang="ts">
import { computed, nextTick, toRaw } from 'vue';
import {
  useComboboxInputValueContext,
  useComboboxRootContext,
} from '../../src/combobox/root/ComboboxRootContext';
import { createChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { REASONS } from '../../src/internals/reasons';
import { mergeProps } from '../../src/merge-props';

// The cases of the root use this part in place of `Combobox.Input`, so that they test the root
// alone. It writes the input to the store, gives it the props of the root and the input value, and
// handles the `input` event. It has no composition, no keys of its own and no chips.
const props = defineProps<{ insidePopup?: boolean | undefined }>();

const store = useComboboxRootContext();
const inputValue = useComboboxInputValueContext();
const inputProps = computed(() => store.select('inputProps'));
const name = computed(() => store.select('name'));
const selectionMode = computed(() => store.select('selectionMode'));
const inputOwnsFormValue = computed(() => selectionMode.value === 'none' && !props.insidePopup);

let currentElement: HTMLInputElement | null = null;

function setInputElement(value: unknown) {
  const element = value as HTMLInputElement | null;
  // Vue calls a function ref again on each patch, with the same element.
  if (element === currentElement) {
    return;
  }
  currentElement = element;
  store.context.inputRef.value = element;
  const state = toRaw(store.state);
  const nextIsInsidePopup = Boolean(props.insidePopup) || state.inline;
  if (nextIsInsidePopup && !state.hasInputValue) {
    store.context.setInputValue('', createChangeEventDetails(REASONS.none));
  }
  store.update({
    inputElement: element,
    inputInsidePopup: nextIsInsidePopup,
    inputOwnsFormValue: inputOwnsFormValue.value,
  });
}

function handleInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const details = createChangeEventDetails(REASONS.inputChange, event);
  store.context.setInputValue(input.value, details);
  // A consumer can keep its controlled value. No render then follows, so the part writes the
  // state back.
  void nextTick(() => {
    const text = String(inputValue.value ?? '');
    if (input.value !== text) {
      input.value = text;
    }
  });
  if (details.isCanceled) {
    return;
  }

  const clearDetails = createChangeEventDetails(REASONS.inputClear, event);
  const state = toRaw(store.state);
  if (input.value === '' && !state.inputInsidePopup) {
    if (selectionMode.value === 'single') {
      store.context.setSelectedValue(null, clearDetails);
    }
    if (!state.openOnInputClick) {
      store.setOpen(false, clearDetails);
    }
  }
  if (input.value.trim() !== '') {
    store.setOpen(true, createChangeEventDetails(REASONS.inputChange, event));
  }
}

function inputAttributes() {
  return mergeProps(inputProps.value, {
    ref: setInputElement,
    value: inputValue.value,
    name: inputOwnsFormValue.value && name.value ? name.value : undefined,
    onInput: handleInput,
  });
}
</script>

<template>
  <input v-bind="inputAttributes()" />
</template>
