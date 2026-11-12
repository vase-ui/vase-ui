<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ text: string }>();

const pieces = computed(() => props.text.split('`'));
</script>

<template>
  <template v-for="(piece, index) in pieces" :key="index">
    <code v-if="index % 2 === 1">{{ piece }}</code>
    <template v-else>{{ piece }}</template>
  </template>
</template>
