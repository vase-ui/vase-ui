<script setup lang="ts">
import { shallowRef } from 'vue';
import * as Tooltip from '../index.parts';

const props = defineProps<{ handle?: Tooltip.Handle<unknown> | undefined }>();
const emit = defineEmits<{
  openChange: [open: boolean, eventDetails: Tooltip.Root.ChangeEventDetails];
}>();

// A server render gets no handle, because the props go to the server as JSON.
const tooltipHandle = props.handle ?? Tooltip.createHandle();
const open = shallowRef(true);
const activeTriggerId = shallowRef('trigger-a');

function onOpenChange(nextOpen: boolean, eventDetails: Tooltip.Root.ChangeEventDetails) {
  emit('openChange', nextOpen, eventDetails);
  open.value = nextOpen;
}
</script>

<template>
  <button type="button" @click="activeTriggerId = 'trigger-b'">Switch to B</button>
  <Tooltip.Root
    :handle="tooltipHandle"
    :open="open"
    :trigger-id="activeTriggerId"
    @open-change="onOpenChange"
  />
  <Tooltip.Trigger v-if="activeTriggerId === 'trigger-a'" id="trigger-a" :handle="tooltipHandle">
    Trigger A
  </Tooltip.Trigger>
</template>
