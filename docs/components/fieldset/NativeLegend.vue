<script setup lang="ts">
import { Fieldset } from '@vase-ui/vue/fieldset';
</script>

<template>
  <Fieldset.Root>
    <Fieldset.Legend>
      <template #element="{ props, elementRef }">
        <legend v-bind="props" :ref="elementRef">Billing details</legend>
      </template>
    </Fieldset.Legend>
  </Fieldset.Root>
</template>
