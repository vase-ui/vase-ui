<script setup lang="ts">
import { Collapsible } from '../collapsible';
import type { CollapsibleRootChangeEventDetails } from '../collapsible';
import { useForwardPropsEmits } from './index';

const props = defineProps<{ open?: boolean | undefined }>();
const emit = defineEmits<{
  openChange: [open: boolean, details: CollapsibleRootChangeEventDetails];
  'update:open': [open: boolean];
}>();
const forwarded = useForwardPropsEmits(props, emit);
defineExpose({ forwarded });
</script>

<template>
  <Collapsible.Root v-bind="forwarded">
    <Collapsible.Trigger>Toggle</Collapsible.Trigger>
    <Collapsible.Panel>Content</Collapsible.Panel>
  </Collapsible.Root>
</template>
