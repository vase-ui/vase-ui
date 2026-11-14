<script setup lang="ts">
import { PreviewCard } from '@vase-ui/vue/preview-card';
</script>

<template>
  <PreviewCard.Root>
    <PreviewCard.Trigger href="#">Trigger 1</PreviewCard.Trigger>
    <PreviewCard.Trigger href="#">Trigger 2</PreviewCard.Trigger>
    <PreviewCard.Portal>
      <PreviewCard.Positioner>
        <PreviewCard.Popup>Preview</PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  </PreviewCard.Root>
</template>
