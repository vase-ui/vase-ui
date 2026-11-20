<script setup lang="ts">
import type { PropType } from 'vue';
import { Autocomplete } from '../../src/autocomplete';

type Props = Record<string, unknown>;

// An autocomplete of tags in a native form. With `inputInPopup`, a trigger opens the popup, and the
// input is in it.
defineProps({
  root: Object as PropType<Props>,
  inputInPopup: Boolean,
  onSubmit: Function as PropType<(event: Event) => void>,
});
const TAGS = ['feature', 'fix', 'docs', 'chore'];
</script>

<template>
  <form data-testid="form" @submit="onSubmit?.($event)">
    <Autocomplete.Root :items="TAGS" v-bind="root">
      <template v-if="inputInPopup">
        <Autocomplete.Trigger data-testid="trigger">
          <Autocomplete.Value />
        </Autocomplete.Trigger>
      </template>
      <Autocomplete.Input v-else data-testid="input" />
      <Autocomplete.Portal>
        <Autocomplete.Positioner>
          <Autocomplete.Popup data-testid="popup">
            <Autocomplete.Input v-if="inputInPopup" data-testid="input" />
            <Autocomplete.List>
              <template #item="{ item }">
                <Autocomplete.Item :value="item" :data-testid="`item-${item}`">
                  {{ item }}
                </Autocomplete.Item>
              </template>
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  </form>
</template>
