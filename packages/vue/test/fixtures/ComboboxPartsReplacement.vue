<script setup lang="ts">
import * as Combobox from '../../src/combobox/index.parts';
import { useComboboxRootContext } from '../../src/combobox/root/ComboboxRootContext';
import type { ComboboxStore } from '../../src/combobox/store';

// The group that comes first in the template mounts before the other group unmounts. Each group
// has an input and a clear button.
const props = defineProps<{ first: boolean; onStore: (store: ComboboxStore) => void }>();

function StoreProbe() {
  props.onStore(useComboboxRootContext());
  return null;
}
</script>

<template>
  <Combobox.Root open default-value="a">
    <StoreProbe />
    <Combobox.InputGroup v-if="!first" data-testid="second-group">
      <Combobox.Input data-testid="second-input" />
      <Combobox.Clear data-testid="second-clear" />
    </Combobox.InputGroup>
    <Combobox.InputGroup v-if="first" data-testid="first-group">
      <Combobox.Input data-testid="first-input" />
      <Combobox.Clear data-testid="first-clear" />
    </Combobox.InputGroup>
  </Combobox.Root>
</template>
