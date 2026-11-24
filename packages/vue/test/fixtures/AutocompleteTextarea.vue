<script setup lang="ts">
import type { PropType } from 'vue';
import { Autocomplete } from '../../src/autocomplete';

// An autocomplete in a form, whose input is a `<textarea>` in the `element` slot. `root` gives
// props to the root.
defineProps({ root: Object as PropType<Record<string, unknown>> });
const TAGS = ['feature', 'fix', 'docs'];
</script>

<template>
  <form data-testid="form">
    <Autocomplete.Root :items="TAGS" v-bind="root">
      <Autocomplete.Input>
        <template #element="{ props, elementRef }">
          <textarea v-bind="props" :ref="elementRef" aria-label="Tag" />
        </template>
      </Autocomplete.Input>
      <Autocomplete.Portal>
        <Autocomplete.Positioner>
          <Autocomplete.Popup>
            <Autocomplete.List>
              <template #item="{ item }">
                <Autocomplete.Item :value="item">{{ item }}</Autocomplete.Item>
              </template>
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  </form>
</template>
