<!-- @strictTemplates true -->
<script setup lang="ts">
import { h } from 'vue';
import type { VNode } from 'vue';
import * as Menu from '../src/menu/index.parts';
import * as Select from '../src/select/index.parts';
import { ToggleGroup } from '../src/toggle-group';
import * as Toolbar from '../src/toolbar/index.parts';

// `Component` refuses this function, because its context has a required slot. A function type
// with only `props` refuses it too, because the context is a required parameter.
const ButtonWithRequiredSlot = (_props: object, context: { slots: { default: () => VNode[] } }) =>
  h('button', context.slots.default());
</script>

<template>
  <Toolbar.Button :as="Select.Trigger" />
  <Toolbar.Button :as="Menu.Trigger" />
  <Toolbar.Group :as="ToggleGroup" />
  <Toolbar.Button :as="ButtonWithRequiredSlot" />
</template>
