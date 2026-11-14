<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';

const demoPopover = Popover.createHandle<{ text: string }>();
</script>

<template>
  <Popover.Trigger :handle="demoPopover" :payload="{ text: 'Trigger 1' }">
    Trigger 1
  </Popover.Trigger>

  <Popover.Trigger :handle="demoPopover" :payload="{ text: 'Trigger 2' }">
    Trigger 2
  </Popover.Trigger>

  <Popover.Root v-slot="{ payload }" :handle="demoPopover">
    <Popover.Portal>
      <Popover.Positioner :side-offset="8">
        <Popover.Popup>
          <Popover.Arrow />
          <Popover.Title>Popover</Popover.Title>
          <Popover.Description v-if="payload !== undefined">
            Opened by {{ payload.text }}
          </Popover.Description>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
