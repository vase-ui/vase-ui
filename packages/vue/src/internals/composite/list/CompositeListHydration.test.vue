<script setup lang="ts">
import { shallowRef } from 'vue';
import CompositeListItemPart from '../../../../test/fixtures/CompositeListItemPart.vue';
import { useCompositeList } from './useCompositeList';

const elementsRef = shallowRef<Array<HTMLElement | null>>([]);

useCompositeList({ elementsRef });
</script>

<template>
  <div :data-elements="elementsRef.map((element) => element?.dataset.testid).join(',')">
    <CompositeListItemPart data-testid="a" />
    <CompositeListItemPart data-testid="b" />
  </div>
</template>
