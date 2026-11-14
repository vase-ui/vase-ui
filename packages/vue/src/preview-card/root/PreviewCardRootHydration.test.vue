<script setup lang="ts">
import * as PreviewCard from '../index.parts';

withDefaults(defineProps<{ defaultOpen?: boolean; defaultTriggerId?: string | null }>(), {
  defaultOpen: false,
  defaultTriggerId: null,
});
</script>

<template>
  <PreviewCard.Root
    v-slot="{ payload }"
    :default-open="defaultOpen"
    :default-trigger-id="defaultTriggerId"
  >
    <PreviewCard.Trigger id="one" href="#one" payload="first">One</PreviewCard.Trigger>
    <PreviewCard.Trigger id="two" href="#two" payload="second">Two</PreviewCard.Trigger>
    <span data-testid="payload">{{ payload ?? 'none' }}</span>
  </PreviewCard.Root>
</template>
