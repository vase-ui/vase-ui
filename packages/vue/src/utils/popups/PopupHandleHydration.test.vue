<script setup lang="ts">
import { createPopupHandleFixture } from '../../../test/fixtures/PopupHandleFixture';
import type { PopupHandleFixture } from '../../../test/fixtures/PopupHandleFixture';
import PopupHandleRootPart from '../../../test/fixtures/PopupHandleRootPart.vue';
import PopupHandleTriggerPart from '../../../test/fixtures/PopupHandleTriggerPart.vue';

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
