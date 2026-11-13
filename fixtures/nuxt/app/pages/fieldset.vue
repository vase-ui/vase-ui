<script setup lang="ts">
import { Fieldset } from '@vase-ui/vue/fieldset';
</script>

<template>
  <main>
    <Fieldset.Root data-testid="fieldset">
      <Fieldset.Legend data-testid="legend">Address</Fieldset.Legend>
    </Fieldset.Root>
    <Fieldset.Root data-testid="named-fieldset" aria-label="Billing" />
  </main>
</template>
