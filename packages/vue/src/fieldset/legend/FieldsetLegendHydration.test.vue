<script setup lang="ts">
import { Fieldset } from '../index';

defineProps<{
  legendId?: string | undefined;
}>();
</script>

<template>
  <Fieldset.Root data-testid="fieldset">
    <Fieldset.Legend :id="legendId" data-testid="legend">Legend</Fieldset.Legend>
  </Fieldset.Root>
</template>
