<script setup lang="ts">
import type { RegisterId } from './createIdRegistry';
import LabelPart from './LabelPart.test.vue';

// A label before or after a control. The compiled template mounts the new label before it unmounts
// the old one.
defineProps<{
  labelBeforeControl: boolean;
  labelId?: string | undefined;
  registerLabelId?: RegisterId | undefined;
}>();
</script>

<template>
  <LabelPart
    v-if="labelBeforeControl"
    :id="labelId"
    :register-label-id="registerLabelId"
    data-testid="label"
  >
    Label
  </LabelPart>
  <span role="checkbox" tabindex="0" aria-checked="false" data-testid="control" />
  <LabelPart
    v-if="!labelBeforeControl"
    :id="labelId"
    :register-label-id="registerLabelId"
    data-testid="label"
  >
    Label
  </LabelPart>
</template>
