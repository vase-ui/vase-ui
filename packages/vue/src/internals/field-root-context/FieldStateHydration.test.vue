<script setup lang="ts">
import FieldControlPart from '../../../test/fixtures/FieldControlPart.vue';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import FieldStatePart from '../../../test/fixtures/FieldStatePart.vue';

defineProps<{
  value?: string | undefined;
  invalid?: boolean | undefined;
}>();
</script>

<template>
  <FieldScope :invalid="invalid" data-testid="root">
    <FieldStatePart data-testid="before" />
    <FieldControlPart :value="value" data-testid="control" />
    <FieldStatePart data-testid="after" />
  </FieldScope>
</template>
