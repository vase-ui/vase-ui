<!-- @strictTemplates true -->
<script setup lang="ts">
import { h } from 'vue';
import type { VNode } from 'vue';
import * as Menu from '../src/menu/parts';
import { RadioGroup } from '../src/radio-group';
import * as Tabs from '../src/tabs/parts';
import { ToggleGroup } from '../src/toggle-group';
import * as Toolbar from '../src/toolbar/parts';
import GenericWithRequiredSlot from './fixtures/GenericWithRequiredSlot.vue';

// `Component` refuses this function, because its context has a required slot. A function type
// with only `props` refuses it too, because the context is a required parameter.
const ButtonWithRequiredSlot = (_props: object, context: { slots: { default: () => VNode[] } }) =>
  h('button', context.slots.default());
</script>

<!-- vue-tsc types a generic SFC as a function. `as` takes it, also with a required slot, also on a generic part. -->
<template>
  <Toolbar.Button :as="Menu.Trigger" />
  <Toolbar.Group :as="ToggleGroup" />
  <Toolbar.Group :as="RadioGroup" />
  <Toolbar.Button :as="GenericWithRequiredSlot" />
  <Tabs.Tab value="a" :as="GenericWithRequiredSlot" />
  <Tabs.Tab value="b" :as="ButtonWithRequiredSlot" />
</template>
