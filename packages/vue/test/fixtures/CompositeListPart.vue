<script setup lang="ts">
import { useCompositeList } from '../../src/internals/composite/list/useCompositeList';
import type { UseCompositeListParameters } from '../../src/internals/composite/list/useCompositeList';

const props = defineProps<UseCompositeListParameters<any>>();

useCompositeList({
  elementsRef: props.elementsRef,
  labelsRef: props.labelsRef,
  onMapChange: (map) => props.onMapChange?.(map),
});
</script>

<template>
  <slot />
</template>
