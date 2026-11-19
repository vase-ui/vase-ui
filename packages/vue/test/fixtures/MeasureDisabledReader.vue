<script setup lang="ts">
import { useTemplateRef } from 'vue';

// Shows what the browser says of its input at each render.
const input = useTemplateRef<HTMLInputElement>('input');
</script>

<template>
  <input ref="input" aria-label="Read" />
  <span class="shown">{{ input?.matches(':disabled') ?? 'none' }}</span>
</template>
