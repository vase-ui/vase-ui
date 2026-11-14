<script setup lang="ts">
import { PreviewCard } from '@vase-ui/vue/preview-card';

const demoPreviewCard = PreviewCard.createHandle<{ title: string }>();
</script>

<template>
  <PreviewCard.Trigger :handle="demoPreviewCard" :payload="{ title: 'Trigger 1' }" href="#">
    Trigger 1
  </PreviewCard.Trigger>
  <PreviewCard.Trigger :handle="demoPreviewCard" :payload="{ title: 'Trigger 2' }" href="#">
    Trigger 2
  </PreviewCard.Trigger>

  <PreviewCard.Root :handle="demoPreviewCard">
    <template #default="{ payload }">
      <PreviewCard.Portal>
        <PreviewCard.Positioner :side-offset="8">
          <PreviewCard.Popup>
            <span v-if="payload !== undefined">Preview card opened by {{ payload.title }}</span>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </template>
  </PreviewCard.Root>
</template>
