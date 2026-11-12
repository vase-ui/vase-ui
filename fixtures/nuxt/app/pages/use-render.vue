<script setup lang="ts">
import { ref } from 'vue';
import { mergeProps } from '@vase-ui/vue/merge-props';

const names = ref<string[]>([]);
const first = { class: 'first', onClick: () => names.value.push('first') };
const second = { class: 'second', onClick: () => names.value.push('second') };
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
    <ol data-testid="names">
      <li v-for="name in names" :key="name">{{ name }}</li>
    </ol>
  </main>
</template>
