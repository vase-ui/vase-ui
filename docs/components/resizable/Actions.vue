<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import ResetLayoutButton from './ResetLayoutButton.vue';

const root = useTemplateRef('root');
const navigation = useTemplateRef('navigation');

function toggleNavigation() {
  if (navigation.value?.isCollapsed()) {
    navigation.value.expand();
  } else {
    navigation.value?.collapse();
  }
}
</script>

<template>
  <button type="button" @click="toggleNavigation">Toggle the navigation</button>
  <button type="button" @click="root?.setLayout({ navigation: 20, editor: 80 })">
    Narrow the navigation
  </button>
  <Resizable.Root ref="root">
    <Resizable.Panel id="navigation" ref="navigation" collapsible :min-size="15" />
    <Resizable.Handle
      aria-label="Resize the navigation"
      @dblclick="
        (event) => {
          event.preventVaseUIHandler();
          navigation?.resize('100%');
        }
      "
    />
    <Resizable.Panel id="editor">
      <ResetLayoutButton />
    </Resizable.Panel>
  </Resizable.Root>
</template>
