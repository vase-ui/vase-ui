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

export interface GenericOpenPartState {
  /** Whether the part is open. */
  open: boolean;
}

export type GenericOpenPartChangeEventReason = typeof REASONS.triggerPress;
export type GenericOpenPartChangeEventDetails =
  VaseUIChangeEventDetails<GenericOpenPartChangeEventReason>;

export interface GenericOpenPartProps<Open extends boolean | undefined>
  extends
    VaseUIComponentProps<GenericOpenPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the part is open, when it is controlled.
   * Its type follows a generic parameter, as the type of `multiple` does in `Select.Root`.
   */
  open?: (Open & boolean) | undefined;
  /** Whether the part is open at first, when it is uncontrolled. */
  defaultOpen?: boolean | undefined;
}
</script>

<script setup lang="ts" generic="Open extends boolean | undefined = boolean">
import { computed } from 'vue';
import { useControlled } from '../../src/common/useControlled';
import { createChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<GenericOpenPartProps<Open>>(), {
  as: 'div',
  open: undefined,
  defaultOpen: false,
});

const emit = defineEmits<{
  openChange: [open: boolean, details: GenericOpenPartChangeEventDetails];
  'update:open': [open: boolean];
}>();

defineSlots<{
  default(props: { state: GenericOpenPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, GenericOpenPartState>;
}>();

const [open, setOpen] = useControlled({
  controlled: () => props.open,
  default: () => props.defaultOpen,
  name: 'GenericOpenPart',
  state: 'open',
});

const state = computed<GenericOpenPartState>(() => ({ open: open.value }));

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
