<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { REASONS } from '../../src/internals/reasons';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../src/internals/types';

export interface OpenPartState {
  /** Whether the part is open. */
  open: boolean;
}

export type OpenPartChangeEventReason = typeof REASONS.triggerPress;
export type OpenPartChangeEventDetails = VaseUIChangeEventDetails<OpenPartChangeEventReason>;

export interface OpenPartProps
  extends VaseUIComponentProps<OpenPartState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** Whether the part is open, when it is controlled. */
  open?: boolean | undefined;
  /** Whether the part is open at first, when it is uncontrolled. */
  defaultOpen?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useControlled } from '../../src/common/useControlled';
import { createChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<OpenPartProps>(), {
  as: 'div',
  open: undefined,
  defaultOpen: false,
});

const emit = defineEmits<{
  openChange: [open: boolean, details: OpenPartChangeEventDetails];
  'update:open': [open: boolean];
}>();

defineSlots<{
  default(props: { state: OpenPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, OpenPartState>;
}>();

const [open, setOpen] = useControlled({
  controlled: () => props.open,
  default: () => props.defaultOpen,
  name: 'OpenPart',
  state: 'open',
});

const state = computed<OpenPartState>(() => ({ open: open.value }));

function handleClick(event: MouseEvent) {
  const nextOpen = !open.value;
  const details = createChangeEventDetails(REASONS.triggerPress, event);
  emit('openChange', nextOpen, details);
  if (details.isCanceled) {
    return;
  }
  emit('update:open', nextOpen);
  setOpen(nextOpen);
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ onClick: handleClick }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
