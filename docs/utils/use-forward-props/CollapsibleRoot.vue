<script setup lang="ts">
import { Collapsible } from '@vase-ui/vue/collapsible';
import type {
  CollapsibleRootChangeEventDetails,
  CollapsibleRootProps,
} from '@vase-ui/vue/collapsible';
import { useForwardPropsEmits } from '@vase-ui/vue/use-forward-props';

// Vue cannot compile the native attribute types, so the other props pass through $attrs.
interface Props extends /* @vue-ignore */ CollapsibleRootProps {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  disabled?: boolean | undefined;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  openChange: [open: boolean, details: CollapsibleRootChangeEventDetails];
  'update:open': [open: boolean];
}>();
const forwarded = useForwardPropsEmits(props, emit);
</script>

<template>
  <Collapsible.Root v-bind="forwarded"><slot /></Collapsible.Root>
</template>
