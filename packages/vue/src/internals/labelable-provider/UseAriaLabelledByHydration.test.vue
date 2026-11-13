<script setup lang="ts">
import HiddenInputControl from '../../../test/fixtures/HiddenInputControl.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';

defineProps<{
  label: 'native' | 'provider';
  ariaLabel?: string | undefined;
}>();
</script>

<template>
  <label v-if="label === 'native'" data-testid="label">
    <HiddenInputControl :aria-label="ariaLabel" data-testid="control" />
  </label>
  <LabelableScope v-else>
    <LabelableLabel data-testid="label">Label</LabelableLabel>
    <HiddenInputControl :aria-label="ariaLabel" data-testid="control" />
  </LabelableScope>
</template>
