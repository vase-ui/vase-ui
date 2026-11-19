<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';

const navigation = useTemplateRef('navigation');

function toggleNavigation() {
  if (navigation.value?.isCollapsed()) navigation.value.expand();
  else navigation.value?.collapse();
}

// In a controlled root, the second method waits for the layout that the first one gave.
async function narrowThenCollapse() {
  navigation.value?.resize('10rem');
  await nextTick();
  navigation.value?.collapse();
}
</script>

<template>
  <button type="button" @click="toggleNavigation">Toggle the navigation</button>
  <button type="button" @click="narrowThenCollapse">Narrow, then collapse</button>
  <Resizable.Root>
    <Resizable.Panel id="navigation" ref="navigation" collapsible :min-size="15" />
    <Resizable.Handle aria-label="Resize the navigation" />
    <Resizable.Panel id="editor" />
  </Resizable.Root>
</template>
