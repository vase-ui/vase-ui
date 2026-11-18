<script setup lang="ts">
import { shallowRef, useAttrs } from 'vue';
import { useVaseUiId } from '../../src/internals/useVaseUiId';
import { useRegisteredMessageId } from '../../src/internals/labelable-provider';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  id?: string | undefined;
}>();

const attrs = useAttrs();
const messageId = useVaseUiId(() => props.id);
const element = shallowRef<HTMLElement | null>(null);
useRegisteredMessageId(messageId, element);

function elementProps() {
  return { ...attrs, id: messageId.value };
}
</script>

<template>
  <p ref="element" v-bind="elementProps()"><slot /></p>
</template>
