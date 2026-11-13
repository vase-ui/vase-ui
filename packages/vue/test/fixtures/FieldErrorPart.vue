<script setup lang="ts">
import { useAttrs } from 'vue';
import { useFieldRootContext } from '../../src/internals/field-root-context';

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const { state } = useFieldRootContext();
</script>

<template>
  <span v-if="state.valid === false" v-bind="attrs"><slot /></span>
</template>
