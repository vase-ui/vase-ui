<script setup lang="ts">
// The roots of the date and time fields render the hidden input through this component. The bound
// object is the only attribute of the input. With a second attribute, the compiler calls the
// `mergeProps` of Vue, which makes a new `style` object in each render. Vue then writes each key of
// the style again, and the input loses the size that `handleHiddenInputInvalid` wrote.
defineProps<{
  inputProps: Record<string, unknown>;
}>();
</script>

<template>
  <input v-bind="inputProps" />
</template>
