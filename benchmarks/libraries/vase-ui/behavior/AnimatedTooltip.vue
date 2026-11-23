<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger data-bench="trigger" :delay="0" :close-delay="0">Open</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden">
              <Tooltip.Popup data-bench="popup" class="bench-motion">
                <Tooltip.Arrow />
                Tooltip
              </Tooltip.Popup>
            </Transition>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  </div>
</template>

<style>
[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}
</style>
