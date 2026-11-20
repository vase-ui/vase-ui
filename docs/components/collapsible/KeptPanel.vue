<script setup lang="ts">
import { Collapsible } from '@vase-ui/vue/collapsible';
</script>

<template>
  <Collapsible.Root>
    <Collapsible.Trigger>Recovery keys</Collapsible.Trigger>
    <Collapsible.Panel class="Panel" keep-mounted>
      <div>alien-bean-pasta</div>
    </Collapsible.Panel>
  </Collapsible.Root>
</template>

<style>
.Panel:not([hidden='until-found']) {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 150ms;
}
.Panel[hidden]:not([hidden='until-found']) {
  grid-template-rows: 0fr;
}
.Panel > * {
  min-height: 0;
  overflow: hidden;
}
</style>
