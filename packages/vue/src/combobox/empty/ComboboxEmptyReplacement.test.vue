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
  <Combobox.Root inline>
    <StoreProbe />
    <Combobox.Empty v-if="!first" data-testid="second" />
    <Combobox.Empty v-if="first" data-testid="first" />
  </Combobox.Root>
</template>
