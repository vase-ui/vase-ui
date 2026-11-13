<script setup lang="ts">
import { createPopupHandleFixture } from './PopupHandleFixture';
import type { PopupHandleFixture } from './PopupHandleFixture';
import PopupHandleRootPart from './PopupHandleRootPart.vue';
import PopupHandleTriggerPart from './PopupHandleTriggerPart.vue';

const props = defineProps<{
  handle?: PopupHandleFixture | undefined;
  defaultOpen?: boolean | undefined;
  defaultTriggerId?: string | undefined;
}>();

// A render with no `handle` prop makes its own handle, as an app does in `setup`.
const handle = props.handle ?? createPopupHandleFixture();
</script>

<template>
  <PopupHandleTriggerPart id="before" :handle="handle">before</PopupHandleTriggerPart>
  <PopupHandleRootPart
    :handle="handle"
    :default-open="defaultOpen"
    :default-trigger-id="defaultTriggerId"
  >
    <PopupHandleTriggerPart id="inside">inside</PopupHandleTriggerPart>
  </PopupHandleRootPart>
  <PopupHandleTriggerPart id="after" :handle="handle">after</PopupHandleTriggerPart>
</template>
