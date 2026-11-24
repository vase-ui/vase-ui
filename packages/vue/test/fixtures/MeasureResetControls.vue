<script setup lang="ts">
import { shallowRef } from 'vue';

const text = shallowRef('Ada');
</script>

<template>
  <form>
    <input :value="text" aria-label="Input" />
    <textarea :value="text" aria-label="Textarea" />
  </form>
</template>
