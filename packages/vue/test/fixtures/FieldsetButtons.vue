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
    <template #element="{ props, elementRef }">
      <legend v-bind="props" :ref="elementRef">
        <Button v-slot="{ state }" class="InNativeLegend">
          Native legend {{ state.disabled }}
        </Button>
      </legend>
    </template>
  </Fieldset.Legend>
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
  <Button>
    <template #element="{ props, elementRef, state }">
      <button v-bind="props" :ref="elementRef" class="SlotButton">
        Slot button {{ state.disabled }}
      </button>
    </template>
  </Button>
</template>
