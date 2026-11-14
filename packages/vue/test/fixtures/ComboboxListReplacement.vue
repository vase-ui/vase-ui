<script setup lang="ts">
import * as Combobox from '../../src/combobox/index.parts';
import { useComboboxRootContext } from '../../src/combobox/root/ComboboxRootContext';
import type { ComboboxStore } from '../../src/combobox/store';

// The list that comes first in the template mounts before the other list unmounts.
const props = defineProps<{ first: boolean; onStore: (store: ComboboxStore) => void }>();

function StoreProbe() {
  props.onStore(useComboboxRootContext());
  return null;
}
</script>

<template>
  <Combobox.Root inline>
    <StoreProbe />
    <Combobox.Input />
    <Combobox.List v-if="!first" data-testid="second-list" />
    <Combobox.List v-if="first" data-testid="first-list" />
  </Combobox.Root>
</template>
