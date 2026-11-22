<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Popover } from '../../src/popover';
import CallAtMount from './CallAtMount.vue';

// Two triggers outside the root, with a handle, and one trigger in the root. With `noRoot`, no root
// has the handle. A child of the root calls `atMount` in its `onMounted`.
const props = defineProps({
  handle: { type: Object as PropType<InstanceType<typeof Popover.Handle>>, required: true },
  root: Object as PropType<Record<string, unknown>>,
  noRoot: Boolean,
  atMount: Function as PropType<() => void>,
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart, handle: props.handle });
</script>

<template>
  <Popover.Trigger id="first" :handle payload="first">First</Popover.Trigger>
  <Popover.Trigger id="second" :handle payload="second">Second</Popover.Trigger>
  <Popover.Root v-if="!noRoot" ref="rootPart" :handle v-bind="root">
    <template #default="{ payload }">
      <Popover.Trigger id="inside">Inside</Popover.Trigger>
      <CallAtMount v-if="atMount" :call="atMount" />
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="popup">{{ payload }}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </template>
  </Popover.Root>
</template>
