<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Toast } from '../../src/toast';
import ToastPartsList from './ToastPartsList.vue';

type Props = Record<string, unknown>;

// A provider with text inputs before and after it. The list renders each toast with its parts, in a
// viewport in a portal, or in place with `inPlace`.
defineProps({
  provider: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  inPlace: Boolean,
  list: Object as PropType<Props>,
});
const listPart = useTemplateRef('listPart');
defineExpose({
  get manager() {
    return listPart.value!.manager;
  },
});
</script>

<template>
  <input id="toast-before" aria-label="Before" />
  <Toast.Provider v-bind="provider">
    <Toast.Portal v-if="!inPlace" v-bind="portal">
      <ToastPartsList ref="listPart" v-bind="list" />
    </Toast.Portal>
    <ToastPartsList v-else ref="listPart" v-bind="list" />
  </Toast.Provider>
  <input id="toast-after" aria-label="After" />
</template>
