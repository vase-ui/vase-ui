<script setup lang="ts">
import { computed } from 'vue';
import { splitTextWithCode } from './textWithCode.ts';

const props = defineProps<{ text: string }>();

const pieces = computed(() => splitTextWithCode(props.text));
</script>

<template>
  <template v-for="(piece, index) in pieces" :key="index">
    <code v-if="piece.kind === 'code'">{{ piece.text }}</code>
    <a v-else-if="piece.kind === 'link'" :href="piece.href">{{ piece.text }}</a>
    <template v-else>{{ piece.text }}</template>
  </template>
</template>
