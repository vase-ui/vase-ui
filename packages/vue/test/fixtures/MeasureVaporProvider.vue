<script setup vapor lang="ts">
import { provide } from 'vue';
import { textKey } from './measureProvide';

const props = defineProps<{ text: string }>();
provide(textKey, () => props.text);
</script>

<template>
  <slot />
</template>
