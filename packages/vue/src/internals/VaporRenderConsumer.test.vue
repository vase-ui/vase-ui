<script setup vapor lang="ts">
import type { Component } from 'vue';

defineProps<{
  part: Component;
  enabled: boolean;
  form: 'empty' | 'bound';
  as?: string | undefined;
  count?: number | undefined;
}>();
</script>

<template>
  <component :is="part" :enabled="enabled" :as="as" :count="count">
    <template #render="{ props }">
      <span v-if="form === 'bound'" v-bind="props" :ref="props.ref" data-testid="bound" />
      <span v-else data-testid="empty" />
    </template>
  </component>
</template>
