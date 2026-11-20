<script setup lang="ts">
import { Collapsible } from '@vase-ui/vue/collapsible';
</script>

<template>
  <Collapsible.Root>
    <Collapsible.Trigger>Recovery keys</Collapsible.Trigger>
    <Transition name="panel">
      <Collapsible.Panel class="Panel">alien-bean-pasta</Collapsible.Panel>
    </Transition>
  </Collapsible.Root>
</template>

<style>
.Panel {
  overflow: hidden;
  transition: height 150ms ease-out;
}
.panel-enter-from,
.panel-leave-to {
  height: 0;
}
.panel-enter-to,
.panel-leave-from {
  height: var(--collapsible-panel-height);
}
</style>
