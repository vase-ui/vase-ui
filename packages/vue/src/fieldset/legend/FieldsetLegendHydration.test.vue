<script setup lang="ts">
import { Fieldset } from '../index';

defineProps<{
  legendId?: string | undefined;
  ariaLabel?: string | undefined;
}>();
</script>

<template>
  <Fieldset.Root :aria-label="ariaLabel" data-testid="fieldset">
    <Fieldset.Legend :id="legendId" data-testid="legend">Legend</Fieldset.Legend>
  </Fieldset.Root>
</template>
