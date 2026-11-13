<script setup lang="ts">
import { useAttrs } from 'vue';
import { fieldValidityMapping } from '../../src/internals/field-constants';
import { useFieldRootContext } from '../../src/internals/field-root-context';
import { getStateAttributesProps } from '../../src/internals/getStateAttributesProps';

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const { state } = useFieldRootContext();

function elementProps() {
  return { ...getStateAttributesProps(state.value, fieldValidityMapping), ...attrs };
}
</script>

<template>
  <span v-bind="elementProps()"><slot /></span>
</template>
