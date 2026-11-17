<script setup lang="ts">
import { Collapsible } from '../index';

withDefaults(defineProps<{ defaultOpen?: boolean; shown?: boolean; inTransition?: boolean }>(), {
  defaultOpen: undefined,
  shown: true,
});
</script>

<template>
  <Collapsible.Root :default-open="defaultOpen">
    <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
    <Transition v-if="inTransition">
      <Collapsible.Panel class="panel" data-testid="panel">Panel content</Collapsible.Panel>
    </Transition>
    <Collapsible.Panel v-else v-show="shown" class="panel" data-testid="panel">
      Panel content
    </Collapsible.Panel>
  </Collapsible.Root>
</template>

<style scoped>
.panel {
  outline-style: dashed;
}
</style>
