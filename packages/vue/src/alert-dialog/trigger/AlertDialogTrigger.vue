<script lang="ts">
import type {
  DialogTriggerProps,
  DialogTriggerState,
} from '../../dialog/trigger/DialogTrigger.vue';
import type { AlertDialogHandle } from '../handle';

export interface AlertDialogTriggerProps<Payload = unknown> extends Omit<
  DialogTriggerProps<Payload>,
  'handle'
> {
  /**
   * A handle to associate the trigger with an alert dialog.
   * Can be created with the AlertDialog.createHandle() method.
   */
  handle?: AlertDialogHandle<Payload> | undefined;
}

export interface AlertDialogTriggerState extends DialogTriggerState {}
</script>

<script setup lang="ts" generic="Payload = unknown">
import { computed, useTemplateRef } from 'vue';
import DialogTrigger from '../../dialog/trigger/DialogTrigger.vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AlertDialogTriggerProps<Payload>>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

defineSlots<{
  default(props: { state: AlertDialogTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, AlertDialogTriggerState>;
}>();

// Base UI gives `DialogTrigger` the type of this part. This part renders `Dialog.Trigger` and makes
// no element of its own, so the two triggers have the same DOM. Its own props interface gives the
// API reference the handle of Alert Dialog.
const trigger = useTemplateRef<{ element: HTMLElement | null }>('trigger');
const element = computed(() => trigger.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <DialogTrigger ref="trigger" v-bind="{ ...$attrs, ...props }">
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DialogTrigger>
</template>
