<script setup lang="ts">
import type { PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';
import FieldsetButtons from './FieldsetButtons.vue';

defineProps({
  scene: {
    type: Object as PropType<{
      kind: 'fieldset' | 'root' | 'div';
      disabled: boolean;
      ownDisabled: boolean;
      click?: () => void;
    }>,
    required: true,
  },
});
</script>

<template>
  <fieldset v-if="scene.kind === 'fieldset'" :disabled="scene.disabled">
    <FieldsetButtons :scene="scene" />
  </fieldset>
  <Fieldset.Root v-else-if="scene.kind === 'root'" :disabled="scene.disabled">
    <FieldsetButtons :scene="scene" />
  </Fieldset.Root>
  <Fieldset.Root v-else :disabled="scene.disabled">
    <template #element="{ props, elementRef }">
      <div v-bind="props" :ref="elementRef"><FieldsetButtons :scene="scene" /></div>
    </template>
  </Fieldset.Root>
</template>
