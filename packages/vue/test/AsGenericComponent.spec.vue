<!-- @strictTemplates true -->
<script setup lang="ts">
import { h } from 'vue';
import type { VNode } from 'vue';
import * as Menu from '../src/menu/parts';
import * as Select from '../src/select/index.parts';
import * as TimePicker from '../src/time-picker/index.parts';

// `Component` refuses this function, because its context has a required slot. A function type
// with only `props` refuses it too, because the context is a required parameter.
const ButtonWithRequiredSlot = (_props: object, context: { slots: { default: () => VNode[] } }) =>
  h('button', context.slots.default());
</script>

<template>
  <TimePicker.List :as="Select.Trigger" />
  <TimePicker.List :as="Menu.Trigger" />
  <TimePicker.List :as="ButtonWithRequiredSlot" />
</template>
