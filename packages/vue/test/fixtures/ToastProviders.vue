<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Toast } from '../../src/toast';
import ToastProviderProbe from './ToastProviderProbe.vue';

type Props = Record<string, unknown>;

// `count` providers with no viewport and no part. The probe of the first provider exposes its
// internal object, and adds a toast with the id `added-<n>` at each change of `addKey`.
defineProps({
  count: { type: Number, default: 1 },
  provider: Object as PropType<Props>,
  addKey: { type: Number, default: 0 },
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
    <ToastProviderProbe ref="probes" :add-key="addKey" />
  </Toast.Provider>
</template>
