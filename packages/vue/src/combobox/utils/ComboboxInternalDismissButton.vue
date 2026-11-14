<script setup lang="ts">
import { shallowRef } from 'vue';
import { visuallyHiddenInput } from '../../common/visuallyHidden';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useButton } from '../../internals/use-button';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

const store = useComboboxRootContext();

const { buttonRef, getButtonProps } = useButton({ native: false });

const element = shallowRef<HTMLSpanElement | null>(null);
// Vue calls the ref during the render, so a read of `element` there would make the render
// depend on it.
let heldElement: HTMLSpanElement | null = null;

function setElement(value: unknown) {
  const next = value as HTMLSpanElement | null;
  // Vue calls a function ref again on each patch, with the same element.
  if (next === heldElement) {
    return;
  }
  heldElement = next;
  element.value = next;
  buttonRef(next);
}

function handleDismiss(event: MouseEvent | KeyboardEvent) {
  store.setOpen(
    false,
    createChangeEventDetails(REASONS.closePress, event, event.currentTarget as HTMLElement),
  );
}

function buttonProps() {
  return {
    ...getButtonProps({ onClick: handleDismiss }),
    ref: setElement,
    'aria-label': 'Dismiss',
    tabindex: undefined,
    style: visuallyHiddenInput,
  };
}

defineExpose({ element });
</script>

<template>
  <span v-bind="buttonProps()" />
</template>
