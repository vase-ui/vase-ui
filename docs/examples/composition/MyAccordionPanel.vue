<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';
import type { AccordionPanelProps } from '@vase-ui/vue/accordion';
import { useForwardProps } from '@vase-ui/vue/use-forward-props';

// Vue cannot compile the native attribute types, so the other props pass through $attrs.
interface Props extends /* @vue-ignore */ AccordionPanelProps {
  keepMounted?: boolean | undefined;
  hiddenUntilFound?: boolean | undefined;
}

const props = defineProps<Props>();
const forwarded = useForwardProps(props);
</script>

<template>
  <Accordion.Panel v-bind="forwarded"><slot /></Accordion.Panel>
</template>
