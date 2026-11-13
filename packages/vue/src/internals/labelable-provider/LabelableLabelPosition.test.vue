<script setup lang="ts">
import LabelableControl from '../../../test/fixtures/LabelableControl.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';

defineProps<{
  labelBeforeControl: boolean;
  labelId?: string | undefined;
  registerLabelId?: ((source: symbol, labelId: string | undefined) => void) | undefined;
}>();
</script>

<template>
  <LabelableLabel
    v-if="labelBeforeControl"
    :id="labelId"
    :register-label-id="registerLabelId"
    data-testid="label"
  >
    Label
  </LabelableLabel>
  <LabelableControl data-testid="control" />
  <LabelableLabel
    v-if="!labelBeforeControl"
    :id="labelId"
    :register-label-id="registerLabelId"
    data-testid="label"
  >
    Label
  </LabelableLabel>
</template>
