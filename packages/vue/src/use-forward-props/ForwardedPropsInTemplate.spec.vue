<!-- @strictTemplates true -->
<script setup lang="ts">
import { Accordion } from '../accordion';
import { Collapsible } from '../collapsible';
import type { CollapsibleRootChangeEventDetails } from '../collapsible';
import { useForwardProps, useForwardPropsEmits } from './index';

const props = defineProps<{ open?: boolean | undefined; keepMounted?: boolean | undefined }>();
const emit = defineEmits<{
  openChange: [open: boolean, details: CollapsibleRootChangeEventDetails];
  'update:open': [open: boolean];
}>();
const forwarded = useForwardProps(props);
const forwardedWithEmits = useForwardPropsEmits(props, emit);
</script>

<template>
  <Accordion.Panel v-bind="forwarded" />
  <Collapsible.Root v-bind="forwardedWithEmits" />
</template>
