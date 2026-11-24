<script setup lang="ts">
import { shallowRef } from 'vue';

// A native input and a native textarea in a form, with `:value` of the same text.
const text = shallowRef('Ada');
</script>

<template>
  <form>
    <input :value="text" aria-label="Input" />
    <textarea :value="text" aria-label="Textarea" />
  </form>
</template>
