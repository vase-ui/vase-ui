<script setup lang="ts">
import type { PropType } from 'vue';

defineProps({ attrs: { type: Object as PropType<Record<string, unknown>>, required: true } });
</script>

<template>
  <img v-bind="attrs" />
</template>
