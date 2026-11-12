<script setup lang="ts">
import LabelableControl from '../../../test/fixtures/LabelableControl.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';

defineProps<{
  labelBeforeControl: boolean;
}>();
</script>

<template>
  <LabelableScope>
    <LabelableLabel v-if="labelBeforeControl" data-testid="label">Label</LabelableLabel>
    <LabelableControl data-testid="control" />
    <LabelableLabel v-if="!labelBeforeControl" data-testid="label">Label</LabelableLabel>
  </LabelableScope>
</template>
