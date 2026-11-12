<script setup lang="ts">
import { ref } from 'vue';
import { mergeProps } from '@vase-ui/vue/merge-props';

const calls = ref<string[]>([]);
const first = { class: 'first', onClick: () => calls.value.push('first') };
const second = { class: 'second', onClick: () => calls.value.push('second') };
</script>

<template>
  <main>
    <Notice data-testid="default-tag" class="highlight">Default tag</Notice>
    <Notice data-testid="as-tag" as="section" tone="warning">As tag</Notice>
    <Notice data-testid="render-slot">
      <template #render="{ props }">
        <a v-bind="props" href="/button">Render slot</a>
      </template>
    </Notice>
    <button data-testid="merged" type="button" v-bind="mergeProps(first, second)">Merged</button>
    <ol data-testid="calls">
      <li v-for="call in calls" :key="call">{{ call }}</li>
    </ol>
  </main>
</template>
