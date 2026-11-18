<script setup lang="ts">
import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import CompositeListItemPart from '../../../../test/fixtures/CompositeListItemPart.vue';
import { useCompositeList } from './useCompositeList';

const props = defineProps<{ elementsRef?: ShallowRef<(HTMLElement | null)[]> }>();
useCompositeList({ elementsRef: props.elementsRef ?? shallowRef([]) });
</script>

<template>
  <div>
    <CompositeListItemPart data-testid="a" />
    <CompositeListItemPart data-testid="b" />
  </div>
</template>
