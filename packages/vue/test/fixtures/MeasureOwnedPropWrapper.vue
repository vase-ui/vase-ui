<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import MeasureOwnedPropInner from './MeasureOwnedPropInner.vue';

// A wrapper in the form of the Vue guide: it declares no prop of the inner part, and it keeps two
// props out with `undefined` after the attributes of the parent.
defineOptions({ inheritAttrs: false });
const attrs = useAttrs();
</script>

<template>
  <MeasureOwnedPropInner v-bind="mergeProps(attrs, { minDays: undefined, multiple: undefined })" />
</template>
