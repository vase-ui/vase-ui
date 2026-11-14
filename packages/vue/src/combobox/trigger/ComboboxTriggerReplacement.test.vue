<script setup lang="ts">
import * as Combobox from '../index.parts';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';

const props = defineProps<{ first: boolean; onStore: (store: ComboboxStore) => void }>();

function StoreProbe() {
  props.onStore(useComboboxRootContext());
  return null;
}
</script>

<template>
  <Combobox.Root>
    <StoreProbe />
    <Combobox.Trigger v-if="!first" data-testid="second" />
    <Combobox.Trigger v-if="first" data-testid="first" />
  </Combobox.Root>
</template>
