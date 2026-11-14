<script setup lang="ts">
import { PreviewCard } from '@vase-ui/vue/preview-card';

const demoPreviewCard = PreviewCard.createHandle();
</script>

<template>
  <PreviewCard.Trigger :handle="demoPreviewCard" href="#">Trigger 1</PreviewCard.Trigger>
  <PreviewCard.Trigger :handle="demoPreviewCard" href="#">Trigger 2</PreviewCard.Trigger>

  <PreviewCard.Root :handle="demoPreviewCard">
    <PreviewCard.Portal>
      <PreviewCard.Positioner>
        <PreviewCard.Popup>Preview</PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  </PreviewCard.Root>
</template>
