<script setup lang="ts">
import LabelableControl from '../../../test/fixtures/LabelableControl.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableMessage from '../../../test/fixtures/LabelableMessage.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';

defineProps<{
  order: 'label-message-control' | 'control-label-message' | 'control-only';
  controlId?: string | undefined;
  labelId?: string | undefined;
}>();
</script>

<template>
  <LabelableScope>
    <template v-if="order === 'label-message-control'">
      <LabelableLabel :id="labelId" data-testid="label">Label</LabelableLabel>
      <LabelableMessage data-testid="message">Message</LabelableMessage>
      <LabelableControl :id="controlId" data-testid="control" />
    </template>
    <template v-else-if="order === 'control-label-message'">
      <LabelableControl :id="controlId" data-testid="control" />
      <LabelableLabel :id="labelId" data-testid="label">Label</LabelableLabel>
      <LabelableMessage data-testid="message">Message</LabelableMessage>
    </template>
    <LabelableControl v-else :id="controlId" data-testid="control" />
  </LabelableScope>
</template>
