<script setup lang="ts">
import { useAttrs } from 'vue';
import {
  useDeferredServerRender,
  useLabelableContext,
  useLabelableId,
} from '../../src/internals/labelable-provider';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  id?: string | undefined;
}>();

const attrs = useAttrs();
const { getDescriptionProps } = useLabelableContext();
const inputId = useLabelableId({ id: () => props.id });
useDeferredServerRender();

function elementProps() {
  return getDescriptionProps({ ...attrs, id: inputId.value });
}
</script>

<template>
  <input v-bind="elementProps()" />
</template>
