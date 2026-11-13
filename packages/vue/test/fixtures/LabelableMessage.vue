<script setup lang="ts">
import { useAttrs } from 'vue';
import { useVaseUiId } from '../../src/internals/useBaseUiId';
import { useRegisteredMessageId } from '../../src/internals/labelable-provider';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  id?: string | undefined;
}>();

const attrs = useAttrs();
const messageId = useVaseUiId(() => props.id);
useRegisteredMessageId(messageId);

function elementProps() {
  return { ...attrs, id: messageId.value };
}
</script>

<template>
  <p v-bind="elementProps()"><slot /></p>
</template>
