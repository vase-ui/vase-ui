<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { PreviewCard } from '../../src/preview-card';

// Two links outside the root, with a handle, and one link in the root. The root comes before the
// links outside it. With `noRoot`, no root has the handle; `noFirst` removes the first link.
const props = defineProps({
  handle: { type: Object as PropType<InstanceType<typeof PreviewCard.Handle>>, required: true },
  root: Object as PropType<Record<string, unknown>>,
  trigger: Object as PropType<Record<string, unknown>>,
  noRoot: Boolean,
  noFirst: Boolean,
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart, handle: props.handle });
</script>

<template>
  <PreviewCard.Root v-if="!noRoot" ref="rootPart" :handle v-bind="root">
    <template #default="{ payload }">
      <PreviewCard.Trigger id="inside" href="#inside" payload="inside" v-bind="trigger">
        Inside
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner>
          <PreviewCard.Popup data-testid="popup">{{ payload ?? 'none' }}</PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </template>
  </PreviewCard.Root>
  <p>
    <PreviewCard.Trigger
      v-if="!noFirst"
      id="first"
      href="#first"
      :handle
      payload="first"
      v-bind="trigger"
    >
      First
    </PreviewCard.Trigger>
    <PreviewCard.Trigger id="second" href="#second" :handle payload="second" v-bind="trigger">
      Second
    </PreviewCard.Trigger>
  </p>
</template>
