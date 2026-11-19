<script lang="ts">
import type { DialogTriggerProps } from '../../dialog/trigger/DialogTrigger.vue';
import type { DrawerHandle } from '../handle';

export interface DrawerTriggerProps<Payload = unknown> extends Omit<
  DialogTriggerProps<Payload>,
  'handle' | 'payload' | 'id'
> {
  /**
   * A handle to associate the trigger with a drawer.
   * Can be created with the Drawer.createHandle() method.
   */
  handle?: DrawerHandle<Payload> | undefined;
  /**
   * A payload to pass to the drawer when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for drawers in controlled mode (with the Drawer.Root `triggerId` prop).
   */
  id?: string | undefined;
}

export interface DrawerTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the drawer is currently open and was opened by this trigger.
   */
  open: boolean;
}
</script>

<script setup lang="ts" generic="Payload = unknown">
import { computed, useTemplateRef } from 'vue';
import DialogTrigger from '../../dialog/trigger/DialogTrigger.vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerTriggerProps<Payload>>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Drawer.Trigger');
}

defineSlots<{
  default(props: { state: DrawerTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, DrawerTriggerState>;
}>();

// Separate outlets keep the forwarded slot stable across renders.
const trigger = useTemplateRef<{ element: HTMLElement | null }>('trigger');
const element = computed(() => trigger.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <DialogTrigger
    v-if="$slots.render"
    ref="trigger"
    v-bind="{ ...withoutPropsOf($attrs, DialogTrigger), ...props }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </DialogTrigger>
  <DialogTrigger
    v-else
    ref="trigger"
    v-bind="{ ...withoutPropsOf($attrs, DialogTrigger), ...props }"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DialogTrigger>
</template>
