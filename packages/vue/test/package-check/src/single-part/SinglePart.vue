<script lang="ts">
export interface SinglePartProps {
  orientation?: 'horizontal' | 'vertical' | undefined;
}

export interface SinglePartState {
  orientation: 'horizontal' | 'vertical';
}
</script>

<script setup lang="ts">
import { markPart } from '../internals/part-marker';

const props = withDefaults(defineProps<SinglePartProps>(), {
  orientation: 'horizontal',
});

markPart();
</script>

<template>
  <div data-single-part :data-orientation="props.orientation"><slot /></div>
</template>
