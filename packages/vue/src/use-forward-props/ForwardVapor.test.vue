<script setup vapor lang="ts">
import { Collapsible } from '../collapsible';
import { useForwardProps } from './index';

const props = defineProps<{ open?: boolean | undefined; id?: string | undefined }>();
const forwarded = useForwardProps(props);
</script>

<template>
  <Collapsible.Root v-bind="forwarded">
    <Collapsible.Panel>Content</Collapsible.Panel>
  </Collapsible.Root>
</template>
