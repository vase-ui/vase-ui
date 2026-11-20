<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Toast } from '../../src/toast';
import ToastProviderProbe from './ToastProviderProbe.vue';

type Props = Record<string, unknown>;

// `count` providers with no viewport and no part. The probe of the first provider exposes its
// internal object. Each probe adds a toast with the id `added-<n>` at each change of `add.key`.
defineProps({
  count: { type: Number, default: 1 },
  provider: Object as PropType<Props>,
  add: { type: Object as PropType<{ key: number }>, default: () => ({ key: 0 }) },
});
const probes = useTemplateRef<InstanceType<typeof ToastProviderProbe>[]>('probes');
defineExpose({
  get provider() {
    return probes.value![0]!.provider;
  },
});
</script>

<template>
  <Toast.Provider v-for="index in count" :key="index" v-bind="provider">
    <ToastProviderProbe ref="probes" :add-key="add.key" />
  </Toast.Provider>
</template>
