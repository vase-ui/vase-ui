<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Toast } from '../../src/toast';
import ToastLabelSlotsList from './ToastLabelSlotsList.vue';

/**
 * What an `element` slot renders: the label of the toast, a text of the developer, or no element.
 * The slot of the title can also render a component of the developer that shows `heading.text`.
 */
export type LabelSlot = 'label' | 'text' | 'none' | 'component';

// Toasts whose title, description and action render in their `element` slots. `slots` gives what
// the slots of the title and of the description render.
defineProps({
  slots: {
    type: Object as PropType<{ title: LabelSlot; description: LabelSlot }>,
    required: true,
  },
  heading: { type: Object as PropType<{ text: string }>, required: true },
});
const list = useTemplateRef('list');
defineExpose({
  get manager() {
    return list.value!.manager;
  },
});
</script>

<template>
  <Toast.Provider>
    <ToastLabelSlotsList ref="list" v-bind="slots" :heading="heading" />
  </Toast.Provider>
</template>
