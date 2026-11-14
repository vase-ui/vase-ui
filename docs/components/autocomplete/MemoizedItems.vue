<script setup lang="ts">
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import SuggestionItem from './SuggestionItem.vue';
import type { Suggestion } from './SuggestionItem.vue';

const suggestions: Suggestion[] = [
  { id: 'a', label: 'Apple', description: 'A round fruit' },
  { id: 'b', label: 'Banana', description: 'A long fruit' },
];
</script>

<template>
  <Autocomplete.Root :items="suggestions">
    <Autocomplete.Input />
    <Autocomplete.Portal>
      <Autocomplete.Positioner>
        <Autocomplete.Popup>
          <Autocomplete.List>
            <template #item="{ item }">
              <SuggestionItem :item="item" />
            </template>
          </Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
</template>
