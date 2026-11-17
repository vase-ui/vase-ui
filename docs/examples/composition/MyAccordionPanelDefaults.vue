<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';
import type { AccordionPanelProps } from '@vase-ui/vue/accordion';

// Vue cannot compile the native attribute types, so the other props pass through $attrs.
interface Props extends /* @vue-ignore */ AccordionPanelProps {
  keepMounted?: boolean | undefined;
  hiddenUntilFound?: boolean | undefined;
}

const props = withDefaults(defineProps<Props>(), {
  keepMounted: undefined,
  hiddenUntilFound: undefined,
});
</script>

<template>
  <Accordion.Panel v-bind="props"><slot /></Accordion.Panel>
</template>
