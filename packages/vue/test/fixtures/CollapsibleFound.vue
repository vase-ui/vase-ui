<script setup lang="ts">
import { Collapsible } from '../../src/collapsible';

// A closed panel with `hiddenUntilFound` and the CSS of the docs, far below the top of the page.
// The text "Needle" is far below the top of the panel.
defineProps({ root: Object });
</script>

<template>
  <div style="height: 1500px">Before</div>
  <Collapsible.Root v-bind="root">
    <Collapsible.Trigger>Trigger</Collapsible.Trigger>
    <Collapsible.Panel class="FoundPanel" hidden-until-found>
      <div>
        <div style="height: 300px">Top</div>
        <p id="found-target">Needle</p>
        <div style="height: 100px">End</div>
      </div>
    </Collapsible.Panel>
  </Collapsible.Root>
  <div style="height: 1500px">After</div>
</template>

<style>
.FoundPanel:not([hidden='until-found']) {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 150ms;
}
.FoundPanel[hidden]:not([hidden='until-found']) {
  grid-template-rows: 0fr;
}
.FoundPanel > * {
  min-height: 0;
  overflow: hidden;
}
</style>
