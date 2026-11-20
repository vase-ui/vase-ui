<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Toast } from '../../src/toast';
import ToastAnchoredList from './ToastAnchoredList.vue';

type Props = Record<string, unknown>;

// An anchor button at the top left, and a list of anchored toasts in a portal.
defineProps({
  positioner: Object as PropType<Props>,
  group: Object as PropType<Props>,
});
const listPart = useTemplateRef('listPart');
defineExpose({
  get manager() {
    return listPart.value!.manager;
  },
});
</script>

<template>
  <button
    id="anchor"
    style="position: fixed; left: 200px; top: 200px; width: 100px; height: 40px"
  >
    Anchor
  </button>
  <Toast.Provider>
    <Toast.Portal>
      <ToastAnchoredList ref="listPart" :positioner="positioner" :group="group" />
    </Toast.Portal>
  </Toast.Provider>
</template>
