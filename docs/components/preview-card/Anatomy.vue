<script setup lang="ts">
import { PreviewCard } from '@vase-ui/vue/preview-card';
</script>

<template>
  <PreviewCard.Root>
    <PreviewCard.Trigger />
    <PreviewCard.Portal>
      <PreviewCard.Backdrop />
      <PreviewCard.Positioner>
        <PreviewCard.Popup>
          <PreviewCard.Arrow />
          <PreviewCard.Viewport />
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  </PreviewCard.Root>
</template>
