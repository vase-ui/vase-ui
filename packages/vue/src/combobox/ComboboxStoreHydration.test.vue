<script setup lang="ts">
import { Autocomplete } from '@vase-ui/vue/autocomplete';
</script>

<template>
  <Autocomplete.Root :items="['alpha', 'beta']" name="search">
    <Autocomplete.Input data-testid="input" />
    <Autocomplete.Portal>
      <Autocomplete.Positioner />
    </Autocomplete.Portal>
  </Autocomplete.Root>
</template>
