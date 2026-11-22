<script setup lang="ts">
import { computed, useTemplateRef, type PropType } from 'vue';
import { Toast } from '../../src/toast';
import ToastPartsList from './ToastPartsList.vue';

type Props = Record<string, unknown>;

// A text input and two providers. Each provider renders a `ToastPartsList` in place, with no
// portal. `first` and `second` give the props of each list. The viewports have the test ids
// `first-viewport` and `second-viewport`.
const props = defineProps({
  first: { type: Object as PropType<Props>, default: () => ({}) },
  second: { type: Object as PropType<Props>, default: () => ({}) },
});
const firstViewport = computed(() => ({
  'data-testid': 'first-viewport',
  ...(props.first.viewport as Props | undefined),
}));
const secondViewport = computed(() => ({
  'data-testid': 'second-viewport',
  ...(props.second.viewport as Props | undefined),
}));
const firstList = useTemplateRef('firstList');
const secondList = useTemplateRef('secondList');
defineExpose({
  get first() {
    return firstList.value!.manager;
  },
  get second() {
    return secondList.value!.manager;
  },
});
</script>

<template>
  <input id="toast-before" aria-label="Before" />
  <Toast.Provider>
    <ToastPartsList ref="firstList" v-bind="first" :viewport="firstViewport" />
  </Toast.Provider>
  <Toast.Provider>
    <ToastPartsList ref="secondList" v-bind="second" :viewport="secondViewport" />
  </Toast.Provider>
</template>
