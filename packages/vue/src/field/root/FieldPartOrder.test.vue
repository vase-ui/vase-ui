<script setup lang="ts">
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableMessage from '../../../test/fixtures/LabelableMessage.vue';
import { Field } from '../index';

type Part = 'label' | 'control' | 'description' | 'error';

defineProps<{
  parts: Part[];
  labelId?: string | undefined;
}>();
</script>

<template>
  <Field.Root>
    <template v-for="part in parts" :key="part">
      <LabelableLabel v-if="part === 'label'" :id="labelId" :native="false" data-testid="label">
        Label
      </LabelableLabel>
      <Field.Control v-else-if="part === 'control'" data-testid="control" />
      <LabelableMessage v-else-if="part === 'description'" data-testid="description">
        Description
      </LabelableMessage>
      <Field.Error v-else-if="part === 'error'" match data-testid="error">Error</Field.Error>
    </template>
  </Field.Root>
</template>
