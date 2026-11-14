<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';

const props = defineProps<{ handle?: Tooltip.Handle<unknown> | undefined }>();

// A server render gets no handle, because the props go to the server as JSON.
const tooltipHandle = props.handle ?? Tooltip.createHandle();
</script>

<template>
  <Tooltip.Trigger id="trigger-b" :handle="tooltipHandle">Trigger B</Tooltip.Trigger>
</template>
