<script setup lang="ts">
import { defineComponent, getCurrentInstance, h, onMounted, shallowRef } from 'vue';
import { useVaseUiId } from '../../src/internals/useBaseUiId';

defineProps<{
  // After a hydration, the region names the id of the first heading.
  staleLabel?: boolean;
}>();

let firstId: string | undefined;

// A heading and the region that it names. Each mount gives the heading a new id.
const LabelledRegion = defineComponent(
  (regionProps: { labelledBy?: string | undefined }) => {
    const id = useVaseUiId();
    firstId ??= id.value;
    return () => [
      h('h2', { id: id.value }, 'Region'),
      h('section', { 'aria-labelledby': regionProps.labelledBy ?? id.value }, 'Content'),
    ];
  },
  { props: ['labelledBy'] },
);

// Vue sets `vnode.el` before `setup` only when it hydrates the component. After a hydration, the
// fixture mounts the region again, as a calendar does with a page whose first day changes.
const hydrates = getCurrentInstance()?.vnode.el != null;
const key = shallowRef(0);
onMounted(() => {
  if (hydrates) {
    key.value += 1;
  }
});
</script>

<template>
  <LabelledRegion :key="key" :labelled-by="staleLabel && key > 0 ? firstId : undefined" />
</template>
