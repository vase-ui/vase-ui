<script setup lang="ts">
import { useAttrs } from 'vue';
import { useFieldsetRootContext } from '../../src/fieldset/root/FieldsetRootContext';

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const { legendId } = useFieldsetRootContext();

function elementProps() {
  return { ...attrs, 'data-legend-id': legendId.value };
}
</script>

<template>
  <span v-bind="elementProps()" />
</template>
