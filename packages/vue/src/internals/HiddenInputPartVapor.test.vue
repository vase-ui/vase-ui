<script setup vapor lang="ts">
// The template has the form of a part with a hidden input, and Vue 3.6 compiles it as a Vapor
// component. Only the project `vapor` mounts it: an ordinary test app has no Vapor interop.
import { visuallyHiddenInputPinned } from '../common/visuallyHidden';
import { handleHiddenInputInvalid } from './handleHiddenInputInvalid';

const props = defineProps<{
  count: number;
  report: (input: HTMLInputElement | null) => void;
}>();

function setInputElement(value: unknown) {
  props.report(value as HTMLInputElement | null);
}

function inputProps() {
  return {
    type: 'checkbox',
    required: true,
    'data-count': props.count,
    style: visuallyHiddenInputPinned,
    onInvalid: handleHiddenInputInvalid,
  };
}
</script>

<template>
  <slot />
  <input v-bind="inputProps()" :ref="setInputElement" />
</template>
