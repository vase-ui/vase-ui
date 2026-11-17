<script setup vapor lang="ts">
import { Collapsible } from '@vase-ui/vue/collapsible';

defineProps<{ open?: boolean | undefined }>();
</script>

<template>
  <Collapsible.Root :open="open">
    <Collapsible.Panel>Content</Collapsible.Panel>
  </Collapsible.Root>
</template>
