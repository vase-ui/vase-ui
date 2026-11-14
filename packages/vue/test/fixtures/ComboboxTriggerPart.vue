<script setup lang="ts">
import { computed, toRaw } from 'vue';
import { useComboboxRootContext } from '../../src/combobox/root/ComboboxRootContext';
import { createChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { REASONS } from '../../src/internals/reasons';
import { mergeProps } from '../../src/merge-props';

// The tests use this part in place of `Combobox.Trigger`. It writes the trigger to the store and
// binds the props that tell the root the type of the input that opens the popup. A click toggles
// the popup.
const store = useComboboxRootContext();
const triggerProps = computed(() => store.select('triggerProps', true));

function setTriggerElement(element: unknown) {
  if (toRaw(store.state).triggerElement !== element) {
    store.set('triggerElement', element as HTMLElement | null);
  }
}

function handleClick(event: MouseEvent) {
  store.setOpen(
    !store.select('open'),
    createChangeEventDetails(REASONS.triggerPress, event, event.currentTarget as HTMLElement),
  );
}

function triggerAttributes() {
  return mergeProps(triggerProps.value, {
    ref: setTriggerElement,
    type: 'button',
    onClick: handleClick,
  });
}
</script>

<template>
  <button v-bind="triggerAttributes()"><slot /></button>
</template>
