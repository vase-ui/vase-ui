<script lang="ts">
export interface MultiPartRootProps<Payload = unknown> {
  payload?: Payload | undefined;
}
</script>

<script setup lang="ts" generic="Payload">
import { markPart } from '../../internals/part-marker';

const props = defineProps<MultiPartRootProps<Payload>>();

defineSlots<{
  default?: (props: { payload: Payload | undefined }) => unknown;
}>();

markPart();
</script>

<template>
  <div data-multi-part-root><slot :payload="props.payload" /></div>
</template>
