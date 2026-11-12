<script setup lang="ts">
import { useAttrs } from 'vue';
import { useLabel } from '../../src/internals/labelable-provider';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    id?: string | undefined;
    native?: boolean;
  }>(),
  { native: true },
);

const attrs = useAttrs();
const labelProps = useLabel({ id: () => props.id, native: () => props.native });

function elementProps() {
  return { ...labelProps.value, ...attrs };
}
</script>

<template>
  <component :is="native ? 'label' : 'div'" v-bind="elementProps()"><slot /></component>
</template>
