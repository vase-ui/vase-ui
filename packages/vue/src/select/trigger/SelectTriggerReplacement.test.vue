<script setup lang="ts">
import * as Select from '../index.parts';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { SelectStore } from '../store';

const props = defineProps<{ first: boolean; onStore: (store: SelectStore) => void }>();

function StoreProbe() {
  props.onStore(useSelectRootContext());
  return null;
}
</script>

<template>
  <Select.Root>
    <StoreProbe />
    <Select.Trigger v-if="!first" data-testid="second" />
    <Select.Trigger v-if="first" data-testid="first" />
  </Select.Root>
</template>
