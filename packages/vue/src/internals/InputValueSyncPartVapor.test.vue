<script setup vapor lang="ts">
import { onMounted, shallowRef } from 'vue';
import { useHiddenValueBeforeHydration } from '../common/hydration';
import { useHiddenInputValueSync, useInputValueSync } from './useInputValueSync';
import type { InputValueSync } from './useInputValueSync';

const props = defineProps<{
  value?: string;
  hidden?: boolean;
  report?: (sync: InputValueSync) => void;
  check?: (changed: boolean, event: Event) => void;
}>();

const input = shallowRef<HTMLInputElement | null>(null);
const writes = useHiddenValueBeforeHydration(() => input.value);
const sync = props.hidden
  ? useHiddenInputValueSync(input, () => props.value ?? '', writes)
  : useInputValueSync(
      () => input.value,
      () => props.value,
    );
onMounted(() => props.report?.(sync));

function setInput(element: unknown) {
  input.value = element as HTMLInputElement | null;
}

function checkEvent(event: Event) {
  props.check?.(sync.isNew(event), event);
}
</script>

<template>
  <input
    v-bind="hidden && writes ? { value } : {}"
    :ref="setInput"
    @input="checkEvent"
    @change="checkEvent"
  />
</template>
