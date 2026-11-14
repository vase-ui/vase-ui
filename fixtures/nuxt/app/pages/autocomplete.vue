<script setup lang="ts">
import { Autocomplete } from '@vase-ui/vue/autocomplete';

// In `en-US`, "ö" is a variant of "o". In `sv`, it is another letter. The filter of the root uses
// `en-US` on the server, and the locale of the visitor after the mount.
const CITIES = ['Malmö', 'Malta', 'Oslo'];
</script>

<template>
  <main>
    <form data-testid="form">
      <Autocomplete.Root inline open name="city" default-value="malmo" :items="CITIES">
        <Autocomplete.Input data-testid="input" />
        <Autocomplete.List data-testid="list">
          <template #item="{ item }">
            <Autocomplete.Item :value="item">{{ item }}</Autocomplete.Item>
          </template>
        </Autocomplete.List>
      </Autocomplete.Root>
    </form>
  </main>
</template>
