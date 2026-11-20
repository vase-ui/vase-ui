<script setup lang="ts">
import type { PropType } from 'vue';
import { Button } from '../../src/button';
import { Fieldset } from '../../src/fieldset';

defineProps({
  scene: {
    type: Object as PropType<{ ownDisabled: boolean; click?: () => void }>,
    required: true,
  },
});
</script>

<template>
  <Fieldset.Legend>
    <Button v-slot="{ state }" class="InLegend">Legend {{ state.disabled }}</Button>
  </Fieldset.Legend>
  <Button v-slot="{ state }" class="Native" :disabled="scene.ownDisabled">
    Native {{ state.disabled }}
  </Button>
  <Button v-slot="{ state }" class="Focusable" focusable-when-disabled>
    Focusable {{ state.disabled }}
  </Button>
  <Button @click="scene.click?.()">
    <template #element="{ props, elementRef, state }">
      <span v-bind="props" :ref="elementRef" class="Custom">Custom {{ state.disabled }}</span>
    </template>
  </Button>
</template>
