<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
import { Tooltip } from '@vase-ui/vue/tooltip';
import MyButton from './MyButton.vue';
</script>

<template>
  <Dialog.Root>
    <Tooltip.Root>
      <Tooltip.Trigger>
        <template #render="{ props: tooltipTrigger }">
          <Dialog.Trigger v-bind="tooltipTrigger">
            <template #render="{ props: dialogTrigger }">
              <MyButton v-bind="dialogTrigger" size="md">Open dialog</MyButton>
            </template>
          </Dialog.Trigger>
        </template>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>Opens a dialog</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
    <Dialog.Portal>
      <Dialog.Popup>
        <Dialog.Title>Dialog</Dialog.Title>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
