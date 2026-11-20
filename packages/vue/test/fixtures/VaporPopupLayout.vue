<script setup vapor lang="ts">
import { Popover } from '@vase-ui/vue/popover';
import { ref } from 'vue';

const width = ref(120);
</script>

<template>
  <Popover.Root default-open default-trigger-id="anchor">
    <Popover.Trigger id="anchor" :payload="width">Open</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner data-testid="positioner">
        <Popover.Popup>
          <template #element="{ props, elementRef }">
            <div v-bind="props" :ref="elementRef" data-testid="popup" style="width: max-content">
              <Popover.Viewport>
                <button :style="{ width: width + 'px', height: '40px' }" @click="width = 180">
                  Resize
                </button>
              </Popover.Viewport>
            </div>
          </template>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
