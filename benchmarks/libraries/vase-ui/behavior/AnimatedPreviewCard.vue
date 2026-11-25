<script setup lang="ts">
import { PreviewCard } from '@vase-ui/vue/preview-card';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <PreviewCard.Root>
      <PreviewCard.Trigger href="#preview" data-bench="trigger" :delay="0" :close-delay="0">
        Open
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner>
          <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden" appear>
            <PreviewCard.Popup data-bench="popup" class="bench-motion">
              <PreviewCard.Arrow />
              Preview
            </PreviewCard.Popup>
          </Transition>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  </div>
</template>

<style>
[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}
</style>
