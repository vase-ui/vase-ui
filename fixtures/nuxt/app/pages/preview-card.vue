<script setup lang="ts">
import { PreviewCard } from '@vase-ui/vue/preview-card';
</script>

<template>
  <main>
    <PreviewCard.Root>
      <PreviewCard.Trigger data-testid="closed-link" href="#closed" :delay="0"
        >Closed link</PreviewCard.Trigger
      >
      <PreviewCard.Portal>
        <PreviewCard.Positioner>
          <PreviewCard.Popup data-testid="closed-popup">Closed preview</PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
    <PreviewCard.Root default-open default-trigger-id="open-link">
      <template #default="{ payload }">
        <PreviewCard.Trigger
          id="open-link"
          data-testid="open-link"
          href="#open"
          payload="Open preview"
          >Open link</PreviewCard.Trigger
        >
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="open-popup">
              <PreviewCard.Viewport data-testid="open-viewport">{{ payload }}</PreviewCard.Viewport>
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </template>
    </PreviewCard.Root>
  </main>
</template>
