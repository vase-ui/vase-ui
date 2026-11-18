<script setup vapor lang="ts">
import type { Component } from 'vue';
import * as Menu from '../../menu/index.parts';

const props = defineProps<{
  /** The text of the content of the item, when `content` is not given. */
  text: string;
  /** A component that renders the text of the item. */
  content?: Component | undefined;
  /** The `label` prop of the item. */
  itemLabel?: string | undefined;
  /** Gets each element that the content of the item mounts. */
  onContent: (element: Element) => void;
}>();

function recordContent(element: unknown) {
  if (element) {
    props.onContent(element as Element);
  }
}
</script>

<template>
  <Menu.Item :label="itemLabel">
    <span :ref="recordContent">
      <component :is="content" v-if="content" />
      <template v-else>{{ text }}</template>
    </span>
  </Menu.Item>
</template>
