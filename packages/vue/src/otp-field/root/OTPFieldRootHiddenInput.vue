<script setup lang="ts">
// The root renders the hidden input only for a valid `length`. A `v-if` on an element makes the
// compiler call the `mergeProps` of Vue, which makes a new `style` object in each render. Vue then
// writes each key of the style again, and the input loses the size that `handleHiddenInputInvalid`
// wrote. Here the bound object is the only attribute of the input.
defineProps<{
  inputProps: Record<string, unknown>;
}>();
</script>

<template>
  <input v-bind="inputProps" />
</template>
