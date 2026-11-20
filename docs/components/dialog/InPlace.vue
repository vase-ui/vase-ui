<script setup lang="ts">
import { ref, useId } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import { useMediaQuery } from '@vase-ui/vue/unstable-use-media-query';

const open = ref(true);
const isNarrow = useMediaQuery('(max-width: 48rem)', { defaultMatches: false });
const titleId = useId();
</script>

<template>
  <div class="layout">
    <ul>
      <li><button type="button" @click="open = true">Task details</button></li>
    </ul>
    <Dialog.Root
      :open="open"
      :modal="isNarrow"
      :disable-pointer-dismissal="!isNarrow"
      @open-change="open = $event"
    >
      <Dialog.Portal disabled>
        <div :data-modal="isNarrow || undefined" class="portal">
          <Dialog.Backdrop class="backdrop" />
          <Dialog.Popup
            :aria-labelledby="titleId"
            :initial-focus="isNarrow ? undefined : false"
            class="panel"
          >
            <Dialog.Title :id="titleId">Task details</Dialog.Title>
            <p>Review the draft before Friday.</p>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
}

.backdrop {
  display: none;
}

.panel {
  position: relative;
  padding: 1rem;
  border: 1px solid;
  background: canvas;
  color: canvastext;
}

.portal[data-modal] .backdrop {
  display: block;
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 25%);
}

.portal[data-modal] .panel {
  position: fixed;
  inset: auto 0 0;
  max-height: 80dvh;
  overflow: auto;
}
</style>
