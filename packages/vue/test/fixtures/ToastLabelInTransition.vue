<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Toast } from '../../src/toast';
import ToastLabelInTransitionList from './ToastLabelInTransitionList.vue';

// The description of each toast is in a `<Transition>` of 200 ms.
const listPart = useTemplateRef('listPart');
defineExpose({
  get manager() {
    return listPart.value!.manager;
  },
});
</script>

<template>
  <Toast.Provider>
    <ToastLabelInTransitionList ref="listPart" />
  </Toast.Provider>
</template>

<style>
.description-enter-active,
.description-leave-active {
  transition: opacity 200ms linear;
}
.description-enter-from,
.description-leave-to {
  opacity: 0;
}
</style>
