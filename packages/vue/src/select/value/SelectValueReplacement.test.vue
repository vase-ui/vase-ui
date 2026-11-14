<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';
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
    <Select.Value v-if="!first" data-testid="second" />
    <Select.Value v-if="first" data-testid="first" />
  </Select.Root>
</template>
