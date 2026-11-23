<script setup lang="ts">
import type { PropType } from 'vue';
import { Button } from '../../src/button';
import ExposedDiv from './ExposedDiv.vue';
import StyledButton from './StyledButton.vue';

defineProps({
  component: { type: String as PropType<'div' | 'button'>, required: true },
  attrs: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <Button :as="component === 'div' ? ExposedDiv : StyledButton" v-bind="attrs">Save</Button>
</template>
