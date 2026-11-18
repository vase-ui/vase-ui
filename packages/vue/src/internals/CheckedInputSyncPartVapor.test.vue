<script setup vapor lang="ts">
import { onMounted, shallowRef } from 'vue';
import { useCheckedInputSync } from './useCheckedInputSync';

const props = defineProps<{
  checked: boolean;
  indeterminate?: boolean;
  take?: () => void;
  report?: (sync: { write: () => void }) => void;
}>();

const input = shallowRef<HTMLInputElement | null>(null);
const sync = useCheckedInputSync(input, () => props.checked, {
  indeterminate: () => props.indeterminate,
  take: props.take,
});
onMounted(() => props.report?.(sync));

function setInput(element: unknown) {
  input.value = element as HTMLInputElement | null;
}
</script>

<template>
  <input type="checkbox" :ref="setInput" />
</template>
