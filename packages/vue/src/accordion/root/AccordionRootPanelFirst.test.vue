<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Accordion } from '../index';

defineProps<{
  triggerId?: string | undefined;
  laterRemovedAtMount?: boolean | undefined;
}>();

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
</script>

<template>
  <Accordion.Root :default-value="[0]">
    <Accordion.Item :value="0">
      <Accordion.Panel data-testid="panel">Panel contents 1</Accordion.Panel>
      <Accordion.Header v-if="!(laterRemovedAtMount && isMounted)">
        <Accordion.Trigger :id="triggerId">Trigger 1</Accordion.Trigger>
      </Accordion.Header>
    </Accordion.Item>
  </Accordion.Root>
</template>
